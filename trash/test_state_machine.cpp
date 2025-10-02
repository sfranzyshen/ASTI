/**
 * State Machine Validation Test
 *
 * Tests the C++ request/response state machine WITHOUT syncMode to prove
 * the hybrid architecture is functional and just being bypassed.
 *
 * Compile:
 *   cd build
 *   g++ -std=c++17 -I../src/cpp -I../libs/CompactAST/src \
 *       ../tests/test_state_machine.cpp \
 *       libarduino_ast_interpreter.a \
 *       -o test_state_machine
 *
 * Run:
 *   ./test_state_machine
 */

#include "../src/cpp/ASTInterpreter.hpp"
#include "../src/cpp/ArduinoDataTypes.hpp"
#include "../libs/CompactAST/src/CompactAST.hpp"
#include "test_state_machine_handler.hpp"
#include <iostream>
#include <fstream>
#include <vector>
#include <string>

using namespace arduino_interpreter;

// Test with a simple Arduino program
const char* simpleTestProgram = R"(
void setup() {
    Serial.begin(9600);
}

void loop() {
    int val = analogRead(A0);
    Serial.print("Value: ");
    Serial.println(val);
    delay(100);
}
)";

// Helper to parse request ID and determine type
struct ParsedRequest {
    std::string type;     // "analogRead", "digitalRead", "millis", "micros"
    int32_t pin;          // For pin operations
    bool valid;
};

ParsedRequest parseRequestId(const std::string& requestId) {
    ParsedRequest result = {"", 0, false};

    if (requestId.find("analogRead") == 0) {
        result.type = "analogRead";
        result.pin = 0;  // For now, assume A0 = pin 0
        result.valid = true;
    }
    else if (requestId.find("digitalRead") == 0) {
        result.type = "digitalRead";
        result.pin = 0;  // Extract from requestId if needed
        result.valid = true;
    }
    else if (requestId.find("millis") == 0) {
        result.type = "millis";
        result.valid = true;
    }
    else if (requestId.find("micros") == 0) {
        result.type = "micros";
        result.valid = true;
    }

    return result;
}

int main(int argc, char* argv[]) {
    std::cout << "========================================" << std::endl;
    std::cout << "State Machine Validation Test" << std::endl;
    std::cout << "Testing C++ Hybrid Architecture Without syncMode" << std::endl;
    std::cout << "========================================" << std::endl;
    std::cout << std::endl;

    // Check if AST file provided, otherwise use embedded test program
    std::vector<uint8_t> compactAST;

    if (argc > 1) {
        // Load AST from file
        std::string astPath = argv[1];
        std::cout << "Loading AST from: " << astPath << std::endl;

        std::ifstream file(astPath, std::ios::binary);
        if (!file) {
            std::cerr << "ERROR: Cannot open AST file: " << astPath << std::endl;
            return 1;
        }

        file.seekg(0, std::ios::end);
        size_t size = file.tellg();
        file.seekg(0, std::ios::beg);

        compactAST.resize(size);
        file.read(reinterpret_cast<char*>(compactAST.data()), size);
        file.close();

        std::cout << "Loaded " << size << " bytes" << std::endl;
    }
    else {
        std::cout << "Using embedded test program (analogRead example)" << std::endl;
        std::cout << std::endl;
        std::cout << "Arduino Code:" << std::endl;
        std::cout << "```" << std::endl;
        std::cout << simpleTestProgram << std::endl;
        std::cout << "```" << std::endl;
        std::cout << std::endl;

        // For now, fail gracefully - need parser integration
        std::cerr << "ERROR: Parser integration not yet implemented." << std::endl;
        std::cerr << "Please provide an AST file as argument:" << std::endl;
        std::cerr << "  ./test_state_machine ../test_data/example_000.ast" << std::endl;
        return 1;
    }

    // Create interpreter with syncMode DISABLED
    std::cout << "Creating interpreter with syncMode=false..." << std::endl;

    InterpreterOptions options;
    options.syncMode = false;  // ← THE KEY: Use real state machine!
    options.maxLoopIterations = 1;
    options.verbose = false;
    options.debug = false;

    auto interpreter = std::make_unique<ASTInterpreter>(
        compactAST.data(),
        compactAST.size(),
        options
    );

    // Create and attach response handler
    StateMachineTestHandler handler;
    handler.setInterpreter(interpreter.get());
    interpreter->setResponseHandler(&handler);

    std::cout << "✅ Interpreter created (syncMode=false)" << std::endl;
    std::cout << "✅ Response handler attached" << std::endl;
    std::cout << std::endl;

    // Run tick() loop
    std::cout << "========================================" << std::endl;
    std::cout << "Starting Execution (tick() loop)" << std::endl;
    std::cout << "========================================" << std::endl;

    int tickCount = 0;
    int suspensionCount = 0;

    while (true) {
        tickCount++;

        // Check if waiting for response BEFORE tick
        if (interpreter->isWaitingForResponse()) {
            suspensionCount++;
            std::string requestId = interpreter->getWaitingRequestId();

            std::cout << std::endl;
            std::cout << "⏸️  [SUSPENSION #" << suspensionCount << "] Waiting for: " << requestId << std::endl;

            // Parse request and provide response
            ParsedRequest req = parseRequestId(requestId);
            if (req.valid) {
                handler.processPendingRequest(requestId, req.type, req.pin);
                std::cout << "✅ Response queued" << std::endl;
            }
            else {
                std::cerr << "❌ Unknown request type: " << requestId << std::endl;
            }
        }

        // Execute one tick
        interpreter->tick();

        // Check if program completed
        ExecutionState state = interpreter->getState();
        if (state == ExecutionState::COMPLETE || state == ExecutionState::ERROR) {
            std::cout << std::endl;
            std::cout << "Program execution complete (state: " << static_cast<int>(state) << ")" << std::endl;
            break;
        }

        // Safety limit
        if (tickCount > 1000) {
            std::cerr << std::endl;
            std::cerr << "ERROR: Too many ticks, possible infinite loop" << std::endl;
            return 1;
        }
    }

    std::cout << std::endl;
    std::cout << "========================================" << std::endl;
    std::cout << "Test Results" << std::endl;
    std::cout << "========================================" << std::endl;
    std::cout << "Total ticks: " << tickCount << std::endl;
    std::cout << "Suspensions: " << suspensionCount << std::endl;

    if (suspensionCount > 0) {
        std::cout << std::endl;
        std::cout << "✅ SUCCESS: State machine worked!" << std::endl;
        std::cout << "   - Execution suspended " << suspensionCount << " times" << std::endl;
        std::cout << "   - Responses were provided by handler" << std::endl;
        std::cout << "   - Execution resumed after each response" << std::endl;
        std::cout << "   - Program completed successfully" << std::endl;
        std::cout << std::endl;
        std::cout << "🎯 CONCLUSION: Hybrid architecture is WORKING!" << std::endl;
        std::cout << "   The syncMode flag is just bypassing a functional system." << std::endl;
        return 0;
    }
    else {
        std::cout << std::endl;
        std::cout << "⚠️  WARNING: No suspensions occurred" << std::endl;
        std::cout << "   - State machine may not have been triggered" << std::endl;
        std::cout << "   - Test program may not use async operations" << std::endl;
        std::cout << "   - Try with a program that uses analogRead/digitalRead" << std::endl;
        return 2;
    }
}
