/**
 * ASTNodes.cpp - C++ AST Node Implementation for Arduino Interpreter
 * 
 * Implementation of AST node classes and utility functions.
 * Optimized for ESP32-S3 memory constraints and host development.
 * 
 * Version: 1.0
 * Compatible with: ArduinoParser.js v5.1.0
 */

#include "ASTNodes.hpp"
#include <sstream>
#include <iostream>

namespace arduino_ast {

// =============================================================================
// BASE AST NODE IMPLEMENTATION
// =============================================================================

std::string ASTNode::toString() const {
    std::ostringstream oss;
    oss << nodeTypeToString(nodeType_);
    
    if (hasFlag(ASTNodeFlags::HAS_VALUE)) {
        oss << " (";
        std::visit([&oss](const auto& value) {
            using T = std::decay_t<decltype(value)>;
            if constexpr (std::is_same_v<T, std::string>) {
                oss << "\"" << value << "\"";
            } else if constexpr (std::is_same_v<T, std::monostate>) {
                oss << "void";
            } else {
                oss << value;
            }
        }, value_);
        oss << ")";
    }
    
    if (hasFlag(ASTNodeFlags::HAS_CHILDREN)) {
        oss << " [" << children_.size() << " children]";
    }
    
    return oss.str();
}

// =============================================================================
// VISITOR IMPLEMENTATIONS
// =============================================================================

void ProgramNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ErrorNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void CommentNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void CompoundStmtNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ExpressionStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void IfStatement::accept(ASTVisitor& visitor) {
    std::cout << "🔥 IfStatement::accept() CALLED! About to call visitor.visit(*this)" << std::endl;
    visitor.visit(*this);
    std::cout << "🔥 IfStatement::accept() COMPLETED visitor.visit(*this)" << std::endl;
}

void WhileStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void DoWhileStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ForStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ReturnStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void BreakStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ContinueStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void BinaryOpNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void UnaryOpNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void FuncCallNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ConstructorCallNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void MemberAccessNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void NumberNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void StringLiteralNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void IdentifierNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void VarDeclNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void FuncDefNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void TypeNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void DeclaratorNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ParamNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void EmptyStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void AssignmentNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void CharLiteralNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void PostfixExpressionNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void SwitchStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void CaseStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void RangeBasedForStatement::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ArrayAccessNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void TernaryExpressionNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ConstantNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ArrayInitializerNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void FunctionPointerDeclaratorNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void StructDeclaration::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void TypedefDeclaration::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void CommaExpression::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void StructType::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void ArrayDeclaratorNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

void PointerDeclaratorNode::accept(ASTVisitor& visitor) {
    visitor.visit(*this);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

ASTNodePtr createNode(ASTNodeType type) {
    switch (type) {
        case ASTNodeType::PROGRAM:
            return std::make_unique<ProgramNode>();
        case ASTNodeType::COMPOUND_STMT:
            return std::make_unique<CompoundStmtNode>();
        case ASTNodeType::EXPRESSION_STMT:
            return std::make_unique<ExpressionStatement>();
        case ASTNodeType::IF_STMT:
            return std::make_unique<IfStatement>();
        case ASTNodeType::WHILE_STMT:
            return std::make_unique<WhileStatement>();
        case ASTNodeType::DO_WHILE_STMT:
            return std::make_unique<DoWhileStatement>();
        case ASTNodeType::FOR_STMT:
            return std::make_unique<ForStatement>();
        case ASTNodeType::RANGE_FOR_STMT:
            return std::make_unique<RangeBasedForStatement>();
        case ASTNodeType::SWITCH_STMT:
            return std::make_unique<SwitchStatement>();
        case ASTNodeType::CASE_STMT:
            return std::make_unique<CaseStatement>();
        case ASTNodeType::RETURN_STMT:
            return std::make_unique<ReturnStatement>();
        case ASTNodeType::BREAK_STMT:
            return std::make_unique<BreakStatement>();
        case ASTNodeType::CONTINUE_STMT:
            return std::make_unique<ContinueStatement>();
        case ASTNodeType::BINARY_OP:
            return std::make_unique<BinaryOpNode>();
        case ASTNodeType::UNARY_OP:
            return std::make_unique<UnaryOpNode>();
        case ASTNodeType::FUNC_CALL:
            return std::make_unique<FuncCallNode>();
        case ASTNodeType::CONSTRUCTOR_CALL:
            return std::make_unique<ConstructorCallNode>();
        case ASTNodeType::MEMBER_ACCESS:
            return std::make_unique<MemberAccessNode>();
        case ASTNodeType::ARRAY_ACCESS:
            return std::make_unique<ArrayAccessNode>();
        case ASTNodeType::CAST_EXPR:
            // TODO: Implement proper CastExpression class
            return std::make_unique<ExpressionStatement>();  // Use generic expression as placeholder
        case ASTNodeType::SIZEOF_EXPR:
            // TODO: Implement proper SizeofExpression class
            return std::make_unique<ExpressionStatement>();  // Use generic expression as placeholder
        case ASTNodeType::TERNARY_EXPR:
            return std::make_unique<TernaryExpressionNode>();
        case ASTNodeType::CONSTANT:
            return std::make_unique<ConstantNode>("");
        case ASTNodeType::ARRAY_INIT:
            return std::make_unique<ArrayInitializerNode>();
        case ASTNodeType::VAR_DECL:
            return std::make_unique<VarDeclNode>();
        case ASTNodeType::FUNC_DEF:
            return std::make_unique<FuncDefNode>();
        case ASTNodeType::FUNC_DECL:
            return std::make_unique<FuncDefNode>(); // Use FuncDefNode for declarations too
        case ASTNodeType::NUMBER_LITERAL:
            return std::make_unique<NumberNode>(0);
        case ASTNodeType::STRING_LITERAL:
            return std::make_unique<StringLiteralNode>("");
        case ASTNodeType::IDENTIFIER:
            return std::make_unique<IdentifierNode>("");
        case ASTNodeType::TYPE_NODE:
            return std::make_unique<TypeNode>("");
        case ASTNodeType::DECLARATOR_NODE:
            return std::make_unique<DeclaratorNode>();
        case ASTNodeType::PARAM_NODE:
            return std::make_unique<ParamNode>();
        case ASTNodeType::EMPTY_STMT:
            return std::make_unique<EmptyStatement>();
        case ASTNodeType::ASSIGNMENT:
            return std::make_unique<AssignmentNode>();
        case ASTNodeType::CHAR_LITERAL:
            return std::make_unique<CharLiteralNode>("");
        case ASTNodeType::POSTFIX_EXPRESSION:
            return std::make_unique<PostfixExpressionNode>();
        case ASTNodeType::FUNCTION_POINTER_DECLARATOR:
            return std::make_unique<FunctionPointerDeclaratorNode>();
        case ASTNodeType::STRUCT_DECL:
            return std::make_unique<StructDeclaration>();
        case ASTNodeType::TYPEDEF_DECL:
            return std::make_unique<TypedefDeclaration>();
        case ASTNodeType::COMMA_EXPRESSION:
            return std::make_unique<CommaExpression>();
        case ASTNodeType::STRUCT_TYPE:
            return std::make_unique<StructType>();
        case ASTNodeType::ARRAY_DECLARATOR:
            return std::make_unique<ArrayDeclaratorNode>();
        case ASTNodeType::POINTER_DECLARATOR:
            return std::make_unique<PointerDeclaratorNode>();
        default:
            return nullptr;
    }
}

std::string nodeTypeToString(ASTNodeType type) {
    switch (type) {
        case ASTNodeType::PROGRAM: return "ProgramNode";
        case ASTNodeType::ERROR_NODE: return "ErrorNode";
        case ASTNodeType::COMMENT: return "CommentNode";
        case ASTNodeType::COMPOUND_STMT: return "CompoundStmtNode";
        case ASTNodeType::EXPRESSION_STMT: return "ExpressionStatement";
        case ASTNodeType::IF_STMT: return "IfStatement";
        case ASTNodeType::WHILE_STMT: return "WhileStatement";
        case ASTNodeType::DO_WHILE_STMT: return "DoWhileStatement";
        case ASTNodeType::FOR_STMT: return "ForStatement";
        case ASTNodeType::RANGE_FOR_STMT: return "RangeBasedForStatement";
        case ASTNodeType::SWITCH_STMT: return "SwitchStatement";
        case ASTNodeType::CASE_STMT: return "CaseStatement";
        case ASTNodeType::RETURN_STMT: return "ReturnStatement";
        case ASTNodeType::BREAK_STMT: return "BreakStatement";
        case ASTNodeType::CONTINUE_STMT: return "ContinueStatement";
        case ASTNodeType::EMPTY_STMT: return "EmptyStatement";
        case ASTNodeType::VAR_DECL: return "VarDeclNode";
        case ASTNodeType::FUNC_DEF: return "FuncDefNode";
        case ASTNodeType::FUNC_DECL: return "FuncDeclNode";
        case ASTNodeType::STRUCT_DECL: return "StructDeclaration";
        case ASTNodeType::ENUM_DECL: return "EnumDeclaration";
        case ASTNodeType::CLASS_DECL: return "ClassDeclaration";
        case ASTNodeType::TYPEDEF_DECL: return "TypedefDeclaration";
        case ASTNodeType::TEMPLATE_DECL: return "TemplateDeclaration";
        case ASTNodeType::BINARY_OP: return "BinaryOpNode";
        case ASTNodeType::UNARY_OP: return "UnaryOpNode";
        case ASTNodeType::ASSIGNMENT: return "AssignmentNode";
        case ASTNodeType::FUNC_CALL: return "FuncCallNode";
        case ASTNodeType::CONSTRUCTOR_CALL: return "ConstructorCallNode";
        case ASTNodeType::MEMBER_ACCESS: return "MemberAccessNode";
        case ASTNodeType::ARRAY_ACCESS: return "ArrayAccessNode";
        case ASTNodeType::CAST_EXPR: return "CastExpression";
        case ASTNodeType::SIZEOF_EXPR: return "SizeofExpression";
        case ASTNodeType::TERNARY_EXPR: return "TernaryExpression";
        case ASTNodeType::NUMBER_LITERAL: return "NumberNode";
        case ASTNodeType::STRING_LITERAL: return "StringLiteralNode";
        case ASTNodeType::CHAR_LITERAL: return "CharLiteralNode";
        case ASTNodeType::IDENTIFIER: return "IdentifierNode";
        case ASTNodeType::CONSTANT: return "ConstantNode";
        case ASTNodeType::ARRAY_INIT: return "ArrayInitializerNode";
        case ASTNodeType::TYPE_NODE: return "TypeNode";
        case ASTNodeType::DECLARATOR_NODE: return "DeclaratorNode";
        case ASTNodeType::PARAM_NODE: return "ParamNode";
        case ASTNodeType::POSTFIX_EXPRESSION: return "PostfixExpressionNode";
        case ASTNodeType::STRUCT_TYPE: return "StructType";
        case ASTNodeType::FUNCTION_POINTER_DECLARATOR: return "FunctionPointerDeclaratorNode";
        case ASTNodeType::COMMA_EXPRESSION: return "CommaExpression";
        case ASTNodeType::ARRAY_DECLARATOR: return "ArrayDeclaratorNode";
        case ASTNodeType::POINTER_DECLARATOR: return "PointerDeclaratorNode";
        default: return "UnknownNode";
    }
}

std::string valueTypeToString(ValueType type) {
    switch (type) {
        case ValueType::VOID_VAL: return "void";
        case ValueType::BOOL_VAL: return "bool";
        case ValueType::INT8_VAL: return "int8";
        case ValueType::UINT8_VAL: return "uint8";
        case ValueType::INT16_VAL: return "int16";
        case ValueType::UINT16_VAL: return "uint16";
        case ValueType::INT32_VAL: return "int32";
        case ValueType::UINT32_VAL: return "uint32";
        case ValueType::INT64_VAL: return "int64";
        case ValueType::UINT64_VAL: return "uint64";
        case ValueType::FLOAT32_VAL: return "float";
        case ValueType::FLOAT64_VAL: return "double";
        case ValueType::STRING_VAL: return "string";
        case ValueType::ARRAY_VAL: return "array";
        case ValueType::NULL_VAL: return "null";
        case ValueType::OPERATOR_VAL: return "operator";
        default: return "unknown";
    }
}

size_t estimateNodeMemoryUsage(const ASTNode* node) {
    if (!node) return 0;
    
    size_t size = sizeof(*node); // Base node size
    
    // Add size of children
    for (const auto& child : node->getChildren()) {
        size += estimateNodeMemoryUsage(child.get());
    }
    
    // Add size of string values
    const auto& value = node->getValue();
    if (std::holds_alternative<std::string>(value)) {
        size += std::get<std::string>(value).capacity();
    }
    
    return size;
}

} // namespace arduino_ast