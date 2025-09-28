#include <iostream>
#include <fstream>
#include <vector>

// Simple test to understand the array access issue
int main() {
    std::cout << "Test 43 Debug - Analyzing pixels array access\n\n";

    // Read the debug output to understand what's happening
    std::ifstream cppDebug("/mnt/d/Devel/ASTInterpreter/build/test43_cpp_debug.json");
    std::string line;
    int lineNum = 0;
    bool foundPixelsSet = false;
    bool foundThisPixel = false;

    while (std::getline(cppDebug, line)) {
        lineNum++;

        // Look for where pixels array is set with value [1,0,0,...]
        if (line.find("\"variable\": \"pixels\"") != std::string::npos && line.find("\"value\":") != std::string::npos) {
            std::cout << "Line " << lineNum << ": Found pixels VAR_SET\n";
            // Read next few lines to see the value
            for (int i = 0; i < 5 && std::getline(cppDebug, line); i++) {
                lineNum++;
                if (line.find("[") != std::string::npos || line.find("1,") != std::string::npos) {
                    std::cout << "  Line " << lineNum << ": " << line << "\n";
                    if (line.find("1, 0, 0") != std::string::npos) {
                        foundPixelsSet = true;
                        std::cout << "  *** pixels[0][0] = 1 confirmed! ***\n";
                    }
                }
            }
        }

        // Look for thisPixel access
        if (line.find("\"variable\": \"thisPixel\"") != std::string::npos) {
            std::cout << "\nLine " << lineNum << ": Found thisPixel VAR_SET\n";
            std::cout << "  " << line << "\n";
            if (line.find("null") != std::string::npos) {
                foundThisPixel = true;
                std::cout << "  *** thisPixel = null (WRONG - should be 1) ***\n";
            }
        }
    }

    std::cout << "\n=== SUMMARY ===\n";
    std::cout << "pixels[0][0] set to 1: " << (foundPixelsSet ? "YES" : "NO") << "\n";
    std::cout << "thisPixel reads as null: " << (foundThisPixel ? "YES (BUG!)" : "NO") << "\n";

    if (foundPixelsSet && foundThisPixel) {
        std::cout << "\nCONFIRMED BUG: Array has value 1 but read returns null\n";
        std::cout << "The issue is in the ArrayAccessNode visitor's lookup mechanism\n";
    }

    return 0;
}