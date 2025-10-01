#include <iostream>
#include <string>
#include <fstream>
#include <vector>
#include <regex>
#include <unordered_map>
#include <iterator>

/**
 * Standalone JSON-to-Arduino Converter
 *
 * Converts JSON command streams from the ultra-minimal interpreter
 * into Arduino code for validation against reference implementations.
 *
 * This replaces the complex FlexibleCommand system with a simple,
 * clean conversion tool that handles all command types dynamically.
 */

class JSONToArduinoConverter {
private:
    std::unordered_map<std::string, std::string> commandTemplates_;

    void initializeTemplates() {
        // Core Arduino commands
        commandTemplates_["DIGITAL_WRITE"] = "digitalWrite({pin}, {value});";
        commandTemplates_["DIGITAL_READ"] = "digitalRead({pin});";
        commandTemplates_["ANALOG_WRITE"] = "analogWrite({pin}, {value});";
        commandTemplates_["ANALOG_READ"] = "analogRead({pin});";
        commandTemplates_["PIN_MODE"] = "pinMode({pin}, {mode});";

        // Timing commands
        commandTemplates_["DELAY"] = "delay({milliseconds});";
        commandTemplates_["DELAY_MICROSECONDS"] = "delayMicroseconds({microseconds});";

        // Serial commands
        commandTemplates_["SERIAL_BEGIN"] = "Serial.begin({baudRate});";
        commandTemplates_["SERIAL_PRINT"] = "Serial.print({message});";
        commandTemplates_["SERIAL_PRINTLN"] = "Serial.println({message});";
        commandTemplates_["SERIAL_WRITE"] = "Serial.write({data});";
        commandTemplates_["SERIAL_FLUSH"] = "Serial.flush();";

        // Sound commands
        commandTemplates_["TONE"] = "tone({pin}, {frequency});";
        commandTemplates_["NO_TONE"] = "noTone({pin});";

        // Variables
        commandTemplates_["VAR_SET"] = "{variable} = {value};";

        // Function calls
        commandTemplates_["FUNCTION_CALL"] = "{function}();";

        // Control flow
        commandTemplates_["IF_STATEMENT"] = "if ({condition}) {";
        commandTemplates_["WHILE_LOOP"] = "while ({condition}) {";
        commandTemplates_["FOR_LOOP"] = "for ({init}; {condition}; {increment}) {";
        commandTemplates_["BREAK_STATEMENT"] = "break;";
        commandTemplates_["CONTINUE_STATEMENT"] = "continue;";

        // System commands
        commandTemplates_["VERSION_INFO"] = "// Interpreter version {version}";
        commandTemplates_["PROGRAM_START"] = "// Program execution started";
        commandTemplates_["PROGRAM_END"] = "// Program execution ended";
        commandTemplates_["SETUP_START"] = "void setup() {";
        commandTemplates_["SETUP_END"] = "} // End setup";
        commandTemplates_["LOOP_START"] = "void loop() {";
        commandTemplates_["LOOP_END"] = "} // End loop";
    }

    std::string extractJSONField(const std::string& json, const std::string& field) {
        std::regex fieldRegex("\"" + field + "\"\\s*:\\s*\"?([^,}\"]+)\"?");
        std::smatch match;
        if (std::regex_search(json, match, fieldRegex)) {
            return match[1].str();
        }
        return "";
    }

    std::string replaceFields(const std::string& template_str, const std::string& json) {
        std::string result = template_str;

        // Replace all {field} placeholders with values from JSON
        std::regex placeholderRegex(R"(\{(\w+)\})");
        std::smatch match;

        while (std::regex_search(result, match, placeholderRegex)) {
            std::string field = match[1].str();
            std::string value = extractJSONField(json, field);
            if (!value.empty()) {
                result = std::regex_replace(result, std::regex("\\{" + field + "\\}"), value);
            } else {
                // Keep placeholder if field not found
                break;
            }
        }

        return result;
    }

public:
    JSONToArduinoConverter() {
        initializeTemplates();
    }

    std::string convertJSONLine(const std::string& jsonLine) {
        if (jsonLine.empty() || jsonLine[0] != '{') {
            return ""; // Skip non-JSON lines
        }

        std::string type = extractJSONField(jsonLine, "type");
        if (type.empty()) {
            return "// Unknown command: " + jsonLine;
        }

        if (commandTemplates_.find(type) != commandTemplates_.end()) {
            return replaceFields(commandTemplates_[type], jsonLine);
        } else {
            return "// Unsupported command type: " + type;
        }
    }

    std::vector<std::string> convertJSONStream(const std::vector<std::string>& jsonLines) {
        std::vector<std::string> arduinoLines;

        for (const auto& jsonLine : jsonLines) {
            std::string arduinoLine = convertJSONLine(jsonLine);
            if (!arduinoLine.empty()) {
                arduinoLines.push_back(arduinoLine);
            }
        }

        return arduinoLines;
    }

    bool convertFile(const std::string& inputFile, const std::string& outputFile) {
        std::ifstream input(inputFile);
        if (!input.is_open()) {
            std::cerr << "Error: Cannot open input file: " << inputFile << std::endl;
            return false;
        }

        // Read entire file content
        std::string content((std::istreambuf_iterator<char>(input)),
                           std::istreambuf_iterator<char>());
        input.close();

        // Extract individual JSON objects from array format
        std::vector<std::string> jsonLines;
        std::regex jsonObjectRegex(R"(\{[^}]*\})");
        std::sregex_iterator iter(content.begin(), content.end(), jsonObjectRegex);
        std::sregex_iterator end;

        for (; iter != end; ++iter) {
            jsonLines.push_back(iter->str());
        }

        std::vector<std::string> arduinoLines = convertJSONStream(jsonLines);

        std::ofstream output(outputFile);
        if (!output.is_open()) {
            std::cerr << "Error: Cannot create output file: " << outputFile << std::endl;
            return false;
        }

        for (const auto& arduinoLine : arduinoLines) {
            output << arduinoLine << std::endl;
        }
        output.close();

        std::cout << "Converted " << jsonLines.size() << " JSON commands to "
                  << arduinoLines.size() << " Arduino lines" << std::endl;
        std::cout << "Output written to: " << outputFile << std::endl;

        return true;
    }
};

int main(int argc, char* argv[]) {
    if (argc != 3) {
        std::cout << "Ultra-Minimal JSON-to-Arduino Converter" << std::endl;
        std::cout << "Usage: " << argv[0] << " <input.json> <output.ino>" << std::endl;
        std::cout << std::endl;
        std::cout << "Converts JSON command streams from the ultra-minimal interpreter" << std::endl;
        std::cout << "into Arduino code for validation testing." << std::endl;
        return 1;
    }

    std::string inputFile = argv[1];
    std::string outputFile = argv[2];

    JSONToArduinoConverter converter;

    if (converter.convertFile(inputFile, outputFile)) {
        std::cout << "✅ Conversion successful!" << std::endl;
        return 0;
    } else {
        std::cout << "❌ Conversion failed!" << std::endl;
        return 1;
    }
}