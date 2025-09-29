#include "src/cpp/CommandProtocol.hpp"
#include <iostream>

using namespace arduino_interpreter;

int main() {
    std::cout << "Testing AnalogWriteCommand Arduino Generation\n";
    std::cout << "==============================================\n\n";

    // Test various PWM values
    auto analogWrite255 = std::make_unique<AnalogWriteCommand>(6, 255);
    auto analogWrite128 = std::make_unique<AnalogWriteCommand>(9, 128);
    auto analogWrite0 = std::make_unique<AnalogWriteCommand>(3, 0);

    std::cout << "AnalogWriteCommand(6, 255): " << analogWrite255->toArduino() << std::endl;
    std::cout << "AnalogWriteCommand(9, 128): " << analogWrite128->toArduino() << std::endl;
    std::cout << "AnalogWriteCommand(3, 0): " << analogWrite0->toArduino() << std::endl;
    std::cout << std::endl;

    // Test complete PWM scenario
    std::cout << "Complete PWM scenario:\n";
    ArduinoCommandGenerator generator;
    std::vector<std::unique_ptr<Command>> commands;

    commands.push_back(std::make_unique<PinModeCommand>(6, PinMode::OUTPUT));
    commands.push_back(std::make_unique<AnalogWriteCommand>(6, 255)); // Full brightness
    commands.push_back(std::make_unique<DelayCommand>(1000));
    commands.push_back(std::make_unique<AnalogWriteCommand>(6, 128)); // Half brightness
    commands.push_back(std::make_unique<DelayCommand>(1000));
    commands.push_back(std::make_unique<AnalogWriteCommand>(6, 0));   // Off

    std::string arduinoCode = generator.generateStream(commands);
    std::cout << arduinoCode << std::endl;

    std::cout << "✅ AnalogWriteCommand Arduino generation test completed!\n";
    return 0;
}