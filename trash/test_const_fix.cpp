#include "src/cpp/ASTInterpreter.hpp"
#include "libs/CompactAST/src/CompactAST.hpp"
#include <iostream>
#include <string>
#include <fstream>
#include <vector>

using namespace arduino_interpreter;
using namespace arduino_ast;

int main() {
    std::cout << "Testing const variable detection fix..." << std::endl;
    
    try {
        // Load test data with const variables (example_010 has const int buttonPin = 2)
        std::ifstream file("src/javascript/test_data/example_010.ast", std::ios::binary);
        if (!file) {
            std::cerr << "Failed to open test file" << std::endl;
            return 1;
        }
        
        // Read binary data
        file.seekg(0, std::ios::end);
        size_t size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<uint8_t> data(size);
        file.read(reinterpret_cast<char*>(data.data()), size);
        file.close();
        
        // Parse AST
        CompactASTReader reader(data.data(), data.size());
        auto ast = reader.parse();
        
        // Set up interpreter options
        InterpreterOptions options;
        options.debugging = true;
        
        // Set up interpreter 
        ASTInterpreter interpreter(std::move(ast), options);
        
        std::cout << "Starting interpretation..." << std::endl;
        interpreter.run(1); // Run 1 iteration
        
        // Get output stream
        std::string output = interpreter.getOutputStream();
        std::cout << "Interpreter output:\\n" << output << std::endl;
        
        // Check if const variable was properly detected
        if (output.find("isConst=true") != std::string::npos && 
            output.find("buttonPin") != std::string::npos) {
            std::cout << "SUCCESS: Found const variable detection in output" << std::endl;
            return 0;
        } else {
            std::cout << "FAILURE: const variable not properly detected" << std::endl;
            return 1;
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
}