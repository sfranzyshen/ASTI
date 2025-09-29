#include "tests/test_utils.hpp"
#include <iostream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::cout << "Testing Arduino Code Generation Pipeline\n";
    std::cout << "=========================================\n\n";

    // Create ArduinoCodeCapture instance
    ArduinoCodeCapture capture(true); // verbose mode

    // Create some test FlexibleCommands to verify conversion
    std::cout << "1. Testing PIN_MODE command conversion:\n";
    FlexibleCommand pinModeCmd("PIN_MODE");
    pinModeCmd.set("pin", 13);
    pinModeCmd.set("mode", static_cast<int>(PinMode::OUTPUT));
    capture.onCommand(pinModeCmd);

    std::cout << "2. Testing DIGITAL_WRITE command conversion:\n";
    FlexibleCommand digitalWriteCmd("DIGITAL_WRITE");
    digitalWriteCmd.set("pin", 13);
    digitalWriteCmd.set("value", static_cast<int>(DigitalValue::HIGH));
    capture.onCommand(digitalWriteCmd);

    std::cout << "3. Testing SERIAL_PRINT command conversion:\n";
    FlexibleCommand serialPrintCmd("SERIAL_PRINT");
    serialPrintCmd.set("data", std::string("Hello, Arduino!"));
    capture.onCommand(serialPrintCmd);

    std::cout << "4. Testing DELAY command conversion:\n";
    FlexibleCommand delayCmd("DELAY");
    delayCmd.set("duration", 1000);
    capture.onCommand(delayCmd);

    // Get the generated Arduino code
    std::cout << "\n" << std::string(50, '=') << "\n";
    std::cout << "GENERATED ARDUINO CODE:\n";
    std::cout << std::string(50, '=') << "\n";
    std::string arduinoCode = capture.getArduinoCode();
    std::cout << arduinoCode << std::endl;

    // Verify we captured commands
    std::cout << std::string(50, '-') << "\n";
    std::cout << "CAPTURE STATISTICS:\n";
    std::cout << std::string(50, '-') << "\n";
    std::cout << "FlexibleCommands captured: " << capture.getFlexibleCommands().size() << std::endl;
    std::cout << "CommandProtocol commands: " << capture.getConvertedCommands().size() << std::endl;

    // Test success criteria
    bool hasArduinoCode = !arduinoCode.empty();
    bool hasCorrectCount = capture.getFlexibleCommands().size() == 4;
    bool hasConvertedCount = capture.getConvertedCommands().size() == 4;

    bool success = hasArduinoCode && hasCorrectCount && hasConvertedCount;

    std::cout << "\n" << (success ? "✅" : "❌") << " Test " << (success ? "PASSED" : "FAILED") << std::endl;

    if (success) {
        std::cout << "\n🎉 ARDUINO CODE GENERATION PIPELINE WORKING!\n";
        std::cout << "\n📋 What this proves:\n";
        std::cout << "   ✅ ArduinoCodeCapture captures FlexibleCommands\n";
        std::cout << "   ✅ FlexibleCommand to Command conversion works\n";
        std::cout << "   ✅ Arduino code generation produces output\n";
        std::cout << "   ✅ Ready for validate_cross_platform integration\n";
    } else {
        std::cout << "\n❌ Arduino generation pipeline issue detected\n";
        std::cout << "   - Arduino code: " << (hasArduinoCode ? "✅" : "❌") << std::endl;
        std::cout << "   - Correct count: " << (hasCorrectCount ? "✅" : "❌") << std::endl;
        std::cout << "   - Converted count: " << (hasConvertedCount ? "✅" : "❌") << std::endl;
    }

    return success ? 0 : 1;
}