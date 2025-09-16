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
#define DEBUG_OUT std::cerr

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
    DEBUG_OUT << "CompactASTReader::parse(): Starting parse..." << std::endl;
    
    if (!headerRead_) {
        DEBUG_OUT << "CompactASTReader::parse(): Parsing header..." << std::endl;
        parseHeaderInternal();
        DEBUG_OUT << "CompactASTReader::parse(): Header parsed successfully" << std::endl;
    }
    
    if (!stringTableRead_) {
        DEBUG_OUT << "CompactASTReader::parse(): Parsing string table..." << std::endl;
        parseStringTableInternal();
        DEBUG_OUT << "CompactASTReader::parse(): String table parsed successfully" << std::endl;
    }
    
    if (!nodesRead_) {
        DEBUG_OUT << "CompactASTReader::parse(): Parsing nodes..." << std::endl;
        parseNodesInternal();
        DEBUG_OUT << "CompactASTReader::parse(): Nodes parsed successfully" << std::endl;
    }
    
    // Link parent-child relationships
    DEBUG_OUT << "CompactASTReader::parse(): Linking node children..." << std::endl;
    linkNodeChildren();
    DEBUG_OUT << "CompactASTReader::parse(): Children linked successfully" << std::endl;
    
    // Return root node (should be first node)
    if (nodes_.empty()) {
        throw CorruptDataException("No nodes found in AST");
    }
    
    DEBUG_OUT << "CompactASTReader::parse(): Returning root node (index 0)" << std::endl;
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
    
    DEBUG_OUT << "Raw header bytes:" << std::endl;
    for (size_t i = 0; i < 16; i++) {
        DEBUG_OUT << "  [" << i << "] = 0x" << std::hex << (int)buffer_[i] << std::dec << std::endl;
    }
    
    DEBUG_OUT << "Before endianness conversion:" << std::endl;
    DEBUG_OUT << "  magic: 0x" << std::hex << header_.magic << std::dec << std::endl;
    DEBUG_OUT << "  version: 0x" << std::hex << header_.version << std::dec << std::endl;
    DEBUG_OUT << "  flags: 0x" << std::hex << header_.flags << std::dec << std::endl;
    DEBUG_OUT << "  nodeCount: " << header_.nodeCount << std::endl;
    DEBUG_OUT << "  stringTableSize: " << header_.stringTableSize << std::endl;
    
    // All header fields are stored in little-endian format per specification
    header_.magic = convertFromLittleEndian32(header_.magic);
    header_.version = convertFromLittleEndian16(header_.version);
    header_.flags = convertFromLittleEndian16(header_.flags);
    header_.nodeCount = convertFromLittleEndian32(header_.nodeCount);
    header_.stringTableSize = convertFromLittleEndian32(header_.stringTableSize);
    
    DEBUG_OUT << "After endianness conversion:" << std::endl;
    DEBUG_OUT << "  magic: 0x" << std::hex << header_.magic << std::dec << std::endl;
    DEBUG_OUT << "  version: 0x" << std::hex << header_.version << std::dec << std::endl;
    DEBUG_OUT << "  flags: 0x" << std::hex << header_.flags << std::dec << std::endl;
    DEBUG_OUT << "  nodeCount: " << header_.nodeCount << std::endl;
    DEBUG_OUT << "  stringTableSize: " << header_.stringTableSize << std::endl;
    
    validateHeader();
    headerRead_ = true;
}

