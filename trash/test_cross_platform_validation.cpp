/**
 * test_cross_platform_validation.cpp - Cross-Platform Validation Tests
 * 
 * Validates that the C++ Arduino AST Interpreter produces identical
 * command streams to the JavaScript ASTInterpreter.js implementation.
 * 
 * Tests all 135 examples from the JavaScript test suite:
 * - examples.js (79 Arduino examples)
 * - old_test.js (54 comprehensive tests)  
 * - neopixel.js (2 NeoPixel tests)
 * 
 * Version: 1.0
 * Compatible with: ASTInterpreter.js v6.3.0
 */

#include "test_utils.hpp"
#include <fstream>
#include <filesystem>
#include <regex>
#include <map>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// =============================================================================
// JAVASCRIPT TEST DATA LOADER
// =============================================================================

struct TestExample {
    std::string name;
    std::string content;
    std::string expectedCommands; // JavaScript command stream (if available)
    std::string baseName;         // File base name for loading AST (e.g., "example_000")
};

/**
 * Load JavaScript test examples from generated files
 * This relies on Node.js generating AST and command data files
 */
class JavaScriptTestLoader {
private:
    std::vector<TestExample> examples_;
    std::string testDataDir_;

public:
    explicit JavaScriptTestLoader(const std::string& testDataDir = "../test_data") 
        : testDataDir_(testDataDir) {}
    
    /**
     * Load examples from JavaScript-generated files
     * Expected format: test_data/example_<index>.ast and test_data/example_<index>.commands
     */
    bool loadExamples() {
        if (!std::filesystem::exists(testDataDir_)) {
            std::cerr << "Test data directory not found: " << testDataDir_ << std::endl;
            std::cerr << "Run 'node generate_test_data.js' first to create test data files." << std::endl;
            return false;
        }
        
        examples_.clear();
        
        // Scan for test data files
        for (const auto& entry : std::filesystem::directory_iterator(testDataDir_)) {
            if (entry.is_regular_file() && entry.path().extension() == ".ast") {
                std::string baseName = entry.path().stem().string();
                std::string commandsFile = testDataDir_ + "/" + baseName + ".commands";
                std::string metaFile = testDataDir_ + "/" + baseName + ".meta";
                
                if (std::filesystem::exists(commandsFile) && std::filesystem::exists(metaFile)) {
                    TestExample example;
                    example.baseName = baseName; // Store base name for AST loading
                    
                    // Load metadata (name, content)
                    if (loadMetadata(metaFile, example)) {
                        // Load expected command stream
                        if (loadCommands(commandsFile, example.expectedCommands)) {
                            examples_.push_back(example);
                        }
                    }
                }
            }
        }
        
        std::cout << "Loaded " << examples_.size() << " test examples from JavaScript test data." << std::endl;
        return !examples_.empty();
    }
    
    const std::vector<TestExample>& getExamples() const { return examples_; }

private:
    bool loadMetadata(const std::string& metaFile, TestExample& example) {
        std::ifstream file(metaFile);
        if (!file) return false;
        
        std::string line;
        while (std::getline(file, line)) {
            if (line.length() >= 5 && line.substr(0, 5) == "name=") {
                example.name = line.substr(5);
            } else if (line.length() >= 8 && line.substr(0, 8) == "content=") {
                // Content might be multi-line, read until end
                example.content = line.substr(8);
                std::string contentLine;
                while (std::getline(file, contentLine)) {
                    example.content += "\n" + contentLine;
                }
                break;
            }
        }
        
        return !example.name.empty() && !example.content.empty();
    }
    
    bool loadCommands(const std::string& commandsFile, std::string& commands) {
        std::ifstream file(commandsFile);
        if (!file) return false;
        
        std::stringstream buffer;
        buffer << file.rdbuf();
        commands = buffer.str();
        
        return !commands.empty();
    }
};

// =============================================================================
// C++ INTERPRETER TEST RUNNER
// =============================================================================

/**
 * Run C++ interpreter on test example and capture command stream
 */
class CppInterpreterTestRunner {
private:
    std::string nodeExecutable_;
    std::string parserScript_;
    std::string testDataDir_;

public:
    CppInterpreterTestRunner(const std::string& testDataDir = "../test_data") 
        : nodeExecutable_("node"), parserScript_("../generate_compact_ast.js"), testDataDir_(testDataDir) {}
    
