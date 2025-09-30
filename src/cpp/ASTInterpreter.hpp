/**
 * ASTInterpreter.hpp - C++ Arduino AST Interpreter Core
 * 
 * Main interpreter class that executes parsed AST nodes and generates command streams
 * identical to the JavaScript ASTInterpreter.js implementation. Designed for
 * ESP32-S3 memory constraints and cross-platform compatibility.
 * 
 * Version: 13.0.0
 * Compatible with: ASTInterpreter.js v13.0.0
 * Command Protocol: CommandProtocol.hpp v1.0
 */

#pragma once

#include "ASTNodes.hpp"
#include "CompactAST.hpp"
#include "EnhancedInterpreter.hpp"
#include "ArduinoLibraryRegistry.hpp"
#include "InterpreterConfig.hpp"
#include <memory>
#include <unordered_map>
#include <unordered_set>
#include <stack>
#include <vector>
#include <string>
#include <functional>
#include <chrono>
#include <queue>

namespace arduino_interpreter {

// =============================================================================
// FORWARD DECLARATIONS
// =============================================================================

class ASTInterpreter;
class ScopeManager;
class ArduinoLibraryInterface;
class EnhancedScopeManager;

// =============================================================================
// INTERPRETER CONFIGURATION
// =============================================================================

/**
 * Interpreter configuration options matching JavaScript implementation
 */
struct InterpreterOptions {
    bool verbose = Config::DEFAULT_VERBOSE;           // Debug output
    bool debug = Config::DEFAULT_DEBUG;             // Detailed debug output
    uint32_t stepDelay = 0;         // Delay between steps (ms)
    uint32_t maxLoopIterations = Config::DEFAULT_MAX_LOOP_ITERATIONS;  // Prevent infinite loops
    uint32_t requestTimeout = Config::DEFAULT_TIMEOUT_MS; // Request timeout (ms)
    bool enableSerial = true;       // Enable Serial commands
    bool enablePins = true;         // Enable pin operations
    bool syncMode = false;          // Test mode: immediate sync responses for digitalRead/analogRead
    std::string version = "13.0.0";  // Interpreter version
};

/**
 * Variable representation matching JavaScript dynamic typing
 */
struct Variable {
    CommandValue value;
    std::string type;
    bool isConst = false;
    bool isReference = false;
    bool isStatic = false;
    bool isGlobal = false;
    std::string templateType = "";  // For template instantiations like vector<int>
    Variable* referenceTarget = nullptr;  // For reference variables
    
    Variable() : value(std::monostate{}), type("undefined") {}
    
    template<typename T>
    Variable(const T& val, const std::string& t = "", bool c = false, bool ref = false, bool stat = false, bool glob = false) 
        : value(val), type(t), isConst(c), isReference(ref), isStatic(stat), isGlobal(glob) {}
    
    template<typename T>
    T getValue() const {
        if (isReference && referenceTarget) {
            // Dereference the reference
            if (std::holds_alternative<T>(referenceTarget->value)) {
                return std::get<T>(referenceTarget->value);
            }
            return T{};
        }
        
        if (std::holds_alternative<T>(value)) {
            return std::get<T>(value);
        }
        return T{};
    }
    
    void setValue(const CommandValue& val) {
        if (isConst) {
            // Const variables cannot be modified after initialization
            return;
        }
        
        if (isReference && referenceTarget) {
            // Set value through reference
            referenceTarget->setValue(val);
            return;
        }
        
        value = val;
    }
    
    // Type promotion/demotion utilities
    CommandValue promoteToType(const std::string& targetType) const {
        CommandValue currentVal = isReference && referenceTarget ? referenceTarget->value : value;
        
        if (targetType == "double" || targetType == "float") {
            if (std::holds_alternative<int32_t>(currentVal)) {
                return static_cast<double>(std::get<int32_t>(currentVal));
            } else if (std::holds_alternative<bool>(currentVal)) {
                return static_cast<double>(std::get<bool>(currentVal) ? 1.0 : 0.0);
            }
        } else if (targetType == "int" || targetType == "int32_t") {
            if (std::holds_alternative<double>(currentVal)) {
                return static_cast<int32_t>(std::get<double>(currentVal));
            } else if (std::holds_alternative<bool>(currentVal)) {
                return static_cast<int32_t>(std::get<bool>(currentVal) ? 1 : 0);
            }
        } else if (targetType == "bool") {
            if (std::holds_alternative<int32_t>(currentVal)) {
                return std::get<int32_t>(currentVal) != 0;
            } else if (std::holds_alternative<double>(currentVal)) {
                return std::get<double>(currentVal) != 0.0;
            }
        }
        
        return currentVal;
    }
    
    // Set reference target
    void setReference(Variable* target) {
        if (!isConst) {  // Can't change reference after const initialization
            referenceTarget = target;
            isReference = true;
        }
    }
    
