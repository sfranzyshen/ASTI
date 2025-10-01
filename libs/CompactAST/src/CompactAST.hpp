/**
 * CompactAST.hpp - C++ Compact AST Binary Format Reader/Writer
 * 
 * Cross-platform binary AST parser that reads the compact format generated
 * by JavaScript exportCompactAST() function. Designed for ESP32-S3 constraints.
 * 
 * Version: 2.3.0
 * Compatible with: ArduinoParser.js exportCompactAST() v6.0.0
 * Format: Compact AST Binary Format Specification v2.3.0
 */

#pragma once

#include "../../../src/cpp/ASTNodes.hpp"
#include <cstdint>
#include <vector>
#include <string>
#include <memory>
#include <exception>
#include <map>
// #include <span>  // C++20 only, using C++17 compatible alternatives

namespace arduino_ast {

// =============================================================================
// HEADER STRUCTURES
// =============================================================================

/**
 * Binary header structure (16 bytes, little-endian)
 * Must match JavaScript CompactASTExporter exactly
 */
#pragma pack(push, 1)
struct CompactASTHeader {
    uint32_t magic;           // 0x41535450 ('ASTP')
    uint16_t version;         // 0x0100 for v1.0
    uint16_t flags;           // Feature flags
    uint32_t nodeCount;       // Number of AST nodes
    uint32_t stringTableSize; // String table size in bytes
};
#pragma pack(pop)

static_assert(sizeof(CompactASTHeader) == 16, "Header size must be 16 bytes");

// =============================================================================
// EXCEPTIONS
// =============================================================================

class CompactASTException : public std::exception {
private:
    std::string message_;
    
public:
    explicit CompactASTException(const std::string& message) : message_(message) {}
    const char* what() const noexcept override { return message_.c_str(); }
};

class InvalidFormatException : public CompactASTException {
public:
    explicit InvalidFormatException(const std::string& detail) 
        : CompactASTException("Invalid AST format: " + detail) {}
};

class CorruptDataException : public CompactASTException {
public:
    explicit CorruptDataException(const std::string& detail)
        : CompactASTException("Corrupt AST data: " + detail) {}
};

class UnsupportedVersionException : public CompactASTException {
public:
    explicit UnsupportedVersionException(uint16_t version)
        : CompactASTException("Unsupported format version: 0x" + 
                             std::to_string(version)) {}
};

// =============================================================================
// COMPACT AST READER
// =============================================================================

/**
 * Reads binary AST format and reconstructs C++ AST nodes
 * Memory-efficient streaming parser for embedded systems
 */
class CompactASTReader {
private:
    const uint8_t* buffer_;
    size_t bufferSize_;
    size_t position_;
    
    CompactASTHeader header_;
    std::vector<std::string> stringTable_;
    std::vector<ASTNodePtr> nodes_;
    std::map<size_t, std::vector<uint16_t>> childIndices_; // nodeIndex -> child indices
    
    // Reading state
    bool headerRead_;
    bool stringTableRead_;
    bool nodesRead_;
    
public:
    /**
     * Constructor with buffer ownership semantics
     * @param buffer Pointer to binary AST data
     * @param size Size of buffer in bytes
     * @param takeOwnership If true, reader will delete[] buffer in destructor
     */
    explicit CompactASTReader(const uint8_t* buffer, size_t size, bool takeOwnership = false);
    
    ~CompactASTReader() = default;
    
    // Non-copyable, movable
    CompactASTReader(const CompactASTReader&) = delete;
    CompactASTReader& operator=(const CompactASTReader&) = delete;
    CompactASTReader(CompactASTReader&&) = default;
    CompactASTReader& operator=(CompactASTReader&&) = default;
    
    /**
     * Parse complete AST from buffer
     * @return Root AST node (usually ProgramNode)
     */
    ASTNodePtr parse();
    
    /**
     * Parse only header information (fast)
     * @return Header information
     */
    CompactASTHeader parseHeader();
    
    /**
     * Get parsed string table (after parsing)
     */
    const std::vector<std::string>& getStringTable() const { return stringTable_; }
    
    /**
     * Get all parsed nodes (after parsing)
     */
    const std::vector<ASTNodePtr>& getNodes() const { return nodes_; }
    
    /**
     * Get memory usage statistics
     */
    struct MemoryStats {
        size_t totalBufferSize;
        size_t headerSize;
        size_t stringTableSize;
        size_t nodeDataSize;
        size_t estimatedNodeMemory;
        size_t stringCount;
        size_t nodeCount;
    };
    
    MemoryStats getMemoryStats() const;
    
