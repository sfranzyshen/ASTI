/**
 * test_utils.hpp - Testing utilities for C++ Arduino AST Interpreter
 * 
 * Common testing functions and mock classes for unit and integration tests.
 * Provides utilities for command stream capture, mock Arduino hardware,
 * and cross-platform validation support.
 * 
 * Version: 1.0
 * Compatible with: ASTInterpreter v1.0, CommandProtocol v1.0
 */

#pragma once

#include "../src/cpp/ASTInterpreter.hpp"
#include "../libs/CompactAST/src/CompactAST.hpp"
#include <vector>
#include <string>
#include <memory>
#include <iostream>
#include <thread>
#include <chrono>
#include <sstream>
#include <chrono>

namespace arduino_interpreter {
namespace testing {

// =============================================================================
// COMMAND STREAM CAPTURE
// =============================================================================

/**
 * Command stream capture for testing
 * Captures JSON commands emitted to stdout by interpreter
 *
 * NOTE: After FlexibleCommand removal, interpreter emits JSON directly to stdout.
 * This class captures stdout to provide the same interface for tests.
 */
class CommandStreamCapture {
private:
    std::vector<std::string> capturedCommands_;
    std::stringstream logStream_;
    bool verbose_;
    std::streambuf* oldCoutBuf_;
    std::ostringstream captureBuffer_;

public:
    explicit CommandStreamCapture(bool verbose = false)
        : verbose_(verbose), oldCoutBuf_(nullptr) {
        // Redirect stdout to our capture buffer
        oldCoutBuf_ = std::cout.rdbuf();
        std::cout.rdbuf(captureBuffer_.rdbuf());
    }

    ~CommandStreamCapture() {
        // Restore stdout
        if (oldCoutBuf_) {
            std::cout.rdbuf(oldCoutBuf_);
        }
    }

    size_t getCommandCount() const {
        return capturedCommands_.size();
    }

    void clear() {
        capturedCommands_.clear();
        captureBuffer_.str("");
        captureBuffer_.clear();
        logStream_.str("");
        logStream_.clear();
    }

    /**
     * Get commands as JSON array string for comparison with JavaScript
     * Parses captured stdout into JSON array format
     */
    std::string getCommandsAsJson() {
        // Parse captured output into individual JSON objects
        std::string captured = captureBuffer_.str();
        capturedCommands_.clear();

        std::istringstream iss(captured);
        std::string line;
        while (std::getline(iss, line)) {
            if (!line.empty() && line[0] == '{') {
                capturedCommands_.push_back(line);
            }
        }

        // Build JSON array
        std::ostringstream json;
        json << "[\n";
        for (size_t i = 0; i < capturedCommands_.size(); ++i) {
            if (i > 0) json << ",\n";
            json << "  " << capturedCommands_[i];
        }
        json << "\n]";
        return json.str();
    }
};

// =============================================================================
// MOCK RESPONSE HANDLER
// =============================================================================

/**
 * Mock response handler for testing external data functions
 * Simulates Arduino hardware responses (analogRead, digitalRead, etc.)
 */
class MockResponseHandler : public ResponseHandler {
private:
    std::unordered_map<std::string, CommandValue> mockResponses_;
    std::vector<RequestId> receivedRequests_;
    uint32_t defaultAnalogValue_ = 512;
    uint32_t defaultDigitalValue_ = 0;
    uint32_t mockMillis_ = 1000;

public:
    void handleResponse(const RequestId& requestId, const CommandValue& value) override {
        receivedRequests_.push_back(requestId);
        // In real implementation, this would send to external system
    }
    
    bool waitForResponse(const RequestId& requestId, CommandValue& result, uint32_t timeoutMs) override {
        receivedRequests_.push_back(requestId);

        // Check if we have a specific mock response
        auto it = mockResponses_.find(requestId);
        if (it != mockResponses_.end()) {
            result = it->second;
            return true;
        }

        // Generate default responses based on operation type (requestId is now a simple string)
        if (requestId.find("analogRead") != std::string::npos) {
            result = static_cast<int32_t>(defaultAnalogValue_);
        } else if (requestId.find("digitalRead") != std::string::npos) {
            result = static_cast<int32_t>(defaultDigitalValue_);
        } else if (requestId.find("millis") != std::string::npos) {
            result = static_cast<int32_t>(mockMillis_);
            mockMillis_ += 100; // Simulate time passage
        } else if (requestId.find("micros") != std::string::npos) {
            result = static_cast<int32_t>(mockMillis_ * 1000);
        } else {
            result = std::monostate{};
            return false;
        }

        return true;
    }
    
    void setMockResponse(const std::string& requestKey, const CommandValue& value) {
        mockResponses_[requestKey] = value;
    }
    
    void setDefaultAnalogValue(uint32_t value) { defaultAnalogValue_ = value; }
    void setDefaultDigitalValue(uint32_t value) { defaultDigitalValue_ = value; }
    void setDefaultMillisValue(uint32_t value) { mockMillis_ = value; }
    
