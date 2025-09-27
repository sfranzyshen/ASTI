#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::cout << "=== TESTING COMPACTAST OPERATOR LOADING FIX ===" << std::endl;
    
    // Load Test 4 binary data (fresh from regeneration)
    std::vector<uint8_t> astData;
    std::ifstream ast("test_data/example_004.ast", std::ios::binary);
    if (!ast) {
        std::cerr << "Failed to load test_data/example_004.ast" << std::endl;
        return 1;
    }
    
    ast.seekg(0, std::ios::end);
    size_t size = ast.tellg();
    ast.seekg(0, std::ios::beg);
    astData.resize(size);
    ast.read(reinterpret_cast<char*>(astData.data()), size);
    ast.close();
    
    // Create and execute interpreter
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    std::cout << "Execution " << (result.success ? "SUCCEEDED" : "FAILED") << std::endl;
    if (!result.error.empty()) {
        std::cout << "Error: " << result.error << std::endl;
    }
    
    // Check for operator-related errors in output
    std::string output = result.commandJson;
    bool hasOperatorErrors = (output.find("Unknown binary operator") != std::string::npos ||
                             output.find("Unknown unary operator") != std::string::npos);
    
    if (hasOperatorErrors) {
        std::cout << "❌ COMPACTAST OPERATOR LOADING STILL BROKEN" << std::endl;
        std::cout << "Found operator errors in output" << std::endl;
    } else {
        std::cout << "✅ NO OPERATOR ERRORS DETECTED" << std::endl;
        std::cout << "CompactAST operator loading appears to be working!" << std::endl;
    }
    
    // Show a sample of the output
    std::cout << "\nFirst 500 chars of C++ output:" << std::endl;
    std::cout << output.substr(0, 500) << "..." << std::endl;
    
    return 0;
}
