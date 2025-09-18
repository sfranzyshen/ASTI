#include <iostream>
#include <fstream>
#include <vector>
#include "libs/CompactAST/src/CompactAST.hpp"

int main() {
    std::cout << "=== CompactAST Operator Extraction Test ===\n";
    
    // Load Test 4 - contains both binary and unary operators
    std::ifstream file("test_data/example_004.ast", std::ios::binary);
    if (!file) {
        std::cerr << "ERROR: Could not find test_data/example_004.ast\n";
        return 1;
    }
    
    std::vector<uint8_t> data((std::istreambuf_iterator<char>(file)),
                              std::istreambuf_iterator<char>());
    file.close();
    
    arduino_ast::CompactASTReader reader(data.data(), data.size());
    
    // Capture stderr to check for setValue() calls
    std::streambuf* cerrBuf = std::cerr.rdbuf();
    std::ostringstream cerrCapture;
    std::cerr.rdbuf(cerrCapture.rdbuf());
    
    auto ast = reader.parse();
    
    // Restore stderr
    std::cerr.rdbuf(cerrBuf);
    std::string output = cerrCapture.str();
    
    if (!ast) {
        std::cout << "❌ FAILED: Could not parse AST\n";
        return 1;
    }
    
    std::cout << "✓ AST parsed successfully\n";
    
    // Check for setValue debug output indicating operator extraction
    int operatorExtractions = 0;
    size_t pos = 0;
    while ((pos = output.find("setValue extracted operator", pos)) != std::string::npos) {
        operatorExtractions++;
        pos++;
    }
    
    std::cout << "✓ Found " << operatorExtractions << " operator extractions in debug output\n";
    
    // Look for specific operators
    bool foundPlus = output.find("operator='+'") != std::string::npos;
    bool foundEquals = output.find("operator='=='") != std::string::npos;
    bool foundLessThan = output.find("operator='<'") != std::string::npos;
    bool foundGreaterThan = output.find("operator='>'") != std::string::npos;
    bool foundMinus = output.find("operator='-'") != std::string::npos;
    
    std::cout << "Operators found in debug output:\n";
    std::cout << "  + (plus): " << (foundPlus ? "✓" : "✗") << "\n";
    std::cout << "  == (equals): " << (foundEquals ? "✓" : "✗") << "\n";
    std::cout << "  < (less): " << (foundLessThan ? "✓" : "✗") << "\n";  
    std::cout << "  > (greater): " << (foundGreaterThan ? "✓" : "✗") << "\n";
    std::cout << "  - (unary minus): " << (foundMinus ? "✓" : "✗") << "\n";
    
    if (operatorExtractions > 0) {
        std::cout << "\n🎉 SUCCESS: Operators are being extracted via setValue()!\n";
        std::cout << "🎉 CompactAST operator loading fix is working!\n";
        return 0;
    } else {
        std::cout << "\n❌ FAILED: No operator extractions found\n";
        std::cout << "Debug output:\n" << output.substr(0, 500) << "\n";
        return 1;
    }
}