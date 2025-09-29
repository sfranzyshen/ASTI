/**
 * test_command_protocol.cpp - Unit tests for Command Protocol
 * 
 * Tests the C++ command protocol implementation for compatibility
 * with the JavaScript ASTInterpreter.js command system.
 */

#include "test_utils.hpp"

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// =============================================================================
// COMMAND CREATION TESTS
// =============================================================================

void testBasicCommandCreation() {
    // Test PIN_MODE command
    auto pinMode = createPinModeCommand(13, PinMode::OUTPUT);
    TEST_ASSERT(pinMode != nullptr, "PIN_MODE command creation failed");
    TEST_ASSERT_EQ(pinMode->type, CommandType::PIN_MODE, "PIN_MODE command type");
    
    // Test DIGITAL_WRITE command
    auto digitalWrite = createDigitalWriteCommand(13, PinState::HIGH);
    TEST_ASSERT(digitalWrite != nullptr, "DIGITAL_WRITE command creation failed");
    TEST_ASSERT_EQ(digitalWrite->type, CommandType::DIGITAL_WRITE, "DIGITAL_WRITE command type");
    
    // Test ANALOG_READ_REQUEST command
    RequestId requestId("analogRead", "test", 12345);
    auto analogRead = createAnalogReadRequestCommand(0, requestId);
    TEST_ASSERT(analogRead != nullptr, "ANALOG_READ_REQUEST command creation failed");
    TEST_ASSERT_EQ(analogRead->type, CommandType::ANALOG_READ_REQUEST, "ANALOG_READ_REQUEST command type");
}

void testCommandSerialization() {
    // Test command to string conversion
    auto pinMode = createPinModeCommand(13, PinMode::OUTPUT);
    std::string cmdStr = pinMode->toString();
    TEST_ASSERT(!cmdStr.empty(), "Command toString should not be empty");
    TEST_ASSERT(cmdStr.find("PIN_MODE") != std::string::npos, "Command string should contain type");
    
    // Test command to JSON conversion
    std::string cmdJson = pinMode->toJson();
    TEST_ASSERT(!cmdJson.empty(), "Command toJson should not be empty");
    TEST_ASSERT(cmdJson.find("\"type\"") != std::string::npos, "Command JSON should contain type field");
    TEST_ASSERT(cmdJson.find("PIN_MODE") != std::string::npos, "Command JSON should contain type value");
}

void testCommandTypes() {
    // Test command type to string conversion
    TEST_ASSERT_EQ(commandTypeToString(CommandType::PIN_MODE), "PIN_MODE", "PIN_MODE string");
    TEST_ASSERT_EQ(commandTypeToString(CommandType::DIGITAL_WRITE), "DIGITAL_WRITE", "DIGITAL_WRITE string");
    TEST_ASSERT_EQ(commandTypeToString(CommandType::ANALOG_READ_REQUEST), "ANALOG_READ_REQUEST", "ANALOG_READ_REQUEST string");
    TEST_ASSERT_EQ(commandTypeToString(CommandType::SERIAL_PRINT), "SERIAL_PRINT", "SERIAL_PRINT string");
    TEST_ASSERT_EQ(commandTypeToString(CommandType::DELAY), "DELAY", "DELAY string");
}

// =============================================================================
// COMMAND VALUE TESTS
// =============================================================================

void testCommandValueConversion() {
    // Test integer values
    CommandValue intVal = static_cast<int32_t>(42);
    std::string intStr = commandValueToString(intVal);
    TEST_ASSERT_EQ(intStr, "42", "Integer command value string");
    
    // Test double values
    CommandValue doubleVal = 3.14159;
    std::string doubleStr = commandValueToString(doubleVal);
    TEST_ASSERT(doubleStr.find("3.14") != std::string::npos, "Double command value string");
    
    // Test string values
    CommandValue stringVal = std::string("Hello World");
    std::string stringStr = commandValueToString(stringVal);
    TEST_ASSERT_EQ(stringStr, "Hello World", "String command value string");
    
    // Test boolean values
    CommandValue boolVal = true;
    std::string boolStr = commandValueToString(boolVal);
    TEST_ASSERT_EQ(boolStr, "true", "Boolean command value string");
}

void testCommandValueJson() {
    // Test various value types in JSON format
    CommandValue intVal = static_cast<int32_t>(123);
    std::string intJson = commandValueToJson(intVal);
    TEST_ASSERT_EQ(intJson, "123", "Integer JSON");
    
    CommandValue stringVal = std::string("test");
    std::string stringJson = commandValueToJson(stringVal);
    TEST_ASSERT_EQ(stringJson, "\"test\"", "String JSON");
    
    CommandValue boolVal = false;
    std::string boolJson = commandValueToJson(boolVal);
    TEST_ASSERT_EQ(boolJson, "false", "Boolean JSON");
}

// =============================================================================
// REQUEST-RESPONSE PATTERN TESTS
// =============================================================================

