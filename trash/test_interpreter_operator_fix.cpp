#include <iostream>
#include <fstream>
#include <vector>
#include <memory>
#include "libs/CompactAST/src/CompactAST.hpp"
#include "src/cpp/ASTInterpreter.hpp"

int main() {
    std::cout << "=== Testing CompactAST Operator Fix with ASTInterpreter ===\n";
    
    // Load Test 4 binary AST (Fade.ino - contains binary operations)
    std::ifstream file("test_data/example_004.ast", std::ios::binary);
    if (!file) {
        std::cerr << "ERROR: Could not open test_data/example_004.ast\n";
        return 1;
    }
    
    std::vector<uint8_t> binaryData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
    file.close();
    
    std::cout << "✓ Loaded " << binaryData.size() << " bytes from example_004.ast\n";
    
    try {
        // Import CompactAST
        arduino_ast::CompactASTReader reader(binaryData.data(), binaryData.size());
        auto ast = reader.parse();
        if (!ast) {
            std::cerr << "ERROR: Failed to import AST\n";
            return 1;
        }
        
        std::cout << "✓ AST imported successfully (root: " << ast->getType() << ")\n";
        
        // Create interpreter and load AST
        auto interpreter = std::make_unique<arduino_interpreter::ASTInterpreter>();
        interpreter->loadAST(std::move(ast));
        
        std::cout << "✓ ASTInterpreter loaded successfully\n";
        std::cout << "✓ Running interpreter steps...\n";
        
        // Run interpreter and capture any errors
        bool hasErrors = false;
        int stepCount = 0;
        const int maxSteps = 50;
        
        // Redirect stderr to capture "Unknown operator" errors
        std::streambuf* cerrBuf = std::cerr.rdbuf();
        std::ostringstream cerrCapture;
        std::cerr.rdbuf(cerrCapture.rdbuf());
        
        try {
            while (stepCount < maxSteps && interpreter->step()) {
                stepCount++;
            }
        } catch (const std::exception& e) {
            hasErrors = true;
            std::cout << "EXCEPTION during execution: " << e.what() << std::endl;
        }
        
        // Restore stderr and check for operator errors
        std::cerr.rdbuf(cerrBuf);
        std::string cerrOutput = cerrCapture.str();
        
        std::cout << "✓ Completed " << stepCount << " interpreter steps\n";
        
        if (cerrOutput.find("Unknown") != std::string::npos) {
            std::cout << "❌ FAILED: Found 'Unknown' errors in output:\n";
            std::cout << cerrOutput << std::endl;
            return 1;
        }
        
        if (hasErrors) {
            std::cout << "❌ FAILED: Execution errors occurred\n";
            return 1;
        }
        
        std::cout << "🎉 SUCCESS: No 'Unknown operator' errors found!\n";
        std::cout << "🎉 CompactAST operator loading fix is working correctly!\n";
        
        // Show any non-error debug output if present
        if (!cerrOutput.empty() && cerrOutput.find("Unknown") == std::string::npos) {
            std::cout << "\n--- Debug output ---\n";
            std::cout << cerrOutput.substr(0, 1000); // First 1000 chars
            if (cerrOutput.length() > 1000) {
                std::cout << "\n... (truncated)\n";
            }
        }
        
    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}