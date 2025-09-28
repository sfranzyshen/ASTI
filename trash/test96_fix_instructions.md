I can see you're dealing with a very specific and frustrating segmentation fault that occurs right after successful function execution. Let me analyze the code and the issue systematically.

🔍 IMMEDIATE ANALYSIS
Looking at your code and the crash pattern, I can see the issue is happening during the return from executeUserFunction when multiply(15, 2) tries to return the value 30 back to calculate().

🚨 MOST LIKELY CULPRIT: MOVE SEMANTICS CORRUPTION
The problem is likely in your move semantics implementation. When you do:

cpp
CommandValue originalReturnValue = std::move(returnValue_);
// ... later ...
returnValue_ = std::move(originalReturnValue);
You're moving from returnValue_ which leaves it in a valid-but-unspecified state. Then you're moving back into it, but the original move may have corrupted the object.

🔧 IMMEDIATE FIX TO TRY
Replace the dangerous move semantics with safer copy operations:

cpp
// In executeUserFunction, around lines 2607-2609 and 2638:

// SAFER APPROACH: Use copies instead of moves
bool savedShouldReturn = shouldReturn_;
CommandValue savedReturnValue = returnValue_;  // COPY, not move
shouldReturn_ = false;
returnValue_ = std::monostate{};

// ... function execution ...

// Restore using copies
shouldReturn_ = savedShouldReturn;
returnValue_ = savedReturnValue;  // COPY back
🎯 SPECIFIC CODE LOCATION TO FIX
In /src/cpp/ASTInterpreter.cpp, find these lines and make the changes:

Current (Problematic):

cpp
// Lines ~2607-2609:
CommandValue originalReturnValue = std::move(returnValue_);
returnValue_ = std::monostate{};

// Lines ~2638:
returnValue_ = std::move(originalReturnValue);
Change to (Safe):

cpp
// Lines ~2607-2609:
CommandValue savedReturnValue = returnValue_;  // Simple copy
returnValue_ = std::monostate{};

// Lines ~2638:
returnValue_ = savedReturnValue;  // Simple copy back
📋 WHY THIS FIX SHOULD WORK
Move semantics with std::variant can leave objects in invalid states

returnValue_ is a member variable - moving from it corrupts its state

Simple copies are safer for std::variant types with complex held values

The crash happens during stack unwinding - exactly when moved-from objects would be destroyed

🔍 ADDITIONAL DEBUGGING TO CONFIRM
Add this debug output right before the return in executeUserFunction:

cpp
// Right before line 2648 (return result;)
std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: About to return from " << name << std::endl;
std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: Result variant index = " << result.index() << std::endl;
std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: RecursionDepth = " << recursionDepth_ << std::endl;

// Add this to see what's actually in the result
if (std::holds_alternative<int32_t>(result)) {
    std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: Result value = " << std::get<int32_t>(result) << std::endl;
}

return result;
🚀 IMMEDIATE ACTION PLAN
Apply the copy fix to replace the move semantics

Add the debug output to confirm the return value is correct

Run the test immediately:

bash
timeout 10 ./build/extract_cpp_commands 96
If it works, remove the debug output and run full validation

🎯 EXPECTED OUTCOME
This should fix the segmentation fault because:

✅ No more invalid moved-from states

✅ Simple copies are safe for std::variant

✅ returnValue_ member variable remains valid

✅ Stack unwinding can proceed normally

The core logic is already working perfectly - this is just a cleanup/return mechanics issue.

Try this fix immediately - it addresses the exact crash pattern you're seeing during function return!

can you put this into a single file that I can download or in a format that will be easy to save?
Test 96 Segmentation Fault Fix - Complete Solution File
🚨 CRITICAL FIX: Replace Dangerous Move Semantics with Safe Copies
File to Modify: /src/cpp/ASTInterpreter.cpp
📍 Exact Lines to Change (Around Lines 2607-2648)
Replace the current problematic move semantics with safe copy operations:

cpp
// =============================================================================
// FIX: SAFER RETURN VALUE STATE MANAGEMENT
// =============================================================================
// REPLACE LINES ~2607-2609 and ~2638 in executeUserFunction

// ❌ CURRENT (PROBLEMATIC) CODE:
// CommandValue originalReturnValue = std::move(returnValue_);
// returnValue_ = std::monostate{};
// ... later ...
// returnValue_ = std::move(originalReturnValue);

// ✅ FIXED (SAFE) CODE:
bool savedShouldReturn = shouldReturn_;
CommandValue savedReturnValue = returnValue_;  // SAFE COPY instead of move
shouldReturn_ = false;
returnValue_ = std::monostate{};

// ... function execution logic ...

