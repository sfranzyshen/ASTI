#include "src/cpp/ASTInterpreter.hpp"
#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <regex>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "Usage: " << argv[0] << " <test_number>" << std::endl;
        std::cout << "Example: " << argv[0] << " 1" << std::endl;
        return 1;
    }
    
    int testNum = std::atoi(argv[1]);
    
    // Format test number with leading zeros
    std::ostringstream testId;
    testId << std::setfill('0') << std::setw(3) << testNum;
    
    std::string astFile = "test_data/example_" + testId.str() + ".ast";
    std::string jsFile = "test_data/example_" + testId.str() + ".commands";
    
    std::cout << "=== SINGLE TEST COMPARISON - Test " << testNum << " ===" << std::endl;
    std::cout << "AST file: " << astFile << std::endl;
    std::cout << "JS file: " << jsFile << std::endl;
    std::cout << std::endl;
    
    // Load AST data
    std::vector<uint8_t> astData;
    std::ifstream ast(astFile, std::ios::binary);
    if (!ast) {
        std::cerr << "Failed to load " << astFile << std::endl;
        return 1;
    }
    
    ast.seekg(0, std::ios::end);
    size_t size = ast.tellg();
    ast.seekg(0, std::ios::beg);
    astData.resize(size);
    ast.read(reinterpret_cast<char*>(astData.data()), size);
    ast.close();
    
    // Execute C++ interpreter
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    TestResult result = executeWithTimeout(*interpreter, 5000);
    
    if (!result.success) {
        std::cerr << "C++ execution failed: " << result.error << std::endl;
        return 1;
    }
    
    // Load JavaScript expected output
    std::ifstream js(jsFile);
    if (!js) {
        std::cerr << "Failed to load " << jsFile << std::endl;
        return 1;
    }
    
    std::string jsContent;
    std::string line;
    while (std::getline(js, line)) {
        jsContent += line + "\n";
    }
    js.close();
    
    // Debug: Check if file was read
    if (jsContent.empty()) {
        std::cerr << "Warning: JavaScript file " << jsFile << " appears to be empty" << std::endl;
    }
    
    std::cout << "C++ OUTPUT:" << std::endl;
    std::cout << "----------" << std::endl;
    std::cout << result.commandStream << std::endl;
    std::cout << std::endl;
    
    std::cout << "JAVASCRIPT OUTPUT:" << std::endl;
    std::cout << "-----------------" << std::endl;
    std::cout << jsContent << std::endl;
    std::cout << std::endl;
    
    // Normalize timestamp values for comparison (keep the field, ignore the value)
    std::string normalizedCpp = result.commandStream;
    std::string normalizedJs = jsContent;
    
    // Replace all timestamp values with a fixed value for comparison
    std::regex timestampRegex(R"("timestamp":\s*\d+)");
    normalizedCpp = std::regex_replace(normalizedCpp, timestampRegex, "\"timestamp\": 0");
    normalizedJs = std::regex_replace(normalizedJs, timestampRegex, "\"timestamp\": 0");
    
    // Line-by-line comparison with normalized timestamps
    std::istringstream cppStream(normalizedCpp);
    std::istringstream jsStream(normalizedJs);
    std::string cppLine, jsLine;
    int lineNum = 1;
    bool identical = true;
    
    std::cout << "LINE-BY-LINE DIFFERENCES (timestamp values normalized):" << std::endl;
    std::cout << "-------------------------------------------------------" << std::endl;
    
    while (std::getline(cppStream, cppLine) || std::getline(jsStream, jsLine)) {
        if (cppLine != jsLine) {
            identical = false;
            std::cout << "Line " << lineNum << ":" << std::endl;
            std::cout << "  C++: " << cppLine << std::endl;
            std::cout << "  JS:  " << jsLine << std::endl;
            std::cout << std::endl;
        }
        lineNum++;
    }
    
    if (identical) {
        std::cout << "IDENTICAL - No differences found!" << std::endl;
    } else {
        std::cout << "DIFFERENT - Differences found above" << std::endl;
    }
    
    return 0;
}