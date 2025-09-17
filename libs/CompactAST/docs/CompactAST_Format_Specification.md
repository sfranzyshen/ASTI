# Compact AST Binary Format Specification v1.0

## Overview
This document defines a cross-platform binary format for Arduino AST data that works identically in JavaScript (ArrayBuffer/DataView) and C++ (binary structs). The format is optimized for embedded systems, particularly ESP32-S3 with 512KB RAM + 8MB PSRAM.

## Design Goals
- **Cross-platform compatibility**: Identical behavior in JavaScript and C++
- **Memory efficiency**: Minimal overhead for embedded systems
- **Type safety**: Explicit type encoding to avoid JS/C++ type conflicts
- **Endianness independence**: Little-endian format for x86/ARM compatibility
- **Alignment safety**: 4-byte aligned structures for performance
- **Version compatibility**: Format versioning for future evolution

## Binary Format Structure

### File Layout
```
[Header: 16 bytes]
[String Table: variable]
[Node Data: variable]
[Padding to 4-byte boundary]
```

### Header Structure (16 bytes)
```cpp
struct CompactASTHeader {
    uint32_t magic;        // 0x41535450 ('ASTP' - AST Parser)
    uint16_t version;      // Format version (0x0100 for v1.0)  
    uint16_t flags;        // Feature flags (reserved)
    uint32_t nodeCount;    // Total number of AST nodes
    uint32_t stringTableSize; // Size of string table in bytes
};
```

### String Table Format
All strings are stored in a central table to reduce memory usage and enable deduplication.

```
[StringCount: 4 bytes] (uint32_t)
[String0Length: 2 bytes] [String0Data: UTF-8] [NullTerminator: 1 byte]
[String1Length: 2 bytes] [String1Data: UTF-8] [NullTerminator: 1 byte]
...
[Padding to 4-byte alignment]
```

**String Encoding:**
- UTF-8 encoding for cross-platform compatibility
- Length-prefixed (2 bytes, max 65535 chars per string)
- Null-terminated for C++ compatibility
- Empty strings encoded as length=0, no data, null terminator only

### Node Data Format

Each AST node is encoded as:
```
[NodeType: 1 byte] [Flags: 1 byte] [DataSize: 2 bytes] [NodeData: variable]
```

**NodeType Values:**
```cpp
enum class ASTNodeType : uint8_t {
    // Program structure
    PROGRAM = 0x01,
    ERROR_NODE = 0x02,
    COMMENT = 0x03,
    
    // Statements
    COMPOUND_STMT = 0x10,
    EXPRESSION_STMT = 0x11,
    IF_STMT = 0x12,
    WHILE_STMT = 0x13,
    DO_WHILE_STMT = 0x14,
    FOR_STMT = 0x15,
    RANGE_FOR_STMT = 0x16,
    SWITCH_STMT = 0x17,
    CASE_STMT = 0x18,
    RETURN_STMT = 0x19,
    BREAK_STMT = 0x1A,
    CONTINUE_STMT = 0x1B,
    EMPTY_STMT = 0x1C,
    
    // Declarations
    VAR_DECL = 0x20,
    FUNC_DEF = 0x21,
    FUNC_DECL = 0x22,
    STRUCT_DECL = 0x23,
    ENUM_DECL = 0x24,
    CLASS_DECL = 0x25,
    TYPEDEF_DECL = 0x26,
    TEMPLATE_DECL = 0x27,
    
    // Expressions
    BINARY_OP = 0x30,
    UNARY_OP = 0x31,
    ASSIGNMENT = 0x32,
    FUNC_CALL = 0x33,
    MEMBER_ACCESS = 0x34,
    ARRAY_ACCESS = 0x35,
    CAST_EXPR = 0x36,
    SIZEOF_EXPR = 0x37,
    TERNARY_EXPR = 0x38,
    
    // Literals and identifiers
    NUMBER_LITERAL = 0x40,
    STRING_LITERAL = 0x41,
    CHAR_LITERAL = 0x42,
    IDENTIFIER = 0x43,
    CONSTANT = 0x44,
    ARRAY_INIT = 0x45,
    
    // Types
    TYPE_NODE = 0x50,
    DECLARATOR = 0x51,
    PARAMETER = 0x52,
    POSTFIX_EXPRESSION_NODE = 0x53,
    STRUCT_TYPE = 0x54,
    FUNCTION_POINTER_DECLARATOR_NODE = 0x55,
    COMMA_EXPRESSION = 0x56,
    ARRAY_DECLARATOR_NODE = 0x57,
    POINTER_DECLARATOR_NODE = 0x58,
    
    // Reserved for future use
    RESERVED_START = 0xF0
};
```

**Flags Field (1 byte):**
```cpp
enum ASTNodeFlags : uint8_t {
    HAS_CHILDREN = 0x01,    // Node has child nodes
    HAS_VALUE = 0x02,       // Node has a value field
    HAS_METADATA = 0x04,    // Node has extended metadata
    IS_POINTER = 0x08,      // Type is a pointer (for TypeNode)
    IS_REFERENCE = 0x10,    // Type is a reference (for TypeNode)
    IS_CONST = 0x20,        // Type is const (for TypeNode)
    RESERVED1 = 0x40,       // Reserved for future use
    RESERVED2 = 0x80        // Reserved for future use
};
```

## Type-Safe Value Encoding

To handle JavaScript's dynamic typing vs C++'s static typing, values are encoded with explicit type tags:

### Value Format
```
[ValueType: 1 byte] [ValueData: variable]
```

