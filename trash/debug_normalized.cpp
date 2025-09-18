#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <regex>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::string astFile = "test_data/example_003.ast";
    std::string jsFile = "src/javascript/test_data/example_003.commands";
    
    // Load AST data
    std::vector<uint8_t> astData;
    std::ifstream ast(astFile, std::ios::binary);
    ast.seekg(0, std::ios::end);
    size_t size = ast.tellg();
    ast.seekg(0, std::ios::beg);
    astData.resize(size);
    ast.read(reinterpret_cast<char*>(astData.data()), size);
    ast.close();
    
    // Execute C++ interpreter
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    // Load JavaScript expected output
    std::ifstream js(jsFile);
    std::string jsContent((std::istreambuf_iterator<char>(js)),
                          std::istreambuf_iterator<char>());
    js.close();
    
    // Normalize timestamp values and requestId values for comparison
    std::string normalizedCpp = result.commandStream;
    std::string normalizedJs = jsContent;
    
    // Replace all timestamp values with a fixed value
    std::regex timestampRegex(R"("timestamp":\s*\d+)");
    normalizedCpp = std::regex_replace(normalizedCpp, timestampRegex, "\"timestamp\": 0");
    normalizedJs = std::regex_replace(normalizedJs, timestampRegex, "\"timestamp\": 0");
    
    // Replace all requestId values with fixed value
    std::regex requestIdRegex(R"("requestId":\s*"[^"]+")");
    normalizedCpp = std::regex_replace(normalizedCpp, requestIdRegex, "\"requestId\": \"normalized\"");
    normalizedJs = std::regex_replace(normalizedJs, requestIdRegex, "\"requestId\": \"normalized\"");
    
    if (normalizedCpp == normalizedJs) {
        std::cout << "🎉 PERFECT MATCH! Test 3 is now 100% IDENTICAL!" << std::endl;
    } else {
        std::cout << "Still different after normalization" << std::endl;
        std::cout << "C++ length: " << normalizedCpp.length() << std::endl;
        std::cout << "JS length: " << normalizedJs.length() << std::endl;
        
        // Find first difference
        size_t minLen = std::min(normalizedCpp.length(), normalizedJs.length());
        for (size_t i = 0; i < minLen; ++i) {
            if (normalizedCpp[i] != normalizedJs[i]) {
                std::cout << "First difference at position " << i << std::endl;
                size_t start = (i > 30) ? i - 30 : 0;
                size_t end = std::min(i + 30, minLen);
                std::cout << "C++ context: \"" << normalizedCpp.substr(start, end - start) << "\"" << std::endl;
                std::cout << "JS context:  \"" << normalizedJs.substr(start, end - start) << "\"" << std::endl;
                break;
            }
        }
    }
    
    return 0;
}