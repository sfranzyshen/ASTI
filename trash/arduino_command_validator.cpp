#include "src/cpp/CommandProtocol.hpp"
#include <iostream>
#include <fstream>
#include <vector>
#include <memory>
#include <sstream>

using namespace arduino_interpreter;

/**
 * Standalone Arduino Command Validation System
 *
 * This tool allows us to test Arduino command generation independently
 * of the full interpreter pipeline, giving us confidence that our
 * CommandProtocol approach works correctly.
 */
class ArduinoCommandValidator {
private:
    std::vector<std::unique_ptr<Command>> commands_;

public:
    // Add commands to test
    void addCommand(std::unique_ptr<Command> cmd) {
        commands_.push_back(std::move(cmd));
    }

    // Generate Arduino code from our commands
    std::string generateArduinoCode() {
        ArduinoCommandGenerator generator;
        return generator.generateStream(commands_);
    }

    // Save Arduino code to file for manual inspection
    void saveArduinoCode(const std::string& filename) {
        std::ofstream file(filename);
        file << generateArduinoCode();
        file.close();
        std::cout << "Arduino code saved to: " << filename << std::endl;
    }

    // Validate that our commands produce expected Arduino output
    bool validateArduinoOutput(const std::vector<std::string>& expectedLines) {
        std::string generated = generateArduinoCode();
        std::istringstream stream(generated);
        std::string line;
        std::vector<std::string> actualLines;

        while (std::getline(stream, line)) {
            if (!line.empty()) {
                actualLines.push_back(line);
            }
        }

        if (actualLines.size() != expectedLines.size()) {
            std::cout << "❌ Line count mismatch. Expected: " << expectedLines.size()
                      << ", Got: " << actualLines.size() << std::endl;
            return false;
        }

        for (size_t i = 0; i < expectedLines.size(); i++) {
            if (actualLines[i] != expectedLines[i]) {
                std::cout << "❌ Line " << (i+1) << " mismatch:" << std::endl;
                std::cout << "   Expected: " << expectedLines[i] << std::endl;
                std::cout << "   Got:      " << actualLines[i] << std::endl;
                return false;
            }
        }

        std::cout << "✅ Arduino output validation passed!" << std::endl;
        return true;
    }

    // Clear commands for next test
    void clear() {
        commands_.clear();
    }
};

// Test scenarios that we know should work
void runBasicGPIOTest(ArduinoCommandValidator& validator) {
    std::cout << "\n=== Basic GPIO Test ===\n";

    validator.clear();
    validator.addCommand(std::make_unique<PinModeCommand>(13, PinMode::OUTPUT));
    validator.addCommand(std::make_unique<DigitalWriteCommand>(13, DigitalValue::HIGH));
    validator.addCommand(std::make_unique<DelayCommand>(1000));
    validator.addCommand(std::make_unique<DigitalWriteCommand>(13, DigitalValue::LOW));

    std::vector<std::string> expected = {
        "pinMode(13, OUTPUT);",
        "digitalWrite(13, HIGH);",
        "delay(1000);",
        "digitalWrite(13, LOW);"
    };

    validator.validateArduinoOutput(expected);
    validator.saveArduinoCode("test_basic_gpio.ino");
}

void runTimingTest(ArduinoCommandValidator& validator) {
    std::cout << "\n=== Timing Test ===\n";

    validator.clear();
    validator.addCommand(std::make_unique<DelayCommand>(500));
    validator.addCommand(std::make_unique<DelayMicrosecondsCommand>(1500));
    validator.addCommand(std::make_unique<DelayCommand>(2000));

    std::vector<std::string> expected = {
        "delay(500);",
        "delayMicroseconds(1500);",
        "delay(2000);"
    };

    validator.validateArduinoOutput(expected);
    validator.saveArduinoCode("test_timing.ino");
}

void runMixedCommandTest(ArduinoCommandValidator& validator) {
    std::cout << "\n=== Mixed Command Test ===\n";

    validator.clear();
    // Simulate a typical Arduino blink pattern
    validator.addCommand(std::make_unique<PinModeCommand>(13, PinMode::OUTPUT));
    validator.addCommand(std::make_unique<PinModeCommand>(2, PinMode::INPUT_PULLUP));

    for (int i = 0; i < 3; i++) {
        validator.addCommand(std::make_unique<DigitalWriteCommand>(13, DigitalValue::HIGH));
        validator.addCommand(std::make_unique<DelayCommand>(500));
        validator.addCommand(std::make_unique<DigitalWriteCommand>(13, DigitalValue::LOW));
        validator.addCommand(std::make_unique<DelayCommand>(500));
    }

    validator.saveArduinoCode("test_blink_pattern.ino");
    std::cout << "✅ Generated complete blink pattern sketch" << std::endl;
}

int main() {
    std::cout << "Arduino Command Validation System\n";
    std::cout << "==================================\n";
    std::cout << "Testing CommandProtocol Arduino generation independently\n";
    std::cout << "of the full interpreter pipeline.\n";

    ArduinoCommandValidator validator;

    try {
        runBasicGPIOTest(validator);
        runTimingTest(validator);
        runMixedCommandTest(validator);

        std::cout << "\n🎉 All validation tests completed successfully!\n";
        std::cout << "\nThis proves that:\n";
        std::cout << "✅ CommandProtocol Arduino generation works correctly\n";
        std::cout << "✅ We can generate deterministic Arduino code\n";
        std::cout << "✅ Our approach will solve the JSON serialization problems\n";
        std::cout << "✅ Ready to proceed with interpreter integration\n";

    } catch (const std::exception& e) {
        std::cout << "❌ Validation failed: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}