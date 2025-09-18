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
    
    // Normalize timestamp values for comparison
    std::string normalizedCpp = result.commandStream;
    std::string normalizedJs = jsContent;
    
    std::regex timestampRegex(R"("timestamp":\s*\d+)");
    normalizedCpp = std::regex_replace(normalizedCpp, timestampRegex, "\"timestamp\": 0");
    normalizedJs = std::regex_replace(normalizedJs, timestampRegex, "\"timestamp\": 0");
    
    std::cout << "Finding first difference..." << std::endl;
    
    size_t minLen = std::min(normalizedCpp.length(), normalizedJs.length());
    for (size_t i = 0; i < minLen; ++i) {
        if (normalizedCpp[i] != normalizedJs[i]) {
            std::cout << "First difference at position " << i << std::endl;
            std::cout << "C++ char: '" << normalizedCpp[i] << "' (ASCII " << (int)normalizedCpp[i] << ")" << std::endl;
            std::cout << "JS char:  '" << normalizedJs[i] << "' (ASCII " << (int)normalizedJs[i] << ")" << std::endl;
            
            // Show context
            size_t start = (i > 20) ? i - 20 : 0;
            size_t end = std::min(i + 20, minLen);
            
            std::cout << "C++ context: \"" << normalizedCpp.substr(start, end - start) << "\"" << std::endl;
            std::cout << "JS context:  \"" << normalizedJs.substr(start, end - start) << "\"" << std::endl;
            return 0;
        }
    }
    
    if (normalizedCpp.length() != normalizedJs.length()) {
        std::cout << "Strings match up to position " << minLen << " but have different lengths" << std::endl;
        std::cout << "C++ length: " << normalizedCpp.length() << std::endl;
        std::cout << "JS length: " << normalizedJs.length() << std::endl;
    } else {
        std::cout << "Strings are identical!" << std::endl;
    }
    
    return 0;
}