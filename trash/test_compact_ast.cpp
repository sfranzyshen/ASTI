/**
 * test_compact_ast.cpp - Unit tests for Compact AST binary format
 * 
 * Tests the C++ compact AST parser implementation for correctness
 * and compatibility with JavaScript-generated AST data.
 */

#include "test_utils.hpp"

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// =============================================================================
// COMPACT AST FORMAT TESTS
// =============================================================================

void testHeaderValidation() {
    // Test valid header
    TEST_ASSERT(arduino_ast::isValidCompactAST(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE), "Valid AST should pass validation");
    
    // Test invalid header - wrong magic
    uint8_t invalidMagic[] = { 0x00, 0x00, 0x00, 0x00 };
    TEST_ASSERT(!arduino_ast::isValidCompactAST(invalidMagic, 4), "Invalid magic should fail validation");
    
    // Test too small buffer
    TEST_ASSERT(!arduino_ast::isValidCompactAST(SIMPLE_TEST_AST, 8), "Too small buffer should fail validation");
}

void testHeaderParsing() {
    uint16_t version = arduino_ast::getCompactASTVersion(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    TEST_ASSERT_EQ(version, 0x0100, "Version should be 0x0100");
    
    uint32_t nodeCount = arduino_ast::getCompactASTNodeCount(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    TEST_ASSERT_EQ(nodeCount, 1, "Node count should be 1");
    
    size_t memoryEstimate = arduino_ast::estimateParsingMemory(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    TEST_ASSERT(memoryEstimate > 0, "Memory estimate should be positive");
    TEST_ASSERT(memoryEstimate < 1024, "Memory estimate should be reasonable for simple AST");
}

void testCompactASTReader() {
    arduino_ast::CompactASTReader reader(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    // Test header parsing
    auto header = reader.parseHeader();
    TEST_ASSERT_EQ(header.magic, 0x41535450, "Header magic should match");
    TEST_ASSERT_EQ(header.version, 0x0100, "Header version should match");
    TEST_ASSERT_EQ(header.nodeCount, 1, "Header node count should match");
    TEST_ASSERT_EQ(header.stringTableSize, 16, "Header string table size should match");
    
    // Test full AST parsing
    auto ast = reader.parse();
    TEST_ASSERT(ast != nullptr, "AST parsing should succeed");
    TEST_ASSERT_EQ(ast->getType(), arduino_ast::ASTNodeType::PROGRAM, "Root node should be PROGRAM");
}

void testStringTableParsing() {
    arduino_ast::CompactASTReader reader(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    // Parse string table
    auto stringTable = reader.parseStringTable();
    TEST_ASSERT(stringTable.size() > 0, "String table should not be empty");
    
    // Check for expected string
    bool foundVoid = false;
    for (const auto& str : stringTable) {
        if (str == "void") {
            foundVoid = true;
            break;
        }
    }
    TEST_ASSERT(foundVoid, "String table should contain 'void'");
}

// =============================================================================
// MEMORY MANAGEMENT TESTS
// =============================================================================

void testMemoryLimits() {
    // Test ESP32-S3 memory constraints
    const size_t ESP32_RAM_LIMIT = 512 * 1024; // 512KB
    
    size_t memoryEstimate = arduino_ast::estimateParsingMemory(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    TEST_ASSERT(memoryEstimate < ESP32_RAM_LIMIT, "Simple AST should fit in ESP32 RAM");
    
    // Test large AST handling (simulate)
    const size_t LARGE_AST_SIZE = 10 * 1024; // 10KB AST
    uint8_t* largeAst = new uint8_t[LARGE_AST_SIZE];
    
    // Copy header from simple AST
    memcpy(largeAst, SIMPLE_TEST_AST, std::min(SIMPLE_TEST_AST_SIZE, LARGE_AST_SIZE));
    
    // Update size fields to simulate large AST
    if (LARGE_AST_SIZE >= 16) {
        // Update node count to simulate more nodes
        *reinterpret_cast<uint32_t*>(largeAst + 8) = 100; // 100 nodes
    }
    
    size_t largememoryEstimate = arduino_ast::estimateParsingMemory(largeAst, LARGE_AST_SIZE);
    TEST_ASSERT(largememoryEstimate > memoryEstimate, "Large AST should require more memory");
    
    delete[] largeAst;
}

void testErrorHandling() {
    // Test null pointer
    bool caughtException = false;
    try {
        arduino_ast::CompactASTReader reader(nullptr, 0);
        auto ast = reader.parse();
    } catch (const std::exception&) {
        caughtException = true;
    }
    TEST_ASSERT(caughtException, "Null pointer should throw exception");
    
    // Test corrupted data
    uint8_t corruptedData[32];
    memcpy(corruptedData, SIMPLE_TEST_AST, std::min(sizeof(corruptedData), SIMPLE_TEST_AST_SIZE));
    
    // Corrupt the magic number
    corruptedData[0] = 0xFF;
    
    caughtException = false;
    try {
        arduino_ast::CompactASTReader reader(corruptedData, sizeof(corruptedData));
        auto ast = reader.parse();
    } catch (const std::exception&) {
        caughtException = true;
    }
    TEST_ASSERT(caughtException, "Corrupted data should throw exception");
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

int main() {
    std::cout << "=== Compact AST Unit Tests ===" << std::endl;
    
    int passed = 0;
    int failed = 0;
    
    // Run tests
    auto result1 = runTest("Header Validation", testHeaderValidation);
    if (result1.success) passed++; else failed++;
    
    auto result2 = runTest("Header Parsing", testHeaderParsing);
    if (result2.success) passed++; else failed++;
    
    auto result3 = runTest("CompactASTReader", testCompactASTReader);
    if (result3.success) passed++; else failed++;
    
    auto result4 = runTest("String Table Parsing", testStringTableParsing);
    if (result4.success) passed++; else failed++;
    
    auto result5 = runTest("Memory Limits", testMemoryLimits);
    if (result5.success) passed++; else failed++;
    
    auto result6 = runTest("Error Handling", testErrorHandling);
    if (result6.success) passed++; else failed++;
    
    // Summary
    std::cout << std::endl;
    std::cout << "=== TEST RESULTS ===" << std::endl;
    std::cout << "Passed: " << passed << std::endl;
    std::cout << "Failed: " << failed << std::endl;
    std::cout << "Success Rate: " << (passed * 100 / (passed + failed)) << "%" << std::endl;
    
    return failed == 0 ? 0 : 1;
}