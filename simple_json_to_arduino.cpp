#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
#include <vector>
#include <regex>

class SimpleJSONToArduino {
private:
    std::vector<std::string> setupCommands;
    std::vector<std::string> loopCommands;
    bool inSetup = false;
    bool inLoop = false;

public:
    std::string convertJSONToArduino(const std::string& jsonContent) {
        setupCommands.clear();
        loopCommands.clear();
        inSetup = false;
        inLoop = false;

        std::istringstream stream(jsonContent);
        std::string line;

        while (std::getline(stream, line)) {
            if (line.empty() || line == "[" || line == "]" || line == "  {" || line == "  }") continue;

            // Remove trailing comma if present
            if (!line.empty() && line.back() == ',') {
                line.pop_back();
            }

            processJSONLine(line);
        }

        return generateArduinoCode();
    }

private:
    void processJSONLine(const std::string& jsonLine) {
        // Check for setup/loop markers
        if (jsonLine.find("SETUP_START") != std::string::npos) {
            inSetup = true;
            inLoop = false;
            return;
        }
        if (jsonLine.find("SETUP_END") != std::string::npos) {
            inSetup = false;
            return;
        }
        if (jsonLine.find("Starting loop() execution") != std::string::npos) {
            inLoop = true;
            inSetup = false;
            return;
        }
        if (jsonLine.find("LOOP_END") != std::string::npos) {
            inLoop = false;
            return;
        }

        // Process Arduino-relevant commands
        if (jsonLine.find("Serial.begin") != std::string::npos) {
            std::regex argsRegex(R"("arguments":\s*\[\s*(\d+)\s*\])");
            std::smatch argsMatch;
            if (std::regex_search(jsonLine, argsMatch, argsRegex)) {
                addCommand("Serial.begin(" + argsMatch[1].str() + ");");
            }
        }
        else if (jsonLine.find("Serial.println") != std::string::npos) {
            std::regex dataRegex("\"data\":\\s*\"([^\"]*)\"");
            std::smatch dataMatch;
            if (std::regex_search(jsonLine, dataMatch, dataRegex)) {
                addCommand("Serial.println(" + dataMatch[1].str() + ");");
            }
        }
        else if (jsonLine.find("PIN_MODE") != std::string::npos || jsonLine.find("pinMode") != std::string::npos) {
            std::regex argsRegex(R"("arguments":\s*\[\s*(\d+),\s*(\d+)\s*\])");
            std::smatch argsMatch;
            if (std::regex_search(jsonLine, argsMatch, argsRegex)) {
                std::string mode = (argsMatch[2].str() == "1") ? "OUTPUT" : "INPUT";
                addCommand("pinMode(" + argsMatch[1].str() + ", " + mode + ");");
            }
        }
        else if (jsonLine.find("DIGITAL_WRITE") != std::string::npos) {
            std::regex pinRegex(R"("pin":\s*(\d+))");
            std::regex valueRegex(R"("value":\s*(\d+))");
            std::smatch pinMatch, valueMatch;

            if (std::regex_search(jsonLine, pinMatch, pinRegex) &&
                std::regex_search(jsonLine, valueMatch, valueRegex)) {
                std::string value = (valueMatch[1].str() == "1") ? "HIGH" : "LOW";
                addCommand("digitalWrite(" + pinMatch[1].str() + ", " + value + ");");
            }
        }
        else if (jsonLine.find("ANALOG_READ_REQUEST") != std::string::npos) {
            std::regex pinRegex(R"("pin":\s*(\d+))");
            std::smatch pinMatch;
            if (std::regex_search(jsonLine, pinMatch, pinRegex)) {
                addCommand("analogRead(" + pinMatch[1].str() + ");");
            }
        }
        else if (jsonLine.find("DELAY") != std::string::npos && jsonLine.find("DELAY_MICROSECONDS") == std::string::npos) {
            std::regex durationRegex(R"("duration":\s*(\d+))");
            std::smatch durationMatch;
            if (std::regex_search(jsonLine, durationMatch, durationRegex)) {
                addCommand("delay(" + durationMatch[1].str() + ");");
            }
        }
    }

    void addCommand(const std::string& command) {
        if (inSetup) {
            setupCommands.push_back("  " + command);
        } else if (inLoop) {
            loopCommands.push_back("  " + command);
        }
    }

    std::string generateArduinoCode() {
        std::ostringstream arduino;

        // Setup function
        arduino << "void setup() {\n";
        for (const auto& cmd : setupCommands) {
            arduino << cmd << "\n";
        }
        arduino << "}\n\n";

        // Loop function
        arduino << "void loop() {\n";
        for (const auto& cmd : loopCommands) {
            arduino << cmd << "\n";
        }
        arduino << "}\n";

        return arduino.str();
    }
};

int main(int argc, char* argv[]) {
    if (argc != 3) {
        std::cerr << "Usage: " << argv[0] << " <input.json> <output.arduino>" << std::endl;
        return 1;
    }

    std::string inputFile = argv[1];
    std::string outputFile = argv[2];

    // Read JSON file
    std::ifstream inFile(inputFile);
    if (!inFile) {
        std::cerr << "Error: Could not open input file: " << inputFile << std::endl;
        return 1;
    }

    std::ostringstream buffer;
    buffer << inFile.rdbuf();
    std::string jsonContent = buffer.str();
    inFile.close();

    // Convert to Arduino
    SimpleJSONToArduino converter;
    std::string arduinoCode = converter.convertJSONToArduino(jsonContent);

    // Write Arduino file
    std::ofstream outFile(outputFile);
    if (!outFile) {
        std::cerr << "Error: Could not create output file: " << outputFile << std::endl;
        return 1;
    }

    outFile << arduinoCode;
    outFile.close();

    std::cout << "Converted " << inputFile << " to " << outputFile << std::endl;
    return 0;
}