// Restore previous return state using safe copies
shouldReturn_ = savedShouldReturn;
returnValue_ = savedReturnValue;  // SAFE COPY back
📋 Complete Fixed executeUserFunction Section
cpp
CommandValue ASTInterpreter::executeUserFunction(const std::string& name, const arduino_ast::FuncDefNode* funcDef, const std::vector<CommandValue>& args) {
    debugLog("Executing user-defined function: " + name);
    
    // CROSS-PLATFORM FIX: Emit function call command with arguments for user functions too (preserve types)
    // TEST 30 FIX: Use specialized serialEvent function that omits empty arguments
    if (name == "serialEvent") {
        emitCommand(FlexibleCommandFactory::createFunctionCallSerialEvent("Calling serialEvent()"));
    } else {
        emitCommand(FlexibleCommandFactory::createFunctionCall(name, args));
    }
    
    // Track user function call statistics
    auto userFunctionStart = std::chrono::steady_clock::now();
    functionsExecuted_++;
    userFunctionsExecuted_++;
    functionCallCounters_[name]++;
    
    // Track recursion depth
    recursionDepth_++;
    if (recursionDepth_ > maxRecursionDepth_) {
        maxRecursionDepth_ = recursionDepth_;
    }
    
    // Enhanced Error Handling: Stack overflow detection
    // Use instance variable instead of static
    callStack_.clear();
    const size_t MAX_RECURSION_DEPTH = 100; // Prevent infinite recursion
    
    callStack_.push_back(name);
    if (callStack_.size() > MAX_RECURSION_DEPTH) {
        // Use enhanced error handling instead of simple error
        emitStackOverflowError(name, callStack_.size());
        callStack_.pop_back();
        recursionDepth_--;
        
        // Try to recover from error
        if (tryRecoverFromError("StackOverflowError")) {
            return getDefaultValueForType("int"); // Return safe default
        } else {
            return std::monostate{}; // Critical error, stop execution
        }
    }
    
    // Count recursive calls of the same function
    size_t recursiveCallCount = 0;
    for (const auto& funcName : callStack_) {
        if (funcName == name) recursiveCallCount++;
    }
    
    debugLog("Function " + name + " call depth: " + std::to_string(callStack_.size()) + 
             ", recursive calls: " + std::to_string(recursiveCallCount));
    
    // =============================================================================
    // 🚨 CRITICAL FIX: SAFER RETURN VALUE STATE MANAGEMENT
    // =============================================================================
    // ULTRATHINK FIX: Save return state to prevent corruption during nested calls
    // FIXED: Use copies instead of dangerous move semantics
    bool savedShouldReturn = shouldReturn_;
    CommandValue savedReturnValue = returnValue_;  // SAFE COPY instead of move
    shouldReturn_ = false;
    returnValue_ = std::monostate{};
    
    // ULTRATHINK FIX: Save current scope only for nested calls to prevent parameter corruption
    // SEGFAULT FIX: Changed condition - save scope for ALL user function calls that might nest
    std::unordered_map<std::string, Variable> savedScope;
    bool shouldRestoreScope = true; // Always save/restore for user functions
    if (shouldRestoreScope && scopeManager_) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            savedScope = *currentScope;
        }
    }

    // Create new scope for function execution
    scopeManager_->pushScope();
    
    // Handle function parameters - COMPLETE IMPLEMENTATION
    const auto& parameters = funcDef->getParameters();
    if (!parameters.empty()) {
        debugLog("Processing " + std::to_string(parameters.size()) + " function parameters");
        
        // Check parameter count - allow fewer args if defaults are available
        size_t requiredParams = 0;
        for (const auto& param : parameters) {
            const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(param.get());
            if (paramNode && paramNode->getChildren().empty()) { // No default value
                requiredParams++;
            }
        }
        
        if (args.size() < requiredParams || args.size() > parameters.size()) {
            emitError("Function " + name + " expects " + std::to_string(requiredParams) + 
                     "-" + std::to_string(parameters.size()) + " arguments, got " + std::to_string(args.size()));
            scopeManager_->popScope();
            return std::monostate{};
        }
        
        // Process each parameter
        for (size_t i = 0; i < parameters.size(); ++i) {
            const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(parameters[i].get());
            if (paramNode) {
                // Get parameter name from declarator
                const auto* declarator = paramNode->getDeclarator();
                if (const auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
                    std::string paramName = declNode->getName();
                    
                    // Get parameter type from ParamNode
                    std::string paramType = "auto";
                    const auto* typeNode = paramNode->getParamType();
                    if (typeNode) {
                        try {
                            paramType = typeNode->getValueAs<std::string>();
                        } catch (...) {
                            paramType = "auto"; // Fallback
                        }
                    }
                    
                    CommandValue paramValue;
                    
                    // Use provided argument or default value
                    if (i < args.size()) {
                        // Use provided argument
                        paramValue = args[i];
                        if (paramType != "auto") {
                            paramValue = convertToType(args[i], paramType);
                        }
                        debugLog("Parameter: " + paramName + " = " + commandValueToString(args[i]) + " (provided)");
                    } else {
                        // Use default value from parameter node children
                        const auto& children = paramNode->getChildren();
                        if (!children.empty()) {
                            CommandValue defaultValue = evaluateExpression(const_cast<arduino_ast::ASTNode*>(children[0].get()));
                            paramValue = paramType != "auto" ? convertToType(defaultValue, paramType) : defaultValue;
                            debugLog("Parameter: " + paramName + " = " + commandValueToString(defaultValue) + " (default)");
                        } else {
                            // No default value provided - use type default
                            if (paramType == "int" || paramType == "int32_t") {
                                paramValue = static_cast<int32_t>(0);
                            } else if (paramType == "double" || paramType == "float") {
                                paramValue = 0.0;
                            } else if (paramType == "bool") {
                                paramValue = false;
                            } else if (paramType == "String" || paramType == "string") {
                                paramValue = std::string("");
                            } else {
                                paramValue = std::monostate{};
                            }
                            debugLog("Parameter: " + paramName + " = " + commandValueToString(paramValue) + " (type default)");
                        }
                    }
                    
                    // Create parameter variable
                    Variable paramVar(paramValue, paramType);
                    scopeManager_->setVariable(paramName, paramVar);
                    
                } else {
                    debugLog("Parameter " + std::to_string(i) + " has no declarator name");
                }
            } else {
                debugLog("Parameter " + std::to_string(i) + " is not a ParamNode");
            }
        }
    } else {
        debugLog("Function " + name + " has no parameters");
    }
    
    CommandValue result = std::monostate{};

    // Execute function body
    if (funcDef->getBody()) {
        const_cast<arduino_ast::ASTNode*>(funcDef->getBody())->accept(*this);
    }

    // Handle return value
    if (shouldReturn_) {
        result = returnValue_;
        shouldReturn_ = false;
        returnValue_ = std::monostate{};
    }
    
    // Clean up scope and call stack
    scopeManager_->popScope();
    callStack_.pop_back();
    
    // =============================================================================
    // 🚨 CRITICAL FIX: RESTORE USING SAFE COPIES
    // =============================================================================
    // ULTRATHINK FIX: Restore previous scope after nested function execution
    // SEGFAULT FIX: Only restore if we actually saved a scope and it's still valid
    if (shouldRestoreScope && scopeManager_ && !savedScope.empty()) {
        // Only restore if we're not at global scope (which should never be modified)
        if (!scopeManager_->isGlobalScope()) {
            auto currentScope = scopeManager_->getCurrentScope();
            if (currentScope) {
                // Create a new scope with the saved content instead of clearing/inserting
                *currentScope = savedScope;
            }
        }
    }

    // ULTRATHINK FIX: Restore previous return state using safe copies
    shouldReturn_ = savedShouldReturn;
    returnValue_ = savedReturnValue;  // SAFE COPY back instead of move

    // Complete user function timing tracking
    auto userFunctionEnd = std::chrono::steady_clock::now();
    auto userDuration = std::chrono::duration_cast<std::chrono::microseconds>(userFunctionEnd - userFunctionStart);
    functionExecutionTimes_[name] += userDuration;
    
    // Update recursion depth tracking
    recursionDepth_--;
    
    debugLog("User function " + name + " completed with result: " + commandValueToString(result));

    // =============================================================================
    // 🎯 DEBUG OUTPUT TO CONFIRM FIX
    // =============================================================================
    std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: About to return from " << name << std::endl;
    std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: Result variant index = " << result.index() << std::endl;
    std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: RecursionDepth after decrement = " << recursionDepth_ << std::endl;
    
    if (std::holds_alternative<int32_t>(result)) {
        std::cerr << "🎯 EXECUTE_USER_FUNCTION DEBUG: Result value = " << std::get<int32_t>(result) << std::endl;
    }

    return result;
}
🔧 Additional Debugging Support (Optional - Remove After Fix Confirmed)
Add this debug output to track the exact crash point:

cpp
// Add to the very end of executeUserFunction, right before return statement:
std::cerr << "🔍 FUNCTION_RETURN_TRACE: " << name << " returning successfully" << std::endl;
std::cerr << "🔍 FUNCTION_RETURN_TRACE: Result type index: " << result.index() << std::endl;
if (std::holds_alternative<int32_t>(result)) {
    std::cerr << "🔍 FUNCTION_RETURN_TRACE: Integer value: " << std::get<int32_t>(result) << std::endl;
}
std::cerr << "🔍 FUNCTION_RETURN_TRACE: Recursion depth: " << recursionDepth_ << std::endl;
🚀 Quick Test Command
bash
# Apply the fix, then test immediately:
make arduino_ast_interpreter
timeout 10 ./build/extract_cpp_commands 96

# If successful, run full validation:
./run_baseline_validation.sh
📁 Save This File As: test96_fix_instructions.md
Expected Result: This should fix the segmentation fault by replacing dangerous move semantics with safe copy operations, allowing Test 96 to pass and advancing your success rate to 79/135 tests (58.52%).