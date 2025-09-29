/**
 * test_interpreter_integration.cpp - Integration tests for AST Interpreter
 * 
 * Tests the complete C++ AST interpreter integration with embedded AST data,
 * command generation, and Arduino hardware simulation.
 */

#include "test_utils.hpp"

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// =============================================================================
// BASIC INTERPRETER TESTS
// =============================================================================

void testBasicInterpreterCreation() {
    // Test interpreter creation with embedded AST
    auto interpreter = createInterpreterFromBinary(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    TEST_ASSERT(interpreter != nullptr, "Interpreter creation should succeed");
    
    TEST_ASSERT_EQ(interpreter->getState(), ExecutionState::IDLE, "Initial state should be IDLE");
    TEST_ASSERT(!interpreter->isRunning(), "Interpreter should not be running initially");
}

void testInterpreterConfiguration() {
    InterpreterOptions options;
    options.verbose = true;
    options.debug = false;
    options.maxLoopIterations = 10;
    options.enableSerial = true;
    
    auto interpreter = std::make_unique<ASTInterpreter>(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE, options);
    TEST_ASSERT(interpreter != nullptr, "Interpreter with custom options should be created");
}

void testMemoryStatistics() {
    auto interpreter = createInterpreterFromBinary(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    auto memStats = interpreter->getMemoryStats();
    TEST_ASSERT(memStats.totalMemory > 0, "Total memory should be positive");
    TEST_ASSERT(memStats.astMemory > 0, "AST memory should be positive");
    TEST_ASSERT(memStats.variableCount >= 0, "Variable count should be non-negative");
    TEST_ASSERT(memStats.pendingRequests == 0, "Initial pending requests should be zero");
}

// =============================================================================
// EXECUTION TESTS
// =============================================================================

void testBasicExecution() {
    auto interpreter = createInterpreterFromBinary(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    CommandStreamCapture capture;
    interpreter->setCommandListener(&capture);
    
    // Start execution
    bool started = interpreter->start();
    TEST_ASSERT(started, "Interpreter should start successfully");
    
    // Wait a moment for execution
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    // Check that some commands were generated
    TEST_ASSERT(capture.getCommandCount() > 0, "Some commands should be generated");
    
    interpreter->stop();
}

void testCommandCapture() {
    auto interpreter = createInterpreterFromBinary(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    CommandStreamCapture capture(true); // verbose
    MockResponseHandler responseHandler;
    
    interpreter->setCommandListener(&capture);
    interpreter->setResponseHandler(&responseHandler);
    
    // Execute with timeout
    TestResult result = executeWithTimeout(*interpreter, 2000);
    
    TEST_ASSERT(!result.commandStream.empty(), "Command stream should not be empty");
    
    // Check for expected system commands
    const auto& commands = capture.getCommands();
    bool foundStart = false;
    bool foundEnd = false;
    
    for (const auto& cmd : commands) {
        if (cmd->type == CommandType::PROGRAM_START) foundStart = true;
        if (cmd->type == CommandType::PROGRAM_END || cmd->type == CommandType::ERROR) foundEnd = true;
    }
    
    TEST_ASSERT(foundStart, "Should find PROGRAM_START command");
    TEST_ASSERT(foundEnd, "Should find PROGRAM_END or ERROR command");
}

// =============================================================================
// ARDUINO SIMULATION TESTS
// =============================================================================

void testArduinoFunctionSimulation() {
    // Create more complex Arduino code for testing
    const uint8_t ARDUINO_TEST_AST[] = {
        // Header (16 bytes) - simplified for test
        0x50, 0x54, 0x53, 0x41,  // Magic: 'ASTP'
        0x00, 0x01,              // Version: 0x0100
        0x00, 0x00,              // Flags: 0x0000
        0x03, 0x00, 0x00, 0x00,  // Node count: 3 (setup, loop, statements)
        0x20, 0x00, 0x00, 0x00,  // String table size: 32
        
        // String table (32 bytes) - simplified
        0x03, 0x00, 0x00, 0x00,  // String count: 3
        0x05, 0x00, 's', 'e', 't', 'u', 'p', 0x00, 0x00, 0x00, // "setup"
        0x04, 0x00, 'l', 'o', 'o', 'p', 0x00, 0x00, 0x00, 0x00, // "loop" 
        0x07, 0x00, 'd', 'i', 'g', 'i', 't', 'a', 'l', 0x00,    // "digital"
        
        // Node data (simplified)
        0x01, 0x00, 0x00, 0x00,  // PROGRAM node
        0x02, 0x00, 0x00, 0x00,  // FUNCTION_DEF node
        0x03, 0x00, 0x00, 0x00   // EXPRESSION_STATEMENT node
    };
    
    const size_t ARDUINO_TEST_AST_SIZE = sizeof(ARDUINO_TEST_AST);
    
    auto interpreter = createInterpreterFromBinary(ARDUINO_TEST_AST, ARDUINO_TEST_AST_SIZE);
    
    CommandStreamCapture capture;
    MockResponseHandler responseHandler;
    
    // Set up mock responses for Arduino functions
    responseHandler.setDefaultAnalogValue(512);
    responseHandler.setDefaultDigitalValue(1);
    
    interpreter->setCommandListener(&capture);
    interpreter->setResponseHandler(&responseHandler);
    
    TestResult result = executeWithTimeout(*interpreter, 3000);
    
    // Should have executed without errors (even with simplified AST)
    TEST_ASSERT(result.commandCount > 0, "Should generate some commands");
}

void testTimeoutHandling() {
    auto interpreter = createInterpreterFromBinary(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    CommandStreamCapture capture;
    interpreter->setCommandListener(&capture);
    
    // Test with very short timeout
    TestResult result = executeWithTimeout(*interpreter, 50); // 50ms timeout
    
    // Should either complete quickly or timeout
    TEST_ASSERT(result.executionTime.count() <= 1000, "Execution should complete within reasonable time"); // 1 second max
}

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

void testInvalidASTHandling() {
    // Test with corrupted AST data
    uint8_t corruptedAST[] = { 0xFF, 0xFF, 0xFF, 0xFF };
    
    bool caughtException = false;
    try {
        auto interpreter = createInterpreterFromBinary(corruptedAST, sizeof(corruptedAST));
        // Should throw during creation or start
        if (interpreter) {
            interpreter->start();
        }
    } catch (const std::exception&) {
        caughtException = true;
    }
    
    TEST_ASSERT(caughtException, "Corrupted AST should throw exception");
}

void testMemoryConstraints() {
    auto interpreter = createInterpreterFromBinary(SIMPLE_TEST_AST, SIMPLE_TEST_AST_SIZE);
    
    auto memStats = interpreter->getMemoryStats();
    
    // Test ESP32-S3 constraints
    const size_t ESP32_RAM_LIMIT = 512 * 1024; // 512KB
    TEST_ASSERT(memStats.totalMemory < ESP32_RAM_LIMIT, "Memory usage should be within ESP32 limits");
    
    // Test reasonable memory usage for simple AST
    TEST_ASSERT(memStats.totalMemory < 64 * 1024, "Simple AST should use less than 64KB"); // 64KB
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

int main() {
    std::cout << "=== Interpreter Integration Tests ===" << std::endl;
    
    int passed = 0;
    int failed = 0;
    
    // Run tests
    auto result1 = runTest("Basic Interpreter Creation", testBasicInterpreterCreation);
    if (result1.success) passed++; else failed++;
    
    auto result2 = runTest("Interpreter Configuration", testInterpreterConfiguration);
    if (result2.success) passed++; else failed++;
    
    auto result3 = runTest("Memory Statistics", testMemoryStatistics);
    if (result3.success) passed++; else failed++;
    
    auto result4 = runTest("Basic Execution", testBasicExecution);
    if (result4.success) passed++; else failed++;
    
    auto result5 = runTest("Command Capture", testCommandCapture);
    if (result5.success) passed++; else failed++;
    
    auto result6 = runTest("Arduino Function Simulation", testArduinoFunctionSimulation);
    if (result6.success) passed++; else failed++;
    
    auto result7 = runTest("Timeout Handling", testTimeoutHandling);
    if (result7.success) passed++; else failed++;
    
    auto result8 = runTest("Invalid AST Handling", testInvalidASTHandling);
    if (result8.success) passed++; else failed++;
    
    auto result9 = runTest("Memory Constraints", testMemoryConstraints);
    if (result9.success) passed++; else failed++;
    
    // Summary
    std::cout << std::endl;
    std::cout << "=== TEST RESULTS ===" << std::endl;
    std::cout << "Passed: " << passed << std::endl;
    std::cout << "Failed: " << failed << std::endl;
    std::cout << "Success Rate: " << (passed * 100 / (passed + failed)) << "%" << std::endl;
    
    return failed == 0 ? 0 : 1;
}