#include "src/cpp/CommandProtocol.hpp"
#include "src/cpp/FlexibleCommand.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <memory>
#include <vector>
#include <regex>
#include <iomanip>

using namespace arduino_interpreter;

/**
 * Generate Arduino reference files from JSON command files
 * Converts existing .commands files to .arduino files for validation
 */

// Helper to convert JSON value to appropriate type
FlexibleCommandValue parseJsonValue(const std::string& value) {
    // Try to parse as integer
    try {
        if (value.find('.') == std::string::npos) {
            return std::stoi(value);
        } else {
            return std::stod(value);
        }
    } catch (...) {
        // If parsing fails, treat as string (remove quotes)
        std::string str = value;
        if (str.length() >= 2 && str.front() == '"' && str.back() == '"') {
            str = str.substr(1, str.length() - 2);
        }
        return str;
    }
}

// Convert JSON object to FlexibleCommand
FlexibleCommand parseJsonCommand(const std::string& jsonObj) {
    // Extract type field
    std::regex typeRegex("\"type\":\\s*\"([^\"]+)\"");
    std::smatch typeMatch;
    std::string type = "";
    if (std::regex_search(jsonObj, typeMatch, typeRegex)) {
        type = typeMatch[1].str();
    }

    FlexibleCommand cmd(type);

    // Extract common fields and add them to the command
    std::vector<std::pair<std::string, std::regex>> fields = {
        {"pin", std::regex("\"pin\":\\s*(\\d+)")},
        {"mode", std::regex("\"mode\":\\s*(\\d+)")},
        {"value", std::regex("\"value\":\\s*(\\d+)")},
        {"duration", std::regex("\"duration\":\\s*(\\d+)")},
        {"baudRate", std::regex("\"baudRate\":\\s*(\\d+)")},
        {"data", std::regex("\"data\":\\s*\"([^\"]*)\"")}
    };

    for (const auto& field : fields) {
        std::smatch match;
        if (std::regex_search(jsonObj, match, field.second)) {
            if (field.first == "data") {
                cmd.set(field.first, match[1].str());
            } else {
                cmd.set(field.first, std::stoi(match[1].str()));
            }
        }
    }

    return cmd;
}

// Convert FlexibleCommand to CommandProtocol Command (same logic as ArduinoCodeCapture)
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
    else if (type == "ANALOG_WRITE") {
        int32_t pin = convertToInt(flexCmd.get("pin"));
        int32_t value = convertToInt(flexCmd.get("value"));
        return std::make_unique<AnalogWriteCommand>(pin, value);
    }
    else if (type == "DELAY") {
        uint32_t duration = static_cast<uint32_t>(convertToInt(flexCmd.get("duration")));
        return std::make_unique<DelayCommand>(duration);
    }
    else if (type == "DELAY_MICROSECONDS") {
        uint32_t duration = static_cast<uint32_t>(convertToInt(flexCmd.get("duration")));
        return std::make_unique<DelayMicrosecondsCommand>(duration);
    }
    else if (type == "SERIAL_BEGIN") {
        int32_t baudRate = convertToInt(flexCmd.get("baudRate"));
        return std::make_unique<SerialBeginCommand>(baudRate);
    }
    else if (type == "SERIAL_PRINT") {
        std::string data = convertToString(flexCmd.get("data"));
        return std::make_unique<SerialPrintCommand>(data, false);
    }
    else if (type == "SERIAL_PRINTLN") {
        std::string data = convertToString(flexCmd.get("data"));
        return std::make_unique<SerialPrintCommand>(data, true);
    }
    else if (type == "ANALOG_READ_REQUEST") {
        int32_t pin = convertToInt(flexCmd.get("pin"));
        return std::make_unique<AnalogReadRequestCommand>(pin);
    }
    else if (type == "DIGITAL_READ_REQUEST") {
        int32_t pin = convertToInt(flexCmd.get("pin"));
        return std::make_unique<DigitalReadRequestCommand>(pin);
    }
    else if (type == "MILLIS_REQUEST") {
        return std::make_unique<MillisRequestCommand>();
    }
    else if (type == "MICROS_REQUEST") {
        return std::make_unique<MicrosRequestCommand>();
    }

    return nullptr;  // Non-Arduino commands are ignored
}

