/**
 * State Machine Test Handler
 *
 * Validates that the C++ state machine request/response architecture works
 * correctly when syncMode is disabled. Acts as a parent app providing
 * deterministic mock responses like JavaScript's generate_test_data.js
 */

#pragma once

#include "../src/cpp/ArduinoDataTypes.hpp"
#include "../src/cpp/ASTInterpreter.hpp"
#include <map>
#include <string>
#include <iostream>

using namespace arduino_interpreter;

class StateMachineTestHandler : public ResponseHandler {
private:
    ASTInterpreter* interpreter_;

    // Track call counts for incremental values
    uint32_t millisCounter_ = 17807;
    uint32_t microsCounter_ = 17807000;

public:
    StateMachineTestHandler() : interpreter_(nullptr) {}

    void setInterpreter(ASTInterpreter* interpreter) {
        interpreter_ = interpreter;
    }

    // =========================================================================
    // DETERMINISTIC MOCK DATA GENERATION (matching JavaScript MockDataManager)
    // =========================================================================

    int32_t getAnalogReadValue(int32_t pin) {
        // Formula matches JavaScript: (pin * 37 + 42) % 1024
        return (pin * 37 + 42) % 1024;
    }

    int32_t getDigitalReadValue(int32_t pin) {
        // Formula matches JavaScript: odd pins = 1, even pins = 0
        return (pin % 2) == 1 ? 1 : 0;
    }

    uint32_t getMillisValue() {
        // Incremental value matching JavaScript
        uint32_t val = millisCounter_;
        millisCounter_ += 100;  // Increment by 100ms per call
        return val;
    }

    uint32_t getMicrosValue() {
        // Incremental value matching JavaScript
        uint32_t val = microsCounter_;
        microsCounter_ += 100000;  // Increment by 100000µs per call
        return val;
    }

    // =========================================================================
    // RESPONSE HANDLER INTERFACE (required by ASTInterpreter)
    // =========================================================================

    void handleResponse(const RequestId& requestId, const CommandValue& value) override {
        // This is called by interpreter when setting up a request
        // In real implementation, parent app would queue this and respond later
        // For testing, we'll just acknowledge
        std::cout << "[HANDLER] Received request setup: " << requestId << std::endl;
    }

    bool waitForResponse(const RequestId& requestId, CommandValue& result, uint32_t timeoutMs) override {
        // This is the blocking wait interface
        // For state machine testing, we don't use this
        return false;
    }

    // =========================================================================
    // MOCK RESPONSE PROVIDER (like JavaScript parent app)
    // =========================================================================

    void processPendingRequest(const std::string& requestId, const std::string& requestType, int32_t pin = 0) {
        CommandValue mockValue;

        if (requestType == "analogRead") {
            mockValue = getAnalogReadValue(pin);
            std::cout << "[HANDLER] Providing analogRead(" << pin << ") = " << getAnalogReadValue(pin) << std::endl;
        }
        else if (requestType == "digitalRead") {
            mockValue = getDigitalReadValue(pin);
            std::cout << "[HANDLER] Providing digitalRead(" << pin << ") = " << getDigitalReadValue(pin) << std::endl;
        }
        else if (requestType == "millis") {
            mockValue = static_cast<int32_t>(getMillisValue());
            std::cout << "[HANDLER] Providing millis() = " << std::get<int32_t>(mockValue) << std::endl;
        }
        else if (requestType == "micros") {
            mockValue = static_cast<int32_t>(getMicrosValue());
            std::cout << "[HANDLER] Providing micros() = " << std::get<int32_t>(mockValue) << std::endl;
        }
        else {
            std::cout << "[HANDLER] Unknown request type: " << requestType << std::endl;
            return;
        }

        // Provide response to interpreter (queues it for next tick())
        if (interpreter_) {
            interpreter_->handleResponse(requestId, mockValue);
            std::cout << "[HANDLER] Response queued for: " << requestId << std::endl;
        }
    }
};
