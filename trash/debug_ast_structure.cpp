#include "libs/CompactAST/src/CompactAST.hpp"
#include <iostream>
#include <fstream>

void analyzeNode(const arduino_ast::ASTNode* node, int depth = 0) {
    if (!node) return;
    
    std::string indent(depth * 2, ' ');
    std::cout << indent << "Node type: " << static_cast<int>(node->getType()) << std::endl;
    
    // If it's a FuncDefNode, analyze its body
    if (node->getType() == arduino_ast::ASTNodeType::FUNC_DEF) {
        auto* funcDef = dynamic_cast<const arduino_ast::FuncDefNode*>(node);
        if (funcDef) {
            std::cout << indent << "  Function found" << std::endl;
            const auto* body = funcDef->getBody();
            if (body) {
                std::cout << indent << "  Body found, analyzing..." << std::endl;
                analyzeNode(body, depth + 2);
            } else {
                std::cout << indent << "  NO BODY!" << std::endl;
            }
        }
    }
    
    // Analyze children
    auto children = node->getChildren();
    std::cout << indent << "Children: " << children.size() << std::endl;
    for (const auto* child : children) {
        analyzeNode(child, depth + 1);
    }
}

int main() {
    std::cout << "=== AST Structure Analysis ===" << std::endl;
    
    // Load AST
    std::ifstream astFile("test_data/example_000.ast", std::ios::binary);
    if (!astFile) {
        std::cerr << "Failed to load example_000.ast" << std::endl;
        return 1;
    }
    
    astFile.seekg(0, std::ios::end);
    size_t size = astFile.tellg();
    astFile.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> astData(size);
    astFile.read(reinterpret_cast<char*>(astData.data()), size);
    
    // Parse AST
    try {
        const auto* root = arduino_ast::CompactAST::deserialize(astData.data(), astData.size());
        if (root) {
            std::cout << "AST loaded successfully" << std::endl;
            analyzeNode(root);
        } else {
            std::cout << "Failed to deserialize AST" << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "Error: " << e.what() << std::endl;
    }
    
    return 0;
}