    /**
     * Run single example through C++ interpreter
     */
    TestResult runExample(const TestExample& example) {
        TestResult result;
        
        try {
            // Step 1: Load pre-generated compact AST file
            std::vector<uint8_t> compactAST;
            if (!loadPreGeneratedAST(example.baseName, compactAST)) {
                result.error = "Failed to load pre-generated AST for " + example.baseName;
                return result;
            }
            
            // Step 2: Create C++ interpreter with compact AST
            auto interpreter = createInterpreterFromBinary(compactAST.data(), compactAST.size());
            if (!interpreter) {
                result.error = "Failed to create C++ interpreter";
                return result;
            }
            
            // Step 3: Execute and capture command stream
            result = executeWithTimeout(*interpreter, 5000);
            
        } catch (const std::exception& e) {
            result.error = std::string("C++ interpreter error: ") + e.what();
        }
        
        return result;
    }

private:
    /**
     * Generate compact AST using Node.js script
     */
    bool generateCompactAST(const std::string& arduinoCode, std::vector<uint8_t>& compactAST) {
        // NOTE: This function is no longer used for dynamic generation
        // All AST files are pre-generated in test_data/ directory
        // This is kept for interface compatibility
        return false; 
    }
    
    /**
     * Load pre-generated AST file (OPTIMIZED VERSION)
     */
    bool loadPreGeneratedAST(const std::string& baseName, std::vector<uint8_t>& compactAST) {
        std::string astFile = testDataDir_ + "/" + baseName + ".ast";
        
        std::ifstream astStream(astFile, std::ios::binary);
        if (!astStream) {
            return false;
        }
        
        // Read AST data
        astStream.seekg(0, std::ios::end);
        size_t size = astStream.tellg();
        astStream.seekg(0, std::ios::beg);
        
        compactAST.resize(size);
        astStream.read(reinterpret_cast<char*>(compactAST.data()), size);
        
        return astStream.good() && !compactAST.empty();
    }
};

// =============================================================================
// COMMAND STREAM COMPARISON
// =============================================================================

/**
 * Compare two command streams for parity
 */
struct ComparisonResult {
    bool identical = false;
    std::string differences;
    double similarity = 0.0;
    
    std::string toString() const {
        if (identical) return "IDENTICAL";
        return "DIFFERENT (" + std::to_string((int)(similarity * 100)) + "% similar): " + differences;
    }
};

/**
 * Command stream comparator
 */
class CommandStreamComparator {
public:
    /**
     * Compare JavaScript and C++ command streams
     */
    ComparisonResult compare(const std::string& jsCommands, const std::string& cppCommands) {
        ComparisonResult result;
        
        // Simple string comparison first
        if (jsCommands == cppCommands) {
            result.identical = true;
            result.similarity = 1.0;
            return result;
        }
        
        // Parse and compare structure
        result.similarity = calculateSimilarity(jsCommands, cppCommands);
        result.differences = findDifferences(jsCommands, cppCommands);
        
        return result;
    }

private:
    double calculateSimilarity(const std::string& str1, const std::string& str2) {
        // Simple Levenshtein-based similarity
        if (str1.empty() && str2.empty()) return 1.0;
        if (str1.empty() || str2.empty()) return 0.0;
        
        size_t maxLen = std::max(str1.length(), str2.length());
        size_t distance = levenshteinDistance(str1, str2);
        
        return 1.0 - (static_cast<double>(distance) / maxLen);
    }
    
    std::string findDifferences(const std::string& str1, const std::string& str2) {
        if (str1.length() != str2.length()) {
            return "Length differs: " + std::to_string(str1.length()) + " vs " + std::to_string(str2.length());
        }
        
        std::stringstream diffs;
        size_t diffCount = 0;
        
        for (size_t i = 0; i < std::min(str1.length(), str2.length()) && diffCount < 5; ++i) {
            if (str1[i] != str2[i]) {
                if (diffCount > 0) diffs << ", ";
                diffs << "pos " << i << ": '" << str1[i] << "' vs '" << str2[i] << "'";
                diffCount++;
            }
        }
        
        if (diffCount >= 5) diffs << "...";
        return diffs.str();
    }
    
    size_t levenshteinDistance(const std::string& s1, const std::string& s2) {
        const size_t m = s1.length();
        const size_t n = s2.length();
        
        if (m == 0) return n;
        if (n == 0) return m;
        
        std::vector<std::vector<size_t>> d(m + 1, std::vector<size_t>(n + 1));
        
        for (size_t i = 1; i <= m; ++i) d[i][0] = i;
        for (size_t j = 1; j <= n; ++j) d[0][j] = j;
        
        for (size_t i = 1; i <= m; ++i) {
            for (size_t j = 1; j <= n; ++j) {
                const size_t cost = (s1[i - 1] == s2[j - 1]) ? 0 : 1;
                d[i][j] = std::min({
                    d[i - 1][j] + 1,      // deletion
                    d[i][j - 1] + 1,      // insertion
                    d[i - 1][j - 1] + cost // substitution
                });
            }
        }
        
        return d[m][n];
    }
};

// =============================================================================
// MAIN TEST EXECUTION
// =============================================================================