    const std::vector<RequestId>& getReceivedRequests() const { return receivedRequests_; }
    void clearRequests() { receivedRequests_.clear(); }
};

// =============================================================================
// TEST EXECUTION HELPERS
// =============================================================================

/**
 * Test execution context with timeout and result capture
 */
struct TestResult {
    bool success = false;
    std::string error;
    uint32_t commandCount = 0;
    std::chrono::milliseconds executionTime{0};
    std::string commandStream;
    
    std::string toString() const {
        std::stringstream ss;
        ss << (success ? "PASS" : "FAIL");
        if (!error.empty()) ss << " - " << error;
        ss << " (" << commandCount << " commands, " << executionTime.count() << "ms)";
        return ss.str();
    }
};

/**
 * Execute interpreter with timeout and capture results
 */
TestResult executeWithTimeout(ASTInterpreter& interpreter, uint32_t timeoutMs = 5000) {
    TestResult result;
    
    auto capture = std::make_unique<CommandStreamCapture>(false);
    auto mockHandler = std::make_unique<MockResponseHandler>();

    // Set mock value to match JavaScript test expectation (723)
    mockHandler->setDefaultAnalogValue(723);

    interpreter.setResponseHandler(mockHandler.get());
    
    auto startTime = std::chrono::steady_clock::now();
    
    try {
        bool started = interpreter.start();
        if (!started) {
            result.error = "Failed to start interpreter";
            return result;
        }
        
        // Wait for completion or timeout
        auto deadline = startTime + std::chrono::milliseconds(timeoutMs);
        while ((interpreter.isRunning() || interpreter.isWaitingForResponse()) && std::chrono::steady_clock::now() < deadline) {
            // CRITICAL FIX: Drive the interpreter with tick() calls
            interpreter.tick();
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        if (interpreter.isRunning()) {
            interpreter.stop();
            result.error = "Execution timeout";
        } else {
            result.success = true;
        }
        
    } catch (const std::exception& e) {
        result.error = e.what();
    }
    
    auto endTime = std::chrono::steady_clock::now();
    result.executionTime = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime);
    result.commandCount = capture->getCommandCount();
    result.commandStream = capture->getCommandsAsJson();
    
    return result;
}

// =============================================================================
// AST HELPERS
// =============================================================================

/**
 * Create test AST from compact binary data
 */
std::unique_ptr<ASTInterpreter> createInterpreterFromBinary(const uint8_t* data, size_t size) {
    InterpreterOptions options;
    options.verbose = false;
    options.debug = false;
    options.maxLoopIterations = 1; // MATCH JAVASCRIPT: Use exactly 1 iteration like JS test data
    options.syncMode = true; // TEST MODE: Enable synchronous responses for digitalRead/analogRead
    
    return std::make_unique<ASTInterpreter>(data, size, options);
}

/**
 * Simple embedded AST for basic testing
 */
const uint8_t SIMPLE_TEST_AST[] = {
    // Header (16 bytes)
    0x50, 0x54, 0x53, 0x41,  // Magic: 'ASTP' (little-endian)
    0x00, 0x01,              // Version: 0x0100
    0x00, 0x00,              // Flags: 0x0000
    0x01, 0x00, 0x00, 0x00,  // Node count: 1
    0x10, 0x00, 0x00, 0x00,  // String table size: 16
    
    // String table (16 bytes)
    0x01, 0x00, 0x00, 0x00,  // String count: 1
    0x04, 0x00,              // String length: 4
    'v', 'o', 'i', 'd',      // String: "void"
    0x00,                    // Null terminator
    0x00, 0x00, 0x00,        // Padding to 4-byte boundary
    
    // Node data
    0x01,                    // Node type: PROGRAM
    0x00,                    // Flags: none
    0x00, 0x00               // Data size: 0
};

const size_t SIMPLE_TEST_AST_SIZE = sizeof(SIMPLE_TEST_AST);

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

#define TEST_ASSERT(condition, message) \
    do { \
        if (!(condition)) { \
            throw std::runtime_error("Assertion failed: " + std::string(message)); \
        } \
    } while(0)

#define TEST_ASSERT_EQ(actual, expected, message) \
    do { \
        if ((actual) != (expected)) { \
            std::stringstream ss; \
            ss << "Assertion failed: " << message << " (expected: " << (expected) << ", actual: " << (actual) << ")"; \
            throw std::runtime_error(ss.str()); \
        } \
    } while(0)

/**
 * Run a single test function with error handling
 */
template<typename TestFunc>
TestResult runTest(const std::string& testName, TestFunc&& testFunc) {
    TestResult result;
    
    auto startTime = std::chrono::steady_clock::now();
    
    try {
        std::cout << "Running " << testName << "... ";
        testFunc();
        result.success = true;
        std::cout << "PASS" << std::endl;
    } catch (const std::exception& e) {
        result.error = e.what();
        std::cout << "FAIL - " << result.error << std::endl;
    }
    
    auto endTime = std::chrono::steady_clock::now();
    result.executionTime = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime);
    
    return result;
}

} // namespace testing
} // namespace arduino_interpreter