    std::string toString() const {
        std::string modifiers = "";
        if (isConst) modifiers += "const ";
        if (isStatic) modifiers += "static ";
        if (isReference) modifiers += "& ";
        if (isGlobal) modifiers += "global ";
        
        CommandValue displayValue = isReference && referenceTarget ? referenceTarget->value : value;
        std::string typeDisplay = templateType.empty() ? type : templateType;
        
        return modifiers + typeDisplay + " = " + commandValueToString(displayValue);
    }
};

// =============================================================================
// SCOPE MANAGEMENT
// =============================================================================

/**
 * Variable scope management matching JavaScript scope stack
 */
class ScopeManager {
private:
    std::vector<std::unordered_map<std::string, Variable>> scopes_;
    std::unordered_map<std::string, Variable> staticVariables_;  // Static variables persist across scopes
    
public:
    ScopeManager() {
        pushScope(); // Global scope
        markCurrentScopeAsGlobal();
    }
    
    void pushScope() {
        scopes_.emplace_back();
    }
    
    void popScope() {
        if (scopes_.size() > 1) { // Keep global scope
            scopes_.pop_back();
        }
    }
    
    void setVariable(const std::string& name, const Variable& var) {
        Variable newVar = var;

        // Mark as global if we're in global scope
        if (scopes_.size() == 1) {
            newVar.isGlobal = true;
        }

        if (newVar.isStatic) {
            // Static variables go in special storage
            staticVariables_[name] = newVar;
        } else {
            // CRITICAL FIX: Search parent scopes first and update if found
            // This ensures that assignments in functions modify globals, not create locals
            for (auto it = scopes_.rbegin(); it != scopes_.rend(); ++it) {
                auto found = it->find(name);
                if (found != it->end()) {
                    // Variable exists in this scope - update it
                    found->second = newVar;
                    return;
                }
            }
            // Variable doesn't exist anywhere - create in current scope
            scopes_.back()[name] = newVar;
        }
    }
    
    Variable* getVariable(const std::string& name) {
        // First check static variables
        auto staticFound = staticVariables_.find(name);
        if (staticFound != staticVariables_.end()) {
            return &staticFound->second;
        }
        
        // Search from current scope backwards
        for (auto it = scopes_.rbegin(); it != scopes_.rend(); ++it) {
            auto found = it->find(name);
            if (found != it->end()) {
                return &found->second;
            }
        }
        return nullptr;
    }
    
    bool hasVariable(const std::string& name) const {
        // Check static variables first
        if (staticVariables_.find(name) != staticVariables_.end()) {
            return true;
        }
        
        for (auto it = scopes_.rbegin(); it != scopes_.rend(); ++it) {
            if (it->find(name) != it->end()) {
                return true;
            }
        }
        return false;
    }
    
    size_t getScopeDepth() const { return scopes_.size(); }

    // Get current scope for parameter preservation (TEST 96 FIX)
    std::unordered_map<std::string, Variable>* getCurrentScope() {
        return scopes_.empty() ? nullptr : &scopes_.back();
    }

    // TEST 43 ULTRATHINK FIX: Check if variable exists in parent scopes (not current scope)
    bool hasVariableInParentScope(const std::string& name) const {
        // Check static variables first
        if (staticVariables_.find(name) != staticVariables_.end()) {
            return true;
        }

        // Skip current scope (last element) and check parent scopes only
        if (scopes_.size() <= 1) {
            return false; // No parent scopes
        }

        for (auto it = scopes_.rbegin() + 1; it != scopes_.rend(); ++it) {
            if (it->find(name) != it->end()) {
                return true;
            }
        }
        return false;
    }

    // Get total variable count across all scopes
    uint32_t getVariableCount() const {
        uint32_t count = static_cast<uint32_t>(staticVariables_.size());
        for (const auto& scope : scopes_) {
            count += static_cast<uint32_t>(scope.size());
        }
        return count;
    }
    
    bool isGlobalScope() const { return scopes_.size() == 1; }
    
    void markCurrentScopeAsGlobal() {
        // Mark all variables in current scope as global
        if (!scopes_.empty()) {
            for (auto& [name, var] : scopes_.back()) {
                var.isGlobal = true;
            }
        }
    }
    
    // Reference variable support
    bool createReference(const std::string& refName, const std::string& targetName) {
        Variable* target = getVariable(targetName);
        if (!target) return false;
        
        Variable refVar;
        refVar.type = target->type + "&";
        refVar.isReference = true;
        refVar.referenceTarget = target;
        
        setVariable(refName, refVar);
        return true;
    }
    
    // Template variable support
    void setTemplateVariable(const std::string& name, const Variable& var, const std::string& templateSpec) {
        Variable templateVar = var;
        templateVar.templateType = templateSpec;
        setVariable(name, templateVar);
    }
    