**Value Types:**
```cpp
enum class ValueType : uint8_t {
    VOID_VAL = 0x00,        // No value
    BOOL_VAL = 0x01,        // Boolean (1 byte: 0 or 1)
    INT8_VAL = 0x02,        // 8-bit signed integer
    UINT8_VAL = 0x03,       // 8-bit unsigned integer  
    INT16_VAL = 0x04,       // 16-bit signed integer
    UINT16_VAL = 0x05,      // 16-bit unsigned integer
    INT32_VAL = 0x06,       // 32-bit signed integer
    UINT32_VAL = 0x07,      // 32-bit unsigned integer
    INT64_VAL = 0x08,       // 64-bit signed integer
    UINT64_VAL = 0x09,      // 64-bit unsigned integer
    FLOAT32_VAL = 0x0A,     // 32-bit IEEE 754 float
    FLOAT64_VAL = 0x0B,     // 64-bit IEEE 754 double
    STRING_VAL = 0x0C,      // String table index (2 bytes)
    ARRAY_VAL = 0x0D,       // Array of values
    NULL_VAL = 0x0E,        // Null pointer/reference
    OPERATOR_VAL = 0x0F     // Operator token (string table index)
};
```

### Specific Node Formats

#### NumberNode
```
NodeType: NUMBER_LITERAL
Flags: HAS_VALUE
DataSize: 5 bytes
Data: [ValueType: FLOAT64_VAL] [Value: 8 bytes]
```

#### IdentifierNode  
```
NodeType: IDENTIFIER
Flags: HAS_VALUE
DataSize: 3 bytes
Data: [ValueType: STRING_VAL] [StringIndex: 2 bytes]
```

#### BinaryOpNode
```
NodeType: BINARY_OP
Flags: HAS_CHILDREN | HAS_VALUE
DataSize: 7 bytes  
Data: [ValueType: OPERATOR_VAL] [OperatorIndex: 2 bytes] [LeftChild: 2 bytes] [RightChild: 2 bytes]
```

#### FuncCallNode
```
NodeType: FUNC_CALL
Flags: HAS_CHILDREN
DataSize: 6 bytes
Data: [CalleeIndex: 2 bytes] [ArgumentCount: 2 bytes] [ArgumentIndices: ArgumentCount * 2 bytes]
```

## Memory Optimization Features

### String Deduplication
- Common strings like "setup", "loop", "HIGH", "LOW" are stored once
- String table sorted by frequency for better cache performance
- Empty strings use single null byte

### Node Indexing
- Nodes referenced by 16-bit indices (max 65535 nodes per AST)
- Parent-child relationships stored as index arrays
- Reduces pointer size from 8 bytes to 2 bytes on 64-bit systems

### Alignment and Padding
- All structures 4-byte aligned for optimal access
- Padding bytes explicitly accounted for in size calculations
- Compatible with both x86 and ARM alignment requirements

## Cross-Platform Implementation

### JavaScript Implementation
```javascript
class CompactASTReader {
    constructor(arrayBuffer) {
        this.buffer = arrayBuffer;
        this.view = new DataView(arrayBuffer);
        this.position = 0;
        this.stringTable = [];
        this.nodes = [];
    }
    
    readHeader() {
        const magic = this.view.getUint32(0, true); // little-endian
        const version = this.view.getUint16(4, true);
        const flags = this.view.getUint16(6, true);
        const nodeCount = this.view.getUint32(8, true);
        const stringTableSize = this.view.getUint32(12, true);
        return { magic, version, flags, nodeCount, stringTableSize };
    }
    
    readStringTable() {
        // Implementation details...
    }
}
```

### C++ Implementation  
```cpp
class CompactASTReader {
private:
    const uint8_t* buffer;
    size_t bufferSize;
    std::vector<std::string> stringTable;
    std::vector<std::unique_ptr<ASTNode>> nodes;
    
public:
    CompactASTReader(const uint8_t* data, size_t size) 
        : buffer(data), bufferSize(size) {}
    
    CompactASTHeader readHeader() {
        if (bufferSize < sizeof(CompactASTHeader)) {
            throw std::runtime_error("Buffer too small for header");
        }
        CompactASTHeader header;
        std::memcpy(&header, buffer, sizeof(header));
        // Convert from little-endian if necessary
        return header;
    }
};
```

## ESP32-S3 Optimizations

### Memory Layout
- **Flash Storage**: Store string table and node type definitions in PROGMEM
- **PSRAM Usage**: Store large AST trees in external PSRAM (8MB available)
- **RAM Usage**: Keep only active node cache in internal RAM (512KB)

### Performance Features
- **Lazy Loading**: Load nodes on demand to reduce memory usage
- **Node Caching**: LRU cache for frequently accessed nodes
- **Stack Optimization**: Iterative traversal instead of recursive to avoid stack overflow

## Validation and Error Handling

### Format Validation
```cpp
bool validateFormat(const uint8_t* buffer, size_t size) {
    if (size < sizeof(CompactASTHeader)) return false;
    
    CompactASTHeader* header = (CompactASTHeader*)buffer;
    if (header->magic != 0x41535450) return false;
    if (header->version > 0x0100) return false;
    
    // Additional validation...
    return true;
}
```

### Error Recovery
- Graceful handling of corrupted data
- Fallback to error nodes for invalid sections  
- Partial parsing support for truncated files

## Future Extensions

### Version 1.1 Planned Features
- Compressed node data using simple RLE encoding
- Extended metadata for debugging information
- Type template argument storage optimization
- Incremental AST updates for dynamic code

### Backwards Compatibility
- Version field in header ensures compatibility checking
- New features use reserved flag bits
- Old readers can safely ignore unknown node types

This format provides a robust foundation for cross-platform AST interchange while maintaining optimal performance for embedded systems.