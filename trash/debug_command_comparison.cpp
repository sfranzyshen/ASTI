#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <vector>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::cout << "=== Debug Command Comparison ===" << std::endl;
    
    // Load AnalogReadSerial example AST
    std::vector<uint8_t> astData;
    std::ifstream astFile("test_data/example_000.ast", std::ios::binary);
    if (!astFile) {
        std::cerr << "Failed to load example_000.ast" << std::endl;
        return 1;
    }
    
    astFile.seekg(0, std::ios::end);
    size_t size = astFile.tellg();
    astFile.seekg(0, std::ios::beg);
    astData.resize(size);
    astFile.read(reinterpret_cast<char*>(astData.data()), size);
    
    // Create C++ interpreter
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    if (!interpreter) {
        std::cerr << "Failed to create C++ interpreter" << std::endl;
        return 1;
    }
    
    // Execute with capture
    std::cout << "DEBUG: About to call executeWithTimeout" << std::endl;
    TestResult result = executeWithTimeout(*interpreter, 5000);
    std::cout << "DEBUG: executeWithTimeout returned, success=" << result.success << std::endl;
    
    std::cout << "\n=== C++ OUTPUT ===\n";
    std::cout << result.commandStream << std::endl;
    
    // Load JavaScript expected output
    std::ifstream jsFile("test_data/example_000.commands");
    if (jsFile) {
        std::cout << "\n=== JavaScript OUTPUT ===\n";
        std::string line;
        int lineCount = 0;
        while (std::getline(jsFile, line) && lineCount++ < 50) {
            std::cout << line << std::endl;
        }
        if (lineCount >= 50) std::cout << "..." << std::endl;
    }
    
    return 0;
}