    void clear() {
        scopes_.clear();
        staticVariables_.clear();
        pushScope(); // Global scope
    }
};

// =============================================================================
// REQUEST-RESPONSE SYSTEM
// =============================================================================


// =============================================================================
// RAII STATE GUARD FOR NESTED FUNCTION CALLS
// =============================================================================

/**
 * RAII-based state guard for managing return values and scope during nested function calls.
 * This class ensures proper cleanup order during stack unwinding and prevents the segmentation
 * fault that occurs when manual state management happens at wrong levels.
 */
class StateGuard {
private:
    class ASTInterpreter* interpreter_;
    bool savedShouldReturn_;
    CommandValue savedReturnValue_;
    std::unordered_map<std::string, Variable> savedScope_;
    bool hasScope_;

public:
    StateGuard(class ASTInterpreter* interp);
    ~StateGuard();

    // Non-copyable, non-movable to ensure proper RAII semantics
    StateGuard(const StateGuard&) = delete;
    StateGuard& operator=(const StateGuard&) = delete;
    StateGuard(StateGuard&&) = delete;
    StateGuard& operator=(StateGuard&&) = delete;
};

// =============================================================================
// MAIN AST INTERPRETER CLASS
// =============================================================================

/**
 * Main Arduino AST Interpreter class
 * Executes AST nodes and generates command streams
 */
class ASTInterpreter : public arduino_ast::ASTVisitor {
    friend class StateGuard;  // Allow StateGuard to access private members for RAII state management

private:
    // Core state
    arduino_ast::ASTNodePtr ast_;
    InterpreterOptions options_;
    ExecutionState state_;
    
    // Managers
    std::unique_ptr<ScopeManager> scopeManager_;
    std::unique_ptr<EnhancedScopeManager> enhancedScopeManager_;
    std::unique_ptr<ArduinoLibraryInterface> libraryInterface_;  // Legacy - to be deprecated
    std::unique_ptr<ArduinoLibraryRegistry> libraryRegistry_;    // New comprehensive system
    
    // Command handling
    ResponseHandler* responseHandler_;
    
    // ULTRATHINK FIX: Context-Aware Execution Control Stack
    class ExecutionControlStack {
    public:
        enum class ScopeType { SETUP, LOOP, COMPOUND_STMT, FOR_LOOP };
        enum class StopReason { NONE, ITERATION_LIMIT, MANUAL_STOP };

    private:
        struct ExecutionContext {

            ScopeType scope;
            StopReason stopReason;
            bool shouldContinueInParent;
            std::string contextName;  // For debugging

            ExecutionContext(ScopeType s, const std::string& name = "")
                : scope(s), stopReason(StopReason::NONE), shouldContinueInParent(true), contextName(name) {}
        };

        std::stack<ExecutionContext> contextStack_;

    public:
        void pushContext(ScopeType scope, const std::string& name = "") {
            contextStack_.push(ExecutionContext(scope, name));
        }

        void popContext() {
            if (!contextStack_.empty()) contextStack_.pop();
        }

        void setStopReason(StopReason reason, bool continueInParent = false) {
            if (!contextStack_.empty()) {
                contextStack_.top().stopReason = reason;
                contextStack_.top().shouldContinueInParent = continueInParent;
            }
        }

        bool shouldContinueInCurrentScope() {
            return contextStack_.empty() || contextStack_.top().stopReason == StopReason::NONE;
        }

        bool shouldContinueToNextStatement() {
            if (contextStack_.empty()) return true;

            auto& current = contextStack_.top();
            if (current.stopReason == StopReason::ITERATION_LIMIT) {
                // CRITICAL: Test 43 needs individual loop completion to continue to next statement in setup()
                // But Test 17+ need iteration limit in loop() to stop everything
                return current.scope == ScopeType::SETUP && current.shouldContinueInParent;
            }

            return current.stopReason == StopReason::NONE;
        }

        ScopeType getCurrentScope() {
            return contextStack_.empty() ? ScopeType::SETUP : contextStack_.top().scope;
        }

        size_t getDepth() const { return contextStack_.size(); }

        void clear() {
            while (!contextStack_.empty()) contextStack_.pop();
        }
    };

    // Execution control
    bool setupCalled_;
    bool inLoop_;
    uint32_t currentLoopIteration_;
    uint32_t maxLoopIterations_;
    ExecutionControlStack executionControl_;  // ULTRATHINK: Replace shouldContinueExecution_ with context-aware system
    bool shouldContinueExecution_;  // Keep for backward compatibility during transition
    std::chrono::steady_clock::time_point executionStart_;
    
    // Function tracking - MEMORY SAFE: Store function names and look up in AST tree
    arduino_ast::ASTNode* currentFunction_;
    std::unordered_set<std::string> userFunctionNames_;
    
    // Control flow
    bool shouldBreak_;
    bool shouldContinue_;
    bool shouldReturn_;
    CommandValue returnValue_;
    
    // Switch statement state management
    CommandValue currentSwitchValue_;
    bool inSwitchFallthrough_ = false;
    
