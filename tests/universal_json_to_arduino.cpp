#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
#include <vector>
#include <regex>

/**
 * Universal JSON to Arduino Command Stream Converter
 *
 * Converts JSON command streams from either JavaScript or C++ interpreters
 * into a linear command stream for validation.
 *
 * OUTPUT FORMAT (command stream, NOT sketch):
 *   VERSION: interpreter v11.0.0 started
 *   PROGRAM_START
 *   SETUP_START
 *   Serial.begin(9600)
 *   SETUP_END
 *   LOOP_START
 *   analogRead(14)
 *   Serial.println(560)
 *   delay(1)
 *   LOOP_END
 *   PROGRAM_END
 *
 * INCLUDES:
 *   - VERSION_INFO (version synchronization)
 *   - PROGRAM_START/END (lifecycle validation)
 *   - SETUP_START/END, LOOP_START/END (flow control validation)
 *   - Hardware commands (core functionality)
 *
 * EXCLUDES:
 *   - VAR_SET (internal state, not observable behavior)
 *   - FUNCTION_CALL with function="loop" (redundant with LOOP_START/END)
 */

class UniversalJSONToArduino {
private:
    std::vector<std::string> commandStream;

public:
    std::string convertToCommandStream(const std::string& jsonContent) {
        commandStream.clear();

        // Parse all JSON objects from the content
        std::vector<std::string> jsonObjects = extractAllJSONObjects(jsonContent);

        // Process each object in order (linear command stream)
        for (size_t i = 0; i < jsonObjects.size(); i++) {
            processJSONObject(jsonObjects[i]);
        }

        return generateCommandStream();
    }

private:
    std::vector<std::string> extractAllJSONObjects(const std::string& content) {
        std::vector<std::string> objects;
        std::istringstream stream(content);
        std::string line;
        std::string currentObject;
        int braceCount = 0;
        bool inObject = false;

        while (std::getline(stream, line)) {
            // Skip empty lines and debug output
            if (line.empty() ||
                line.find("DEBUG") != std::string::npos ||
                line.find("EXTRACT_DEBUG") != std::string::npos) {
                continue;
            }

            // Skip JSON array markers
            if (line == "[" || line == "]" || line == "  [" || line == "  ]") {
                continue;
            }

            // Remove leading/trailing whitespace and comma
            size_t start = line.find_first_not_of(" \t\n\r");
            if (start == std::string::npos) continue;

            size_t end = line.find_last_not_of(" \t\n\r,");
            line = line.substr(start, end - start + 1);

            if (line.empty()) continue;

            // Process character by character for precise brace counting
            for (size_t pos = 0; pos < line.length(); pos++) {
                char c = line[pos];

                if (c == '{') {
                    if (braceCount == 0) {
                        inObject = true;
                        currentObject = "";
                    }
                    braceCount++;
                    currentObject += c;
                } else if (c == '}') {
                    currentObject += c;
                    braceCount--;

                    if (braceCount == 0 && inObject) {
                        objects.push_back(currentObject);
                        currentObject = "";
                        inObject = false;

                        // Continue processing rest of line if there's more
                        if (pos + 1 < line.length()) {
                            std::string remaining = line.substr(pos + 1);
                            size_t nextStart = remaining.find_first_not_of(" \t\n\r,");
                            if (nextStart != std::string::npos) {
                                remaining = remaining.substr(nextStart);
                                if (!remaining.empty() && remaining[0] == '{') {
                                    line = remaining;
                                    pos = -1;
                                }
                            }
                        }
                    }
                } else if (inObject) {
                    currentObject += c;
                }
            }

            if (inObject && braceCount > 0) {
                currentObject += " ";
            }
        }

        return objects;
    }