void CompactASTReader::parseStringTableInternal() {
    if (!headerRead_) {
        parseHeaderInternal();
    }
    
    DEBUG_OUT << "parseStringTableInternal(): Starting at position " << position_ << std::endl;
    DEBUG_OUT << "parseStringTableInternal(): String table size from header: " << header_.stringTableSize << std::endl;
    
    // Read string count
    validatePosition(4);
    uint32_t stringCount = convertFromLittleEndian32(readUint32());
    DEBUG_OUT << "parseStringTableInternal(): String count: " << stringCount << ", position now: " << position_ << std::endl;
    
    stringTable_.clear();
    stringTable_.reserve(stringCount);
    
    // Read each string
    for (uint32_t i = 0; i < stringCount; ++i) {
        validatePosition(2);
        uint16_t stringLength = convertFromLittleEndian16(readUint16());
        DEBUG_OUT << "parseStringTableInternal(): String " << i << " length: " << stringLength << ", position: " << position_ << std::endl;
        
        validatePosition(stringLength + 1); // +1 for null terminator
        std::string str = readString(stringLength);
        
        // Skip null terminator
        position_++;
        DEBUG_OUT << "parseStringTableInternal(): String " << i << ": \"" << str << "\", position now: " << position_ << std::endl;
        
        stringTable_.push_back(std::move(str));
    }
    
    // Align to 4-byte boundary
    DEBUG_OUT << "parseStringTableInternal(): Before alignment, position: " << position_ << std::endl;
    alignTo4Bytes();
    DEBUG_OUT << "parseStringTableInternal(): After alignment, position: " << position_ << std::endl;
    
    stringTableRead_ = true;
}

void CompactASTReader::parseNodesInternal() {
    if (!stringTableRead_) {
        parseStringTableInternal();
    }
    
    nodes_.clear();
    nodes_.reserve(header_.nodeCount);
    
    DEBUG_OUT << "parseNodesInternal(): About to parse " << header_.nodeCount << " nodes" << std::endl;
    
    // Parse each node
    for (uint32_t i = 0; i < header_.nodeCount; ++i) {
        DEBUG_OUT << "parseNodesInternal(): Parsing node " << i << std::endl;
        auto node = parseNode(i);
        DEBUG_OUT << "parseNodesInternal(): Node " << i << " parsed successfully" << std::endl;
        nodes_.push_back(std::move(node));
    }
    
    DEBUG_OUT << "parseNodesInternal(): All nodes parsed successfully" << std::endl;
    nodesRead_ = true;
}

