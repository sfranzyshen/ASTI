#define DEBUG_OUT std::cerr

#include "libs/CompactAST/src/CompactAST.hpp"
#include "src/cpp/ASTNodes.hpp"
#include <iostream>
#include <memory>
#include <fstream>
#include <vector>

using namespace arduino_ast;

const char* getNodeTypeName(ASTNodeType type) {
    switch (type) {
        case ASTNodeType::PROGRAM: return "PROGRAM";
        case ASTNodeType::ERROR_NODE: return "ERROR_NODE";
        case ASTNodeType::COMMENT: return "COMMENT";
        case ASTNodeType::COMPOUND_STMT: return "COMPOUND_STMT";
        case ASTNodeType::EXPRESSION_STMT: return "EXPRESSION_STMT";
        case ASTNodeType::VAR_DECL: return "VAR_DECL";
        case ASTNodeType::FUNC_DEF: return "FUNC_DEF";
        case ASTNodeType::BINARY_OP: return "BINARY_OP";
        case ASTNodeType::UNARY_OP: return "UNARY_OP";
        case ASTNodeType::ASSIGNMENT: return "ASSIGNMENT";
        case ASTNodeType::FUNC_CALL: return "FUNC_CALL";
        default: return "UNKNOWN";
    }
}

void printAllNodes(const ASTNode* node, int depth = 0) {
    if (!node) return;
    
    std::string indent(depth * 2, ' ');
    std::cout << indent << getNodeTypeName(node->getType()) << " (" << static_cast<int>(node->getType()) << ")";
    
    // Check if it has a value
    if (node->hasFlag(ASTNodeFlags::HAS_VALUE)) {
        const ASTValue& value = node->getValue();
        if (std::holds_alternative<std::string>(value)) {
            std::cout << " [value: '" << std::get<std::string>(value) << "']";
        } else if (std::holds_alternative<int>(value)) {
            std::cout << " [value: " << std::get<int>(value) << "]";
        } else if (std::holds_alternative<double>(value)) {
            std::cout << " [value: " << std::get<double>(value) << "]";
        } else {
            std::cout << " [value: <other>]";
        }
    }
    
    std::cout << " children=" << node->getChildren().size() << std::endl;
    
    if (node->getType() == ASTNodeType::UNARY_OP) {
        const UnaryOpNode* unaryOp = dynamic_cast<const UnaryOpNode*>(node);
        if (unaryOp) {
            std::cout << indent << "  --> UNARY_OP operator: '" << unaryOp->getOperator() << "'" << std::endl;
        }
    } else if (node->getType() == ASTNodeType::FUNC_DEF) {
        std::cout << indent << "  --> FUNC_DEF has " << node->getChildren().size() << " children (should have function body)" << std::endl;
    }
    
    // Recursively check children
    for (const auto& child : node->getChildren()) {
        printAllNodes(child.get(), depth + 1);
    }
}

int main() {
    try {
        // Read binary file
        std::ifstream file("test_simple_unary.ast", std::ios::binary | std::ios::ate);
        if (!file) {
            std::cerr << "Could not open file" << std::endl;
            return 1;
        }
        
        std::streamsize size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<uint8_t> buffer(size);
        if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
            std::cerr << "Could not read file" << std::endl;
            return 1;
        }
        file.close();
        
        CompactASTReader reader(buffer.data(), buffer.size());
        
        // Print debugging info
        std::cout << "=== HEADER INFO ===" << std::endl;
        auto header = reader.parseHeader();
        std::cout << "Node count: " << header.nodeCount << std::endl;
        std::cout << "String table size: " << header.stringTableSize << std::endl;
        
        auto program = reader.parse();
        
        std::cout << "=== STRING TABLE ===" << std::endl;
        const auto& strings = reader.getStringTable();
        for (size_t i = 0; i < strings.size(); ++i) {
            std::cout << "  [" << i << "] = '" << strings[i] << "'" << std::endl;
        }
        
        // Look for the "-" string specifically
        std::cout << "=== SEARCHING FOR UNARY OPERATOR ===" << std::endl;
        for (size_t i = 0; i < strings.size(); ++i) {
            if (strings[i] == "-") {
                std::cout << "Found '-' operator at string index " << i << std::endl;
            }
        }
        
        std::cout << "=== AST STRUCTURE DEBUG ===" << std::endl;
        printAllNodes(program.get());
        std::cout << "=== END DEBUG ===" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}