    void processJSONObject(const std::string& jsonObj) {
        std::string type = extractStringField(jsonObj, "type");

        // VERSION_INFO - Version synchronization validation
        if (type == "VERSION_INFO") {
            std::string component = extractStringField(jsonObj, "component");
            std::string version = extractStringField(jsonObj, "version");
            std::string status = extractStringField(jsonObj, "status");
            commandStream.push_back("VERSION: " + component + " v" + version + " " + status);
            return;
        }

        // PROGRAM_START/END - Lifecycle validation
        if (type == "PROGRAM_START") {
            commandStream.push_back("PROGRAM_START");
            return;
        }
        if (type == "PROGRAM_END") {
            commandStream.push_back("PROGRAM_END");
            return;
        }

        // GENERATION_FAILED - Test generation timeout/error marker
        if (type == "GENERATION_FAILED") {
            std::string reason = extractStringField(jsonObj, "reason");
            std::string testName = extractStringField(jsonObj, "testName");
            commandStream.push_back("GENERATION_FAILED: " + testName + " - " + reason);
            return;
        }

        // SETUP_START/END - Flow control validation
        if (type == "SETUP_START") {
            commandStream.push_back("SETUP_START");
            return;
        }
        if (type == "SETUP_END") {
            commandStream.push_back("SETUP_END");
            return;
        }

        // LOOP_START/END - Flow control validation
        if (type == "LOOP_START") {
            commandStream.push_back("LOOP_START");
            return;
        }
        if (type == "LOOP_END") {
            commandStream.push_back("LOOP_END");
            return;
        }

        // EXCLUDE: VAR_SET (internal state, not observable)
        if (type == "VAR_SET") {
            return;
        }

        // FUNCTION_CALL - Hardware commands
        if (type == "FUNCTION_CALL") {
            std::string function = extractStringField(jsonObj, "function");

            // EXCLUDE: function="loop" (redundant with LOOP_START/END)
            if (function == "loop") {
                return;
            }

            // Serial.begin
            if (function == "Serial.begin") {
                int baudRate = extractIntField(jsonObj, "baudRate");
                if (baudRate == 0) {
                    baudRate = extractFirstArrayInt(jsonObj, "arguments");
                }
                if (baudRate > 0) {
                    commandStream.push_back("Serial.begin(" + std::to_string(baudRate) + ")");
                }
                return;
            }

            // Serial.println / Serial.print
            if (function == "Serial.println" || function == "Serial.print") {
                std::string data = extractStringField(jsonObj, "data");
                if (!data.empty()) {
                    commandStream.push_back(function + "(" + data + ")");
                } else {
                    std::string arg = extractFirstArrayString(jsonObj, "arguments");
                    if (!arg.empty()) {
                        commandStream.push_back(function + "(\"" + arg + "\")");
                    }
                }
                return;
            }

            // Keyboard.begin
            if (function == "Keyboard.begin") {
                commandStream.push_back("Keyboard.begin()");
                return;
            }

            // Keyboard.press
            if (function == "Keyboard.press") {
                int arg = extractFirstArrayInt(jsonObj, "arguments");
                if (arg > 0) {
                    commandStream.push_back("Keyboard.press(" + std::to_string(arg) + ")");
                }
                return;
            }

            // Keyboard.write
            if (function == "Keyboard.write") {
                int arg = extractFirstArrayInt(jsonObj, "arguments");
                if (arg > 0) {
                    commandStream.push_back("Keyboard.write(" + std::to_string(arg) + ")");
                }
                return;
            }

            // Keyboard.releaseAll
            if (function == "Keyboard.releaseAll") {
                commandStream.push_back("Keyboard.releaseAll()");
                return;
            }

            // Keyboard.release
            if (function == "Keyboard.release") {
                int arg = extractFirstArrayInt(jsonObj, "arguments");
                if (arg > 0) {
                    commandStream.push_back("Keyboard.release(" + std::to_string(arg) + ")");
                } else {
                    commandStream.push_back("Keyboard.release()");
                }
                return;
            }

            // Keyboard.println
            if (function == "Keyboard.println") {
                std::string arg = extractFirstArrayStringOrObject(jsonObj, "arguments");
                if (!arg.empty()) {
                    commandStream.push_back("Keyboard.println(" + arg + ")");
                } else {
                    commandStream.push_back("Keyboard.println()");
                }
                return;
            }

            // Keyboard.print
            if (function == "Keyboard.print") {
                std::string arg = extractFirstArrayStringOrObject(jsonObj, "arguments");
                if (!arg.empty()) {
                    commandStream.push_back("Keyboard.print(" + arg + ")");
                }
                return;
            }

            // pinMode
            if (function == "pinMode") {
                std::vector<int> args = extractIntArray(jsonObj, "arguments");
                if (args.size() >= 2) {
                    std::string mode = (args[1] == 1) ? "OUTPUT" : "INPUT";
                    commandStream.push_back("pinMode(" + std::to_string(args[0]) + ", " + mode + ")");
                }
                return;
            }

            // digitalWrite
            if (function == "digitalWrite") {
                std::vector<int> args = extractIntArray(jsonObj, "arguments");
                if (args.size() >= 2) {
                    std::string value = (args[1] == 1) ? "HIGH" : "LOW";
                    commandStream.push_back("digitalWrite(" + std::to_string(args[0]) + ", " + value + ")");
                }
                return;
            }

            // delay
            if (function == "delay") {
                std::vector<int> args = extractIntArray(jsonObj, "arguments");
                if (args.size() >= 1) {
                    commandStream.push_back("delay(" + std::to_string(args[0]) + ")");
                }
                return;
            }
        }

        // PIN_MODE command type
        if (type == "PIN_MODE") {
            int pin = extractIntField(jsonObj, "pin");
            int mode = extractIntField(jsonObj, "mode");
            if (pin >= 0) {
                std::string modeStr = (mode == 1) ? "OUTPUT" : "INPUT";
                commandStream.push_back("pinMode(" + std::to_string(pin) + ", " + modeStr + ")");
            }
            return;
        }

        // DIGITAL_WRITE command type
        if (type == "DIGITAL_WRITE") {
            int pin = extractIntField(jsonObj, "pin");
            int value = extractIntField(jsonObj, "value");
            if (pin >= 0) {
                std::string valueStr = (value == 1) ? "HIGH" : "LOW";
                commandStream.push_back("digitalWrite(" + std::to_string(pin) + ", " + valueStr + ")");
            }
            return;
        }

        // ANALOG_READ_REQUEST command type
        if (type == "ANALOG_READ_REQUEST") {
            int pin = extractIntField(jsonObj, "pin");
            if (pin >= 0) {
                commandStream.push_back("analogRead(" + std::to_string(pin) + ")");
            }
            return;
        }

        // DELAY command type
        if (type == "DELAY") {
            int duration = extractIntField(jsonObj, "duration");
            if (duration > 0) {
                commandStream.push_back("delay(" + std::to_string(duration) + ")");
            }
            return;
        }
    }

