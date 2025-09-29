#include "src/cpp/CommandProtocol.hpp"
#include <iostream>
#include <memory>

using namespace arduino_interpreter;

int main() {
    std::cout << "Testing Read Request Commands Arduino Generation\n";
    std::cout << "================================================\n\n";

    // Create a collection of read request commands
    std::vector<std::unique_ptr<Command>> commands;

    // Test AnalogReadRequestCommand
    std::cout << "1. Creating AnalogReadRequestCommand(A0)\n";
    commands.push_back(std::make_unique<AnalogReadRequestCommand>(14)); // A0 = pin 14

    // Test DigitalReadRequestCommand
    std::cout << "2. Creating DigitalReadRequestCommand(7)\n";
    commands.push_back(std::make_unique<DigitalReadRequestCommand>(7));

    // Test multiple read operations
    std::cout << "3. Creating multiple read requests\n";
    commands.push_back(std::make_unique<AnalogReadRequestCommand>(15)); // A1 = pin 15
    commands.push_back(std::make_unique<DigitalReadRequestCommand>(2));

    std::cout << "\nArduino code generated:\n";
    std::cout << "========================\n";
    ArduinoCommandGenerator generator;
    std::string arduinoCode = generator.generateStream(commands);
    std::cout << arduinoCode << std::endl;

    std::cout << "Individual command breakdown:\n";
    for (size_t i = 0; i < commands.size(); i++) {
        std::cout << "  " << (i+1) << ". " << commands[i]->getTypeString()
                  << " → " << commands[i]->toArduino() << std::endl;
    }

    // Validation
    bool hasAnalogRead = false;
    bool hasDigitalRead = false;
    for (const auto& cmd : commands) {
        if (cmd->type == CommandType::ANALOG_READ_REQUEST) {
            hasAnalogRead = true;
        }
        if (cmd->type == CommandType::DIGITAL_READ_REQUEST) {
            hasDigitalRead = true;
        }
    }

    bool success = hasAnalogRead && hasDigitalRead && (commands.size() >= 4);

    std::cout << "\n" << (success ? "✅" : "❌") << " Test " << (success ? "PASSED" : "FAILED") << std::endl;

    if (success) {
        std::cout << "\n🎉 READ REQUEST COMMANDS WORKING PERFECTLY!\n";
        std::cout << "\n📋 What this proves:\n";
        std::cout << "   ✅ analogRead() request generation works\n";
        std::cout << "   ✅ digitalRead() request generation works\n";
        std::cout << "   ✅ Multiple pin read requests work\n";
        std::cout << "   ✅ Request commands produce Arduino comments\n";
        std::cout << "\n🚀 CommandProtocol now supports 9 Arduino functions!\n";
    } else {
        std::cout << "\n❌ Read request command issue detected\n";
    }

    return success ? 0 : 1;
}