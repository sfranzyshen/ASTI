#include "tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <iomanip>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

/**
 * Focused analysis tool for BareMinimum.ino command stream differences
 * Compares JavaScript vs C++ command generation line-by-line
 */

struct CommandComparison {
    std::vector<std::string> jsCommands;
    std::vector<std::string> cppCommands;
    std::vector<std::string> differences;
};

std::vector<std::string> splitCommands(const std::string& commandStream) {
    std::vector<std::string> commands;
    std::istringstream iss(commandStream);
    std::string line;
    
    while (std::getline(iss, line)) {
        if (!line.empty() && line != "\n") {
            commands.push_back(line);
        }
    }
    
    return commands;
}

CommandComparison compareCommandStreams(const std::vector<std::string>& jsCommands, 
                                       const std::vector<std::string>& cppCommands) {
    CommandComparison comparison;
    comparison.jsCommands = jsCommands;
    comparison.cppCommands = cppCommands;
    
    // Analyze differences
    size_t maxSize = std::max(jsCommands.size(), cppCommands.size());
    
    for (size_t i = 0; i < maxSize; i++) {
        std::string jsCmd = (i < jsCommands.size()) ? jsCommands[i] : "[MISSING]";
        std::string cppCmd = (i < cppCommands.size()) ? cppCommands[i] : "[MISSING]";
        
        if (jsCmd != cppCmd) {
            std::ostringstream diff;
            diff << "Line " << (i+1) << ":\n";
            diff << "  JS:  " << jsCmd << "\n";
            diff << "  C++: " << cppCmd << "\n";
            comparison.differences.push_back(diff.str());
        }
    }
    
    return comparison;
}

void analyzeCommandTypes(const std::vector<std::string>& commands, const std::string& label) {
    std::map<std::string, int> commandCounts;
    
    for (const auto& cmd : commands) {
        // Extract command type (first part before space/colon)
        std::string type;
        size_t pos = cmd.find(' ');
        if (pos == std::string::npos) {
            pos = cmd.find(':');
        }
        
        if (pos != std::string::npos) {
            type = cmd.substr(0, pos);
        } else {
            type = cmd;
        }
        
        commandCounts[type]++;
    }
    
    std::cout << "\n=== " << label << " Command Type Analysis ===\n";
    std::cout << "Total commands: " << commands.size() << "\n";
    
    for (const auto& pair : commandCounts) {
        std::cout << "  " << pair.first << ": " << pair.second << "\n";
    }
}

int main() {
    try {
        std::cout << "=== Focused BareMinimum.ino Analysis Tool ===\n";
        
        // Load the BareMinimum AST file (example_001.ast)
        std::ifstream file("test_data/example_001.ast", std::ios::binary);
        if (!file) {
            std::cerr << "Error: Cannot open test_data/example_001.ast\n";
            return 1;
        }
        
        // Read the binary AST data
        std::vector<uint8_t> astData((std::istreambuf_iterator<char>(file)),
                                     std::istreambuf_iterator<char>());
        file.close();
        
        std::cout << "Loaded BareMinimum AST: " << astData.size() << " bytes\n";
        
        // Create C++ interpreter using test utils
        auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
        if (!interpreter) {
            std::cerr << "Error: Failed to create C++ interpreter\n";
            return 1;
        }
        
        std::cout << "Created C++ interpreter successfully\n";
        
        // Execute with timeout and capture results
        auto result = executeWithTimeout(*interpreter, 5000);
        
        std::cout << "C++ execution completed\n";
        std::cout << "Success: " << (result.success ? "YES" : "NO") << "\n";
        if (!result.success) {
            std::cout << "Error: " << result.error << "\n";
        }
        std::cout << "Command count: " << result.commandCount << "\n";
        
        // Load JavaScript reference command stream
        std::ifstream jsFile("test_data/example_001_js_commands.txt");
        std::string jsCommandStream;
        if (jsFile) {
            std::ostringstream buffer;
            buffer << jsFile.rdbuf();
            jsCommandStream = buffer.str();
        } else {
            std::cout << "Warning: JavaScript reference file not found\n";
            std::cout << "Run: node generate_js_reference.js to create reference files\n";
            
            // Show C++ commands only
            std::cout << "\n=== C++ Generated Commands ===\n";
            std::cout << result.commandStream << "\n";
            
            auto cppCommands = splitCommands(result.commandStream);
            analyzeCommandTypes(cppCommands, "C++");
            
            std::cout << "\n=== Analysis ===\n";
            std::cout << "JavaScript expected: ~18 commands\n";
            std::cout << "C++ generated: " << result.commandCount << " commands\n";
            std::cout << "Difference: " << (int)result.commandCount - 18 << "\n";
            
            return 0;
        }
        
        // Split command streams into individual commands
        auto jsCommands = splitCommands(jsCommandStream);
        auto cppCommands = splitCommands(result.commandStream);
        
        std::cout << "\nCommand counts:\n";
        std::cout << "  JavaScript: " << jsCommands.size() << " commands\n";
        std::cout << "  C++:        " << cppCommands.size() << " commands\n";
        std::cout << "  Difference: " << (int)cppCommands.size() - (int)jsCommands.size() << "\n";
        
        // Analyze command types
        analyzeCommandTypes(jsCommands, "JavaScript");
        analyzeCommandTypes(cppCommands, "C++");
        
        // Compare command streams
        auto comparison = compareCommandStreams(jsCommands, cppCommands);
        
        if (!comparison.differences.empty()) {
            std::cout << "\n=== Command Differences (First 20) ===\n";
            for (size_t i = 0; i < std::min((size_t)20, comparison.differences.size()); i++) {
                std::cout << comparison.differences[i] << "\n";
            }
            
            if (comparison.differences.size() > 20) {
                std::cout << "... (" << (comparison.differences.size() - 20) << " more differences)\n";
            }
        } else {
            std::cout << "\n=== All commands match! ===\n";
        }
        
        // Calculate similarity
        size_t totalCommands = std::max(jsCommands.size(), cppCommands.size());
        size_t matchingCommands = totalCommands - comparison.differences.size();
        double similarity = totalCommands > 0 ? (double)matchingCommands / totalCommands * 100.0 : 0.0;
        
        std::cout << "\n=== Summary ===\n";
        std::cout << "Total commands compared: " << totalCommands << "\n";
        std::cout << "Matching commands: " << matchingCommands << "\n";
        std::cout << "Different commands: " << comparison.differences.size() << "\n";
        std::cout << "Similarity: " << std::fixed << std::setprecision(1) << similarity << "%\n";
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }
}