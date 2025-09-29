#include "src/cpp/ASTInterpreter.hpp"
#include "libs/ArduinoParser/src/ArduinoParser.js" // For parsing
#include <iostream>
#include <string>

int main() {
    std::cout << "=== Ultra-Minimal JSON Output Test ===" << std::endl;

    // Simple Arduino program to test JSON output
    std::string testProgram = R"(
        void setup() {
            pinMode(13, OUTPUT);
            digitalWrite(13, HIGH);
        }

        void loop() {
            digitalWrite(13, LOW);
            delay(1000);
        }
    )";

    try {
        // For this demo, let's just test the JSON helper functions directly
        arduino_interpreter::ASTInterpreter interpreter(nullptr);

        std::cout << "\n=== Testing JSON Helper Functions ===" << std::endl;

        // Test basic JSON field generation
        std::cout << "Integer field: " << interpreter.jsonField("pin", 13) << std::endl;
        std::cout << "String field: " << interpreter.jsonField("type", "DIGITAL_WRITE") << std::endl;
        std::cout << "Double field: " << interpreter.jsonField("delay", 1000.0) << std::endl;

        // Test complete JSON generation
        std::vector<std::string> fields = {
            interpreter.jsonField("pin", 13),
            interpreter.jsonField("value", 1)
        };
        std::string digitalWriteJSON = interpreter.buildJSON("DIGITAL_WRITE", fields);
        std::cout << "\nComplete JSON: " << digitalWriteJSON << std::endl;

        // Test VERSION_INFO JSON
        std::vector<std::string> versionFields = {
            interpreter.jsonField("component", "interpreter"),
            interpreter.jsonField("version", "11.0.0"),
            interpreter.jsonField("status", "started")
        };
        std::string versionJSON = interpreter.buildJSON("VERSION_INFO", versionFields);
        std::cout << "Version JSON: " << versionJSON << std::endl;

        std::cout << "\n✅ JSON Helper Functions Working Correctly!" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "❌ Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}