    // Continuation-based execution system for non-blocking operations
    arduino_ast::ASTNode* suspendedNode_;
    int suspendedChildIndex_;                  // Track child index in CompoundStmtNode for resumption
    arduino_ast::ASTNode* currentCompoundNode_; // Track current compound statement being executed
    int currentChildIndex_;                    // Track current child index being executed
    std::string waitingForRequestId_;
    std::string suspendedFunction_;
    CommandValue lastExpressionResult_;
    ExecutionState previousExecutionState_;
    
    // Request-response system
    std::unordered_map<std::string, CommandValue> pendingResponseValues_;
    std::queue<std::pair<std::string, CommandValue>> responseQueue_;
    
    // =============================================================================
    // INSTANCE VARIABLES (converted from problematic static variables)  
    // =============================================================================
    bool inTick_;                          // Prevent re-entry in tick()
    uint32_t requestIdCounter_;            // For generateRequestId()
    std::vector<std::string> callStack_;   // Function call stack tracking
    int allocationCounter_;                // malloc allocation counter
    int mallocCounter_;                    // malloc request counter
    
    // =============================================================================
    // PERFORMANCE TRACKING & STATISTICS
    // =============================================================================
    
    // Execution profiling
    std::chrono::steady_clock::time_point totalExecutionStart_;
    std::chrono::steady_clock::time_point currentFunctionStart_;
    std::chrono::milliseconds totalExecutionTime_{0};
    std::chrono::milliseconds functionExecutionTime_{0};
    
    // Command generation statistics
    uint32_t commandsGenerated_;
    uint32_t errorsGenerated_;
    std::unordered_map<std::string, uint32_t> commandTypeCounters_;
    
    // Function call statistics
    uint32_t functionsExecuted_;
    uint32_t userFunctionsExecuted_;
    uint32_t arduinoFunctionsExecuted_;
    std::unordered_map<std::string, uint32_t> functionCallCounters_;
    std::unordered_map<std::string, std::chrono::microseconds> functionExecutionTimes_;
    
    // Loop iteration statistics
    uint32_t loopsExecuted_;
    uint32_t totalLoopIterations_;
    std::unordered_map<std::string, uint32_t> loopTypeCounters_; // "for", "while", "do-while"
    uint32_t maxLoopDepth_;
    uint32_t currentLoopDepth_;
    
    // Variable access statistics
    uint32_t variablesAccessed_;
    uint32_t variablesModified_;
    uint32_t arrayAccessCount_;
    uint32_t structAccessCount_;
    std::unordered_map<std::string, uint32_t> variableAccessCounters_;
    std::unordered_map<std::string, uint32_t> variableModificationCounters_;
    
    // Memory usage tracking
    size_t peakVariableMemory_;
    size_t currentVariableMemory_;
    size_t peakCommandMemory_;
    size_t currentCommandMemory_;
    
    // Hardware operation statistics
    uint32_t pinOperations_;
    uint32_t analogReads_;
    uint32_t digitalReads_;
    uint32_t analogWrites_;
    uint32_t digitalWrites_;
    uint32_t serialOperations_;
    
    // Error and performance tracking
    uint32_t recursionDepth_;
    uint32_t maxRecursionDepth_;
    uint32_t timeoutOccurrences_;
    uint32_t memoryAllocations_;
    
    // Enhanced error handling state
    bool safeMode_;
    std::string safeModeReason_;
    uint32_t typeErrors_;
    uint32_t boundsErrors_;
    uint32_t nullPointerErrors_;
    uint32_t stackOverflowErrors_;
    uint32_t memoryExhaustionErrors_;
    size_t memoryLimit_;  // Memory limit for ESP32-S3 (512KB + 8MB PSRAM)

public:
    /**
     * Constructor with AST root node
     */
    explicit ASTInterpreter(arduino_ast::ASTNodePtr ast, 
                           const InterpreterOptions& options = InterpreterOptions{});
    
    /**
     * Constructor with compact binary AST
     */
    explicit ASTInterpreter(const uint8_t* compactAST, size_t size,
                           const InterpreterOptions& options = InterpreterOptions{});
    
    ~ASTInterpreter();
    
    // Non-copyable, movable
    ASTInterpreter(const ASTInterpreter&) = delete;
    ASTInterpreter& operator=(const ASTInterpreter&) = delete;
    ASTInterpreter(ASTInterpreter&&) = default;
    ASTInterpreter& operator=(ASTInterpreter&&) = default;
    
    // =============================================================================
    // EXECUTION CONTROL
    // =============================================================================
    
    /**
     * Start interpreter execution
     * @return true if started successfully
     */
    bool start();
    
    /**
     * Stop interpreter execution
     */
    void stop();
    
    /**
     * Pause execution (can be resumed)
     */
    void pause();
    
    /**
     * Resume paused execution
     */
    void resume();
    
    /**
     * Execute single step (for debugging)
     */
    bool step();
    
    /**
     * State machine execution loop
     */
    void tick();
    
    /**
     * Resume execution with external data response
     * @param requestId The request ID that this response is for
     * @param value The value to resume execution with
     * @return true if the response was accepted
     */
    bool resumeWithValue(const std::string& requestId, const CommandValue& value);
    
