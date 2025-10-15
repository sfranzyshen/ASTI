/**
 * DeterministicDataProvider.hpp
 *
 * Test utility implementation of SyncDataProvider with deterministic formulas.
 *
 * This is a REFERENCE IMPLEMENTATION for testing and validation.
 * It provides reproducible, formula-based values that match the JavaScript
 * MockDataManager for cross-platform test validation.
 *
 * Real applications should implement their own SyncDataProvider to:
 * - Read from actual hardware
 * - Fetch from remote APIs
 * - Load from databases
 * - Use custom test data sets
 *
 * Formulas match: src/javascript/MockDataManager.js
 */

#pragma once

#include "../src/cpp/SyncDataProvider.hpp"
#include <string>

namespace arduino_interpreter {

/**
 * Deterministic data provider using formulas matching JavaScript implementation
 *
 * This is a TEST UTILITY - not part of the interpreter core.
 */
class DeterministicDataProvider : public SyncDataProvider {
private:
    uint32_t millisCounter_;
    uint32_t microsCounter_;

public:
    /**
     * Constructor with optional initial time values
     *
     * Default values match JavaScript MockDataManager:
     * - millis: 17807 (matches JS initial value)
     * - micros: 17807000 (17807 ms * 1000)
     */
    DeterministicDataProvider(uint32_t initialMillis = 17807,
                             uint32_t initialMicros = 17807000)
        : millisCounter_(initialMillis), microsCounter_(initialMicros) {}

    /**
     * analogRead(pin) - Pin-based deterministic formula
     *
     * Formula: (pin * 37 + 42) % 1024
     * Matches: JavaScript MockDataManager.getAnalogReadValue()
     */
    int32_t getAnalogReadValue(int32_t pin) override {
        return (pin * 37 + 42) % 1024;
    }

    /**
     * digitalRead(pin) - Odd pins HIGH, even pins LOW
     *
     * Formula: (pin % 2) == 1 ? HIGH : LOW
     * Matches: JavaScript MockDataManager.getDigitalReadValue()
     */
    int32_t getDigitalReadValue(int32_t pin) override {
        return (pin % 2) == 1 ? 1 : 0;
    }

    /**
     * millis() - Incremental counter
     *
     * Returns current counter value, then increments by 100ms.
     * Matches: JavaScript MockDataManager.getMillisValue()
     */
    uint32_t getMillisValue() override {
        uint32_t value = millisCounter_;
        millisCounter_ += 100;  // Increment by 100ms per call
        return value;
    }

    /**
     * micros() - Incremental counter
     *
     * Returns current counter value, then increments by 100000µs (100ms).
     * Matches: JavaScript MockDataManager.getMicrosValue()
     */
    uint32_t getMicrosValue() override {
        uint32_t value = microsCounter_;
        microsCounter_ += 100000;  // Increment by 100000µs (100ms) per call
        return value;
    }

    /**
     * pulseIn(pin, state, timeout) - Pin-based deterministic formula
     *
     * Formula: (pin * 150 + 1000)
     * Returns consistent pulse duration based on pin number.
     * Matches: JavaScript MockDataManager.getPulseInValue()
     */
    uint32_t getPulseInValue(int32_t pin, int32_t state, uint32_t timeout) override {
        // Deterministic formula based on pin
        return pin * 150 + 1000;
    }

    /**
     * Library sensor values - Deterministic formulas per library/method
     *
     * Provides deterministic values for library sensor readings.
     */
    int32_t getLibrarySensorValue(const std::string& libraryName,
                                 const std::string& methodName,
                                 int32_t arg = 0) override {
        if (libraryName == "CapacitiveSensor") {
            if (methodName == "capacitiveSensor" || methodName == "capacitiveSensorRaw") {
                // Deterministic formula for capacitive sensor
                // Formula: (arg * 13 + 477) % 2000 + 100
                // This gives values in range 100-2099, deterministic based on argument
                return (arg * 13 + 477) % 2000 + 100;
            }
        }

        // Default: return 0 for unknown library/method
        return 0;
    }

    /**
     * Reset counters to initial values (useful for test repeatability)
     */
    void reset(uint32_t initialMillis = 17807, uint32_t initialMicros = 17807000) {
        millisCounter_ = initialMillis;
        microsCounter_ = initialMicros;
    }
};

} // namespace arduino_interpreter
