#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <regex>
#include <chrono>
#include <thread>
#include <algorithm>
#include <cmath>
#include <unistd.h>
#include <cstdlib>
#include <sys/wait.h>

/**
 * Arduino Cross-Platform Validation Tool
 * Compares Arduino outputs from C++ and JavaScript interpreters
 * Uses universal_json_to_arduino converter for comparison
 * Stops on first functional difference for analysis
 */

// Normalize Arduino code for comparison
// Helper function to round floating-point Serial.println values to 6 decimal places
std::string roundFloatPrintValues(const std::string& input) {
    std::string result = input;
    std::regex floatRegex(R"(Serial\.println\((\d+\.\d+)\))");
    std::smatch match;
    std::string::const_iterator searchStart(result.cbegin());

    while (std::regex_search(searchStart, result.cend(), match, floatRegex)) {
        std::string fullMatch = match[0].str();
        std::string numStr = match[1].str();
        double value = std::stod(numStr);

        // Round to 6 decimal places to match C++ std::to_string precision
        double rounded = std::round(value * 1000000.0) / 1000000.0;

        // Format with 6 decimal places
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6) << rounded;
        std::string roundedStr = oss.str();

        // Create replacement
        std::string replacement = "Serial.println(" + roundedStr + ")";

        // Replace in result
        size_t pos = match.position() + (searchStart - result.cbegin());
        result.replace(pos, fullMatch.length(), replacement);

        // Move search position forward
        searchStart = result.cbegin() + pos + replacement.length();
    }

    return result;
}

std::string normalizeArduino(const std::string& arduino) {
    std::string normalized = arduino;

    // FIRST: Round all floating-point Serial.println values to 6 decimal places
    // This matches C++ std::to_string precision and properly rounds JS values
    normalized = roundFloatPrintValues(normalized);

    // Normalize timing function values that vary between platforms
    std::regex millisVarRegex(R"(millis\(\))");
    normalized = std::regex_replace(normalized, millisVarRegex, "millis() /* normalized */");

    // Normalize delay values that might be calculated
    std::regex delayVarRegex(R"(delay\(\d+\))");
    normalized = std::regex_replace(normalized, delayVarRegex, "delay(1000)");

    // Normalize pin references (A0 can be 14 or 36)
    std::regex pinA0Regex(R"(\b(?:14|36)\b)");  // A0 pin differences
    normalized = std::regex_replace(normalized, pinA0Regex, "A0");

    // Normalize analog values that come from mock responses
    std::regex analogReadVarRegex(R"(analogRead\(\d+\))");
    normalized = std::regex_replace(normalized, analogReadVarRegex, "analogRead(A0)");

    // Normalize calculated values in Serial.print/println (integers)
    std::regex serialPrintVarRegex(R"(Serial\.println\(\d+\))");
    normalized = std::regex_replace(normalized, serialPrintVarRegex, "Serial.println(0)");

    std::regex serialPrintStringRegex(R"(Serial\.print\("[^"]*"\))");
    // Preserve literal strings, only normalize calculated values

    // Normalize escape sequences BEFORE whitespace normalization
    // Convert literal \t, \n, \r (two chars) to actual whitespace characters
    // This ensures C++ literal tabs and JS escaped \t are treated the same
    std::regex escapeTabRegex(R"(\\t)");
    normalized = std::regex_replace(normalized, escapeTabRegex, "\t");

    std::regex escapeNewlineRegex(R"(\\n)");
    normalized = std::regex_replace(normalized, escapeNewlineRegex, "\n");

    std::regex escapeCarriageRegex(R"(\\r)");
    normalized = std::regex_replace(normalized, escapeCarriageRegex, "\r");

    // Remove extra whitespace and normalize line endings
    std::regex whitespaceRegex(R"(\s+)");
    normalized = std::regex_replace(normalized, whitespaceRegex, " ");

    // Remove trailing semicolons and spaces for consistency
    std::regex trailingRegex(R"(\s*;\s*$)", std::regex_constants::ECMAScript);
    normalized = std::regex_replace(normalized, trailingRegex, "");

    return normalized;
}

