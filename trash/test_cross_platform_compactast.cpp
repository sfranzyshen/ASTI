/**
 * Test cross-platform CompactAST compatibility
 * This verifies that C++ can correctly read JavaScript-generated CompactAST binary data
 */

#include "libs/CompactAST/src/CompactAST.hpp"
#include <iostream>
#include <fstream>
#include <vector>
#include <memory>
#include <sstream>

using namespace arduino_ast;

std::string localNodeTypeToString(ASTNodeType type) {
    switch (type) {
        case ASTNodeType::PROGRAM: return "PROGRAM";
        case ASTNodeType::ERROR_NODE: return "ERROR_NODE";
        case ASTNodeType::COMMENT: return "COMMENT";
        case ASTNodeType::COMPOUND_STMT: return "COMPOUND_STMT";
        case ASTNodeType::EXPRESSION_STMT: return "EXPRESSION_STMT";
        case ASTNodeType::IF_STMT: return "IF_STMT";
        case ASTNodeType::WHILE_STMT: return "WHILE_STMT";
        case ASTNodeType::DO_WHILE_STMT: return "DO_WHILE_STMT";
        case ASTNodeType::FOR_STMT: return "FOR_STMT";
        case ASTNodeType::RANGE_FOR_STMT: return "RANGE_FOR_STMT";
        case ASTNodeType::SWITCH_STMT: return "SWITCH_STMT";
        case ASTNodeType::CASE_STMT: return "CASE_STMT";
        case ASTNodeType::RETURN_STMT: return "RETURN_STMT";
        case ASTNodeType::BREAK_STMT: return "BREAK_STMT";
        case ASTNodeType::CONTINUE_STMT: return "CONTINUE_STMT";
        case ASTNodeType::EMPTY_STMT: return "EMPTY_STMT";
        case ASTNodeType::VAR_DECL: return "VAR_DECL";
        case ASTNodeType::FUNC_DEF: return "FUNC_DEF";
        case ASTNodeType::FUNC_DECL: return "FUNC_DECL";
        case ASTNodeType::STRUCT_DECL: return "STRUCT_DECL";
        case ASTNodeType::ENUM_DECL: return "ENUM_DECL";
        case ASTNodeType::CLASS_DECL: return "CLASS_DECL";
        case ASTNodeType::TYPEDEF_DECL: return "TYPEDEF_DECL";
        case ASTNodeType::TEMPLATE_DECL: return "TEMPLATE_DECL";
        case ASTNodeType::BINARY_OP: return "BINARY_OP";
        case ASTNodeType::UNARY_OP: return "UNARY_OP";
        case ASTNodeType::ASSIGNMENT: return "ASSIGNMENT";
        case ASTNodeType::FUNC_CALL: return "FUNC_CALL";
        case ASTNodeType::MEMBER_ACCESS: return "MEMBER_ACCESS";
        case ASTNodeType::ARRAY_ACCESS: return "ARRAY_ACCESS";
        case ASTNodeType::CAST_EXPR: return "CAST_EXPR";
        case ASTNodeType::SIZEOF_EXPR: return "SIZEOF_EXPR";
        case ASTNodeType::TERNARY_EXPR: return "TERNARY_EXPR";
        case ASTNodeType::NUMBER_LITERAL: return "NUMBER_LITERAL";
        case ASTNodeType::STRING_LITERAL: return "STRING_LITERAL";
        case ASTNodeType::CHAR_LITERAL: return "CHAR_LITERAL";
        case ASTNodeType::IDENTIFIER: return "IDENTIFIER";
        case ASTNodeType::CONSTANT: return "CONSTANT";
        case ASTNodeType::ARRAY_INIT: return "ARRAY_INIT";
        case ASTNodeType::TYPE_NODE: return "TYPE_NODE";
        case ASTNodeType::DECLARATOR_NODE: return "DECLARATOR_NODE";
        case ASTNodeType::PARAM_NODE: return "PARAM_NODE";
        case ASTNodeType::POSTFIX_EXPRESSION: return "POSTFIX_EXPRESSION";
        case ASTNodeType::STRUCT_TYPE: return "STRUCT_TYPE";
        case ASTNodeType::FUNCTION_POINTER_DECLARATOR: return "FUNCTION_POINTER_DECLARATOR";
        case ASTNodeType::COMMA_EXPRESSION: return "COMMA_EXPRESSION";
        case ASTNodeType::ARRAY_DECLARATOR: return "ARRAY_DECLARATOR";
        case ASTNodeType::POINTER_DECLARATOR: return "POINTER_DECLARATOR";
        case ASTNodeType::CONSTRUCTOR_CALL: return "CONSTRUCTOR_CALL";
        default: return "UNKNOWN";
    }
}

std::string valueToString(const ASTValue& value) {
    return std::visit([](const auto& v) -> std::string {
        using T = std::decay_t<decltype(v)>;
        if constexpr (std::is_same_v<T, std::monostate>) {
            return "(void)";
        } else if constexpr (std::is_same_v<T, bool>) {
            return v ? "true" : "false";
        } else if constexpr (std::is_same_v<T, std::string>) {
            return '\"' + v + '\"';
        } else {
            return std::to_string(v);
        }
    }, value);
}

