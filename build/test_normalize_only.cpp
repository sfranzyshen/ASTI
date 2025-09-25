#include <iostream>
#include <fstream>
#include <sstream>
#include <regex>

// Exactly the same normalize function from validate_cross_platform.cpp
std::string normalizeJSON(const std::string& json) {
    std::string normalized = json;

    // Replace all timestamps with normalized value
    std::regex timestampRegex(R"("timestamp":\s*\d+)");
    normalized = std::regex_replace(normalized, timestampRegex, R"("timestamp": 0)");

    // Normalize pin numbers - A0 can be pin 14 or 36 depending on platform
    std::regex pinRegex(R"("pin":\s*(?:14|36))");
    normalized = std::regex_replace(normalized, pinRegex, R"("pin": 0)");

    // Normalize request IDs - format varies between implementations
    std::regex requestIdRegex(R"("requestId":\s*"[^"]+")");
    normalized = std::regex_replace(normalized, requestIdRegex, R"("requestId": "normalized")");

    // Normalize whitespace - remove extra spaces around colons and commas
    std::regex spaceRegex(R"(\s*:\s*)");
    normalized = std::regex_replace(normalized, spaceRegex, ": ");

    std::regex commaRegex(R"(\s*,\s*)");
    normalized = std::regex_replace(normalized, commaRegex, ", ");

    // Remove trailing whitespace from lines
    std::regex trailingSpaceRegex(R"(\s+$)", std::regex_constants::ECMAScript);
    normalized = std::regex_replace(normalized, trailingSpaceRegex, "");

    // Normalize field ordering for DIGITAL_WRITE commands (common pattern)
    std::regex digitalWriteRegex(R"("type": "DIGITAL_WRITE",\s*"timestamp": 0,\s*"pin": (\d+),\s*"value": (\d+))");
    normalized = std::regex_replace(normalized, digitalWriteRegex, R"("type": "DIGITAL_WRITE", "pin": $1, "value": $2, "timestamp": 0)");

    // LOOP_LIMIT_REACHED field reordering - C++ vs JS field order difference
    std::string loopPattern = "\"type\": \"LOOP_LIMIT_REACHED\", \"timestamp\": 0, \"message\": \"([^\"]+)\", \"iterations\": ([0-9]+), \"phase\": \"([^\"]+)\"";
    std::string loopReplacement = "\"type\": \"LOOP_LIMIT_REACHED\", \"phase\": \"$3\", \"iterations\": $2, \"timestamp\": 0, \"message\": \"$1\"";
    std::regex loopPhaseRegex(loopPattern);
    normalized = std::regex_replace(normalized, loopPhaseRegex, loopReplacement);

    // Normalize decimal number formatting - C++ outputs 5.0000000000, JS outputs 5
    std::regex decimalNormRegex(R"((\d+)\.0+(?!\d))");  // Match integers with trailing zeros
    normalized = std::regex_replace(normalized, decimalNormRegex, "$1");

    // Normalize mock analog/digital values that could vary between test runs
    // These values come from MockResponseHandler and may be randomized or platform-specific
    std::regex analogValueRegex(R"("value":\s*\d+(?:\.\d+)?)");  // Match any analog reading value
    std::regex voltageRegex(R"("voltage":\s*\d+(?:\.\d+)?)");    // Match calculated voltage values
    std::regex sensorValueRegex(R"("sensorValue".*"value":\s*\d+)");  // Match sensor readings

    // Normalize specific test patterns that use mock values
    // VAR_SET for sensorValue (from analogRead)
    std::regex sensorVarSetRegex(R"("VAR_SET",\s*"variable":\s*"sensorValue",\s*"value":\s*\d+)");
    normalized = std::regex_replace(normalized, sensorVarSetRegex, R"("VAR_SET", "variable": "sensorValue", "value": 0)");

    // VAR_SET for voltage (calculated from sensorValue)
    std::regex voltageVarSetRegex(R"("VAR_SET",\s*"variable":\s*"voltage",\s*"value":\s*[\d.]+)");
    normalized = std::regex_replace(normalized, voltageVarSetRegex, R"("VAR_SET", "variable": "voltage", "value": 0)");

    // Serial.println arguments that contain calculated values
    std::regex serialArgsRegex(R"("arguments":\s*\[\s*"[\d.]+"?\s*\])");
    normalized = std::regex_replace(normalized, serialArgsRegex, R"("arguments": ["0"])");

    // Serial.println data field with calculated values
    std::regex serialDataRegex(R"("data":\s*"[\d.]+")");
    normalized = std::regex_replace(normalized, serialDataRegex, R"("data": "0")");

    // Serial.println message field with calculated values
    std::regex serialMsgRegex(R"~("message":\s*"Serial\.println\([\d.]+\)")~");
    normalized = std::regex_replace(normalized, serialMsgRegex, R"~("message": "Serial.println(0)")~");

    return normalized;
}

int main() {
    // Test with a simple JSON first
    std::string testJson = R"([{"type":"VERSION_INFO","timestamp":123456}])";
    std::cout << "Testing with simple JSON..." << std::endl;
    try {
        std::string result = normalizeJSON(testJson);
        std::cout << "Simple test SUCCESS" << std::endl;
    } catch (const std::exception& e) {
        std::cout << "Simple test FAILED: " << e.what() << std::endl;
        return 1;
    }

    // Test with actual test 114 output
    std::cout << "Reading test 114 C++ output..." << std::endl;
    std::string test114Output;
    {
        std::ifstream proc;
        // Use popen-like approach to get extract_cpp_commands output
        FILE* pipe = popen("./extract_cpp_commands 114 2>/dev/null", "r");
        if (!pipe) {
            std::cout << "Failed to get extract_cpp_commands output" << std::endl;
            return 1;
        }

        char buffer[1024];
        std::string result;
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            result += buffer;
        }
        pclose(pipe);

        // Extract JSON part
        size_t jsonStart = result.find('[');
        if (jsonStart != std::string::npos) {
            size_t jsonEnd = result.rfind(']');
            if (jsonEnd != std::string::npos && jsonEnd > jsonStart) {
                test114Output = result.substr(jsonStart, jsonEnd - jsonStart + 1);
            }
        }
    }

    if (test114Output.empty()) {
        std::cout << "Failed to get test 114 output" << std::endl;
        return 1;
    }

    std::cout << "Got " << test114Output.length() << " bytes of test 114 output" << std::endl;
    std::cout << "Testing normalization on test 114..." << std::endl;

    try {
        std::string normalized = normalizeJSON(test114Output);
        std::cout << "Normalization SUCCESS" << std::endl;
        std::cout << "Result length: " << normalized.length() << std::endl;
    } catch (const std::exception& e) {
        std::cout << "Normalization FAILED: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}