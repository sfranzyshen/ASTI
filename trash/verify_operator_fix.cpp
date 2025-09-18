#include "src/cpp/ASTInterpreter.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;

int main() {
    // Test with the regenerated Test 4
    std::ifstream file("test_data/example_004.ast", std::ios::binary);
    if (!file) {
        std::cerr << "Could not open test_data/example_004.ast" << std::endl;
        return 1;
    }
    
    // Read the file
    std::vector<uint8_t> data;
    file.seekg(0, std::ios::end);
    size_t size = file.tellg();
    file.seekg(0, std::ios::beg);
    data.resize(size);
    file.read(reinterpret_cast<char*>(data.data()), size);
    file.close();
    
    std::cout << "=== TESTING OPERATOR FIX ===\n";
    std::cout << "AST file size: " << size << " bytes\n";
    
    try {
        // Create interpreter from binary data
        auto interpreter = createInterpreterFromBinary(data.data(), data.size());
        std::cout << "✓ AST loaded successfully (no parsing errors)\n";
        
        // Try to execute and capture any errors
        std::string commandStream;
        bool success = false;
        
        try {
            // Simple execution test
            interpreter->executeUntilSuspension(std::chrono::milliseconds(1000));
            success = true;
            std::cout << "✓ Execution started successfully (no operator errors)\n";
        } catch (const std::exception& e) {
            std::cout << "✗ Execution failed: " << e.what() << std::endl;
            if (std::string(e.what()).find("Unknown") != std::string::npos) {
                std::cout << "  This indicates operator loading still failing\n";
            }
        }
        
        return success ? 0 : 1;
        
    } catch (const std::exception& e) {
        std::cerr << "✗ Failed to create interpreter: " << e.what() << std::endl;
        return 1;
    }
}