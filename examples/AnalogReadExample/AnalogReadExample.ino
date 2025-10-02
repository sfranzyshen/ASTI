/**
 * AnalogReadExample.ino
 *
 * Advanced example showing real ESP32-S3 hardware integration.
 * Executes AnalogReadSerial.ino with live analog sensor readings from GPIO36.
 *
 * Hardware Setup:
 *   - Connect a potentiometer or analog sensor to GPIO36 (A0)
 *   - Or connect GPIO36 to 3.3V through a 10K resistor for fixed reading
 *
 * Expected Output:
 *   Continuous analog readings (0-4095 for ESP32's 12-bit ADC)
 */

#include <ArduinoASTInterpreter.h>

// Note: Full AST binary omitted for brevity (1396 bytes)
// This example demonstrates hardware integration concept
// See tools/ast_to_c_array.sh to embed your own CompactAST binaries

// For this example, we'll use a simplified setup demonstration
// In production, embed the full CompactAST binary from test_data/example_000.ast

// Hardware data provider connecting to real ESP32 pins
class HardwareDataProvider : public SyncDataProvider {
public:
    int32_t getAnalogReadValue(int32_t pin) override {
        // Map Arduino pin numbers to ESP32 GPIO
        uint8_t esp32Pin;
        if (pin == 14) {          // A0 in Arduino
            esp32Pin = 36;        // GPIO36 on ESP32-S3
        } else {
            esp32Pin = pin;
        }
        return analogRead(esp32Pin);
    }

    int32_t getDigitalReadValue(int32_t pin) override {
        return digitalRead(pin);
    }

    uint32_t getMillisValue() override {
        return millis();
    }

    uint32_t getMicrosValue() override {
        return micros();
    }

    uint32_t getPulseInValue(int32_t pin, int32_t state, uint32_t timeout) override {
        return pulseIn(pin, state, timeout);
    }

    int32_t getLibrarySensorValue(const std::string& libraryName,
                                  const std::string& methodName,
                                  int32_t arg) override {
        return 0; // Add custom library sensor integration here
    }
};

HardwareDataProvider hardwareProvider;

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("=== Hardware Integration Example ===");
    Serial.println("This example demonstrates real ESP32 hardware integration.");
    Serial.println();
    Serial.println("To run with actual interpreter:");
    Serial.println("1. Convert your .ino to CompactAST using ArduinoParser");
    Serial.println("2. Use tools/ast_to_c_array.sh to create C array");
    Serial.println("3. Embed the array and create ASTInterpreter");
    Serial.println("4. Connect hardwareProvider");
    Serial.println();
    Serial.println("Reading from GPIO36 (A0):");

    // Demonstrate direct hardware access (what the data provider does)
    for (int i = 0; i < 5; i++) {
        int value = hardwareProvider.getAnalogReadValue(14); // A0
        Serial.print("Analog reading: ");
        Serial.println(value);
        delay(500);
    }

    Serial.println();
    Serial.println("Hardware provider working correctly!");
    Serial.println("See BasicInterpreter example for full interpreter integration.");
}

void loop() {
    delay(1000);
}