    std::string extractStringField(const std::string& jsonObj, const std::string& fieldName) {
        std::string pattern = "\"" + fieldName + "\"\\s*:\\s*\"([^\"]+)\"";
        std::regex fieldRegex(pattern);
        std::smatch match;

        if (std::regex_search(jsonObj, match, fieldRegex)) {
            return match[1].str();
        }
        return "";
    }

    int extractIntField(const std::string& jsonObj, const std::string& fieldName) {
        std::string pattern = "\"" + fieldName + "\"\\s*:\\s*(\\d+)";
        std::regex fieldRegex(pattern);
        std::smatch match;

        if (std::regex_search(jsonObj, match, fieldRegex)) {
            return std::stoi(match[1].str());
        }
        return 0;
    }

    int extractFirstArrayInt(const std::string& jsonObj, const std::string& arrayName) {
        // Updated regex to handle both quoted and unquoted integers: ["131"] or [131]
        std::string pattern = "\"" + arrayName + "\"\\s*:\\s*\\[\\s*\"?(\\d+)\"?";
        std::regex arrayRegex(pattern);
        std::smatch match;

        if (std::regex_search(jsonObj, match, arrayRegex)) {
            return std::stoi(match[1].str());
        }
        return 0;
    }

    std::string extractFirstArrayString(const std::string& jsonObj, const std::string& arrayName) {
        std::string pattern = "\"" + arrayName + "\"\\s*:\\s*\\[\\s*\"([^\"]+)\"";
        std::regex arrayRegex(pattern);
        std::smatch match;

        if (std::regex_search(jsonObj, match, arrayRegex)) {
            return match[1].str();
        }
        return "";
    }

