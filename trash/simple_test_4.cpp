#include <iostream>
#include <fstream>
#include <vector>
#include "libs/CompactAST/src/CompactAST.hpp"

int main() {
    std::cout << "Testing CompactAST Import for Test 4\n";
    
    // Load Test 4 binary AST
    std::ifstream file("test_data/example_004.ast", std::ios::binary);
    if (!file) {
        std::cerr << "ERROR: Could not open test_data/example_004.ast\n";
        return 1;
    }
    
    std::vector<uint8_t> binaryData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
    file.close();
    
    std::cout << "Loaded " << binaryData.size() << " bytes\n";
    
    try {
        arduino_ast::CompactASTReader reader(binaryData.data(), binaryData.size());
        auto ast = reader.parse();
        if (ast) {
            std::cout << "SUCCESS: AST imported successfully\n";
            std::cout << "Root node type: " << ast->getType() << std::endl;
        } else {
            std::cout << "ERROR: Failed to import AST\n";
            return 1;
        }
    } catch (const std::exception& e) {
        std::cerr << "EXCEPTION: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}