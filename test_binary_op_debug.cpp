#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::string astFile = "test_data/example_004.ast";
    
    // Load AST data
    std::vector<uint8_t> astData;
    std::ifstream ast(astFile, std::ios::binary);
    ast.seekg(0, std::ios::end);
    size_t size = ast.tellg();
    ast.seekg(0, std::ios::beg);
    astData.resize(size);
    ast.read(reinterpret_cast<char*>(astData.data()), size);
    ast.close();
    
    // Create interpreter with debugging enabled
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    
    // Enable debug logging by calling a simple operation
    std::cout << "Starting Test 4 binary operator debugging..." << std::endl;
    
    // Execute a few steps to trigger the binary operation errors
    TestResult result = executeWithTimeout(*interpreter, 2000);  // Short timeout
    
    std::cout << "Binary operator debugging complete." << std::endl;
    std::cout << "Result status: " << (result.success ? "SUCCESS" : "FAILED") << std::endl;
    std::cout << "Commands generated: " << std::endl;
    std::cout << result.commandStream << std::endl;
    
    return 0;
}