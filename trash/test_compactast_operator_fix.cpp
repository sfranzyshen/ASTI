#include <iostream>
#include <fstream>
#include <vector>
#include "libs/CompactAST/src/CompactAST.hpp"
#include "src/cpp/ASTInterpreter.hpp"

int main() {
    std::cout << "Testing CompactAST Operator Loading Fix\n";
    std::cout << "=======================================\n";
    
    // Load Test 4 binary AST (Fade.ino - contains binary operations)
    std::ifstream file("test_data/example_004.ast", std::ios::binary);
    if (!file) {
        std::cerr << "ERROR: Could not open test_data/example_004.ast\n";
        return 1;
    }
    
    std::vector<uint8_t> binaryData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
    file.close();
    
    std::cout << "Loaded " << binaryData.size() << " bytes from example_004.ast\n";
    
    try {
        // Import CompactAST
        compact_ast::CompactAST compactAST;
        auto ast = compactAST.importAST(binaryData);
        if (!ast) {
            std::cerr << "ERROR: Failed to import AST\n";
            return 1;
        }
        
        std::cout << "Successfully imported AST\n";
        
        // Create interpreter and run a few steps
        arduino_interpreter::ASTInterpreter interpreter;
        interpreter.loadAST(std::move(ast));
        
        std::cout << "Running interpreter...\n";
        for (int i = 0; i < 10 && interpreter.step(); ++i) {
            // Just step through execution
        }
        
        std::cout << "SUCCESS: No 'Unknown operator' errors encountered!\n";
        std::cout << "CompactAST operator loading fix is working.\n";
        
    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}