    /**
     * Check if interpreter is running
     */
    bool isRunning() const { return state_ == ExecutionState::RUNNING; }
    
    /**
     * Check if interpreter is waiting for response
     */
    bool isWaitingForResponse() const;
    
    /**
     * Get current execution state
     */
    ExecutionState getState() const { return state_; }
    
    // =============================================================================
    // EVENT HANDLERS
    // =============================================================================
    
    // Command listener removed - FlexibleCommand infrastructure eliminated
    
    /**
     * Set response handler for request-response operations
     */
    void setResponseHandler(ResponseHandler* handler) { responseHandler_ = handler; }
    
    /**
     * Handle response from external system
     */
    bool handleResponse(const std::string& requestId, const CommandValue& value);
    
    /**
     * Queue a response for later processing (thread-safe)
     */
    void queueResponse(const std::string& requestId, const CommandValue& value);
    
    /**
     * Process queued responses (called by tick())
     */
    void processResponseQueue();
    
    // =============================================================================
    // VISITOR PATTERN IMPLEMENTATION
    // =============================================================================
    
    void visit(arduino_ast::ProgramNode& node) override;
    void visit(arduino_ast::ErrorNode& node) override;
    void visit(arduino_ast::CommentNode& node) override;
    
    void visit(arduino_ast::CompoundStmtNode& node) override;
    void visit(arduino_ast::ExpressionStatement& node) override;
    void visit(arduino_ast::IfStatement& node) override;
    void visit(arduino_ast::WhileStatement& node) override;
    void visit(arduino_ast::DoWhileStatement& node) override;
    void visit(arduino_ast::ForStatement& node) override;
    void visit(arduino_ast::RangeBasedForStatement& node) override;
    void visit(arduino_ast::SwitchStatement& node) override;
    void visit(arduino_ast::CaseStatement& node) override;
    void visit(arduino_ast::ReturnStatement& node) override;
    void visit(arduino_ast::BreakStatement& node) override;
    void visit(arduino_ast::ContinueStatement& node) override;
    
    void visit(arduino_ast::BinaryOpNode& node) override;
    void visit(arduino_ast::UnaryOpNode& node) override;
    void visit(arduino_ast::FuncCallNode& node) override;
    void visit(arduino_ast::ConstructorCallNode& node) override;
    void visit(arduino_ast::MemberAccessNode& node) override;
    void visit(arduino_ast::AssignmentNode& node) override;
    void visit(arduino_ast::PostfixExpressionNode& node) override;
    void visit(arduino_ast::ArrayAccessNode& node) override;
    void visit(arduino_ast::TernaryExpressionNode& node) override;
    void visit(arduino_ast::CommaExpression& node) override;
    
    void visit(arduino_ast::NumberNode& node) override;
    void visit(arduino_ast::StringLiteralNode& node) override;
    void visit(arduino_ast::CharLiteralNode& node) override;
    void visit(arduino_ast::IdentifierNode& node) override;
    void visit(arduino_ast::ConstantNode& node) override;
    void visit(arduino_ast::ArrayInitializerNode& node) override;
    
    void visit(arduino_ast::EmptyStatement& node) override;
    
    void visit(arduino_ast::VarDeclNode& node) override;
    void visit(arduino_ast::FuncDefNode& node) override;
    void visit(arduino_ast::TypeNode& node) override;
    void visit(arduino_ast::DeclaratorNode& node) override;
    void visit(arduino_ast::ParamNode& node) override;
    void visit(arduino_ast::FunctionPointerDeclaratorNode& node) override;
    void visit(arduino_ast::ArrayDeclaratorNode& node) override;
    void visit(arduino_ast::PointerDeclaratorNode& node) override;
    void visit(arduino_ast::StructDeclaration& node) override;
    void visit(arduino_ast::TypedefDeclaration& node) override;
    void visit(arduino_ast::StructType& node) override;
    
    // Missing AST node types for JavaScript compatibility
    void visit(arduino_ast::NamespaceAccessNode& node) override;
    void visit(arduino_ast::CppCastNode& node) override;
    void visit(arduino_ast::FunctionStyleCastNode& node) override;
    void visit(arduino_ast::WideCharLiteralNode& node) override;
    void visit(arduino_ast::DesignatedInitializerNode& node) override;
    void visit(arduino_ast::FuncDeclNode& node) override;
    
    // JavaScript-compatible node types (added for cross-platform parity)
    void visit(arduino_ast::ConstructorDeclarationNode& node) override;
    void visit(arduino_ast::EnumMemberNode& node) override;
    void visit(arduino_ast::EnumTypeNode& node) override;
    void visit(arduino_ast::LambdaExpressionNode& node) override;
    void visit(arduino_ast::MemberFunctionDeclarationNode& node) override;
    void visit(arduino_ast::MultipleStructMembersNode& node) override;
    void visit(arduino_ast::NewExpressionNode& node) override;
    void visit(arduino_ast::PreprocessorDirectiveNode& node) override;
    void visit(arduino_ast::RangeExpressionNode& node) override;
    void visit(arduino_ast::StructMemberNode& node) override;
    void visit(arduino_ast::TemplateTypeParameterNode& node) override;
    void visit(arduino_ast::UnionDeclarationNode& node) override;
    void visit(arduino_ast::UnionTypeNode& node) override;
    
