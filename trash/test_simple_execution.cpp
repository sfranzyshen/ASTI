#include "src/cpp/ASTInterpreter.hpp"
#include "libs/CompactAST/src/CompactAST.hpp"
#include <iostream>
#include <fstream>
#include <vector>

using namespace arduino_ast;
using namespace arduino_interpreter;

int main() {
    try {
        // Read binary file
        std::ifstream file("test_data/example_004.ast", std::ios::binary | std::ios::ate);
        if (!file) {
            std::cerr << "Could not open file" << std::endl;
            return 1;
        }
        
        std::streamsize size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<uint8_t> buffer(size);
        if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
            std::cerr << "Could not read file" << std::endl;
            return 1;
        }
        file.close();
        
        CompactASTReader reader(buffer.data(), buffer.size());
        auto program = reader.parse();
        
        std::cout << "=== ATTEMPTING EXECUTION ===" << std::endl;
        
        // Create interpreter with limited loop iterations
        InterpreterOptions options;
        options.maxLoopIterations = 1;
        ASTInterpreter interpreter(std::move(program), options);
        
        // Try to execute
        bool success = interpreter.start();
        
        std::cout << "Execution " << (success ? "succeeded" : "failed") << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}