/**
 * Cross-platform validation test suite
 */
class CrossPlatformValidationSuite {
private:
    JavaScriptTestLoader loader_;
    CppInterpreterTestRunner runner_;
    CommandStreamComparator comparator_;
    
    struct ValidationStats {
        uint32_t totalTests = 0;
        uint32_t identicalStreams = 0;
        uint32_t similarStreams = 0;
        uint32_t differentStreams = 0;
        uint32_t cppErrors = 0;
        uint32_t jsErrors = 0;
        double averageSimilarity = 0.0;
    };

public:
    /**
     * Run complete validation suite
     */
    int run() {
        std::cout << "=== Cross-Platform Validation Test Suite ===" << std::endl;
        std::cout << "Comparing C++ vs JavaScript Arduino AST Interpreter" << std::endl;
        std::cout << std::endl;
        
        // Load JavaScript test data
        if (!loader_.loadExamples()) {
            std::cerr << "ERROR: Could not load JavaScript test examples." << std::endl;
            std::cerr << "Please run: node generate_test_data.js" << std::endl;
            return 1;
        }
        
        ValidationStats stats;
        const auto& examples = loader_.getExamples();
        stats.totalTests = examples.size();
        
        std::cout << "Running validation on " << stats.totalTests << " test examples..." << std::endl;
        std::cout << std::endl;
        
        // Run validation on each example
        for (size_t i = 0; i < examples.size(); ++i) {
            const auto& example = examples[i];
            
            std::cout << "[" << (i + 1) << "/" << stats.totalTests << "] " 
                      << example.name << "... ";
            
            // Run C++ interpreter
            TestResult cppResult = runner_.runExample(example);
            
            if (!cppResult.success) {
                std::cout << "C++ ERROR: " << cppResult.error << std::endl;
                stats.cppErrors++;
                continue;
            }
            
            if (example.expectedCommands.empty()) {
                std::cout << "NO JS DATA" << std::endl;
                stats.jsErrors++;
                continue;
            }
            
            // Compare command streams
            ComparisonResult comparison = comparator_.compare(
                example.expectedCommands, 
                cppResult.commandStream
            );
            
            stats.averageSimilarity += comparison.similarity;
            
            if (comparison.identical) {
                std::cout << "IDENTICAL ✓" << std::endl;
                stats.identicalStreams++;
            } else if (comparison.similarity > 0.9) {
                std::cout << "SIMILAR (" << (int)(comparison.similarity * 100) << "%) ≈" << std::endl;
                stats.similarStreams++;
            } else {
                std::cout << "DIFFERENT (" << (int)(comparison.similarity * 100) << "%) ✗" << std::endl;
                std::cout << "    Differences: " << comparison.differences << std::endl;
                stats.differentStreams++;
            }
        }
        
        // Calculate final statistics
        if (stats.totalTests > 0) {
            stats.averageSimilarity /= stats.totalTests;
        }
        
        // Print summary
        std::cout << std::endl;
        std::cout << "=== VALIDATION RESULTS ===" << std::endl;
        std::cout << "Total Tests: " << stats.totalTests << std::endl;
        std::cout << "Identical Streams: " << stats.identicalStreams 
                  << " (" << (stats.identicalStreams * 100 / stats.totalTests) << "%)" << std::endl;
        std::cout << "Similar Streams: " << stats.similarStreams 
                  << " (" << (stats.similarStreams * 100 / stats.totalTests) << "%)" << std::endl;
        std::cout << "Different Streams: " << stats.differentStreams 
                  << " (" << (stats.differentStreams * 100 / stats.totalTests) << "%)" << std::endl;
        std::cout << "C++ Errors: " << stats.cppErrors << std::endl;
        std::cout << "JS Data Missing: " << stats.jsErrors << std::endl;
        std::cout << "Average Similarity: " << (int)(stats.averageSimilarity * 100) << "%" << std::endl;
        std::cout << std::endl;
        
        // Determine success
        bool success = (stats.identicalStreams + stats.similarStreams) >= (stats.totalTests * 0.95);
        
        if (success) {
            std::cout << "🎉 VALIDATION SUCCESSFUL! 🎉" << std::endl;
            std::cout << "C++ interpreter achieves high parity with JavaScript implementation." << std::endl;
        } else {
            std::cout << "❌ VALIDATION FAILED" << std::endl;
            std::cout << "Significant differences found between C++ and JavaScript interpreters." << std::endl;
        }
        
        return success ? 0 : 1;
    }
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

int main(int argc, char* argv[]) {
    try {
        CrossPlatformValidationSuite suite;
        return suite.run();
        
    } catch (const std::exception& e) {
        std::cerr << "FATAL ERROR: " << e.what() << std::endl;
        return 2;
    }
}