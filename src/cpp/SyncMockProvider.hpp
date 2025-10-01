/**
 * SyncMockProvider.hpp
 *
 * Interface for parent applications to provide mock sensor/hardware values
 * to the C++ interpreter synchronously.
 *
 * Philosophy:
 * - Interpreter should NEVER generate mock data internally
 * - Parent app provides ALL mock values (deterministic or random)
 * - Synchronous blocking calls (no async state machine needed)
 * - Matches JavaScript's async/await pattern in result, not implementation
 *
 * Usage:
 *   class MyMockProvider : public SyncMockProvider {
 *       int32_t getAnalogReadValue(int32_t pin) override {
 *           return (pin * 37 + 42) % 1024;  // Deterministic formula
 *       }
 *   };
 *
 *   auto provider = std::make_unique<MyMockProvider>();
 *   interpreter->setSyncMockProvider(provider.get());
 */

#pragma once

#include <cstdint>

namespace arduino_interpreter {

/**
 * Interface for providing mock hardware/sensor values synchronously
 *
 * Parent applications implement this interface to provide deterministic
 * or random mock values for testing and validation.
 */
class SyncMockProvider {
public:
    virtual ~SyncMockProvider() = default;

    /**
     * Get mock value for analogRead(pin)
     *
     * Called synchronously when interpreter executes analogRead().
     * Execution blocks until this returns.
     *
     * @param pin Arduino pin number (0-13, A0-A7 as 14-21)
     * @return Analog value (0-1023 for 10-bit ADC)
     */
    virtual int32_t getAnalogReadValue(int32_t pin) = 0;

    /**
     * Get mock value for digitalRead(pin)
     *
     * @param pin Arduino pin number
     * @return Digital value (0=LOW, 1=HIGH)
     */
    virtual int32_t getDigitalReadValue(int32_t pin) = 0;

    /**
     * Get mock value for millis()
     *
     * @return Milliseconds since program start (simulated)
     */
    virtual uint32_t getMillisValue() = 0;

    /**
     * Get mock value for micros()
     *
     * @return Microseconds since program start (simulated)
     */
    virtual uint32_t getMicrosValue() = 0;

    /**
     * Get mock value for pulseIn(pin, state, timeout)
     *
     * @param pin Pin to read pulse from
     * @param state HIGH or LOW
     * @param timeout Maximum time to wait (microseconds)
     * @return Pulse duration in microseconds (0 if timeout)
     */
    virtual uint32_t getPulseInValue(int32_t pin, int32_t state, uint32_t timeout) = 0;

    /**
     * Get mock value for library sensor readings (CapacitiveSensor, etc.)
     *
     * Generic interface for any library that returns sensor values.
     *
     * @param libraryName Library name (e.g., "CapacitiveSensor")
     * @param methodName Method name (e.g., "capacitiveSensor")
     * @param arg Optional argument (e.g., sample count)
     * @return Sensor reading value
     */
    virtual int32_t getLibrarySensorValue(const std::string& libraryName,
                                         const std::string& methodName,
                                         int32_t arg = 0) = 0;
};

} // namespace arduino_interpreter
