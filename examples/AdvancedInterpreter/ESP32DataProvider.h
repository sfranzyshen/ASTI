/**
 * ESP32DataProvider.h
 *
 * Real hardware data provider for ESP32 platform.
 * Implements SyncDataProvider interface using actual ESP32 hardware functions.
 *
 * This provider returns REAL sensor values from connected hardware rather than
 * mock data, allowing the interpreter to interact with the physical world.
 */

#ifndef ESP32_DATA_PROVIDER_H
#define ESP32_DATA_PROVIDER_H

#include <ArduinoASTInterpreter.h>
#include <Arduino.h>

class ESP32DataProvider : public SyncDataProvider {
public:
    /**
     * Read analog value from ESP32 ADC
     * @param pin GPIO pin number (e.g., 36 for A0 on Nano ESP32)
     * @return Analog value (0-4095 for ESP32 12-bit ADC)
     */
    int32_t getAnalogReadValue(int32_t pin) override {
        return analogRead(pin);
    }

    /**
     * Read digital value from ESP32 GPIO
     * @param pin GPIO pin number
     * @return Digital value (0=LOW, 1=HIGH)
     */
    int32_t getDigitalReadValue(int32_t pin) override {
        return digitalRead(pin);
    }

    /**
     * Get current millisecond count from ESP32
     * @return Milliseconds since boot
     */
    uint32_t getMillisValue() override {
        return millis();
    }

    /**
     * Get current microsecond count from ESP32
     * @return Microseconds since boot
     */
    uint32_t getMicrosValue() override {
        return micros();
    }

    /**
     * Read pulse duration on ESP32 GPIO
     * @param pin GPIO pin number
     * @param state Pulse state (HIGH or LOW)
     * @param timeout Timeout in microseconds
     * @return Pulse duration in microseconds, or 0 on timeout
     */
    uint32_t getPulseInValue(int32_t pin, int32_t state, uint32_t timeout) override {
        return pulseIn(pin, state, timeout);
    }

    /**
     * Get sensor value from external library
     * Currently returns 0 as library integration is not implemented yet.
     *
     * Future implementation could integrate with:
     * - DHT sensors (temperature/humidity)
     * - Ultrasonic sensors (distance)
     * - Accelerometers (x/y/z values)
     * - etc.
     *
     * @param libraryName Name of the library (e.g., "DHT")
     * @param methodName Method to call (e.g., "readTemperature")
     * @param arg Optional argument
     * @return Sensor value, or 0 if not implemented
     */
    int32_t getLibrarySensorValue(const std::string& libraryName,
                                  const std::string& methodName,
                                  int32_t arg) override {
        // Not implemented yet - would require dynamic library loading
        // or hardcoded support for specific sensors
        return 0;
    }
};

#endif // ESP32_DATA_PROVIDER_H