void dumpASTStructure(const ASTNode* node, int indent = 0) {
    if (!node) {
        std::cout << std::string(indent * 2, ' ') << "(null)\n";
        return;
    }
    
    std::string indentStr(indent * 2, ' ');
    std::cout << indentStr << localNodeTypeToString(node->getType());
    
    const auto& value = node->getValue();
    if (!std::holds_alternative<std::monostate>(value)) {
        std::cout << " [" << valueToString(value) << "]";
    }
    
    std::cout << " (children: " << node->getChildren().size() << ")\n";
    
    // Dump children
    for (const auto& child : node->getChildren()) {
        dumpASTStructure(child.get(), indent + 1);
    }
}

bool testCompactASTFile(const std::string& filename) {
    std::cout << "Testing CompactAST file: " << filename << std::endl;
    
    // Read binary file
    std::ifstream file(filename, std::ios::binary | std::ios::ate);
    if (!file) {
        std::cout << "  ❌ Could not open file" << std::endl;
        return false;
    }
    
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> buffer(size);
    if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
        std::cout << "  ❌ Could not read file" << std::endl;
        return false;
    }
    file.close();
    
    std::cout << "  File size: " << size << " bytes" << std::endl;
    
    try {
        // Test format validation first
        if (!isValidCompactAST(buffer.data(), buffer.size())) {
            std::cout << "  ❌ Invalid CompactAST format" << std::endl;
            return false;
        }
        std::cout << "  ✓ Format validation passed" << std::endl;
        
        // Create reader and parse
        CompactASTReader reader(buffer.data(), buffer.size());
        
        // Parse header
        auto header = reader.parseHeader();
        std::cout << "  Header info:" << std::endl;
        std::cout << "    Magic: 0x" << std::hex << header.magic << std::dec << std::endl;
        std::cout << "    Version: 0x" << std::hex << header.version << std::dec << std::endl;
        std::cout << "    Node count: " << header.nodeCount << std::endl;
        std::cout << "    String table size: " << header.stringTableSize << std::endl;
        
        // Parse full AST
        auto rootNode = reader.parse();
        std::cout << "  ✓ AST parsing successful" << std::endl;
        
        // Get string table
        const auto& strings = reader.getStringTable();
        std::cout << "  String table (" << strings.size() << " entries): [";
        for (size_t i = 0; i < strings.size(); ++i) {
            if (i > 0) std::cout << ", ";
            std::cout << '\"' << strings[i] << '\"';
        }
        std::cout << "]" << std::endl;
        
        // Dump AST structure
        std::cout << "  AST Structure:" << std::endl;
        dumpASTStructure(rootNode.get(), 2);
        
        // Get memory stats
        auto stats = reader.getMemoryStats();
        std::cout << "  Memory stats:" << std::endl;
        std::cout << "    Total buffer: " << stats.totalBufferSize << " bytes" << std::endl;
        std::cout << "    Header: " << stats.headerSize << " bytes" << std::endl;
        std::cout << "    String table: " << stats.stringTableSize << " bytes" << std::endl;
        std::cout << "    Node data: " << stats.nodeDataSize << " bytes" << std::endl;
        std::cout << "    Estimated node memory: " << stats.estimatedNodeMemory << " bytes" << std::endl;
        
        return true;
        
    } catch (const std::exception& e) {
        std::cout << "  ❌ Exception during parsing: " << e.what() << std::endl;
        return false;
    }
}

int main(int argc, char* argv[]) {
    std::cout << "=== CompactAST Cross-Platform Compatibility Test ===\n" << std::endl;
    
    // Test if we can find any .ast files
    std::vector<std::string> testFiles = {
        "src/javascript/test_data/example_001.ast",
        "test_basic_arduino_program.ast",
        "test_simple.ast"
    };
    
    // If command line arguments provided, use those instead
    if (argc > 1) {
        testFiles.clear();
        for (int i = 1; i < argc; i++) {
            testFiles.push_back(argv[i]);
        }
    }
    
    int totalTests = 0;
    int passedTests = 0;
    
    for (const auto& filename : testFiles) {
        std::cout << "\n" << std::string(60, '-') << std::endl;
        if (testCompactASTFile(filename)) {
            passedTests++;
        }
        totalTests++;
    }
    
    std::cout << "\n" << std::string(60, '=') << std::endl;
    std::cout << "Summary:" << std::endl;
    std::cout << "  Tests run: " << totalTests << std::endl;
    std::cout << "  Passed: " << passedTests << std::endl;
    std::cout << "  Failed: " << (totalTests - passedTests) << std::endl;
    std::cout << "  Success rate: " << (totalTests > 0 ? (passedTests * 100.0 / totalTests) : 0) << "%" << std::endl;
    
    if (passedTests == totalTests && totalTests > 0) {
        std::cout << "\n✅ All tests passed! CompactAST cross-platform compatibility is VERIFIED." << std::endl;
        return 0;
    } else {
        std::cout << "\n❌ Some tests failed. CompactAST cross-platform compatibility has ISSUES." << std::endl;
        return 1;
    }
}
