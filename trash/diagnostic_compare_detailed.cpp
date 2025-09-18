#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::cout << "=== DETAILED COMMAND COMPARISON - AnalogReadSerial.ino ===" << std::endl;
    
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
    
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    std::cout << "=== C++ COMMAND STREAM ===\n";
    std::cout << result.commandStream << std::endl;
    
    return 0;
}