    std::vector<int> extractIntArray(const std::string& jsonObj, const std::string& arrayName) {
        std::vector<int> result;
        std::string pattern = "\"" + arrayName + "\"\\s*:\\s*\\[([^\\]]+)\\]";
        std::regex arrayRegex(pattern);
        std::smatch match;

        if (std::regex_search(jsonObj, match, arrayRegex)) {
            std::string arrayContent = match[1].str();
            std::regex numRegex("(\\d+)");
            std::sregex_iterator iter(arrayContent.begin(), arrayContent.end(), numRegex);
            std::sregex_iterator end;

            for (; iter != end; ++iter) {
                result.push_back(std::stoi(iter->str()));
            }
        }
        return result;
    }

    std::string extractFirstArrayStringOrObject(const std::string& jsonObj, const std::string& arrayName) {
        // Try object with "value" field first (for Arduino String objects)
        std::string objectPattern = "\"" + arrayName + "\"\\s*:\\s*\\[\\s*\\{[^}]*\"value\"\\s*:\\s*\"([^\"]+)\"";
        std::regex objectRegex(objectPattern);
        std::smatch objectMatch;

        if (std::regex_search(jsonObj, objectMatch, objectRegex)) {
            return "\"" + objectMatch[1].str() + "\"";
        }

        // Try simple string
        std::string stringPattern = "\"" + arrayName + "\"\\s*:\\s*\\[\\s*\"([^\"]+)\"";
        std::regex stringRegex(stringPattern);
        std::smatch stringMatch;

        if (std::regex_search(jsonObj, stringMatch, stringRegex)) {
            return "\"" + stringMatch[1].str() + "\"";
        }

        // Check for empty array
        std::string emptyPattern = "\"" + arrayName + "\"\\s*:\\s*\\[\\s*\\]";
        std::regex emptyRegex(emptyPattern);
        if (std::regex_search(jsonObj, emptyRegex)) {
            return "";  // Empty arguments
        }

        return "";
    }

    std::string generateCommandStream() {
        std::ostringstream stream;
        for (const auto& cmd : commandStream) {
            stream << cmd << "\n";
        }
        return stream.str();
    }
};

int main(int argc, char* argv[]) {
    if (argc != 3) {
        std::cerr << "Usage: " << argv[0] << " <input.json> <output.arduino>" << std::endl;
        std::cerr << "Converts JSON command streams to Arduino command streams" << std::endl;
        std::cerr << "Handles BOTH JavaScript JSON arrays AND C++ line-by-line JSON!" << std::endl;
        return 1;
    }

    std::string inputFile = argv[1];
    std::string outputFile = argv[2];

    std::ifstream inFile(inputFile);
    if (!inFile) {
        std::cerr << "Error: Could not open " << inputFile << std::endl;
        return 1;
    }

    std::ostringstream buffer;
    buffer << inFile.rdbuf();
    std::string jsonContent = buffer.str();
    inFile.close();

    UniversalJSONToArduino converter;
    std::string commandStream = converter.convertToCommandStream(jsonContent);

    std::ofstream outFile(outputFile);
    if (!outFile) {
        std::cerr << "Error: Could not create " << outputFile << std::endl;
        return 1;
    }

    outFile << commandStream;
    outFile.close();

    std::cout << "✅ Converted " << inputFile << " to " << outputFile << std::endl;
    return 0;
}