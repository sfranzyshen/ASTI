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
    
    // Simple string comparison
    if (normalizedCpp == normalizedJs) {
        std::cout << "IDENTICAL! Test 3 is now 100% matched!" << std::endl;
    } else {
        std::cout << "DIFFERENT - still has differences" << std::endl;
        std::cout << "C++ length: " << normalizedCpp.length() << std::endl;
        std::cout << "JS length: " << normalizedJs.length() << std::endl;
    }
    
    return 0;
}