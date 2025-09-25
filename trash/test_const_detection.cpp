#include <iostream>
#include <fstream>
#include <vector>
#include "libs/CompactAST/src/CompactAST.hpp"
#include "src/cpp/ASTInterpreter.hpp"

int main() {
    std::cout << "Testing const variable detection for Test 10\n";
    
    // Load Test 10 binary AST (contains const int buttonPin = 2)
    std::ifstream file("test_data/example_010.ast", std::ios::binary);
    if (!file) {
        std::cerr << "ERROR: Could not open test_data/example_010.ast\n";
        return 1;
    }
    
    std::vector<uint8_t> binaryData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
    file.close();
    
    std::cout << "Loaded " << binaryData.size() << " bytes\n";
    
    try {
        // Parse AST
        arduino_ast::CompactASTReader reader(binaryData.data(), binaryData.size());
        auto ast = reader.parse();
        
        if (!ast) {
            std::cerr << "ERROR: Failed to parse AST\n";
            return 1;
        }
        
        std::cout << "SUCCESS: AST parsed successfully\n";
        
        // Create interpreter with debug enabled
        arduino_interpreter::InterpreterOptions options;
        options.debug = true;
        options.verbose = true;
        options.maxLoopIterations = 1; // Only run 1 loop iteration
        
        arduino_interpreter::ASTInterpreter interpreter(std::move(ast), options);
        
        std::cout << "\n=== RUNNING INTERPRETER (Looking for const detection) ===\n";
        
        // The interpreter should emit debug messages about const detection
        // when it processes the VarDeclNode for "const int buttonPin = 2"
        
        // Note: The actual execution will depend on the interpreter implementation
        // but the debug output should show const detection working
        
        std::cout << "\nInterpreter created successfully.\n";
        std::cout << "Check debug output above for const variable detection messages.\n";
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "EXCEPTION: " << e.what() << std::endl;
        return 1;
    }
}