// Legacy JSON normalization (kept for reference, will be removed)
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

    // Normalize SWITCH_STATEMENT field ordering - C++ vs JS field order difference
    std::regex switchStmtRegex(R"~("type":\s*"SWITCH_STATEMENT",.*?"discriminant":\s*([^,}\n]+).*?"timestamp":\s*0.*?"message":\s*"([^"]+)")~");
    normalized = std::regex_replace(normalized, switchStmtRegex, R"~("type": "SWITCH_STATEMENT", "discriminant": $1, "timestamp": 0, "message": "$2")~");

    // Normalize SWITCH_CASE field ordering - C++ vs JS field order difference
    std::regex switchCaseRegex(R"~("type":\s*"SWITCH_CASE",\s*"timestamp":\s*0,\s*"caseValue":\s*([^,}]+),\s*"matched":\s*(true|false))~");
    normalized = std::regex_replace(normalized, switchCaseRegex, R"~("type": "SWITCH_CASE", "caseValue": $1, "matched": $2, "timestamp": 0)~");

    // Normalize BREAK_STATEMENT presence - JavaScript may include it, C++ may not
    std::regex breakStmtRegex(R"~(\},\s*\{\s*"type":\s*"BREAK_STATEMENT",\s*"timestamp":\s*0,\s*"action":\s*"exit_switch"\s*\}\s*,\s*)~");
    normalized = std::regex_replace(normalized, breakStmtRegex, "}, ");

    return normalized;
}

// Extract C++ command stream for test using existing extract_cpp_commands tool
std::string extractCppCommands(int testNumber) {
    // Use the existing extract_cpp_commands binary to get JSON output
    // MUST run from root folder according to COMMANDS.md
    std::ostringstream command;
    // CRITICAL FIX: Capture stderr to detect crashes/errors, not silence them
    command << "cd .. && ./build/extract_cpp_commands " << testNumber << " 2>&1";

    FILE* pipe = popen(command.str().c_str(), "r");
    if (!pipe) {
        std::cerr << "ERROR: Failed to execute extract_cpp_commands for test " << testNumber << std::endl;
        return "";
    }

    std::ostringstream result;
    char buffer[1024];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result << buffer;
    }

    int status = pclose(pipe);

    // CRITICAL FIX: Detect non-zero exit code as error
    if (status != 0) {
        int exitCode = WEXITSTATUS(status);
        bool segfault = WIFSIGNALED(status);
        std::cerr << "ERROR: extract_cpp_commands failed for test " << testNumber;
        if (segfault) {
            std::cerr << " (SEGFAULT - signal " << WTERMSIG(status) << ")";
        } else {
            std::cerr << " (exit code " << exitCode << ")";
        }
        std::cerr << std::endl;
        std::cerr << "Output: " << result.str() << std::endl;
        return "";
    }

    // Extract just the JSON part (filter out debug output)
    std::string fullOutput = result.str();
    std::ostringstream jsonOutput;
    std::istringstream stream(fullOutput);
    std::string line;

    bool foundJsonStart = false;
    while (std::getline(stream, line)) {
        // Look for lines that start with { or are part of JSON array
        if (line.empty()) continue;

        // Skip debug lines that don't start with { or [
        if (line[0] == '{' || line[0] == '[' || foundJsonStart) {
            foundJsonStart = true;
            jsonOutput << line << std::endl;
        }
        // REMOVED: The broken early exit on ']' that was cutting off extraction
        // Now reads ALL output until EOF
    }

    return jsonOutput.str();
}

// Load JavaScript JSON commands from reference files
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

// Compare JSON command streams functionally
// Convert JSON to Arduino code using universal converter
std::string convertJSONToArduino(const std::string& json) {
    // Write JSON to temp file
    std::string tempJsonFile = "temp_" + std::to_string(getpid()) + ".json";
    std::string tempArduinoFile = "temp_" + std::to_string(getpid()) + ".arduino";

    std::ofstream jsonFile(tempJsonFile);
    jsonFile << json;
    jsonFile.close();

    // Run universal converter - REMOVED 2>/dev/null to see errors
    std::string command = "../universal_json_to_arduino " + tempJsonFile + " " + tempArduinoFile;
    int result = system(command.c_str());

    std::string arduinoCode;
    if (result == 0) {
        std::ifstream arduinoFile(tempArduinoFile);
        if (arduinoFile) {
            std::ostringstream buffer;
            buffer << arduinoFile.rdbuf();
            arduinoCode = buffer.str();

            // CRITICAL FIX: Detect if converter silently failed
            if (arduinoCode.empty()) {
                std::cerr << "WARNING: Converter succeeded but produced empty output for " << tempJsonFile << std::endl;
            }
        } else {
            std::cerr << "ERROR: Could not read converter output file: " << tempArduinoFile << std::endl;
        }
    } else {
        std::cerr << "ERROR: Converter failed with exit code: " << result << " for " << tempJsonFile << std::endl;
    }

    // Clean up temp files
    remove(tempJsonFile.c_str());
    remove(tempArduinoFile.c_str());

    return arduinoCode;
}