    // =============================================================================
    // UTILITY METHODS
    // =============================================================================
    
    /**
     * Get memory usage statistics
     */
    struct MemoryStats {
        size_t totalMemory;
        size_t variableMemory;
        size_t astMemory;
        size_t commandMemory;
        size_t peakVariableMemory;
        size_t peakCommandMemory;
        uint32_t variableCount;
        uint32_t pendingRequests;
        uint32_t memoryAllocations;
    };
    
    MemoryStats getMemoryStats() const;
    
    /**
     * Get execution statistics
     */
    struct ExecutionStats {
        std::chrono::milliseconds totalExecutionTime;
        std::chrono::milliseconds functionExecutionTime;
        uint32_t commandsGenerated;
        uint32_t errorsGenerated;
        uint32_t functionsExecuted;
        uint32_t userFunctionsExecuted;
        uint32_t arduinoFunctionsExecuted;
        uint32_t loopsExecuted;
        uint32_t totalLoopIterations;
        uint32_t maxLoopDepth;
        uint32_t variablesAccessed;
        uint32_t variablesModified;
        uint32_t arrayAccessCount;
        uint32_t structAccessCount;
        uint32_t maxRecursionDepth;
    };
    
    ExecutionStats getExecutionStats() const;
    
    /**
     * Get hardware operation statistics
     */
    struct HardwareStats {
        uint32_t pinOperations;
        uint32_t analogReads;
        uint32_t digitalReads;
        uint32_t analogWrites;
        uint32_t digitalWrites;
        uint32_t serialOperations;
        uint32_t timeoutOccurrences;
    };
    
    HardwareStats getHardwareStats() const;
    
    /**
     * Get function call frequency statistics
     */
    struct FunctionCallStats {
        std::unordered_map<std::string, uint32_t> callCounts;
        std::unordered_map<std::string, std::chrono::microseconds> executionTimes;
        std::string mostCalledFunction;
        std::string slowestFunction;
    };
    
    FunctionCallStats getFunctionCallStats() const;
    
    /**
     * Get variable access frequency statistics
     */
    struct VariableAccessStats {
        std::unordered_map<std::string, uint32_t> accessCounts;
        std::unordered_map<std::string, uint32_t> modificationCounts;
        std::string mostAccessedVariable;
        std::string mostModifiedVariable;
    };
    
    VariableAccessStats getVariableAccessStats() const;
    
    /**
     * Get enhanced error handling statistics
     */
    struct ErrorStats {
        bool safeMode;
        std::string safeModeReason;
        uint32_t typeErrors;
        uint32_t boundsErrors;
        uint32_t nullPointerErrors;
        uint32_t stackOverflowErrors;
        uint32_t memoryExhaustionErrors;
        uint32_t totalErrors;
        size_t memoryLimit;
        size_t memoryUsed;
        double errorRate; // Errors per command generated
    };
    
    ErrorStats getErrorStats() const;
    
    /**
     * Reset all performance statistics
     */
    void resetStatistics();
    
    // =============================================================================
    // TYPE CONVERSION UTILITIES (Public for ArduinoLibraryInterface)
    // =============================================================================
    
    int32_t convertToInt(const CommandValue& value);
    double convertToDouble(const CommandValue& value);
    std::string convertToString(const CommandValue& value);
    bool convertToBool(const CommandValue& value);
    bool isNumeric(const CommandValue& value);
    
    // =============================================================================
    // ENHANCED ERROR HANDLING
    // =============================================================================
    
    /**
     * Type validation and error reporting
     */
    bool validateType(const CommandValue& value, const std::string& expectedType, 
                     const std::string& context = "");
    bool validateArrayBounds(const CommandValue& array, int32_t index, 
                           const std::string& arrayName = "");
    bool validatePointer(const CommandValue& pointer, const std::string& context = "");
    bool validateMemoryLimit(size_t requestedSize, const std::string& context = "");
    
    /**
     * Enhanced error reporting with context
     */
    void emitTypeError(const std::string& context, const std::string& expectedType, 
                      const std::string& actualType);
    void emitBoundsError(const std::string& arrayName, int32_t index, 
                        int32_t arraySize);
    void emitNullPointerError(const std::string& context);
    void emitStackOverflowError(const std::string& functionName, size_t depth);
    void emitMemoryExhaustionError(const std::string& context, size_t requested, 
                                  size_t available);
    
    /**
     * Error recovery and graceful degradation
     */
    bool tryRecoverFromError(const std::string& errorType);
    CommandValue getDefaultValueForType(const std::string& type);
    void enterSafeMode(const std::string& reason);
    
private:
    // =============================================================================
    // INTERNAL EXECUTION METHODS
    // =============================================================================
    
