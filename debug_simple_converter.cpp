#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
#include <vector>
#include <regex>

int main() {
    std::string jsonObj = R"({"type":"FUNCTION_CALL","function":"Serial.begin","baudRate":9600})";

    std::cout << "Testing field extraction on: " << jsonObj << std::endl;

    // Test type extraction
    std::regex typeRegex(R"("type":\s*"([^"]+)")");
    std::smatch match;
    if (std::regex_search(jsonObj, match, typeRegex)) {
        std::cout << "Type: " << match[1].str() << std::endl;
    }

    // Test function extraction
    std::regex funcRegex(R"("function":\s*"([^"]+)")");
    if (std::regex_search(jsonObj, match, funcRegex)) {
        std::cout << "Function: " << match[1].str() << std::endl;
    }

    // Test baudRate extraction
    std::regex baudRegex(R"("baudRate":\s*([^,}]+))");
    if (std::regex_search(jsonObj, match, baudRegex)) {
        std::cout << "BaudRate: " << match[1].str() << std::endl;
    }

    return 0;
}