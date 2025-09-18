#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <vector>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

/**
 * Simple C++ command stream extractor for BareMinimum.ino
 * Outputs raw JSON command stream for comparison
 */

int main() {
    try {
        // Load the BareMinimum AST file (example_001.ast)
        std::ifstream file("test_data/example_001.ast", std::ios::binary);
        if (!file) {
            std::cerr << "Error: Cannot open test_data/example_001.ast" << std::endl;
            return 1;
        }
        
        // Read the binary AST data
        std::vector<uint8_t> astData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
        file.close();
        
        // Create C++ interpreter using test utils
        auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
        if (!interpreter) {
            std::cerr << "Error: Failed to create C++ interpreter" << std::endl;
            return 1;
        }
        
        // Execute with timeout and capture results
        auto result = executeWithTimeout(*interpreter, 5000);
        
        if (!result.success) {
            std::cerr << "Error: " << result.error << std::endl;
            return 1;
        }
        
        // Output the raw JSON command stream
        std::cout << result.commandStream << std::endl;
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
}