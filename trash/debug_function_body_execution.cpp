#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// Custom interpreter to debug function body execution
class DebugBodyExecutionInterpreter : public ASTInterpreter {
public:
    DebugBodyExecutionInterpreter(const uint8_t* astData, size_t astSize, const InterpreterOptions& options)
        : ASTInterpreter(astData, astSize, options) {}
    
    void visit(arduino_ast::FuncDefNode& node) override {
        std::cout << "DEBUG: visit(FuncDefNode) called" << std::endl;
        
        // Get function name
        std::string funcName = "unknown";
        auto* declarator = node.getDeclarator();
        if (auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
            funcName = declNode->getName();
        } else if (auto* identNode = dynamic_cast<const arduino_ast::IdentifierNode*>(declarator)) {
            funcName = identNode->getName();
        }
        
        std::cout << "DEBUG: Function name: " << funcName << std::endl;
        
        // Check if function has a body
        const auto* body = node.getBody();
        if (body) {
            std::cout << "DEBUG: Function " << funcName << " HAS a body, type: " << static_cast<int>(body->getType()) << std::endl;
            
            if (funcName == "setup" || funcName == "loop") {
                std::cout << "DEBUG: About to visit " << funcName << " body..." << std::endl;
                const_cast<arduino_ast::ASTNode*>(body)->accept(*this);
                std::cout << "DEBUG: Finished visiting " << funcName << " body" << std::endl;
            }
        } else {
            std::cout << "DEBUG: Function " << funcName << " has NO body!" << std::endl;
        }
        
        // Call parent implementation
        ASTInterpreter::visit(node);
    }
    
    void visit(arduino_ast::FuncCallNode& node) override {
        std::cout << "DEBUG: visit(FuncCallNode) called" << std::endl;
        
        // Get function name
        std::string functionName = "unknown";
        if (const auto* identifier = dynamic_cast<const arduino_ast::IdentifierNode*>(node.getCallee())) {
            functionName = identifier->getName();
        } else if (const auto* memberAccess = dynamic_cast<const arduino_ast::MemberAccessNode*>(node.getCallee())) {
            if (const auto* objectId = dynamic_cast<const arduino_ast::IdentifierNode*>(memberAccess->getObject())) {
                if (const auto* propertyId = dynamic_cast<const arduino_ast::IdentifierNode*>(memberAccess->getProperty())) {
                    functionName = objectId->getName() + "." + propertyId->getName();
                }
            }
        }
        
        std::cout << "DEBUG: Function call: " << functionName << std::endl;
        
        // Call parent implementation
        ASTInterpreter::visit(node);
        
        std::cout << "DEBUG: visit(FuncCallNode) completed for " << functionName << std::endl;
    }
    
    void visit(arduino_ast::CompoundStmtNode& node) override {
        std::cout << "DEBUG: visit(CompoundStmtNode) called" << std::endl;
        
        // Call parent implementation
        ASTInterpreter::visit(node);
        
        std::cout << "DEBUG: visit(CompoundStmtNode) completed" << std::endl;
    }
    
    void visit(arduino_ast::VarDeclNode& node) override {
        std::cout << "DEBUG: visit(VarDeclNode) called" << std::endl;
        
        // Call parent implementation  
        ASTInterpreter::visit(node);
    }
    
    void visit(arduino_ast::AssignmentNode& node) override {
        std::cout << "DEBUG: visit(AssignmentNode) called" << std::endl;
        
        // Call parent implementation
        ASTInterpreter::visit(node);
    }
};

int main() {
    std::cout << "=== Debug Function Body Execution ===" << std::endl;
    
    // Load AnalogReadSerial example (has Arduino function calls)
    std::vector<uint8_t> astData;
    std::ifstream astFile("test_data/example_000.ast", std::ios::binary);
    if (!astFile) {
        std::cerr << "Failed to load example_000.ast" << std::endl;
        return 1;
    }
    
    astFile.seekg(0, std::ios::end);
    size_t size = astFile.tellg();
    astFile.seekg(0, std::ios::beg);
    astData.resize(size);
    astFile.read(reinterpret_cast<char*>(astData.data()), size);
    
    // Create debug interpreter
    InterpreterOptions options;
    options.verbose = false;
    options.debug = false;
    options.maxLoopIterations = 1;
    
    auto interpreter = std::make_unique<DebugBodyExecutionInterpreter>(astData.data(), astData.size(), options);
    if (!interpreter) {
        std::cerr << "Failed to create debug interpreter" << std::endl;
        return 1;
    }
    
    std::cout << "DEBUG: About to start interpreter execution..." << std::endl;
    
    // Execute with timeout
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    std::cout << "DEBUG: Interpreter execution completed" << std::endl;
    std::cout << "Success: " << result.success << std::endl;
    std::cout << "Commands generated: " << result.commandCount << std::endl;
    
    if (!result.error.empty()) {
        std::cout << "Error: " << result.error << std::endl;
    }
    
    return 0;
}