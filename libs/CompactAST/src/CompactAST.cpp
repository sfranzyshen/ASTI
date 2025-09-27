/**
 * CompactAST.cpp - C++ Compact AST Binary Format Implementation
 * 
 * Implementation of binary AST reader/writer with cross-platform compatibility.
 * Handles endianness, alignment, and memory optimization for embedded systems.
 * 
 * Version: 1.0
 */

#include "CompactAST.hpp"
#include <cstring>
#include <algorithm>
#include <sstream>
#include <iomanip>
#include <iostream>

// Disable debug output for command stream parity testing
class NullStream {
public:
    template<typename T>
    NullStream& operator<<(const T&) { return *this; }
    NullStream& operator<<(std::ostream& (*)(std::ostream&)) { return *this; }
};

static NullStream nullStream;

// Platform-specific headers
#ifdef ARDUINO_ARCH_ESP32
#include <Arduino.h>
#include <esp_heap_caps.h>
#endif

namespace arduino_ast {

// =============================================================================
// CONSTANTS
// =============================================================================

static constexpr uint32_t COMPACT_AST_MAGIC = 0x50545341; // 'ASTP' as written by JavaScript in little-endian
static constexpr uint16_t SUPPORTED_VERSION = 0x0100;     // v1.0
static constexpr size_t MIN_BUFFER_SIZE = sizeof(CompactASTHeader);

// =============================================================================
// COMPACT AST READER IMPLEMENTATION
// =============================================================================

CompactASTReader::CompactASTReader(const uint8_t* buffer, size_t size, bool takeOwnership)
    : buffer_(buffer), bufferSize_(size), position_(0),
      headerRead_(false), stringTableRead_(false), nodesRead_(false) {
    
    // TODO: Implement takeOwnership for memory management
    (void)takeOwnership; // Suppress unused parameter warning
    
    if (!buffer_ || bufferSize_ < MIN_BUFFER_SIZE) {
        throw InvalidFormatException("Buffer too small for header");
    }
}

// CompactASTReader::CompactASTReader(std::span<const uint8_t> data)
//     : CompactASTReader(data.data(), data.size()) {
// }

ASTNodePtr CompactASTReader::parse() {
    
    if (!headerRead_) {
        parseHeaderInternal();
    }
    
    if (!stringTableRead_) {
        parseStringTableInternal();
    }
    
    if (!nodesRead_) {
        parseNodesInternal();
    }
    
    // Link parent-child relationships
    linkNodeChildren();
    
    // Return root node (should be first node)
    if (nodes_.empty()) {
        throw CorruptDataException("No nodes found in AST");
    }
    
    return std::move(nodes_[0]);
}

CompactASTHeader CompactASTReader::parseHeader() {
    if (!headerRead_) {
        parseHeaderInternal();
    }
    return header_;
}

void CompactASTReader::parseHeaderInternal() {
    position_ = 0;
    validatePosition(sizeof(CompactASTHeader));
    
    // Read header with proper endianness handling
    std::memcpy(&header_, buffer_ + position_, sizeof(CompactASTHeader));
    position_ += sizeof(CompactASTHeader);
    
    for (size_t i = 0; i < 16; i++) {
    }
    
    
    // All header fields are stored in little-endian format per specification
    header_.magic = convertFromLittleEndian32(header_.magic);
    header_.version = convertFromLittleEndian16(header_.version);
    header_.flags = convertFromLittleEndian16(header_.flags);
    header_.nodeCount = convertFromLittleEndian32(header_.nodeCount);
    header_.stringTableSize = convertFromLittleEndian32(header_.stringTableSize);
    
    
    validateHeader();
    headerRead_ = true;
}

void CompactASTReader::parseStringTableInternal() {
    if (!headerRead_) {
        parseHeaderInternal();
    }
    
    
    // Read string count
    validatePosition(4);
    uint32_t stringCount = convertFromLittleEndian32(readUint32());
    
    stringTable_.clear();
    stringTable_.reserve(stringCount);
    
    // Read each string
    for (uint32_t i = 0; i < stringCount; ++i) {
        validatePosition(2);
        uint16_t stringLength = convertFromLittleEndian16(readUint16());
        
        validatePosition(stringLength + 1); // +1 for null terminator
        std::string str = readString(stringLength);
        
        // Skip null terminator
        position_++;
        
        stringTable_.push_back(std::move(str));
    }
    
    // Align to 4-byte boundary
    alignTo4Bytes();
    
    stringTableRead_ = true;
}

void CompactASTReader::parseNodesInternal() {
    if (!stringTableRead_) {
        parseStringTableInternal();
    }
    
    nodes_.clear();
    nodes_.reserve(header_.nodeCount);
    
    
    // Parse each node
    for (uint32_t i = 0; i < header_.nodeCount; ++i) {
        auto node = parseNode(i);
        nodes_.push_back(std::move(node));
    }
    
    nodesRead_ = true;
}

ASTNodePtr CompactASTReader::parseNode(size_t nodeIndex) {
    
    validatePosition(4); // NodeType + Flags + DataSize
    
    uint8_t nodeTypeRaw = readUint8();
    uint8_t flags = readUint8();
    uint16_t dataSize = convertFromLittleEndian16(readUint16());
    
    
    // DEBUG: Check flags for operator nodes
    if (nodeTypeRaw == static_cast<uint8_t>(ASTNodeType::UNARY_OP) || 
        nodeTypeRaw == static_cast<uint8_t>(ASTNodeType::BINARY_OP)) {
        std::cerr << "OPERATOR NODE DEBUG: nodeType=" << static_cast<int>(nodeTypeRaw) 
                  << ", flags=" << static_cast<int>(flags)
                  << ", HAS_VALUE=" << (flags & static_cast<uint8_t>(ASTNodeFlags::HAS_VALUE) ? "YES" : "NO")
                  << std::endl;
    }
    
    // Validate node type
    validateNodeType(nodeTypeRaw);
    ASTNodeType nodeType = static_cast<ASTNodeType>(nodeTypeRaw);
    
    
    // Create node
    ASTNodePtr node;
    
    // Create specific node types
    switch (nodeType) {
        // Program structure
        case ASTNodeType::PROGRAM:
            node = std::make_unique<ProgramNode>();
            break;
        case ASTNodeType::ERROR_NODE:
            node = createNode(nodeType); // Use factory for error nodes
            break;
        case ASTNodeType::COMMENT:
            node = createNode(nodeType); // Use factory for comments
            break;
            
        // Statements
        case ASTNodeType::COMPOUND_STMT:
            node = std::make_unique<CompoundStmtNode>();
            break;
        case ASTNodeType::EXPRESSION_STMT:
            node = std::make_unique<ExpressionStatement>();
            break;
        case ASTNodeType::IF_STMT:
            node = std::make_unique<IfStatement>();
            break;
        case ASTNodeType::WHILE_STMT:
            node = std::make_unique<WhileStatement>();
            break;
        case ASTNodeType::DO_WHILE_STMT:
            node = std::make_unique<DoWhileStatement>();
            break;
        case ASTNodeType::FOR_STMT:
            node = std::make_unique<ForStatement>();
            break;
        case ASTNodeType::RANGE_FOR_STMT:
            node = std::make_unique<RangeBasedForStatement>();
            break;
        case ASTNodeType::SWITCH_STMT:
            node = std::make_unique<SwitchStatement>();
            break;
        case ASTNodeType::CASE_STMT:
            node = std::make_unique<CaseStatement>();
            break;
        case ASTNodeType::RETURN_STMT:
            node = std::make_unique<ReturnStatement>();
            break;
        case ASTNodeType::BREAK_STMT:
            node = std::make_unique<BreakStatement>();
            break;
        case ASTNodeType::CONTINUE_STMT:
            node = std::make_unique<ContinueStatement>();
            break;
        case ASTNodeType::EMPTY_STMT:
            node = std::make_unique<EmptyStatement>();
            break;
            
        // Declarations
        case ASTNodeType::VAR_DECL:
            node = std::make_unique<VarDeclNode>();
            break;
        case ASTNodeType::FUNC_DEF:
            node = std::make_unique<FuncDefNode>();
            break;
        case ASTNodeType::FUNC_DECL:
            node = std::make_unique<FuncDefNode>(); // Use FuncDefNode for declarations too
            break;
        case ASTNodeType::STRUCT_DECL:
            node = std::make_unique<StructDeclaration>();
            break;
        case ASTNodeType::TYPEDEF_DECL:
            node = std::make_unique<TypedefDeclaration>();
            break;
            
        // Expressions
        case ASTNodeType::BINARY_OP:
            node = std::make_unique<BinaryOpNode>();
            break;
        case ASTNodeType::UNARY_OP:
            node = std::make_unique<UnaryOpNode>();
            break;
        case ASTNodeType::ASSIGNMENT:
            node = std::make_unique<AssignmentNode>();
            break;
        case ASTNodeType::FUNC_CALL:
            node = std::make_unique<FuncCallNode>();
            break;
        case ASTNodeType::CONSTRUCTOR_CALL:
            node = std::make_unique<ConstructorCallNode>();
            break;
        case ASTNodeType::MEMBER_ACCESS:
            node = std::make_unique<MemberAccessNode>();
            break;
        case ASTNodeType::ARRAY_ACCESS:
            node = std::make_unique<ArrayAccessNode>();
            break;
        case ASTNodeType::TERNARY_EXPR:
            node = std::make_unique<TernaryExpressionNode>();
            break;
        case ASTNodeType::POSTFIX_EXPRESSION:
            node = std::make_unique<PostfixExpressionNode>();
            break;
        case ASTNodeType::COMMA_EXPRESSION:
            node = std::make_unique<CommaExpression>();
            break;
            
        // Literals and identifiers
        case ASTNodeType::NUMBER_LITERAL:
            node = std::make_unique<NumberNode>(0.0);
            break;
        case ASTNodeType::STRING_LITERAL:
            node = std::make_unique<StringLiteralNode>("");
            break;
        case ASTNodeType::CHAR_LITERAL:
            node = std::make_unique<CharLiteralNode>("");
            break;
        case ASTNodeType::IDENTIFIER:
            node = std::make_unique<IdentifierNode>("");
            break;
        case ASTNodeType::CONSTANT:
            node = std::make_unique<ConstantNode>("");
            break;
        case ASTNodeType::ARRAY_INIT:
            node = std::make_unique<ArrayInitializerNode>();
            break;
            
        // Types and parameters
        case ASTNodeType::TYPE_NODE:
            node = std::make_unique<TypeNode>("void");
            break;
        case ASTNodeType::DECLARATOR_NODE:
            node = std::make_unique<DeclaratorNode>();
            break;
        case ASTNodeType::PARAM_NODE:
            node = std::make_unique<ParamNode>();
            break;
        case ASTNodeType::STRUCT_TYPE:
            node = std::make_unique<StructType>();
            break;
        case ASTNodeType::FUNCTION_POINTER_DECLARATOR:
            node = std::make_unique<FunctionPointerDeclaratorNode>();
            break;
        case ASTNodeType::ARRAY_DECLARATOR:
            node = std::make_unique<ArrayDeclaratorNode>();
            break;
        case ASTNodeType::POINTER_DECLARATOR:
            node = std::make_unique<PointerDeclaratorNode>();
            break;
        case ASTNodeType::DESIGNATED_INITIALIZER:
            node = std::make_unique<DesignatedInitializerNode>();
            break;

        default:
            // Create generic node for unsupported types
            node = createNode(nodeType);
            if (!node) {
                throw CorruptDataException("Unsupported node type: " + 
                                         std::to_string(static_cast<int>(nodeType)));
            }
            break;
    }
    
    // Set flags
    node->setFlags(static_cast<ASTNodeFlags>(flags));
    
    size_t dataStart = position_;
    
    // Parse value if present
    if (flags & static_cast<uint8_t>(ASTNodeFlags::HAS_VALUE)) {
        ASTValue value = parseValue();
        node->setValue(value);
    }
    
    // Parse children if present
    if (flags & static_cast<uint8_t>(ASTNodeFlags::HAS_CHILDREN)) {
        
        // Child indices should be stored as uint16_t values
        size_t remainingBytes = dataSize - (position_ - dataStart);
        size_t childCount = remainingBytes / 2; // Each child index is 2 bytes
        
        
        for (size_t i = 0; i < childCount; ++i) {
            if (position_ + 2 <= dataStart + dataSize) {
                uint16_t childIndex = convertFromLittleEndian16(readUint16());
                
                // Store child index for later linking
                childIndices_[nodeIndex].push_back(childIndex);
            } else {
                break;
            }
        }
    }
    
    // Skip to end of node data
    position_ = dataStart + dataSize;
    
    return node;
}

ASTValue CompactASTReader::parseValue() {
    validatePosition(1);
    uint8_t valueTypeRaw = readUint8();
    ValueType valueType = static_cast<ValueType>(valueTypeRaw);
    
    
    switch (valueType) {
        case ValueType::VOID_VAL:
            return std::monostate{};
            
        case ValueType::BOOL_VAL:
            validatePosition(1);
            return static_cast<bool>(readUint8());
            
        case ValueType::INT8_VAL:
            validatePosition(1);
            return static_cast<int32_t>(static_cast<int8_t>(readUint8()));
            
        case ValueType::UINT8_VAL:
            validatePosition(1);
            {
                uint8_t rawValue = readUint8();
                // For NumberNode compatibility, return as double
                double result = static_cast<double>(rawValue);
                return result;
            }
            
        case ValueType::INT16_VAL:
            validatePosition(2);
            return static_cast<double>(static_cast<int16_t>(convertFromLittleEndian16(readUint16())));
            
        case ValueType::UINT16_VAL:
            validatePosition(2);
            return static_cast<double>(convertFromLittleEndian16(readUint16()));
            
        case ValueType::INT32_VAL:
            validatePosition(4);
            return static_cast<double>(convertFromLittleEndian32(readUint32()));
            
        case ValueType::UINT32_VAL:
            validatePosition(4);
            return static_cast<double>(convertFromLittleEndian32(readUint32()));
            
        case ValueType::FLOAT32_VAL:
            validatePosition(4);
            return static_cast<double>(readFloat32());
            
        case ValueType::FLOAT64_VAL:
            validatePosition(8);
            return readFloat64();
            
        case ValueType::STRING_VAL:
            validatePosition(2);
            {
                uint16_t stringIndex = convertFromLittleEndian16(readUint16());
                if (stringIndex >= stringTable_.size()) {
                    // Handle invalid string index gracefully - return empty string instead of crashing
                    return std::string("");
                }
                return stringTable_[stringIndex];
            }
            
        case ValueType::NULL_VAL:
            return std::monostate{};
            
        default:
            throw CorruptDataException("Unsupported value type: " + 
                                     std::to_string(static_cast<int>(valueType)));
    }
}

void CompactASTReader::linkNodeChildren() {
    
    // Process in descending order, but handle root node (0) specially to avoid it being moved
    std::vector<std::pair<size_t, std::vector<uint16_t>>> orderedPairs(childIndices_.begin(), childIndices_.end());
    std::sort(orderedPairs.begin(), orderedPairs.end(), [](const auto& a, const auto& b) {
        // Special handling: if one is root (0) and other is not, process non-root first
        if (a.first == 0 && b.first != 0) return false;  // Process b before a
        if (b.first == 0 && a.first != 0) return true;   // Process a before b
        // Otherwise, use descending order (higher indices first)
        return a.first > b.first;
    });
    
    for (const auto& pair : orderedPairs) {
        size_t parentIndex = pair.first;
        const std::vector<uint16_t>& childIndexList = pair.second;
        
        
        if (parentIndex >= nodes_.size()) {
            continue;
        }
        
        auto& parentNode = nodes_[parentIndex];
        if (!parentNode) {
            continue;
        }
        
        for (uint16_t childIndex : childIndexList) {
            
            if (childIndex >= nodes_.size()) {
                continue;
            }
            
            if (!nodes_[childIndex]) {
                continue;
            }
            
            // CRITICAL: Never move the root node (index 0) as it should never be anyone's child
            if (childIndex == 0) {
                continue;
            }
            
            // Get child node without moving (keep it in the array for now)
            auto& childNodeRef = nodes_[childIndex];
            if (!childNodeRef) {
                continue;
            }
            
            // Special handling for specific node types to set up proper structure
            if (parentNode->getType() == ASTNodeType::FUNC_DEF) {
                auto* funcDefNode = dynamic_cast<arduino_ast::FuncDefNode*>(parentNode.get());
                if (funcDefNode) {
                    
                    // Determine child role based on type - be flexible about order
                    auto childType = childNodeRef->getType();
                    if (childType == ASTNodeType::TYPE_NODE && !funcDefNode->getReturnType()) {
                        funcDefNode->setReturnType(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::DECLARATOR_NODE && !funcDefNode->getDeclarator()) {
                        funcDefNode->setDeclarator(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::PARAM_NODE) {
                        funcDefNode->addParameter(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::COMPOUND_STMT && !funcDefNode->getBody()) {
                        funcDefNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::VAR_DECL) {
                auto* varDeclNode = dynamic_cast<arduino_ast::VarDeclNode*>(parentNode.get());
                if (varDeclNode) {

                    auto childType = childNodeRef->getType();
                    std::cerr << "*** CHILD TYPE IS: " << static_cast<int>(childType) << " ***" << std::endl;
                    if (childType == ASTNodeType::TYPE_NODE && !varDeclNode->getVarType()) {
                        varDeclNode->setVarType(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::DECLARATOR_NODE) {
                        varDeclNode->addDeclaration(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::ARRAY_DECLARATOR) {
                        varDeclNode->addDeclaration(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::NUMBER_LITERAL ||
                               childType == ASTNodeType::STRING_LITERAL ||
                               childType == ASTNodeType::CHAR_LITERAL ||
                               childType == ASTNodeType::IDENTIFIER ||
                               childType == ASTNodeType::TERNARY_EXPR ||
                               childType == ASTNodeType::BINARY_OP ||
                               childType == ASTNodeType::UNARY_OP ||
                               childType == ASTNodeType::FUNC_CALL ||
                               childType == ASTNodeType::CONSTRUCTOR_CALL ||
                               childType == ASTNodeType::ARRAY_INIT ||
                               childType == ASTNodeType::CONSTANT) {
                        // This is an initializer - add it as a child to the last DeclaratorNode
                        const auto& declarations = varDeclNode->getDeclarations();
                        if (!declarations.empty()) {
                            auto* lastDecl = declarations.back().get();
                            if (lastDecl && lastDecl->getType() == ASTNodeType::DECLARATOR_NODE) {
                                const_cast<arduino_ast::ASTNode*>(lastDecl)->addChild(std::move(nodes_[childIndex]));
                            } else {
                                parentNode->addChild(std::move(nodes_[childIndex]));
                            }
                        } else {
                            parentNode->addChild(std::move(nodes_[childIndex]));
                        }
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::EXPRESSION_STMT) {
                auto* exprStmtNode = dynamic_cast<arduino_ast::ExpressionStatement*>(parentNode.get());
                if (exprStmtNode) {
                    
                    // ExpressionStatement expects its first child to be the expression
                    if (!exprStmtNode->getExpression()) {
                        exprStmtNode->setExpression(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::FUNC_CALL) {
                auto* funcCallNode = dynamic_cast<arduino_ast::FuncCallNode*>(parentNode.get());
                if (funcCallNode) {

                    // FuncCallNode expects first child as callee, rest as arguments
                    if (!funcCallNode->getCallee()) {
                        funcCallNode->setCallee(std::move(nodes_[childIndex]));
                    } else {
                        funcCallNode->addArgument(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::CONSTRUCTOR_CALL) {
                auto* constructorCallNode = dynamic_cast<arduino_ast::ConstructorCallNode*>(parentNode.get());
                if (constructorCallNode) {

                    // ConstructorCallNode expects first child as callee, rest as arguments (same as FuncCallNode)
                    if (!constructorCallNode->getCallee()) {
                        constructorCallNode->setCallee(std::move(nodes_[childIndex]));
                    } else {
                        constructorCallNode->addArgument(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::TERNARY_EXPR) {
                auto* ternaryNode = dynamic_cast<arduino_ast::TernaryExpressionNode*>(parentNode.get());
                if (ternaryNode) {
                    // Count how many children this ternary already has
                    int ternaryChildCount = 0;
                    if (ternaryNode->getCondition()) ternaryChildCount++;
                    if (ternaryNode->getTrueExpression()) ternaryChildCount++;
                    if (ternaryNode->getFalseExpression()) ternaryChildCount++;
                    
                    
                    // Ternary expressions expect 3 children in order: condition, trueExpression, falseExpression
                    if (ternaryChildCount == 0) {
                        ternaryNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (ternaryChildCount == 1) {
                        ternaryNode->setTrueExpression(std::move(nodes_[childIndex]));
                    } else if (ternaryChildCount == 2) {
                        ternaryNode->setFalseExpression(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::ARRAY_ACCESS) {
                auto* arrayAccessNode = dynamic_cast<arduino_ast::ArrayAccessNode*>(parentNode.get());
                if (arrayAccessNode) {

                    // ArrayAccessNode expects 2 children in order: array (identifier), index
                    if (!arrayAccessNode->getArray()) {
                        arrayAccessNode->setArray(std::move(nodes_[childIndex]));
                    } else if (!arrayAccessNode->getIndex()) {
                        arrayAccessNode->setIndex(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::ARRAY_DECLARATOR) {
                auto* arrayDeclNode = dynamic_cast<arduino_ast::ArrayDeclaratorNode*>(parentNode.get());
                if (arrayDeclNode) {

                    // ArrayDeclaratorNode expects 2 children in order: identifier, size
                    if (!arrayDeclNode->getIdentifier()) {
                        arrayDeclNode->setIdentifier(std::move(nodes_[childIndex]));
                    } else if (!arrayDeclNode->getSize()) {
                        arrayDeclNode->setSize(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::MEMBER_ACCESS) {
                auto* memberAccessNode = dynamic_cast<arduino_ast::MemberAccessNode*>(parentNode.get());
                if (memberAccessNode) {
                    
                    // MemberAccessNode expects 2 children in order: object, property
                    if (!memberAccessNode->getObject()) {
                        memberAccessNode->setObject(std::move(nodes_[childIndex]));
                    } else if (!memberAccessNode->getProperty()) {
                        memberAccessNode->setProperty(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::IF_STMT) {
                auto* ifStmtNode = dynamic_cast<arduino_ast::IfStatement*>(parentNode.get());
                if (ifStmtNode) {
                    // Count how many children this if statement already has
                    int ifChildCount = 0;
                    if (ifStmtNode->getCondition()) ifChildCount++;
                    if (ifStmtNode->getConsequent()) ifChildCount++;
                    if (ifStmtNode->getAlternate()) ifChildCount++;
                    
                    
                    // If statements expect: condition, consequent, alternate (optional)
                    if (ifChildCount == 0) {
                        ifStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (ifChildCount == 1) {
                        ifStmtNode->setConsequent(std::move(nodes_[childIndex]));
                    } else if (ifChildCount == 2) {
                        ifStmtNode->setAlternate(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::WHILE_STMT) {
                auto* whileStmtNode = dynamic_cast<arduino_ast::WhileStatement*>(parentNode.get());
                if (whileStmtNode) {
                    
                    // While statements expect: condition, body
                    if (!whileStmtNode->getCondition()) {
                        whileStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (!whileStmtNode->getBody()) {
                        whileStmtNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::FOR_STMT) {
                auto* forStmtNode = dynamic_cast<arduino_ast::ForStatement*>(parentNode.get());
                if (forStmtNode) {
                    // Count how many children this for statement already has
                    int forChildCount = 0;
                    if (forStmtNode->getInitializer()) forChildCount++;
                    if (forStmtNode->getCondition()) forChildCount++;
                    if (forStmtNode->getIncrement()) forChildCount++;
                    if (forStmtNode->getBody()) forChildCount++;
                    
                    
                    // For statements expect: initializer, condition, increment, body
                    if (forChildCount == 0) {
                        forStmtNode->setInitializer(std::move(nodes_[childIndex]));
                    } else if (forChildCount == 1) {
                        forStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (forChildCount == 2) {
                        forStmtNode->setIncrement(std::move(nodes_[childIndex]));
                    } else if (forChildCount == 3) {
                        forStmtNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::SWITCH_STMT) {
                auto* switchStmtNode = dynamic_cast<arduino_ast::SwitchStatement*>(parentNode.get());
                if (switchStmtNode) {
                    // Switch statements expect: discriminant (condition), then all case statements as children
                    if (!switchStmtNode->getCondition()) {
                        switchStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else {
                        // All subsequent children should be case statements - add them as generic children
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::BINARY_OP) {
                auto* binaryOpNode = dynamic_cast<arduino_ast::BinaryOpNode*>(parentNode.get());
                if (binaryOpNode) {
                    
                    // Binary operations expect: left, right
                    if (!binaryOpNode->getLeft()) {
                        binaryOpNode->setLeft(std::move(nodes_[childIndex]));
                    } else if (!binaryOpNode->getRight()) {
                        binaryOpNode->setRight(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::UNARY_OP) {
                auto* unaryOpNode = dynamic_cast<arduino_ast::UnaryOpNode*>(parentNode.get());
                if (unaryOpNode) {
                    
                    
                    // Unary operations expect: operand
                    if (!unaryOpNode->getOperand()) {
                        unaryOpNode->setOperand(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::ASSIGNMENT) {
                auto* assignmentNode = dynamic_cast<arduino_ast::AssignmentNode*>(parentNode.get());
                if (assignmentNode) {
                    
                    // Assignment operations expect: left, right
                    if (!assignmentNode->getLeft()) {
                        assignmentNode->setLeft(std::move(nodes_[childIndex]));
                    } else if (!assignmentNode->getRight()) {
                        assignmentNode->setRight(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::PARAM_NODE) {
                auto* paramNode = dynamic_cast<arduino_ast::ParamNode*>(parentNode.get());
                if (paramNode) {
                    
                    auto childType = childNodeRef->getType();
                    // According to JavaScript CompactAST export order: 
                    // ParamNode: ['paramType', 'declarator', 'defaultValue']
                    if (childType == ASTNodeType::TYPE_NODE && !paramNode->getParamType()) {
                        paramNode->setParamType(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::DECLARATOR_NODE && !paramNode->getDeclarator()) {
                        paramNode->setDeclarator(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::POSTFIX_EXPRESSION) {
                auto* postfixNode = dynamic_cast<arduino_ast::PostfixExpressionNode*>(parentNode.get());
                if (postfixNode) {

                    // PostfixExpressionNode expects: operand
                    if (!postfixNode->getOperand()) {
                        postfixNode->setOperand(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::CASE_STMT) {
                auto* caseStmtNode = dynamic_cast<arduino_ast::CaseStatement*>(parentNode.get());
                if (caseStmtNode) {
                    // Case statements expect: label (case value), body (statements)
                    if (!caseStmtNode->getLabel()) {
                        caseStmtNode->setLabel(std::move(nodes_[childIndex]));
                    } else if (!caseStmtNode->getBody()) {
                        caseStmtNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::RETURN_STMT) {
                auto* returnStmtNode = dynamic_cast<arduino_ast::ReturnStatement*>(parentNode.get());
                if (returnStmtNode && !returnStmtNode->getReturnValue()) {
                    if (childIndex < nodes_.size() && nodes_[childIndex]) {
                        returnStmtNode->setReturnValue(std::move(nodes_[childIndex]));
                    }
                } else {
                    if (childIndex < nodes_.size() && nodes_[childIndex]) {
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                }
            } else {
                parentNode->addChild(std::move(nodes_[childIndex]));
            }
            
        }
    }
    
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

bool CompactASTReader::validateFormat() const {
    if (bufferSize_ < MIN_BUFFER_SIZE) {
        return false;
    }
    
    // Check magic number (stored in little-endian format)
    uint32_t magic;
    std::memcpy(&magic, buffer_, 4);
    magic = convertFromLittleEndian32(magic);
    
    return magic == COMPACT_AST_MAGIC;
}

void CompactASTReader::validateHeader() const {
    if (header_.magic != COMPACT_AST_MAGIC) {
        throw InvalidFormatException("Invalid magic number: 0x" + 
                                   std::to_string(header_.magic));
    }
    
    if (header_.version > SUPPORTED_VERSION) {
        throw UnsupportedVersionException(header_.version);
    }
    
    if (header_.nodeCount == 0) {
        throw InvalidFormatException("Node count cannot be zero");
    }
    
    // Sanity check: string table size shouldn't exceed buffer
    if (header_.stringTableSize > bufferSize_) {
        throw InvalidFormatException("String table size exceeds buffer size");
    }
}

void CompactASTReader::validatePosition(size_t requiredBytes) const {
    if (position_ + requiredBytes > bufferSize_) {
        throw CorruptDataException("Unexpected end of buffer at position " + 
                                 std::to_string(position_));
    }
}

void CompactASTReader::validateNodeType(uint8_t nodeType) const {
    // Check if node type is in valid range
    if (nodeType == 0 || (nodeType >= 0x53 && nodeType < 0xF0) || nodeType == 0xFF) {
        // Allow some flexibility for unknown node types
        // throw CorruptDataException("Invalid node type: " + std::to_string(nodeType));
    }
}

// =============================================================================
// LOW-LEVEL READING FUNCTIONS
// =============================================================================

uint8_t CompactASTReader::readUint8() {
    return buffer_[position_++];
}

uint16_t CompactASTReader::readUint16() {
    uint16_t value;
    std::memcpy(&value, buffer_ + position_, 2);
    position_ += 2;
    return value;
}

uint32_t CompactASTReader::readUint32() {
    uint32_t value;
    std::memcpy(&value, buffer_ + position_, 4);
    position_ += 4;
    return value;
}

uint64_t CompactASTReader::readUint64() {
    uint64_t value;
    std::memcpy(&value, buffer_ + position_, 8);
    position_ += 8;
    return value;
}

float CompactASTReader::readFloat32() {
    float value;
    std::memcpy(&value, buffer_ + position_, 4);
    position_ += 4;
    return value;
}

double CompactASTReader::readFloat64() {
    double value;
    std::memcpy(&value, buffer_ + position_, 8);
    position_ += 8;
    return value;
}

std::string CompactASTReader::readString(size_t length) {
    std::string result(reinterpret_cast<const char*>(buffer_ + position_), length);
    position_ += length;
    return result;
}

void CompactASTReader::skipBytes(size_t count) {
    position_ += count;
}

void CompactASTReader::alignTo4Bytes() {
    size_t remainder = position_ % 4;
    if (remainder != 0) {
        position_ += (4 - remainder);
    }
}

// =============================================================================
// ENDIANNESS HANDLING
// =============================================================================

uint16_t CompactASTReader::convertFromLittleEndian16(uint16_t value) const {
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    return __builtin_bswap16(value);
    #else
    return value; // Already little-endian
    #endif
}

uint32_t CompactASTReader::convertFromLittleEndian32(uint32_t value) const {
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    return __builtin_bswap32(value);
    #else
    return value; // Already little-endian
    #endif
}

uint64_t CompactASTReader::convertFromLittleEndian64(uint64_t value) const {
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    return __builtin_bswap64(value);
    #else
    return value; // Already little-endian
    #endif
}

uint32_t CompactASTReader::convertFromBigEndian32(uint32_t value) const {
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    return value; // Already big-endian
    #else
    return __builtin_bswap32(value); // Convert from big-endian to little-endian
    #endif
}

// =============================================================================
// MEMORY STATISTICS
// =============================================================================

CompactASTReader::MemoryStats CompactASTReader::getMemoryStats() const {
    MemoryStats stats;
    stats.totalBufferSize = bufferSize_;
    stats.headerSize = sizeof(CompactASTHeader);
    stats.stringTableSize = headerRead_ ? header_.stringTableSize : 0;
    stats.nodeDataSize = stats.totalBufferSize - stats.headerSize - stats.stringTableSize;
    stats.stringCount = stringTable_.size();
    stats.nodeCount = nodes_.size();
    
    // Estimate node memory usage
    stats.estimatedNodeMemory = 0;
    for (const auto& node : nodes_) {
        if (node) {
            stats.estimatedNodeMemory += estimateNodeMemoryUsage(node.get());
        }
    }
    
    return stats;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

bool isValidCompactAST(const uint8_t* buffer, size_t size) {
    if (!buffer || size < MIN_BUFFER_SIZE) {
        return false;
    }
    
    uint32_t magic;
    std::memcpy(&magic, buffer, 4);
    
    // Magic number is stored in little-endian format (consistent with header parsing)
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    magic = __builtin_bswap32(magic); // Convert from little-endian to big-endian
    #else
    // Already little-endian, no conversion needed
    #endif
    
    return magic == COMPACT_AST_MAGIC;
}

// bool isValidCompactAST(std::span<const uint8_t> data) {
//     return isValidCompactAST(data.data(), data.size());
// }

uint16_t getCompactASTVersion(const uint8_t* buffer, size_t size) {
    if (!isValidCompactAST(buffer, size)) {
        return 0;
    }
    
    uint16_t version;
    std::memcpy(&version, buffer + 4, 2);
    
    // Version is stored in little-endian format
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    version = __builtin_bswap16(version);
    #endif
    
    return version;
}

uint32_t getCompactASTNodeCount(const uint8_t* buffer, size_t size) {
    if (!isValidCompactAST(buffer, size)) {
        return 0;
    }
    
    uint32_t nodeCount;
    std::memcpy(&nodeCount, buffer + 8, 4);
    
    // Node count is stored in little-endian format
    #if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    nodeCount = __builtin_bswap32(nodeCount);
    #endif
    
    return nodeCount;
}

size_t estimateParsingMemory(const uint8_t* buffer, size_t size) {
    if (!isValidCompactAST(buffer, size)) {
        return 0;
    }
    
    uint32_t nodeCount = getCompactASTNodeCount(buffer, size);
    
    // Rough estimation:
    // - Each node: ~100 bytes average
    // - String table: ~50% of buffer size
    // - Overhead: ~20%
    
    return (nodeCount * 100) + (size / 2) + (size / 5);
}

std::string dumpAST(const ASTNode* node, int indent) {
    if (!node) {
        return std::string(indent * 2, ' ') + "(null)\n";
    }
    
    std::ostringstream oss;
    std::string indentStr(indent * 2, ' ');
    
    oss << indentStr << node->toString() << "\n";
    
    // Recursively dump children
    for (const auto& child : node->getChildren()) {
        oss << dumpAST(child.get(), indent + 1);
    }
    
    return oss.str();
}

// =============================================================================
// ESP32-SPECIFIC OPTIMIZATIONS
// =============================================================================

#ifdef ARDUINO_ARCH_ESP32

ESP32CompactASTReader::ESP32CompactASTReader(const uint8_t* buffer, size_t size)
    : CompactASTReader(buffer, size), usingPSRAM_(false) {
    
    // Check if we should use PSRAM for large ASTs
    if (size > PSRAM_THRESHOLD && ESP.getPsramSize() > 0) {
        usingPSRAM_ = true;
    }
}

ESP32CompactASTReader ESP32CompactASTReader::fromPROGMEM(const uint8_t* progmemData, size_t size) {
    // Copy from PROGMEM to RAM (or PSRAM if available)
    uint8_t* ramBuffer;
    
    if (size > PSRAM_THRESHOLD && ESP.getPsramSize() > 0) {
        ramBuffer = (uint8_t*)heap_caps_malloc(size, MALLOC_CAP_SPIRAM);
    } else {
        ramBuffer = (uint8_t*)malloc(size);
    }
    
    if (!ramBuffer) {
        throw std::bad_alloc();
    }
    
    memcpy_P(ramBuffer, progmemData, size);
    
    return ESP32CompactASTReader(ramBuffer, size);
}

ESP32CompactASTReader::ESP32MemoryInfo ESP32CompactASTReader::getMemoryInfo() const {
    ESP32MemoryInfo info;
    info.totalHeap = ESP.getHeapSize();
    info.freeHeap = ESP.getFreeHeap();
    info.totalPSRAM = ESP.getPsramSize();
    info.freePSRAM = ESP.getFreePsram();
    info.astMemoryUsage = getMemoryStats().estimatedNodeMemory;
    info.astInPSRAM = usingPSRAM_;
    
    return info;
}

#endif // ARDUINO_ARCH_ESP32

} // namespace arduino_ast