    /**
     * Validate buffer format without full parsing
     * @return true if format appears valid
     */
    bool validateFormat() const;

private:
    // Low-level reading functions
    uint8_t readUint8();
    uint16_t readUint16();
    uint32_t readUint32();
    uint64_t readUint64();
    float readFloat32();
    double readFloat64();
    std::string readString(size_t length);
    void skipBytes(size_t count);
    void alignTo4Bytes();
    
    // Format parsing functions
    void parseHeaderInternal();
    void parseStringTableInternal();
    void parseNodesInternal();
    
    ASTNodePtr parseNode(size_t nodeIndex);
    ASTValue parseValue();
    void linkNodeChildren();
    
    // Validation helpers
    void validateHeader() const;
    void validatePosition(size_t requiredBytes) const;
    void validateNodeType(uint8_t nodeType) const;
    
    // Endianness handling
    uint16_t convertFromLittleEndian16(uint16_t value) const;
    uint32_t convertFromLittleEndian32(uint32_t value) const;
    uint64_t convertFromLittleEndian64(uint64_t value) const;
    uint32_t convertFromBigEndian32(uint32_t value) const;
};

// =============================================================================
// COMPACT AST WRITER (Future Extension)
// =============================================================================

/**
 * Writes C++ AST nodes to binary format
 * For future bidirectional compatibility
 */
class CompactASTWriter {
private:
    std::vector<uint8_t> buffer_;
    std::map<std::string, uint16_t> stringTable_;
    std::vector<std::string> strings_;
    uint16_t version_;
    uint16_t flags_;
    
public:
    explicit CompactASTWriter(uint16_t version = 0x0100, uint16_t flags = 0x0000);
    
    /**
     * Write AST to binary format
     * @param rootNode Root of AST to write
     * @return Binary data
     */
    std::vector<uint8_t> write(const ASTNode* rootNode);
    
    /**
     * Get current buffer size
     */
    size_t getBufferSize() const { return buffer_.size(); }
    
private:
    void writeHeader(uint32_t nodeCount, uint32_t stringTableSize);
    void writeStringTable();
    void writeNodes(const ASTNode* rootNode);
    void collectStringsAndNodes(const ASTNode* node);
    
    uint16_t addString(const std::string& str);
    void writeUint8(uint8_t value);
    void writeUint16(uint16_t value);
    void writeUint32(uint32_t value);
    void writeFloat64(double value);
    void writeString(const std::string& str);
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Quick format validation without full parsing
 * @param buffer Binary data
 * @param size Buffer size
 * @return true if format appears valid
 */
bool isValidCompactAST(const uint8_t* buffer, size_t size);
bool isValidCompactAST(const uint8_t* buffer, size_t size);

/**
 * Get format version from buffer
 * @param buffer Binary data
 * @param size Buffer size
 * @return Format version or 0 if invalid
 */
uint16_t getCompactASTVersion(const uint8_t* buffer, size_t size);

/**
 * Get node count from buffer header
 * @param buffer Binary data
 * @param size Buffer size
 * @return Node count or 0 if invalid
 */
uint32_t getCompactASTNodeCount(const uint8_t* buffer, size_t size);

/**
 * Estimate memory required for parsing
 * @param buffer Binary data
 * @param size Buffer size
 * @return Estimated memory in bytes
 */
size_t estimateParsingMemory(const uint8_t* buffer, size_t size);

/**
 * Debug function to dump AST structure
 * @param node Root node to dump
 * @param indent Current indentation level
 * @return String representation
 */
std::string dumpAST(const ASTNode* node, int indent = 0);

// =============================================================================
// ESP32-S3 OPTIMIZATIONS
// =============================================================================

#ifdef ARDUINO_ARCH_ESP32

/**
 * ESP32-specific memory-optimized reader
 * Uses PSRAM for large ASTs, internal RAM for active nodes
 */
class ESP32CompactASTReader : public CompactASTReader {
private:
    static constexpr size_t PSRAM_THRESHOLD = 32768; // 32KB
    bool usingPSRAM_;
    
public:
    explicit ESP32CompactASTReader(const uint8_t* buffer, size_t size);
    
    /**
     * Load AST from PROGMEM (flash storage)
     */
    static ESP32CompactASTReader fromPROGMEM(const uint8_t* progmemData, size_t size);
    
    /**
     * Check if using PSRAM for storage
     */
    bool isUsingPSRAM() const { return usingPSRAM_; }
    
    /**
     * Get ESP32 memory information
     */
    struct ESP32MemoryInfo {
        size_t totalHeap;
        size_t freeHeap;
        size_t totalPSRAM;
        size_t freePSRAM;
        size_t astMemoryUsage;
        bool astInPSRAM;
    };
    
    ESP32MemoryInfo getMemoryInfo() const;
};

#endif // ARDUINO_ARCH_ESP32

} // namespace arduino_ast