    void initializeInterpreter();
    void executeProgram();
    void executeGlobalVariables();
    void executeSetup();
    void executeLoop();
    void executeFunctions();
    
    // Expression evaluation
    CommandValue evaluateExpression(arduino_ast::ASTNode* expr);
    CommandValue evaluateBinaryOperation(const std::string& op, const CommandValue& left, const CommandValue& right);
    CommandValue evaluateUnaryOperation(const std::string& op, const CommandValue& operand);
    CommandValue evaluateComparison(const std::string& op, const CommandValue& left, const CommandValue& right);
    CommandValue evaluateLogical(const std::string& op, const CommandValue& left, const CommandValue& right);
    
    // Arduino function handling
    CommandValue executeArduinoFunction(const std::string& name, const std::vector<CommandValue>& args);
    CommandValue executeUserFunction(const std::string& name, const arduino_ast::FuncDefNode* funcDef, const std::vector<CommandValue>& args);
    CommandValue handlePinOperation(const std::string& function, const std::vector<CommandValue>& args);
    CommandValue handleTimingOperation(const std::string& function, const std::vector<CommandValue>& args);

    // Deterministic mock value generation for cross-platform consistency
    int32_t getDeterministicDigitalReadValue(int32_t pin);
    int32_t getDeterministicAnalogReadValue(int32_t pin);
    uint32_t getDeterministicMillisValue();
    uint32_t getDeterministicMicrosValue();
    static void resetStaticTimingCounters();
    CommandValue handleSerialOperation(const std::string& function, const std::vector<CommandValue>& args);
    CommandValue handleMultipleSerialOperation(const std::string& portName, const std::string& methodName, const std::vector<CommandValue>& args);
    
    // Helper methods for Serial system
    std::string generateRequestId(const std::string& prefix);
    
    // External data functions using continuation pattern
    void requestAnalogRead(int32_t pin);
    void requestDigitalRead(int32_t pin);
    void requestMillis();
    void requestMicros();
    
    // Continuation helpers
    bool hasResponse(const std::string& requestId) const;
    CommandValue consumeResponse(const std::string& requestId);
    
    // JSON emission (replacing FlexibleCommand)
    void emitJSON(const std::string& jsonString);
    void emitVersionInfo(const std::string& component, const std::string& version, const std::string& status);
    void emitProgramStart();
    void emitProgramEnd(const std::string& message);
    void emitSetupStart();
    void emitSetupEnd();
    void emitLoopStart(const std::string& type, int iteration = 0);
    void emitFunctionCall(const std::string& function, const std::string& message, int iteration = 0, bool completed = false);
    void emitFunctionCall(const std::string& function, const std::vector<std::string>& arguments);
    void emitFunctionCall(const std::string& function, const std::vector<CommandValue>& arguments);
    void emitError(const std::string& message, const std::string& type = "RuntimeError");

    // Arduino hardware commands
    void emitAnalogReadRequest(int pin, const std::string& requestId);
    void emitDigitalReadRequest(int pin, const std::string& requestId);
    void emitDigitalWrite(int pin, int value);
    void emitAnalogWrite(int pin, int value);
    void emitPinMode(int pin, int mode);
    void emitDelay(int duration);
    void emitDelayMicroseconds(int duration);

    // Legacy emitCommand removed - FlexibleCommand infrastructure eliminated

    // Serial communication
    void emitSerialBegin(int baudRate);
    void emitSerialPrint(const std::string& data);
    void emitSerialPrint(const std::string& data, const std::string& format);  // Overload
    void emitSerialPrintln(const std::string& data);
    void emitSerialWrite(const std::string& data);  // Changed from int to string
    void emitSerialFlush();
    void emitSerialRequest(const std::string& type, const std::string& requestId);  // Added type parameter
    void emitSerialTimeout(int timeout);
    void emitSerialEvent(const std::string& message);

    // Variable operations
    void emitVarSet(const std::string& variable, const std::string& value);
    void emitVarSetConst(const std::string& variable, const std::string& value, const std::string& type);
    void emitVarSetConstString(const std::string& varName, const std::string& stringVal);
    void emitVarSetArduinoString(const std::string& varName, const std::string& stringVal);
    void emitVarSetExtern(const std::string& variable, const std::string& value);

    // Loop and control flow
    void emitLoopEnd(const std::string& message, int iterations);
    void emitFunctionCallLoop(int iteration, bool completed);
    void emitForLoopStart();
    void emitWhileLoopStart();
    void emitWhileLoopEnd(int iteration);

    // Audio
    void emitTone(int pin, int frequency);
    void emitToneWithDuration(int pin, int frequency, int duration);
    void emitNoTone(int pin);