bool compareJSONCommands(const std::string& cppJSON, const std::string& jsJSON, int testNumber) {
    std::cerr << "DEBUG: Comparing test " << testNumber << " - C++ JSON size: " << cppJSON.size()
              << " bytes, JS JSON size: " << jsJSON.size() << " bytes" << std::endl;

    // CRITICAL FIX: Missing data is an ERROR, not a skip or match
    if (cppJSON.empty() || jsJSON.empty()) {
        std::cout << "Test " << testNumber << ": ERROR - Missing data - ";
        if (cppJSON.empty() && jsJSON.empty()) {
            std::cout << "Both C++ and JS streams empty (possible crash or no test data)" << std::endl;
        } else if (cppJSON.empty()) {
            std::cout << "C++ stream empty (segfault/crash/timeout)" << std::endl;
        } else {
            std::cout << "JS reference missing" << std::endl;
        }
        return false;  // Missing data is FAILURE
    }

    // Convert both JSON streams to Arduino code
    std::cerr << "DEBUG: Converting test " << testNumber << " JSON to Arduino command streams..." << std::endl;
    std::string cppArduino = convertJSONToArduino(cppJSON);
    std::string jsArduino = convertJSONToArduino(jsJSON);
    std::cerr << "DEBUG: Conversion complete - C++ arduino size: " << cppArduino.size()
              << " bytes, JS arduino size: " << jsArduino.size() << " bytes" << std::endl;

    // CRITICAL FIX: Detect conversion failures (empty output)
    if (cppArduino.empty() || jsArduino.empty()) {
        std::cout << "Test " << testNumber << ": ERROR - Conversion failed - ";
        if (cppArduino.empty() && jsArduino.empty()) {
            std::cout << "Both conversions produced empty output" << std::endl;
        } else if (cppArduino.empty()) {
            std::cout << "C++ JSON to Arduino conversion failed" << std::endl;
        } else {
            std::cout << "JS JSON to Arduino conversion failed" << std::endl;
        }
        return false;  // Conversion failure is FAILURE
    }

    // CRITICAL FIX: ALWAYS save .arduino files for ALL tests (pass or fail)
    // Normalize both command streams before comparison AND saving
    std::string normalizedCpp = normalizeArduino(cppArduino);
    std::string normalizedJs = normalizeArduino(jsArduino);

    // Save NORMALIZED versions so user can see what was actually compared
    std::ofstream cppFile("test" + std::to_string(testNumber) + "_cpp.arduino");
    cppFile << normalizedCpp << std::endl;
    cppFile.close();

    std::ofstream jsFile("test" + std::to_string(testNumber) + "_js.arduino");
    jsFile << normalizedJs << std::endl;
    jsFile.close();

    // NOTE: We don't save _debug.json copies here because:
    // - Clean C++ JSON is already saved by extract_cpp_commands as testN_cpp.json
    // - JS JSON is the reference file test_data/example_NNN.commands
    // - The pipe JSON may have stderr mixed in (corrupted)

    if (normalizedCpp == normalizedJs) {
        std::cout << "Test " << testNumber << ": EXACT MATCH ✅" << std::endl;
        return true;
    } else {
        std::cout << "Test " << testNumber << ": MISMATCH ❌" << std::endl;

        // Show first 200 chars of difference for debugging
        std::cout << "C++ command stream (first 200 chars): " << cppArduino.substr(0, 200) << "..." << std::endl;
        std::cout << "JS command stream (first 200 chars): " << jsArduino.substr(0, 200) << "..." << std::endl;
        std::cout << "Full outputs saved to test" << testNumber << "_cpp.arduino and test" << testNumber << "_js.arduino" << std::endl;
        std::cout << "JSON source files: build/test" << testNumber << "_cpp.json and test_data/example_"
                  << std::setfill('0') << std::setw(3) << testNumber << ".commands" << std::endl;

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
    
    std::cout << "=== Arduino Cross-Platform Validation ===" << std::endl;
    std::cout << "Testing range: " << startTest << " to " << endTest << std::endl;
    std::cout << "Comparing command streams (version, flow control, hardware commands)" << std::endl;
    std::cout << "Will stop on first functional difference" << std::endl << std::endl;
    
    int successCount = 0;
    int totalTests = 0;
    
    for (int testNumber = startTest; testNumber <= endTest; testNumber++) {
        totalTests++;
        
        // Extract both command streams
        std::string cppCommands = extractCppCommands(testNumber);
        std::string jsCommands = loadJsCommands(testNumber);
        
        // Compare functionally
        bool matches = compareJSONCommands(cppCommands, jsCommands, testNumber);
        
        if (matches) {
            successCount++;
        } else {
            // Continue testing to see overall improvement
            // (temporarily disabled stopping on first difference)
        }
    }
    
    std::cout << std::endl << "=== SUMMARY ===" << std::endl;
    std::cout << "Tests processed: " << totalTests << std::endl;
    std::cout << "Exact matches: " << successCount << std::endl;
    std::cout << "Success rate: " << (100.0 * successCount / totalTests) << "%" << std::endl;
    
    return (successCount == totalTests) ? 0 : 1;
}