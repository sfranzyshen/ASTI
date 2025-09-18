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
    
    // Execute C++ interpreter
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    // Look for brightness = 5 (should be 0 + 5 from addition operation)
    if (result.commandStream.find("\"variable\": \"brightness\",\n    \"value\": 5") != std::string::npos) {
        std::cout << "🎉 SUCCESS! Binary operator fix worked - brightness = 5 detected!" << std::endl;
    } else if (result.commandStream.find("\"variable\": \"brightness\",\n    \"value\": 0") != std::string::npos) {
        std::cout << "⚠️  PARTIAL: brightness still 0 - binary operators not working yet" << std::endl;
    } else {
        std::cout << "❌ ERROR: Could not find brightness variable" << std::endl;
    }
    
    // Check for operator errors
    if (result.commandStream.find("Binary operator parsing failed") != std::string::npos) {
        std::cout << "❌ C++ still has operator parsing errors" << std::endl;
    } else if (result.commandStream.find("Unknown binary operator") != std::string::npos) {
        std::cout << "❌ C++ still has unknown operator errors" << std::endl;
    } else {
        std::cout << "✅ No C++ operator errors detected" << std::endl;
    }
    
    return 0;
}