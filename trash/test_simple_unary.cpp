#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    // Load the simple AST file we created
    std::vector<uint8_t> astData;
    std::ifstream ast("debug_simple.ast", std::ios::binary);
    if (!ast) {
        std::cerr << "Failed to load debug_simple.ast" << std::endl;
        return 1;
    }
    
    ast.seekg(0, std::ios::end);
    size_t size = ast.tellg();
    ast.seekg(0, std::ios::beg);
    astData.resize(size);
    ast.read(reinterpret_cast<char*>(astData.data()), size);
    ast.close();
    
    std::cout << "=== TESTING SIMPLE UNARY OPERATOR ===\n";
    std::cout << "AST file size: " << size << " bytes\n";
    
    // Execute C++ interpreter
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    if (!result.success) {
        std::cerr << "C++ execution failed: " << result.error << std::endl;
        return 1;
    }
    
    std::cout << "C++ OUTPUT:\n";
    std::cout << "----------\n";
    std::cout << result.commandStream << std::endl;
    
    return 0;
}