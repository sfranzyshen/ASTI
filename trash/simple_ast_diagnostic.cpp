#include "libs/CompactAST/src/CompactAST.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_ast;

void printNodeType(ASTNodeType type) {
    switch(type) {
        case ASTNodeType::FUNC_CALL: std::cout << "FUNC_CALL"; break;
        case ASTNodeType::FUNC_DEF: std::cout << "FUNC_DEF"; break;
        case ASTNodeType::BLOCK: std::cout << "BLOCK"; break;
        case ASTNodeType::IDENTIFIER: std::cout << "IDENTIFIER"; break;
        case ASTNodeType::NUMBER: std::cout << "NUMBER"; break;
        case ASTNodeType::PROGRAM: std::cout << "PROGRAM"; break;
        default: std::cout << "TYPE_" << static_cast<int>(type); break;
    }
}

void walkAST(const ASTNode* node, int depth = 0) {
    if (!node) return;
    
    std::string indent(depth * 2, ' ');
    std::cout << indent;
    printNodeType(node->getType());
    std::cout << std::endl;
    
    // Get all children safely
    std::vector<const ASTNode*> children;
    try {
        if (node->getType() == ASTNodeType::FUNC_DEF) {
            auto* funcDef = dynamic_cast<const FuncDefNode*>(node);
            if (funcDef) {
                std::cout << indent << "  Function name: ";
                auto* declarator = funcDef->getDeclarator();
                if (auto* declNode = dynamic_cast<const DeclaratorNode*>(declarator)) {
                    std::cout << declNode->getName();
                } else if (auto* identNode = dynamic_cast<const IdentifierNode*>(declarator)) {
                    std::cout << identNode->getName();
                }
                std::cout << std::endl;
                
                const auto* body = funcDef->getBody();
                if (body) {
                    std::cout << indent << "  Body:" << std::endl;
                    walkAST(body, depth + 2);
                } else {
                    std::cout << indent << "  NO BODY!" << std::endl;
                }
                return; // Don't process other children
            }
        } else if (node->getType() == ASTNodeType::FUNC_CALL) {
            auto* funcCall = dynamic_cast<const FuncCallNode*>(node);
            if (funcCall) {
                std::cout << indent << "  Function call: ";
                const auto* callee = funcCall->getCallee();
                if (auto* identNode = dynamic_cast<const IdentifierNode*>(callee)) {
                    std::cout << identNode->getName();
                }
                std::cout << std::endl;
            }
        }
        
        // Process regular children
        auto nodeChildren = node->getChildren();
        for (const auto* child : nodeChildren) {
            walkAST(child, depth + 1);
        }
    } catch (const std::exception& e) {
        std::cout << indent << "  Error: " << e.what() << std::endl;
    }
}

int main() {
    std::cout << "=== Simple AST Diagnostic ===" << std::endl;
    
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
    
    try {
        const auto* root = CompactAST::deserialize(astData.data(), astData.size());
        if (root) {
            std::cout << "AST loaded successfully, analyzing structure..." << std::endl;
            walkAST(root);
        } else {
            std::cout << "Failed to deserialize AST" << std::endl;
        }
    } catch (const std::exception& e) {
        std::cout << "Error: " << e.what() << std::endl;
    }
    
    return 0;
}