    // Additional emission methods to replace ALL FlexibleCommandFactory calls
    void emitIfStatement(const std::string& condition, const std::string& conditionDisplay, const std::string& branch);
    void emitWhileLoopIteration(int iteration);
    void emitDoWhileLoopStart();
    void emitDoWhileLoopIteration(int iteration);
    void emitDoWhileLoopEnd(int iteration);
    void emitForLoopIteration(int iteration);
    void emitForLoopEnd(int iteration, int maxIterations);
    void emitBreakStatement();
    void emitContinueStatement();
    void emitSwitchStatement(const std::string& discriminant);
    void emitSwitchCase(const std::string& caseValue, bool shouldExecute);

    // Multi-Serial
    void emitMultiSerialBegin(const std::string& portName, int baudRate);
    void emitMultiSerialPrint(const std::string& portName, const std::string& output, const std::string& format);
    void emitMultiSerialPrintln(const std::string& portName, const std::string& data, const std::string& format);
    void emitMultiSerialRequest(const std::string& portName, const std::string& method, const std::string& requestId);
    void emitMultiSerialCommand(const std::string& portName, const std::string& methodName);

    // PulseIn and timing
    void emitPulseInRequest(int pin, int value, int timeout, const std::string& requestId);
    void emitMillisRequest();
    void emitMicrosRequest();
    void emitSerialRequestWithChar(const std::string& type, char terminator, const std::string& requestId);

    // Advanced C++ features
    void emitConstructorRegistered(const std::string& constructorName);
    void emitEnumMember(const std::string& memberName, int memberValue);
    void emitEnumTypeRef(const std::string& enumName);
    void emitLambdaFunction(const std::string& captures, const std::string& parameters, const std::string& body);
    void emitMemberFunctionRegistered(const std::string& className, const std::string& functionName);
    void emitMultipleStructMembers(const std::string& memberNames, const std::string& typeName);
    void emitObjectInstance(const std::string& typeName, const std::string& args);
    void emitPreprocessorError(const std::string& directive, const std::string& errorMessage);
    void emitRangeExpression(const std::string& start, const std::string& end);
    void emitStructMember(const std::string& memberName, const std::string& typeName, int size);
    void emitTemplateTypeParam(const std::string& parameterName, const std::string& constraint);
    void emitUnionDefinition(const std::string& unionName, const std::string& members, const std::string& variables);
    void emitUnionTypeRef(const std::string& typeName, int defaultSize);

    // Request handling
    CommandValue waitForResponse(const std::string& requestId);
    void processRequestQueue();
    
    // Control flow helpers
    void enterLoop(const std::string& loopType);
    void exitLoop(const std::string& loopType);
    bool checkLoopLimit();
    void resetControlFlow();
    
    // Memory management
    void cleanupExpiredRequests();
    void optimizeMemoryUsage();
    
    // Debug and logging
    void debugLog(const std::string& message);
    void verboseLog(const std::string& message);
    void logExecutionState(const std::string& context);
    
    // Type conversion utilities
    CommandValue convertToType(const CommandValue& value, const std::string& typeName);
    
    // MEMORY SAFE: AST tree traversal to find function definitions
    arduino_ast::ASTNode* findFunctionInAST(const std::string& functionName);
};

// =============================================================================
// ARDUINO LIBRARY INTERFACE
// =============================================================================

/**
 * Interface for Arduino library functions
 * Handles library method calls and object management
 */
class ArduinoLibraryInterface {
private:
    ASTInterpreter* interpreter_;
    std::unordered_map<std::string, std::function<CommandValue(const std::vector<CommandValue>&)>> functions_;
    
public:
    explicit ArduinoLibraryInterface(ASTInterpreter* interpreter) : interpreter_(interpreter) {
        registerStandardFunctions();
    }
    
    /**
     * Call library function
     */
    CommandValue callFunction(const std::string& name, const std::vector<CommandValue>& args);
    
    /**
     * Register custom function
     */
    void registerFunction(const std::string& name, 
                         std::function<CommandValue(const std::vector<CommandValue>&)> func);
    
    /**
     * Check if function exists
     */
    bool hasFunction(const std::string& name) const;
    
private:
    void registerStandardFunctions();
    void registerArduinoCoreFunctions();
    void registerMathFunctions();
    void registerStringFunctions();
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Helper function to convert CommandValue to JSON string representation
 */
std::string commandValueToJsonString(const CommandValue& value);

/**
 * Create interpreter from JavaScript-generated compact AST
 */
std::unique_ptr<ASTInterpreter> createInterpreterFromCompactAST(
    const uint8_t* data, size_t size, 
    const InterpreterOptions& options = InterpreterOptions{});

/**
 * Cross-platform compatibility helpers
 */
namespace compat {
    /**
     * Convert JavaScript number to appropriate C++ type
     */
    CommandValue convertJSNumber(double jsNumber);
    
    /**
     * Handle JavaScript-style type coercion
     */
    bool jsTypeCoercionToBool(const CommandValue& value);
    double jsTypeCoercionToNumber(const CommandValue& value);
    std::string jsTypeCoercionToString(const CommandValue& value);
}

} // namespace arduino_interpreter