ASTNodePtr CompactASTReader::parseNode(size_t nodeIndex) {
    DEBUG_OUT << "parseNode(" << nodeIndex << "): Starting parse at position " << position_ << std::endl;
    
    validatePosition(4); // NodeType + Flags + DataSize
    
    uint8_t nodeTypeRaw = readUint8();
    uint8_t flags = readUint8();
    uint16_t dataSize = convertFromLittleEndian16(readUint16());
    
    DEBUG_OUT << "parseNode(" << nodeIndex << "): nodeType=" << static_cast<int>(nodeTypeRaw) 
              << ", flags=" << static_cast<int>(flags) 
              << ", dataSize=" << dataSize << std::endl;
    
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
    
    DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating node of type " << static_cast<int>(nodeType) << std::endl;
    
    // Create node
    ASTNodePtr node;
    
    // Create specific node types
    switch (nodeType) {
        // Program structure
        case ASTNodeType::PROGRAM:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ProgramNode" << std::endl;
            node = std::make_unique<ProgramNode>();
            break;
        case ASTNodeType::ERROR_NODE:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ErrorNode" << std::endl;
            node = createNode(nodeType); // Use factory for error nodes
            break;
        case ASTNodeType::COMMENT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating CommentNode" << std::endl;
            node = createNode(nodeType); // Use factory for comments
            break;
            
        // Statements
        case ASTNodeType::COMPOUND_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating CompoundStmtNode" << std::endl;
            node = std::make_unique<CompoundStmtNode>();
            break;
        case ASTNodeType::EXPRESSION_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ExpressionStatement" << std::endl;
            node = std::make_unique<ExpressionStatement>();
            break;
        case ASTNodeType::IF_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating IfStatement" << std::endl;
            node = std::make_unique<IfStatement>();
            break;
        case ASTNodeType::WHILE_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating WhileStatement" << std::endl;
            node = std::make_unique<WhileStatement>();
            break;
        case ASTNodeType::DO_WHILE_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating DoWhileStatement" << std::endl;
            node = std::make_unique<DoWhileStatement>();
            break;
        case ASTNodeType::FOR_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ForStatement" << std::endl;
            node = std::make_unique<ForStatement>();
            break;
        case ASTNodeType::RANGE_FOR_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating RangeBasedForStatement" << std::endl;
            node = std::make_unique<RangeBasedForStatement>();
            break;
        case ASTNodeType::SWITCH_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating SwitchStatement" << std::endl;
            node = std::make_unique<SwitchStatement>();
            break;
        case ASTNodeType::CASE_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating CaseStatement" << std::endl;
            node = std::make_unique<CaseStatement>();
            break;
        case ASTNodeType::RETURN_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ReturnStatement" << std::endl;
            node = std::make_unique<ReturnStatement>();
            break;
        case ASTNodeType::BREAK_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating BreakStatement" << std::endl;
            node = std::make_unique<BreakStatement>();
            break;
        case ASTNodeType::CONTINUE_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ContinueStatement" << std::endl;
            node = std::make_unique<ContinueStatement>();
            break;
        case ASTNodeType::EMPTY_STMT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating EmptyStatement" << std::endl;
            node = std::make_unique<EmptyStatement>();
            break;
            
        // Declarations
        case ASTNodeType::VAR_DECL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating VarDeclNode" << std::endl;
            node = std::make_unique<VarDeclNode>();
            break;
        case ASTNodeType::FUNC_DEF:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating FuncDefNode" << std::endl;
            node = std::make_unique<FuncDefNode>();
            break;
        case ASTNodeType::FUNC_DECL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating FuncDefNode (declaration)" << std::endl;
            node = std::make_unique<FuncDefNode>(); // Use FuncDefNode for declarations too
            break;
        case ASTNodeType::STRUCT_DECL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating StructDeclaration" << std::endl;
            node = std::make_unique<StructDeclaration>();
            break;
        case ASTNodeType::TYPEDEF_DECL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating TypedefDeclaration" << std::endl;
            node = std::make_unique<TypedefDeclaration>();
            break;
            
        // Expressions
        case ASTNodeType::BINARY_OP:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating BinaryOpNode" << std::endl;
            node = std::make_unique<BinaryOpNode>();
            break;
        case ASTNodeType::UNARY_OP:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating UnaryOpNode" << std::endl;
            node = std::make_unique<UnaryOpNode>();
            break;
        case ASTNodeType::ASSIGNMENT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating AssignmentNode" << std::endl;
            node = std::make_unique<AssignmentNode>();
            break;
        case ASTNodeType::FUNC_CALL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating FuncCallNode" << std::endl;
            node = std::make_unique<FuncCallNode>();
            break;
        case ASTNodeType::CONSTRUCTOR_CALL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ConstructorCallNode" << std::endl;
            node = std::make_unique<ConstructorCallNode>();
            break;
        case ASTNodeType::MEMBER_ACCESS:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating MemberAccessNode" << std::endl;
            node = std::make_unique<MemberAccessNode>();
            break;
        case ASTNodeType::ARRAY_ACCESS:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ArrayAccessNode" << std::endl;
            node = std::make_unique<ArrayAccessNode>();
            break;
        case ASTNodeType::TERNARY_EXPR:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating TernaryExpressionNode" << std::endl;
            node = std::make_unique<TernaryExpressionNode>();
            break;
        case ASTNodeType::POSTFIX_EXPRESSION:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating PostfixExpressionNode" << std::endl;
            node = std::make_unique<PostfixExpressionNode>();
            break;
        case ASTNodeType::COMMA_EXPRESSION:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating CommaExpression" << std::endl;
            node = std::make_unique<CommaExpression>();
            break;
            
        // Literals and identifiers
        case ASTNodeType::NUMBER_LITERAL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating NumberNode" << std::endl;
            node = std::make_unique<NumberNode>(0.0);
            break;
        case ASTNodeType::STRING_LITERAL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating StringLiteralNode" << std::endl;
            node = std::make_unique<StringLiteralNode>("");
            break;
        case ASTNodeType::CHAR_LITERAL:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating CharLiteralNode" << std::endl;
            node = std::make_unique<CharLiteralNode>("");
            break;
        case ASTNodeType::IDENTIFIER:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating IdentifierNode" << std::endl;
            node = std::make_unique<IdentifierNode>("");
            break;
        case ASTNodeType::CONSTANT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ConstantNode" << std::endl;
            node = std::make_unique<ConstantNode>("");
            break;
        case ASTNodeType::ARRAY_INIT:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ArrayInitializerNode" << std::endl;
            node = std::make_unique<ArrayInitializerNode>();
            break;
            
        // Types and parameters
        case ASTNodeType::TYPE_NODE:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating TypeNode" << std::endl;
            node = std::make_unique<TypeNode>("void");
            break;
        case ASTNodeType::DECLARATOR_NODE:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating DeclaratorNode" << std::endl;
            node = std::make_unique<DeclaratorNode>();
            break;
        case ASTNodeType::PARAM_NODE:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ParamNode" << std::endl;
            node = std::make_unique<ParamNode>();
            break;
        case ASTNodeType::STRUCT_TYPE:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating StructType" << std::endl;
            node = std::make_unique<StructType>();
            break;
        case ASTNodeType::FUNCTION_POINTER_DECLARATOR:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating FunctionPointerDeclaratorNode" << std::endl;
            node = std::make_unique<FunctionPointerDeclaratorNode>();
            break;
        case ASTNodeType::ARRAY_DECLARATOR:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating ArrayDeclaratorNode" << std::endl;
            node = std::make_unique<ArrayDeclaratorNode>();
            break;
        case ASTNodeType::POINTER_DECLARATOR:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating PointerDeclaratorNode" << std::endl;
            node = std::make_unique<PointerDeclaratorNode>();
            break;
            
        default:
            DEBUG_OUT << "parseNode(" << nodeIndex << "): Creating node via createNode for type " << static_cast<int>(nodeType) << std::endl;
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
        DEBUG_OUT << "parseNode(" << nodeIndex << "): Parsing value..." << std::endl;
        ASTValue value = parseValue();
        node->setValue(value);
        DEBUG_OUT << "parseNode(" << nodeIndex << "): Value parsed" << std::endl;
    }
    
    // Parse children if present
    if (flags & static_cast<uint8_t>(ASTNodeFlags::HAS_CHILDREN)) {
        DEBUG_OUT << "parseNode(" << nodeIndex << "): Parsing children..." << std::endl;
        
        // Child indices should be stored as uint16_t values
        size_t remainingBytes = dataSize - (position_ - dataStart);
        size_t childCount = remainingBytes / 2; // Each child index is 2 bytes
        
        DEBUG_OUT << "parseNode(" << nodeIndex << "): Expected " << childCount << " children (remainingBytes=" << remainingBytes << ")" << std::endl;
        
        for (size_t i = 0; i < childCount; ++i) {
            if (position_ + 2 <= dataStart + dataSize) {
                uint16_t childIndex = convertFromLittleEndian16(readUint16());
                DEBUG_OUT << "parseNode(" << nodeIndex << "): Child " << i << " index: " << childIndex << std::endl;
                
                // Store child index for later linking
                childIndices_[nodeIndex].push_back(childIndex);
            } else {
                DEBUG_OUT << "parseNode(" << nodeIndex << "): Not enough data for child " << i << std::endl;
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
    
    DEBUG_OUT << "parseValue(): valueType = " << static_cast<int>(valueType) << std::endl;
    
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
                DEBUG_OUT << "parseValue(): UINT8_VAL rawValue=" << static_cast<int>(rawValue) 
                         << ", returning double=" << result << std::endl;
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
                    DEBUG_OUT << "Warning: Invalid string index " << stringIndex 
                              << " (table size: " << stringTable_.size() 
                              << "), using empty string" << std::endl;
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
    DEBUG_OUT << "linkNodeChildren(): Linking children for " << childIndices_.size() << " parent nodes" << std::endl;
    
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
        
        DEBUG_OUT << "linkNodeChildren(): Node " << parentIndex << " has " << childIndexList.size() << " children" << std::endl;
        
        if (parentIndex >= nodes_.size()) {
            DEBUG_OUT << "linkNodeChildren(): ERROR - Invalid parent index " << parentIndex << std::endl;
            continue;
        }
        
        auto& parentNode = nodes_[parentIndex];
        if (!parentNode) {
            DEBUG_OUT << "linkNodeChildren(): ERROR - Parent node " << parentIndex << " is null" << std::endl;
            continue;
        }
        
        for (uint16_t childIndex : childIndexList) {
            DEBUG_OUT << "linkNodeChildren(): Linking child " << childIndex << " to parent " << parentIndex << std::endl;
            
            if (childIndex >= nodes_.size()) {
                DEBUG_OUT << "linkNodeChildren(): ERROR - Invalid child index " << childIndex << std::endl;
                continue;
            }
            
            if (!nodes_[childIndex]) {
                DEBUG_OUT << "linkNodeChildren(): ERROR - Child node " << childIndex << " is null" << std::endl;
                continue;
            }
            
            // CRITICAL: Never move the root node (index 0) as it should never be anyone's child
            if (childIndex == 0) {
                DEBUG_OUT << "linkNodeChildren(): WARNING - Attempted to move root node (index 0) as child of " << parentIndex << std::endl;
                DEBUG_OUT << "linkNodeChildren(): This suggests corrupted AST data - skipping this child link" << std::endl;
                continue;
            }
            
            // Get child node without moving (keep it in the array for now)
            auto& childNodeRef = nodes_[childIndex];
            if (!childNodeRef) {
                DEBUG_OUT << "linkNodeChildren(): ERROR - Child node " << childIndex << " is null (already moved?)" << std::endl;
                continue;
            }
            
            // Special handling for specific node types to set up proper structure
            if (parentNode->getType() == ASTNodeType::FUNC_DEF) {
                auto* funcDefNode = dynamic_cast<arduino_ast::FuncDefNode*>(parentNode.get());
                if (funcDefNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up FuncDefNode child " << childIndex << std::endl;
                    
                    // Determine child role based on type - be flexible about order
                    auto childType = childNodeRef->getType();
                    if (childType == ASTNodeType::TYPE_NODE && !funcDefNode->getReturnType()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting return type" << std::endl;
                        funcDefNode->setReturnType(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::DECLARATOR_NODE && !funcDefNode->getDeclarator()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting declarator" << std::endl;
                        funcDefNode->setDeclarator(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::PARAM_NODE) {
                        DEBUG_OUT << "linkNodeChildren(): Adding parameter" << std::endl;
                        funcDefNode->addParameter(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::COMPOUND_STMT && !funcDefNode->getBody()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting body" << std::endl;
                        funcDefNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Adding as generic child (type: " << static_cast<int>(childType) << ")" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::VAR_DECL) {
                auto* varDeclNode = dynamic_cast<arduino_ast::VarDeclNode*>(parentNode.get());
                if (varDeclNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up VarDeclNode child " << childIndex << std::endl;

                    auto childType = childNodeRef->getType();
                    std::cerr << "*** CHILD TYPE IS: " << static_cast<int>(childType) << " ***" << std::endl;
                    if (childType == ASTNodeType::TYPE_NODE && !varDeclNode->getVarType()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting var type" << std::endl;
                        varDeclNode->setVarType(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::DECLARATOR_NODE) {
                        DEBUG_OUT << "linkNodeChildren(): Adding DeclaratorNode to declarations" << std::endl;
                        varDeclNode->addDeclaration(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::ARRAY_DECLARATOR) {
                        DEBUG_OUT << "linkNodeChildren(): Adding ArrayDeclaratorNode to declarations" << std::endl;
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
                        DEBUG_OUT << "linkNodeChildren(): Found expression initializer (type: " << static_cast<int>(childType) << ")" << std::endl;
                        const auto& declarations = varDeclNode->getDeclarations();
                        if (!declarations.empty()) {
                            auto* lastDecl = declarations.back().get();
                            if (lastDecl && lastDecl->getType() == ASTNodeType::DECLARATOR_NODE) {
                                DEBUG_OUT << "linkNodeChildren(): Adding initializer as child to DeclaratorNode" << std::endl;
                                const_cast<arduino_ast::ASTNode*>(lastDecl)->addChild(std::move(nodes_[childIndex]));
                            } else {
                                DEBUG_OUT << "linkNodeChildren(): No DeclaratorNode to attach initializer to" << std::endl;
                                parentNode->addChild(std::move(nodes_[childIndex]));
                            }
                        } else {
                            DEBUG_OUT << "linkNodeChildren(): No declarations to attach initializer to" << std::endl;
                            parentNode->addChild(std::move(nodes_[childIndex]));
                        }
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::EXPRESSION_STMT) {
                DEBUG_OUT << "linkNodeChildren(): Found EXPRESSION_STMT parent node!" << std::endl;
                auto* exprStmtNode = dynamic_cast<arduino_ast::ExpressionStatement*>(parentNode.get());
                if (exprStmtNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up ExpressionStatement child " << childIndex << std::endl;
                    
                    // ExpressionStatement expects its first child to be the expression
                    if (!exprStmtNode->getExpression()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting expression" << std::endl;
                        exprStmtNode->setExpression(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Expression already set, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::FUNC_CALL) {
                DEBUG_OUT << "linkNodeChildren(): Found FUNC_CALL parent node!" << std::endl;
                auto* funcCallNode = dynamic_cast<arduino_ast::FuncCallNode*>(parentNode.get());
                if (funcCallNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up FuncCallNode child " << childIndex << std::endl;

                    // FuncCallNode expects first child as callee, rest as arguments
                    if (!funcCallNode->getCallee()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting callee" << std::endl;
                        funcCallNode->setCallee(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Adding argument" << std::endl;
                        funcCallNode->addArgument(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::CONSTRUCTOR_CALL) {
                DEBUG_OUT << "linkNodeChildren(): Found CONSTRUCTOR_CALL parent node!" << std::endl;
                auto* constructorCallNode = dynamic_cast<arduino_ast::ConstructorCallNode*>(parentNode.get());
                if (constructorCallNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up ConstructorCallNode child " << childIndex << std::endl;

                    // ConstructorCallNode expects first child as callee, rest as arguments (same as FuncCallNode)
                    if (!constructorCallNode->getCallee()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting callee" << std::endl;
                        constructorCallNode->setCallee(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Adding argument" << std::endl;
                        constructorCallNode->addArgument(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::TERNARY_EXPR) {
                DEBUG_OUT << "linkNodeChildren(): Found TERNARY_EXPR parent node!" << std::endl;
                auto* ternaryNode = dynamic_cast<arduino_ast::TernaryExpressionNode*>(parentNode.get());
                if (ternaryNode) {
                    // Count how many children this ternary already has
                    int ternaryChildCount = 0;
                    if (ternaryNode->getCondition()) ternaryChildCount++;
                    if (ternaryNode->getTrueExpression()) ternaryChildCount++;
                    if (ternaryNode->getFalseExpression()) ternaryChildCount++;
                    
                    DEBUG_OUT << "linkNodeChildren(): Setting up TernaryExpressionNode child " << childIndex 
                             << " (relative position: " << ternaryChildCount << ")" << std::endl;
                    
                    // Ternary expressions expect 3 children in order: condition, trueExpression, falseExpression
                    if (ternaryChildCount == 0) {
                        DEBUG_OUT << "linkNodeChildren(): Setting condition" << std::endl;
                        ternaryNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (ternaryChildCount == 1) {
                        DEBUG_OUT << "linkNodeChildren(): Setting true expression" << std::endl;
                        ternaryNode->setTrueExpression(std::move(nodes_[childIndex]));
                    } else if (ternaryChildCount == 2) {
                        DEBUG_OUT << "linkNodeChildren(): Setting false expression" << std::endl;
                        ternaryNode->setFalseExpression(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for ternary expression, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::MEMBER_ACCESS) {
                DEBUG_OUT << "linkNodeChildren(): Found MEMBER_ACCESS parent node!" << std::endl;
                auto* memberAccessNode = dynamic_cast<arduino_ast::MemberAccessNode*>(parentNode.get());
                if (memberAccessNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up MemberAccessNode child " << childIndex << std::endl;
                    
                    // MemberAccessNode expects 2 children in order: object, property
                    if (!memberAccessNode->getObject()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting object" << std::endl;
                        memberAccessNode->setObject(std::move(nodes_[childIndex]));
                    } else if (!memberAccessNode->getProperty()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting property" << std::endl;
                        memberAccessNode->setProperty(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for member access, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::IF_STMT) {
                DEBUG_OUT << "linkNodeChildren(): Found IF_STMT parent node!" << std::endl;
                auto* ifStmtNode = dynamic_cast<arduino_ast::IfStatement*>(parentNode.get());
                if (ifStmtNode) {
                    // Count how many children this if statement already has
                    int ifChildCount = 0;
                    if (ifStmtNode->getCondition()) ifChildCount++;
                    if (ifStmtNode->getConsequent()) ifChildCount++;
                    if (ifStmtNode->getAlternate()) ifChildCount++;
                    
                    DEBUG_OUT << "linkNodeChildren(): Setting up IfStatement child " << childIndex 
                             << " (relative position: " << ifChildCount << ")" << std::endl;
                    
                    // If statements expect: condition, consequent, alternate (optional)
                    if (ifChildCount == 0) {
                        DEBUG_OUT << "linkNodeChildren(): Setting condition" << std::endl;
                        ifStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (ifChildCount == 1) {
                        DEBUG_OUT << "linkNodeChildren(): Setting consequent" << std::endl;
                        ifStmtNode->setConsequent(std::move(nodes_[childIndex]));
                    } else if (ifChildCount == 2) {
                        DEBUG_OUT << "linkNodeChildren(): Setting alternate" << std::endl;
                        ifStmtNode->setAlternate(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for if statement, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::WHILE_STMT) {
                DEBUG_OUT << "linkNodeChildren(): Found WHILE_STMT parent node!" << std::endl;
                auto* whileStmtNode = dynamic_cast<arduino_ast::WhileStatement*>(parentNode.get());
                if (whileStmtNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up WhileStatement child " << childIndex << std::endl;
                    
                    // While statements expect: condition, body
                    if (!whileStmtNode->getCondition()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting condition" << std::endl;
                        whileStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (!whileStmtNode->getBody()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting body" << std::endl;
                        whileStmtNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for while statement, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::FOR_STMT) {
                DEBUG_OUT << "linkNodeChildren(): Found FOR_STMT parent node!" << std::endl;
                auto* forStmtNode = dynamic_cast<arduino_ast::ForStatement*>(parentNode.get());
                if (forStmtNode) {
                    // Count how many children this for statement already has
                    int forChildCount = 0;
                    if (forStmtNode->getInitializer()) forChildCount++;
                    if (forStmtNode->getCondition()) forChildCount++;
                    if (forStmtNode->getIncrement()) forChildCount++;
                    if (forStmtNode->getBody()) forChildCount++;
                    
                    DEBUG_OUT << "linkNodeChildren(): Setting up ForStatement child " << childIndex 
                             << " (relative position: " << forChildCount << ")" << std::endl;
                    
                    // For statements expect: initializer, condition, increment, body
                    if (forChildCount == 0) {
                        DEBUG_OUT << "linkNodeChildren(): Setting initializer" << std::endl;
                        forStmtNode->setInitializer(std::move(nodes_[childIndex]));
                    } else if (forChildCount == 1) {
                        DEBUG_OUT << "linkNodeChildren(): Setting condition" << std::endl;
                        forStmtNode->setCondition(std::move(nodes_[childIndex]));
                    } else if (forChildCount == 2) {
                        DEBUG_OUT << "linkNodeChildren(): Setting increment" << std::endl;
                        forStmtNode->setIncrement(std::move(nodes_[childIndex]));
                    } else if (forChildCount == 3) {
                        DEBUG_OUT << "linkNodeChildren(): Setting body" << std::endl;
                        forStmtNode->setBody(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for for statement, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::BINARY_OP) {
                DEBUG_OUT << "linkNodeChildren(): Found BINARY_OP parent node!" << std::endl;
                auto* binaryOpNode = dynamic_cast<arduino_ast::BinaryOpNode*>(parentNode.get());
                if (binaryOpNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up BinaryOpNode child " << childIndex << std::endl;
                    
                    // Binary operations expect: left, right
                    if (!binaryOpNode->getLeft()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting left operand" << std::endl;
                        binaryOpNode->setLeft(std::move(nodes_[childIndex]));
                    } else if (!binaryOpNode->getRight()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting right operand" << std::endl;
                        binaryOpNode->setRight(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for binary operation, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::UNARY_OP) {
                DEBUG_OUT << "linkNodeChildren(): Found UNARY_OP parent node!" << std::endl;
                auto* unaryOpNode = dynamic_cast<arduino_ast::UnaryOpNode*>(parentNode.get());
                if (unaryOpNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up UnaryOpNode child " << childIndex << std::endl;
                    
                    
                    // Unary operations expect: operand
                    if (!unaryOpNode->getOperand()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting operand" << std::endl;
                        unaryOpNode->setOperand(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for unary operation, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::ASSIGNMENT) {
                DEBUG_OUT << "linkNodeChildren(): Found ASSIGNMENT parent node!" << std::endl;
                auto* assignmentNode = dynamic_cast<arduino_ast::AssignmentNode*>(parentNode.get());
                if (assignmentNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up AssignmentNode child " << childIndex << std::endl;
                    
                    // Assignment operations expect: left, right
                    if (!assignmentNode->getLeft()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting left side" << std::endl;
                        assignmentNode->setLeft(std::move(nodes_[childIndex]));
                    } else if (!assignmentNode->getRight()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting right side" << std::endl;
                        assignmentNode->setRight(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for assignment, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::PARAM_NODE) {
                DEBUG_OUT << "linkNodeChildren(): Found PARAM_NODE parent node!" << std::endl;
                auto* paramNode = dynamic_cast<arduino_ast::ParamNode*>(parentNode.get());
                if (paramNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up ParamNode child " << childIndex << std::endl;
                    
                    auto childType = childNodeRef->getType();
                    // According to JavaScript CompactAST export order: 
                    // ParamNode: ['paramType', 'declarator', 'defaultValue']
                    if (childType == ASTNodeType::TYPE_NODE && !paramNode->getParamType()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting param type" << std::endl;
                        paramNode->setParamType(std::move(nodes_[childIndex]));
                    } else if (childType == ASTNodeType::DECLARATOR_NODE && !paramNode->getDeclarator()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting declarator" << std::endl;
                        paramNode->setDeclarator(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Adding as generic child to ParamNode (type: " << static_cast<int>(childType) << ")" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else if (parentNode->getType() == ASTNodeType::POSTFIX_EXPRESSION) {
                DEBUG_OUT << "linkNodeChildren(): Found POSTFIX_EXPRESSION parent node!" << std::endl;
                auto* postfixNode = dynamic_cast<arduino_ast::PostfixExpressionNode*>(parentNode.get());
                if (postfixNode) {
                    DEBUG_OUT << "linkNodeChildren(): Setting up PostfixExpressionNode child " << childIndex << std::endl;

                    // PostfixExpressionNode expects: operand
                    if (!postfixNode->getOperand()) {
                        DEBUG_OUT << "linkNodeChildren(): Setting operand" << std::endl;
                        postfixNode->setOperand(std::move(nodes_[childIndex]));
                    } else {
                        DEBUG_OUT << "linkNodeChildren(): Too many children for postfix expression, adding as generic child" << std::endl;
                        parentNode->addChild(std::move(nodes_[childIndex]));
                    }
                } else {
                    parentNode->addChild(std::move(nodes_[childIndex]));
                }
            } else {
                parentNode->addChild(std::move(nodes_[childIndex]));
            }
            
            DEBUG_OUT << "linkNodeChildren(): Child " << childIndex << " linked successfully" << std::endl;
        }
    }
    
    DEBUG_OUT << "linkNodeChildren(): All children linked" << std::endl;
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