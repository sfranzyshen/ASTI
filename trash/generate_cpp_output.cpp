#include <iostream>
#include <fstream>
#include <vector>
#include <sstream>
#include "libs/CompactAST/src/CompactAST.hpp"
#include "src/cpp/ASTInterpreter.hpp"

int main() {
    std::cout << "Generating C++ command stream for Test 4..." << std::endl;
    
    // Load Test 4 AST
    std::ifstream file("test_data/example_004.ast", std::ios::binary);
    if (!file) {
        std::cerr << "ERROR: Could not open test_data/example_004.ast" << std::endl;
        return 1;
    }
    
    std::vector<uint8_t> binaryData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
    file.close();
    
    try {
        // Import AST
        arduino_ast::CompactASTReader reader(binaryData.data(), binaryData.size());
        
        // Suppress debug output during parsing
        std::streambuf* cerrBuf = std::cerr.rdbuf();
        std::ostringstream nullStream;
        std::cerr.rdbuf(nullStream.rdbuf());
        
        auto ast = reader.parse();
        
        // Restore stderr
        std::cerr.rdbuf(cerrBuf);
        
        if (!ast) {
            std::cerr << "ERROR: Failed to parse AST" << std::endl;
            return 1;
        }
        
        // Create interpreter and execute
        auto interpreter = std::make_unique<arduino_interpreter::ASTInterpreter>();
        interpreter->loadAST(std::move(ast));
        
        // Execute and capture commands
        std::ostringstream commands;
        commands << "[" << std::endl;
        
        bool first = true;
        int maxSteps = 100;
        int steps = 0;
        
        // Suppress stderr during execution 
        std::cerr.rdbuf(nullStream.rdbuf());
        
        while (steps < maxSteps && interpreter->step()) {
            steps++;
            // In a real implementation, we'd capture the command stream
            // For now, just count steps
        }
        
        // Restore stderr
        std::cerr.rdbuf(cerrBuf);
        
        commands << "]" << std::endl;
        
        // Write to file
        std::ofstream outFile("test_data/example_004_cpp_output.json");
        outFile << commands.str();
        outFile.close();
        
        std::cout << "C++ execution completed: " << steps << " steps" << std::endl;
        std::cout << "Commands would be written to test_data/example_004_cpp_output.json" << std::endl;
        std::cout << "Note: Full command capture requires integration with command protocol" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}