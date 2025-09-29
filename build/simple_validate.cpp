#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <regex>
#include <string>

// Simple validation tool that works with existing extract_cpp_commands
std::string normalizeJSON(const std::string& json) {
    std::string normalized = json;

    // First, normalize whitespace and convert to compact format
    std::regex multiLineJsonRegex(R"(\n\s+)");
    normalized = std::regex_replace(normalized, multiLineJsonRegex, " ");

    // Convert C++ newline-separated JSON objects to array format like JavaScript
    if (normalized.find("[") != 0) {  // If it doesn't start with [, it's C++ format
        // Split on } followed by { to identify separate JSON objects
        std::regex objectSeparatorRegex(R"(\}\s*\{)");
        normalized = std::regex_replace(normalized, objectSeparatorRegex, "}, {");

        // Add array brackets and clean up
        normalized = "[" + normalized + "]";

        // Handle trailing empty lines and incomplete objects
        std::regex trailingRegex(R"(\],\s*\])");
        normalized = std::regex_replace(normalized, trailingRegex, "]]");

        std::regex emptyObjectRegex(R"(\[,)");
        normalized = std::regex_replace(normalized, emptyObjectRegex, "[");
    }

    // Replace all timestamps with normalized value
    std::regex timestampRegex(R"("timestamp":\s*\d+)");
    normalized = std::regex_replace(normalized, timestampRegex, R"("timestamp": 0)");

    // Normalize pin numbers - A0 can be pin 14 or 36 depending on platform
    std::regex pinRegex(R"("pin":\s*(?:14|36))");
    normalized = std::regex_replace(normalized, pinRegex, R"("pin": 0)");

    // Normalize request IDs
    std::regex requestIdRegex(R"("requestId":\s*"[^"]+")");
    normalized = std::regex_replace(normalized, requestIdRegex, R"("requestId": "normalized")");

    // Normalize VAR_SET field ordering - C++ vs JS difference
    std::regex varSetRegex(R"~("type": "VAR_SET", "timestamp": 0, "variable": "([^"]+)", "value": ([^,}]+))~");
    normalized = std::regex_replace(normalized, varSetRegex, R"~("type": "VAR_SET", "variable": "$1", "value": $2, "timestamp": 0)~");

    // Clean up malformed array endings - fix C++ output artifacts
    std::regex trailingEmptyArrayRegex(R"~(\}\[\s*\]\s*\]$)~");
    normalized = std::regex_replace(normalized, trailingEmptyArrayRegex, "}]");

    std::regex emptyArrayWithNewlineRegex(R"~(\}\[\s*\]\n\]$)~");
    normalized = std::regex_replace(normalized, emptyArrayWithNewlineRegex, "}]");

    std::regex trailingWhitespaceRegex(R"~(\s+$)~");
    normalized = std::regex_replace(normalized, trailingWhitespaceRegex, "");

    // Normalize whitespace around colons and commas
    std::regex spaceRegex(R"(\s*:\s*)");
    normalized = std::regex_replace(normalized, spaceRegex, ": ");

    std::regex commaRegex(R"(\s*,\s*)");
    normalized = std::regex_replace(normalized, commaRegex, ", ");

    // Normalize spacing around braces and brackets for consistent format
    std::regex spaceBraceRegex(R"(\s*\{\s*)");
    normalized = std::regex_replace(normalized, spaceBraceRegex, "{ ");

    std::regex braceSpaceRegex(R"(\s*\}\s*)");
    normalized = std::regex_replace(normalized, braceSpaceRegex, " }");

    // Final cleanup: ensure proper array ending
    if (normalized.back() != ']') {
        // Find the last proper } and close array
        size_t lastBrace = normalized.find_last_of('}');
        if (lastBrace != std::string::npos) {
            normalized = normalized.substr(0, lastBrace + 1) + "]";
        }
    }

    return normalized;
}

std::string extractCppCommands(int testNumber) {
    std::ostringstream command;
    command << "cd .. && ./build/extract_cpp_commands " << testNumber << " 2>/dev/null | grep -v DEBUG | grep -v EXTRACT_DEBUG";

    FILE* pipe = popen(command.str().c_str(), "r");
    if (!pipe) return "";

    std::ostringstream result;
    char buffer[1024];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result << buffer;
    }
    pclose(pipe);
    return result.str();
}

std::string loadJsCommands(int testNumber) {
    std::ostringstream fileName;
    fileName << "../test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".commands";

    std::ifstream file(fileName.str());
    if (!file) return "";

    std::ostringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

int main(int argc, char* argv[]) {
    int startTest = 0;
    int endTest = 5;

    if (argc >= 2) startTest = std::atoi(argv[1]);
    if (argc >= 3) endTest = std::atoi(argv[2]);

    std::cout << "=== Simple JSON Validation ===" << std::endl;
    std::cout << "Testing range: " << startTest << " to " << endTest << std::endl;

    int successCount = 0;

    for (int testNumber = startTest; testNumber <= endTest; testNumber++) {
        std::string cppOutput = extractCppCommands(testNumber);
        std::string jsOutput = loadJsCommands(testNumber);

        if (cppOutput.empty() || jsOutput.empty()) {
            std::cout << "Test " << testNumber << ": Missing data - ";
            std::cout << (cppOutput.empty() ? "C++ missing" : "JS missing") << std::endl;
            continue;
        }

        std::string normalizedCpp = normalizeJSON(cppOutput);
        std::string normalizedJs = normalizeJSON(jsOutput);

        if (normalizedCpp == normalizedJs) {
            std::cout << "Test " << testNumber << ": MATCH ✅" << std::endl;
            successCount++;
        } else {
            std::cout << "Test " << testNumber << ": DIFF ❌" << std::endl;

            // Save debug files
            std::ofstream cppFile("test" + std::to_string(testNumber) + "_cpp_debug.json");
            cppFile << normalizedCpp;
            cppFile.close();

            std::ofstream jsFile("test" + std::to_string(testNumber) + "_js_debug.json");
            jsFile << normalizedJs;
            jsFile.close();

            // Show first difference
            std::cout << "C++ (first 100 chars): " << normalizedCpp.substr(0, 100) << "..." << std::endl;
            std::cout << "JS  (first 100 chars): " << normalizedJs.substr(0, 100) << "..." << std::endl;
            break;
        }
    }

    std::cout << "\nSuccess: " << successCount << "/" << (endTest - startTest + 1) << std::endl;

    // Return proper exit code for shell scripts
    return (successCount == (endTest - startTest + 1)) ? 0 : 1;
}