// Process a single JSON commands file
bool processCommandsFile(int testNumber) {
    // Input file
    std::ostringstream inputFileName;
    inputFileName << "test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".commands";

    std::ifstream inputFile(inputFileName.str());
    if (!inputFile) {
        std::cout << "   ❌ Could not open " << inputFileName.str() << std::endl;
        return false;
    }

    // Read entire JSON file
    std::ostringstream jsonBuffer;
    jsonBuffer << inputFile.rdbuf();
    std::string jsonContent = jsonBuffer.str();
    inputFile.close();

    // Parse JSON array and extract Arduino commands
    std::vector<std::unique_ptr<Command>> arduinoCommands;

    // Find individual JSON objects in the array
    std::regex objectRegex(R"(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})");
    std::sregex_iterator iter(jsonContent.begin(), jsonContent.end(), objectRegex);
    std::sregex_iterator end;

    for (; iter != end; ++iter) {
        std::string jsonObj = iter->str();

        // Check if this is an Arduino-relevant command
        if (jsonObj.find("\"type\":") != std::string::npos) {
            FlexibleCommand flexCmd = parseJsonCommand(jsonObj);
            auto arduinoCmd = convertFlexibleToCommand(flexCmd);
            if (arduinoCmd) {
                arduinoCommands.push_back(std::move(arduinoCmd));
            }
        }
    }

    // Generate Arduino code
    ArduinoCommandGenerator generator;
    std::string arduinoCode = generator.generateStream(arduinoCommands);

    // Output file
    std::ostringstream outputFileName;
    outputFileName << "test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".arduino";

    std::ofstream outputFile(outputFileName.str());
    if (!outputFile) {
        std::cout << "   ❌ Could not create " << outputFileName.str() << std::endl;
        return false;
    }

    outputFile << arduinoCode;
    outputFile.close();

    std::cout << "   ✅ Generated " << outputFileName.str() << " (" << arduinoCommands.size() << " commands)" << std::endl;
    return true;
}

int main(int argc, char* argv[]) {
    std::cout << "Arduino Reference File Generator\n";
    std::cout << "================================\n\n";

    int startTest = 0;
    int endTest = 10;  // Default to first 10 tests for safety

    if (argc >= 3) {
        startTest = std::atoi(argv[1]);
        endTest = std::atoi(argv[2]);
    } else if (argc == 2) {
        startTest = endTest = std::atoi(argv[1]);
    }

    std::cout << "Processing tests " << startTest << "-" << endTest << "...\n\n";

    int successCount = 0;
    int totalCount = 0;

    for (int testNum = startTest; testNum <= endTest; testNum++) {
        totalCount++;
        std::cout << "Processing test " << testNum << ":\n";

        if (processCommandsFile(testNum)) {
            successCount++;
        }
    }

    std::cout << "\n" << std::string(50, '=') << "\n";
    std::cout << "GENERATION COMPLETE\n";
    std::cout << std::string(50, '=') << "\n";
    std::cout << "Success rate: " << successCount << "/" << totalCount
              << " (" << (100.0 * successCount / totalCount) << "%)" << std::endl;

    if (successCount == totalCount) {
        std::cout << "\n🎉 ALL ARDUINO REFERENCE FILES GENERATED SUCCESSFULLY!\n";
        std::cout << "\n📋 What was created:\n";
        std::cout << "   ✅ .arduino files for tests " << startTest << "-" << endTest << "\n";
        std::cout << "   ✅ Only Arduino-relevant commands included\n";
        std::cout << "   ✅ Ready for validate_cross_platform testing\n";
        std::cout << "\n🚀 Arduino validation system is now complete!\n";
    } else {
        std::cout << "\n⚠️ Some files failed to generate\n";
        std::cout << "Check the error messages above for details\n";
    }

    return (successCount == totalCount) ? 0 : 1;
}