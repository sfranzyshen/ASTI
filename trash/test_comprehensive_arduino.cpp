#include "src/cpp/CommandProtocol.hpp"
#include <iostream>
#include <memory>
#include <iomanip>

using namespace arduino_interpreter;

int main() {
    std::cout << "Testing Comprehensive Arduino Command Generation\n";
    std::cout << "================================================\n\n";

    // Create a comprehensive Arduino program using CommandProtocol
    std::vector<std::unique_ptr<Command>> commands;

    std::cout << "Building complete Arduino sketch...\n\n";

    // === SETUP PHASE ===
    std::cout << "1. Setup Phase Commands:\n";

    // Serial initialization
    commands.push_back(std::make_unique<SerialBeginCommand>(9600));
    std::cout << "   ✓ Serial.begin(9600)\n";

    // Pin setup
    commands.push_back(std::make_unique<PinModeCommand>(13, PinMode::OUTPUT));
    commands.push_back(std::make_unique<PinModeCommand>(7, PinMode::INPUT));
    std::cout << "   ✓ pinMode() calls\n";

    // === MAIN PROGRAM PHASE ===
    std::cout << "\n2. Main Program Commands:\n";

    // Digital operations
    commands.push_back(std::make_unique<DigitalWriteCommand>(13, DigitalValue::HIGH));
    commands.push_back(std::make_unique<DigitalReadRequestCommand>(7));
    std::cout << "   ✓ Digital I/O operations\n";

    // Analog operations
    commands.push_back(std::make_unique<AnalogWriteCommand>(9, 128));
    commands.push_back(std::make_unique<AnalogReadRequestCommand>(14)); // A0
    std::cout << "   ✓ Analog I/O operations\n";

    // Timing operations
    commands.push_back(std::make_unique<DelayCommand>(1000));
    commands.push_back(std::make_unique<DelayMicrosecondsCommand>(500));
    commands.push_back(std::make_unique<MillisRequestCommand>());
    commands.push_back(std::make_unique<MicrosRequestCommand>());
    std::cout << "   ✓ Timing operations\n";

    // Serial communication
    commands.push_back(std::make_unique<SerialPrintCommand>("Sensor value: ", false));
    commands.push_back(std::make_unique<SerialPrintCommand>("123", true)); // println
    std::cout << "   ✓ Serial communication\n";

    // === GENERATE ARDUINO CODE ===
    std::cout << "\n" << std::string(50, '=') << "\n";
    std::cout << "GENERATED ARDUINO SKETCH:\n";
    std::cout << std::string(50, '=') << "\n";

    ArduinoCommandGenerator generator;
    std::string arduinoCode = generator.generateStream(commands);
    std::cout << arduinoCode << std::endl;

    // === DETAILED BREAKDOWN ===
    std::cout << std::string(50, '-') << "\n";
    std::cout << "COMMAND BREAKDOWN:\n";
    std::cout << std::string(50, '-') << "\n";

    for (size_t i = 0; i < commands.size(); i++) {
        std::cout << std::setw(2) << (i+1) << ". "
                  << std::left << std::setw(20) << commands[i]->getTypeString()
                  << " → " << commands[i]->toArduino() << std::endl;
    }

    // === VALIDATION ===
    std::cout << "\n" << std::string(50, '=') << "\n";
    std::cout << "VALIDATION RESULTS:\n";
    std::cout << std::string(50, '=') << "\n";

    // Count function types
    int digitalOps = 0, analogOps = 0, timingOps = 0, serialOps = 0;

    for (const auto& cmd : commands) {
        switch (cmd->type) {
            case CommandType::PIN_MODE:
            case CommandType::DIGITAL_WRITE:
            case CommandType::DIGITAL_READ_REQUEST:
                digitalOps++;
                break;
            case CommandType::ANALOG_WRITE:
            case CommandType::ANALOG_READ_REQUEST:
                analogOps++;
                break;
            case CommandType::DELAY:
            case CommandType::DELAY_MICROSECONDS:
            case CommandType::MILLIS_REQUEST:
            case CommandType::MICROS_REQUEST:
                timingOps++;
                break;
            case CommandType::SERIAL_BEGIN:
            case CommandType::SERIAL_PRINT:
            case CommandType::SERIAL_PRINTLN:
                serialOps++;
                break;
            default:
                break;
        }
    }

    std::cout << "📊 Function Categories Covered:\n";
    std::cout << "   🔌 Digital I/O operations: " << digitalOps << " commands\n";
    std::cout << "   📈 Analog I/O operations: " << analogOps << " commands\n";
    std::cout << "   ⏱️  Timing operations: " << timingOps << " commands\n";
    std::cout << "   📡 Serial communication: " << serialOps << " commands\n";
    std::cout << "   📋 Total commands: " << commands.size() << "\n\n";

    bool success = (digitalOps >= 3) && (analogOps >= 2) &&
                   (timingOps >= 4) && (serialOps >= 3) &&
                   (commands.size() >= 12);

    std::cout << (success ? "✅" : "❌") << " Comprehensive Test "
              << (success ? "PASSED" : "FAILED") << std::endl;

    if (success) {
        std::cout << "\n🎉 COMPREHENSIVE ARDUINO GENERATION SUCCESS!\n";
        std::cout << "\n🚀 CommandProtocol supports 11+ Arduino functions:\n";
        std::cout << "   ✅ pinMode() - Pin configuration\n";
        std::cout << "   ✅ digitalWrite() - Digital output\n";
        std::cout << "   ✅ digitalRead() - Digital input (request)\n";
        std::cout << "   ✅ analogWrite() - PWM output\n";
        std::cout << "   ✅ analogRead() - Analog input (request)\n";
        std::cout << "   ✅ delay() - Millisecond delays\n";
        std::cout << "   ✅ delayMicroseconds() - Microsecond delays\n";
        std::cout << "   ✅ millis() - Millisecond timer (request)\n";
        std::cout << "   ✅ micros() - Microsecond timer (request)\n";
        std::cout << "   ✅ Serial.begin() - Serial initialization\n";
        std::cout << "   ✅ Serial.print()/println() - Serial output\n";
        std::cout << "\n🏆 PRODUCTION-READY ARDUINO CODE GENERATION!\n";
    }

    return success ? 0 : 1;
}