void testRequestIdGeneration() {
    RequestId req1("analogRead", "test", 1000);
    RequestId req2("digitalRead", "test", 1001);
    
    TEST_ASSERT(req1.operation == "analogRead", "Request operation");
    TEST_ASSERT(req1.context == "test", "Request context");
    TEST_ASSERT(req1.timestamp == 1000, "Request timestamp");
    
    std::string req1Str = req1.toString();
    std::string req2Str = req2.toString();
    TEST_ASSERT(req1Str != req2Str, "Different requests should have different string representations");
}

void testMockResponseHandler() {
    MockResponseHandler handler;
    
    // Test analog read response
    RequestId analogReq("analogRead", "test", 1000);
    CommandValue analogResult;
    bool success = handler.waitForResponse(analogReq, analogResult, 1000);
    
    TEST_ASSERT(success, "Analog read mock should succeed");
    TEST_ASSERT(std::holds_alternative<int32_t>(analogResult), "Analog read should return int32_t");
    
    int32_t analogValue = std::get<int32_t>(analogResult);
    TEST_ASSERT(analogValue >= 0 && analogValue <= 1023, "Analog value should be in valid range");
    
    // Test digital read response
    RequestId digitalReq("digitalRead", "test", 1001);
    CommandValue digitalResult;
    success = handler.waitForResponse(digitalReq, digitalResult, 1000);
    
    TEST_ASSERT(success, "Digital read mock should succeed");
    TEST_ASSERT(std::holds_alternative<int32_t>(digitalResult), "Digital read should return int32_t");
    
    int32_t digitalValue = std::get<int32_t>(digitalResult);
    TEST_ASSERT(digitalValue == 0 || digitalValue == 1, "Digital value should be 0 or 1");
}

// =============================================================================
// SYSTEM COMMANDS TESTS
// =============================================================================

void testSystemCommands() {
    // Test PROGRAM_START command
    auto startCmd = createSystemCommand(CommandType::PROGRAM_START, "Program starting");
    TEST_ASSERT(startCmd != nullptr, "PROGRAM_START command creation");
    TEST_ASSERT_EQ(startCmd->type, CommandType::PROGRAM_START, "PROGRAM_START command type");
    
    // Test ERROR command
    auto errorCmd = createSystemCommand(CommandType::ERROR, "Test error message");
    TEST_ASSERT(errorCmd != nullptr, "ERROR command creation");
    TEST_ASSERT_EQ(errorCmd->type, CommandType::ERROR, "ERROR command type");
    
    // Test PROGRAM_END command
    auto endCmd = createSystemCommand(CommandType::PROGRAM_END, "Program completed");
    TEST_ASSERT(endCmd != nullptr, "PROGRAM_END command creation");
    TEST_ASSERT_EQ(endCmd->type, CommandType::PROGRAM_END, "PROGRAM_END command type");
}

void testExecutionStateEnum() {
    // Test execution state enum values
    TEST_ASSERT_EQ(static_cast<int>(ExecutionState::IDLE), 0, "IDLE state value");
    TEST_ASSERT_EQ(static_cast<int>(ExecutionState::RUNNING), 1, "RUNNING state value");
    TEST_ASSERT_EQ(static_cast<int>(ExecutionState::PAUSED), 2, "PAUSED state value");
    TEST_ASSERT_EQ(static_cast<int>(ExecutionState::STEPPING), 3, "STEPPING state value");
    TEST_ASSERT_EQ(static_cast<int>(ExecutionState::ERROR), 4, "ERROR state value");
    TEST_ASSERT_EQ(static_cast<int>(ExecutionState::COMPLETE), 5, "COMPLETE state value");
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

int main() {
    std::cout << "=== Command Protocol Unit Tests ===" << std::endl;
    
    int passed = 0;
    int failed = 0;
    
    // Run tests
    auto result1 = runTest("Basic Command Creation", testBasicCommandCreation);
    if (result1.success) passed++; else failed++;
    
    auto result2 = runTest("Command Serialization", testCommandSerialization);
    if (result2.success) passed++; else failed++;
    
    auto result3 = runTest("Command Types", testCommandTypes);
    if (result3.success) passed++; else failed++;
    
    auto result4 = runTest("Command Value Conversion", testCommandValueConversion);
    if (result4.success) passed++; else failed++;
    
    auto result5 = runTest("Command Value JSON", testCommandValueJson);
    if (result5.success) passed++; else failed++;
    
    auto result6 = runTest("Request ID Generation", testRequestIdGeneration);
    if (result6.success) passed++; else failed++;
    
    auto result7 = runTest("Mock Response Handler", testMockResponseHandler);
    if (result7.success) passed++; else failed++;
    
    auto result8 = runTest("System Commands", testSystemCommands);
    if (result8.success) passed++; else failed++;
    
    auto result9 = runTest("Execution State Enum", testExecutionStateEnum);
    if (result9.success) passed++; else failed++;
    
    // Summary
    std::cout << std::endl;
    std::cout << "=== TEST RESULTS ===" << std::endl;
    std::cout << "Passed: " << passed << std::endl;
    std::cout << "Failed: " << failed << std::endl;
    std::cout << "Success Rate: " << (passed * 100 / (passed + failed)) << "%" << std::endl;
    
    return failed == 0 ? 0 : 1;
}