#include <iostream>
#include <fstream>
#include <vector>
#include "libs/CompactAST/src/CompactAST.hpp"

int main() {
    std::cout << "=== Testing CompactAST Structure Fix ===" << std::endl;
    
    // Load a simple test AST file
    std::ifstream file("test_simple.ast", std::ios::binary);
    if (!file.is_open()) {
        std::cout << "ERROR: Could not open test_simple.ast" << std::endl;
        return 1;
    }
    
    // Read the file into memory
    file.seekg(0, std::ios::end);
    size_t size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> buffer(size);
    file.read(reinterpret_cast<char*>(buffer.data()), size);
    file.close();
    
    std::cout << "Loaded " << size << " bytes from test_simple.ast" << std::endl;
    
    try {
        // Parse the CompactAST
        arduino_ast::CompactASTReader reader(buffer.data(), size);
        auto rootNode = reader.parse();
        
        std::cout << "✅ CompactAST parsed successfully!" << std::endl;
        std::cout << "Root node type: " << static_cast<int>(rootNode->getType()) << std::endl;
        
        // Just verify the AST structure was properly created
        std::cout << "Root node children: " << rootNode->getChildren().size() << std::endl;
        
        // Check if we can traverse the structure (basic test)
        if (!rootNode->getChildren().empty()) {
            auto firstChild = rootNode->getChildren()[0].get();
            std::cout << "First child type: " << static_cast<int>(firstChild->getType()) << std::endl;
        }
        
        std::cout << "\n=== CompactAST Structure Test PASSED ===" << std::endl;
        return 0;
        
    } catch (const std::exception& e) {
        std::cout << "❌ ERROR: " << e.what() << std::endl;
        return 1;
    }
}