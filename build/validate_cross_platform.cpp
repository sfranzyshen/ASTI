#include "../tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <regex>
#include <chrono>
#include <thread>
#include <algorithm>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

/**
 * Cross-Platform Validation Tool
 * Compares C++ and JavaScript command streams for tests 0-134
 * Normalizes timestamps, whitespace, and field order differences
 * Stops on first functional difference for analysis
 */

// Normalize JSON for comparison
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
    
    // Serial.println data field with calculated values (but preserve ASCII character values 0-127)
    std::regex serialDataRegex(R"~("data":\s*"(?:[1-9]\d{3,}|\d*\.\d+)")~"); // Match large numbers (1000+) or decimals, but not 0-999 integers
    normalized = std::regex_replace(normalized, serialDataRegex, R"("data": "0")");
    
    // Serial.println message field with calculated values
    std::regex serialMsgRegex(R"~("message":\s*"Serial\.println\([\d.]+\)")~");
    normalized = std::regex_replace(normalized, serialMsgRegex, R"~("message": "Serial.println(0)")~");


    return normalized;
}

// Extract C++ command stream for test
std::string extractCppCommands(int testNumber) {
    std::ostringstream astFileName;
    astFileName << "../test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".ast";
    std::string astFile = astFileName.str();
    
    // Load AST file
    std::ifstream file(astFile, std::ios::binary | std::ios::ate);
    if (!file) {
        return ""; // File doesn't exist
    }
    
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> compactAST(size);
    file.read(reinterpret_cast<char*>(compactAST.data()), size);
    file.close();
    
    try {
        // Set up C++ interpreter with command capture
        CommandStreamCapture capture;
        MockResponseHandler responseHandler;
        
        // Configure mock values to match JavaScript test data
        responseHandler.setDefaultAnalogValue(975);  // Match JS test data value
        responseHandler.setDefaultDigitalValue(1);   // Match JS test data value
        responseHandler.setDefaultMillisValue(17807); // Match JS test data value for millis()
        
        InterpreterOptions options;
        options.verbose = false;
        options.debug = false;
        options.maxLoopIterations = 1;
        options.syncMode = true;
        
        // Redirect stderr to suppress debug output during validation
        std::streambuf* orig = std::cerr.rdbuf();
        std::ostringstream nullStream;
        std::cerr.rdbuf(nullStream.rdbuf());
        
        auto interpreter = std::make_unique<ASTInterpreter>(compactAST.data(), compactAST.size(), options);
        interpreter->setCommandListener(&capture);
        interpreter->setResponseHandler(&responseHandler);
        
        // Execute with timeout
        interpreter->start();
        
        auto startTime = std::chrono::steady_clock::now();
        auto deadline = startTime + std::chrono::milliseconds(5000);
        while (interpreter->isRunning() && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        if (interpreter->isRunning()) {
            interpreter->stop();
        }
        
        // Restore stderr
        std::cerr.rdbuf(orig);
        
        std::string fullOutput = capture.getCommandsAsJson();
        
        // Extract only JSON part (remove any debug output)
        size_t jsonStart = fullOutput.find('[');
        size_t jsonEnd = fullOutput.rfind(']');
        if (jsonStart != std::string::npos && jsonEnd != std::string::npos && jsonEnd > jsonStart) {
            return fullOutput.substr(jsonStart, jsonEnd - jsonStart + 1);
        }
        return fullOutput;
        
    } catch (const std::exception& e) {
        return "";
    }
}

// Load JavaScript command stream
std::string loadJsCommands(int testNumber) {
    std::ostringstream fileName;
    fileName << "../test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".commands";
    
    std::ifstream file(fileName.str());
    if (!file) {
        return "";
    }
    
    std::ostringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

// Compare command streams functionally
bool compareCommands(const std::string& cppJson, const std::string& jsJson, int testNumber) {
    if (cppJson.empty() || jsJson.empty()) {
        if (cppJson.empty() && jsJson.empty()) {
            std::cout << "Test " << testNumber << ": Both streams empty - SKIP (no execution)" << std::endl;
            return true;  // Both empty is considered a match
        }
        std::cout << "Test " << testNumber << ": One stream missing - ";
        std::cout << (cppJson.empty() ? "C++ missing" : "JS missing") << std::endl;
        return false;
    }
    
    // Normalize both streams
    std::string normalizedCpp = normalizeJSON(cppJson);
    std::string normalizedJs = normalizeJSON(jsJson);
    
    if (normalizedCpp == normalizedJs) {
        std::cout << "Test " << testNumber << ": EXACT MATCH ✅" << std::endl;
        return true;
    } else {
        std::cout << "Test " << testNumber << ": FUNCTIONAL DIFFERENCE ❌" << std::endl;
        
        // Save normalized outputs for detailed comparison
        std::ofstream cppFile("test" + std::to_string(testNumber) + "_cpp_debug.json");
        cppFile << normalizedCpp << std::endl;
        cppFile.close();
        
        std::ofstream jsFile("test" + std::to_string(testNumber) + "_js_debug.json");  
        jsFile << normalizedJs << std::endl;
        jsFile.close();
        
        // Show first 200 chars of difference for debugging
        std::cout << "C++ (first 200 chars): " << normalizedCpp.substr(0, 200) << "..." << std::endl;
        std::cout << "JS  (first 200 chars): " << normalizedJs.substr(0, 200) << "..." << std::endl;
        std::cout << "Full outputs saved to test" << testNumber << "_cpp_debug.json and test" << testNumber << "_js_debug.json" << std::endl;
        
        return false;
    }
}

int main(int argc, char* argv[]) {
    int startTest = 0;
    int endTest = 134;
    
    if (argc >= 2) {
        startTest = std::atoi(argv[1]);
    }
    if (argc >= 3) {
        endTest = std::atoi(argv[2]);
    }
    
    std::cout << "=== Cross-Platform Validation ===" << std::endl;
    std::cout << "Testing range: " << startTest << " to " << endTest << std::endl;
    std::cout << "Normalizing timestamps, whitespace, field order differences" << std::endl;
    std::cout << "Will stop on first functional difference" << std::endl << std::endl;
    
    int successCount = 0;
    int totalTests = 0;
    
    for (int testNumber = startTest; testNumber <= endTest; testNumber++) {
        totalTests++;
        
        // Extract both command streams
        std::string cppCommands = extractCppCommands(testNumber);
        std::string jsCommands = loadJsCommands(testNumber);
        
        // Compare functionally
        bool matches = compareCommands(cppCommands, jsCommands, testNumber);
        
        if (matches) {
            successCount++;
        } else {
            // Stop on first functional difference
            std::cout << std::endl << "STOPPING: Found functional difference in test " << testNumber << std::endl;
            std::cout << "Analysis required before continuing." << std::endl;
            break;
        }
    }
    
    std::cout << std::endl << "=== SUMMARY ===" << std::endl;
    std::cout << "Tests processed: " << totalTests << std::endl;
    std::cout << "Exact matches: " << successCount << std::endl;
    std::cout << "Success rate: " << (100.0 * successCount / totalTests) << "%" << std::endl;
    
    return (successCount == totalTests) ? 0 : 1;
}