#include "src/cpp/CommandProtocol.hpp"
#include <iostream>
#include <memory>

using namespace arduino_interpreter;

int main() {
    std::cout << "Testing Arduino Command Generation\n";
    std::cout << "==================================\n\n";

    // Test DigitalWriteCommand
    std::cout << "DigitalWriteCommand tests:\n";
    auto digitalWriteHigh = std::make_unique<DigitalWriteCommand>(13, DigitalValue::HIGH);
    auto digitalWriteLow = std::make_unique<DigitalWriteCommand>(7, DigitalValue::LOW);

    std::cout << "Pin 13 HIGH: " << digitalWriteHigh->toArduino() << std::endl;
    std::cout << "Pin 7 LOW: " << digitalWriteLow->toArduino() << std::endl;
    std::cout << std::endl;

    // Test PinModeCommand
    std::cout << "PinModeCommand tests:\n";
    auto pinModeOutput = std::make_unique<PinModeCommand>(13, PinMode::OUTPUT);
    auto pinModeInput = std::make_unique<PinModeCommand>(2, PinMode::INPUT);
    auto pinModeInputPullup = std::make_unique<PinModeCommand>(3, PinMode::INPUT_PULLUP);

    std::cout << "Pin 13 OUTPUT: " << pinModeOutput->toArduino() << std::endl;
    std::cout << "Pin 2 INPUT: " << pinModeInput->toArduino() << std::endl;
    std::cout << "Pin 3 INPUT_PULLUP: " << pinModeInputPullup->toArduino() << std::endl;
    std::cout << std::endl;

    // Test ArduinoCommandGenerator with a command stream
    std::cout << "ArduinoCommandGenerator stream test:\n";
    std::vector<std::unique_ptr<Command>> commands;
    commands.push_back(std::make_unique<PinModeCommand>(13, PinMode::OUTPUT));
    commands.push_back(std::make_unique<DigitalWriteCommand>(13, DigitalValue::HIGH));
    commands.push_back(std::make_unique<DigitalWriteCommand>(13, DigitalValue::LOW));

    ArduinoCommandGenerator generator;
    std::string arduinoCode = generator.generateStream(commands);

    std::cout << "Generated Arduino code:\n";
    std::cout << arduinoCode << std::endl;

    std::cout << "Test completed successfully!\n";
    return 0;
}