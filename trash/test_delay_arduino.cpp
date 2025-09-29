#include "src/cpp/CommandProtocol.hpp"
#include <iostream>
#include <memory>

using namespace arduino_interpreter;

int main() {
    std::cout << "Testing DelayCommand Arduino Generation\n";
    std::cout << "=======================================\n\n";

    // Test DelayCommand
    auto delay1000 = std::make_unique<DelayCommand>(1000);
    auto delay500 = std::make_unique<DelayCommand>(500);

    std::cout << "DelayCommand(1000): " << delay1000->toArduino() << std::endl;
    std::cout << "DelayCommand(500): " << delay500->toArduino() << std::endl;
    std::cout << std::endl;

    // Test DelayMicrosecondsCommand
    auto delayMicros2000 = std::make_unique<DelayMicrosecondsCommand>(2000);
    auto delayMicros100 = std::make_unique<DelayMicrosecondsCommand>(100);

    std::cout << "DelayMicrosecondsCommand(2000): " << delayMicros2000->toArduino() << std::endl;
    std::cout << "DelayMicrosecondsCommand(100): " << delayMicros100->toArduino() << std::endl;
    std::cout << std::endl;

    // Test with ArduinoCommandGenerator
    std::cout << "ArduinoCommandGenerator stream test:\n";
    std::vector<std::unique_ptr<Command>> commands;
    commands.push_back(std::make_unique<PinModeCommand>(13, PinMode::OUTPUT));
    commands.push_back(std::make_unique<DigitalWriteCommand>(13, DigitalValue::HIGH));
    commands.push_back(std::make_unique<DelayCommand>(1000));
    commands.push_back(std::make_unique<DigitalWriteCommand>(13, DigitalValue::LOW));
    commands.push_back(std::make_unique<DelayMicrosecondsCommand>(500));

    ArduinoCommandGenerator generator;
    std::string arduinoCode = generator.generateStream(commands);

    std::cout << "Generated Arduino code:\n";
    std::cout << arduinoCode << std::endl;

    std::cout << "Test completed successfully!\n";
    return 0;
}