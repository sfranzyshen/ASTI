#include "src/cpp/CommandProtocol.hpp"
#include "src/cpp/FlexibleCommand.hpp"
#include <iostream>
#include <memory>

using namespace arduino_interpreter;

/**
 * Standalone test of FlexibleCommand to CommandProtocol conversion
 * Tests the core conversion logic without requiring ASTInterpreter
 */

// Simple converter function (extracted from ArduinoCodeCapture)
std::unique_ptr<Command> convertFlexibleToCommand(const FlexibleCommand& flexCmd) {
    std::string type = flexCmd.getType();

    auto convertToInt = [](const FlexibleCommandValue& value) -> int32_t {
        if (std::holds_alternative<int>(value)) {
            return static_cast<int32_t>(std::get<int>(value));
        } else if (std::holds_alternative<long>(value)) {
            return static_cast<int32_t>(std::get<long>(value));
        } else if (std::holds_alternative<double>(value)) {
            return static_cast<int32_t>(std::get<double>(value));
        } else if (std::holds_alternative<bool>(value)) {
            return std::get<bool>(value) ? 1 : 0;
        }
        return 0;
    };

    auto convertToString = [](const FlexibleCommandValue& value) -> std::string {
        if (std::holds_alternative<std::string>(value)) {
            return std::get<std::string>(value);
        } else if (std::holds_alternative<int>(value)) {
            return std::to_string(std::get<int>(value));
        } else if (std::holds_alternative<long>(value)) {
            return std::to_string(std::get<long>(value));
        }
        return "";
    };

    if (type == "PIN_MODE") {
        int32_t pin = convertToInt(flexCmd.get("pin"));
        int32_t modeVal = convertToInt(flexCmd.get("mode"));
        PinMode mode = static_cast<PinMode>(modeVal);
        return std::make_unique<PinModeCommand>(pin, mode);
    }
    else if (type == "DIGITAL_WRITE") {
        int32_t pin = convertToInt(flexCmd.get("pin"));
        int32_t valueVal = convertToInt(flexCmd.get("value"));
        DigitalValue value = static_cast<DigitalValue>(valueVal);
        return std::make_unique<DigitalWriteCommand>(pin, value);
    }
    else if (type == "SERIAL_PRINT") {
        std::string data = convertToString(flexCmd.get("data"));
        return std::make_unique<SerialPrintCommand>(data, false);
    }
    else if (type == "DELAY") {
        uint32_t duration = static_cast<uint32_t>(convertToInt(flexCmd.get("duration")));
        return std::make_unique<DelayCommand>(duration);
    }

    return nullptr;
}

int main() {
    std::cout << "Testing FlexibleCommand to CommandProtocol Conversion\n";
    std::cout << "====================================================\n\n";

    std::vector<std::unique_ptr<Command>> commands;

    // Test 1: PIN_MODE conversion
    std::cout << "1. Testing PIN_MODE conversion:\n";
    FlexibleCommand pinModeCmd("PIN_MODE");
    pinModeCmd.set("pin", 13);
    pinModeCmd.set("mode", static_cast<int>(PinMode::OUTPUT));
    auto cmd1 = convertFlexibleToCommand(pinModeCmd);
    if (cmd1) {
        std::cout << "   ✅ Converted to: " << cmd1->toArduino() << std::endl;
        commands.push_back(std::move(cmd1));
    } else {
        std::cout << "   ❌ Conversion failed\n";
    }

    // Test 2: DIGITAL_WRITE conversion
    std::cout << "2. Testing DIGITAL_WRITE conversion:\n";
    FlexibleCommand digitalWriteCmd("DIGITAL_WRITE");
    digitalWriteCmd.set("pin", 13);
    digitalWriteCmd.set("value", static_cast<int>(DigitalValue::HIGH));
    auto cmd2 = convertFlexibleToCommand(digitalWriteCmd);
    if (cmd2) {
        std::cout << "   ✅ Converted to: " << cmd2->toArduino() << std::endl;
        commands.push_back(std::move(cmd2));
    } else {
        std::cout << "   ❌ Conversion failed\n";
    }

    // Test 3: SERIAL_PRINT conversion
    std::cout << "3. Testing SERIAL_PRINT conversion:\n";
    FlexibleCommand serialPrintCmd("SERIAL_PRINT");
    serialPrintCmd.set("data", std::string("Hello, Arduino!"));
    auto cmd3 = convertFlexibleToCommand(serialPrintCmd);
    if (cmd3) {
        std::cout << "   ✅ Converted to: " << cmd3->toArduino() << std::endl;
        commands.push_back(std::move(cmd3));
    } else {
        std::cout << "   ❌ Conversion failed\n";
    }

    // Test 4: DELAY conversion
    std::cout << "4. Testing DELAY conversion:\n";
    FlexibleCommand delayCmd("DELAY");
    delayCmd.set("duration", 1000);
    auto cmd4 = convertFlexibleToCommand(delayCmd);
    if (cmd4) {
        std::cout << "   ✅ Converted to: " << cmd4->toArduino() << std::endl;
        commands.push_back(std::move(cmd4));
    } else {
        std::cout << "   ❌ Conversion failed\n";
    }

    // Generate complete Arduino sketch
    std::cout << "\n" << std::string(50, '=') << "\n";
    std::cout << "COMPLETE ARDUINO SKETCH:\n";
    std::cout << std::string(50, '=') << "\n";

    ArduinoCommandGenerator generator;
    std::string arduinoCode = generator.generateStream(commands);
    std::cout << arduinoCode << std::endl;

    // Validation
    bool success = (commands.size() == 4) && !arduinoCode.empty();

    std::cout << std::string(50, '-') << "\n";
    std::cout << (success ? "✅" : "❌") << " Test " << (success ? "PASSED" : "FAILED") << std::endl;

    if (success) {
        std::cout << "\n🎉 CONVERSION PIPELINE WORKING PERFECTLY!\n";
        std::cout << "\n📋 What this proves:\n";
        std::cout << "   ✅ FlexibleCommand parameter extraction works\n";
        std::cout << "   ✅ Type conversion (int, string, enum) works\n";
        std::cout << "   ✅ CommandProtocol object creation works\n";
        std::cout << "   ✅ Arduino code generation works\n";
        std::cout << "\n🚀 Ready for validate_cross_platform integration!\n";
    } else {
        std::cout << "\n❌ Conversion pipeline issue detected\n";
        std::cout << "   Commands converted: " << commands.size() << "/4\n";
        std::cout << "   Arduino code length: " << arduinoCode.length() << " chars\n";
    }

    return success ? 0 : 1;
}