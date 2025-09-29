/**
 * extract_cpp_commands.cpp - Extract C++ Command Stream for Single Test
 * 
 * Usage: ./extract_cpp_commands <test_number>
 * Example: ./extract_cpp_commands 4
 * 
 * Extracts and displays the C++ command stream for any test number.
 */

#include "test_utils.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <thread>
#include <chrono>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <test_number>" << std::endl;
        std::cerr << "Example: " << argv[0] << " 4" << std::endl;
        return 1;
    }
    
    int testNumber = std::atoi(argv[1]);
    if (testNumber < 0) {
        std::cerr << "ERROR: Invalid test number: " << testNumber << std::endl;
        return 1;
    }
    
    // Format test file name - use test_data/ from project root
    std::ostringstream astFileName;
    astFileName << "test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".ast";
    std::string astFile = astFileName.str();
    
    // Headers removed for validate_cross_platform compatibility
    
    // Load AST file
    std::ifstream file(astFile, std::ios::binary | std::ios::ate);
    if (!file) {
        std::cerr << "ERROR: Cannot open " << astFile << std::endl;
        std::cerr << "Make sure test data exists. Run: node generate_test_data.js" << std::endl;
        return 1;
    }
    
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> compactAST(size);
    file.read(reinterpret_cast<char*>(compactAST.data()), size);
    file.close();
    try {
        // Set up C++ interpreter with command capture - use constructor that loads compact AST directly
        CommandStreamCapture capture;
        MockResponseHandler responseHandler;
        
        InterpreterOptions options;
        options.verbose = false;
        options.debug = false;
        options.maxLoopIterations = Config::TEST_MAX_LOOP_ITERATIONS; // MATCH JAVASCRIPT: Use exactly 1 iteration like JS test data
        options.syncMode = true; // TEST MODE: Enable synchronous responses for digitalRead/analogRead
        
        auto interpreter = std::make_unique<ASTInterpreter>(compactAST.data(), compactAST.size(), options);
        interpreter->setCommandListener(&capture);
        interpreter->setResponseHandler(&responseHandler);
        
        // Execute interpreter
        interpreter->start();
        
        // Wait for completion with timeout
        auto startTime = std::chrono::steady_clock::now();
        auto timeoutMs = 5000;
        auto deadline = startTime + std::chrono::milliseconds(timeoutMs);
        while (interpreter->isRunning() && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        if (interpreter->isRunning()) {
            interpreter->stop();
        }

        // Get JSON output
        std::string jsonOutput = capture.getCommandsAsJson();

        // CRITICAL FIX: ALWAYS save JSON to file for debugging and analysis
        std::ostringstream outputFileName;
        outputFileName << "build/test" << testNumber << "_cpp.json";
        std::ofstream outputFile(outputFileName.str());
        if (outputFile) {
            outputFile << jsonOutput << std::endl;
            outputFile.close();
            std::cerr << "Saved C++ JSON to " << outputFileName.str() << std::endl;
        } else {
            std::cerr << "WARNING: Could not save JSON to " << outputFileName.str() << std::endl;
        }

        // Also output to stdout for pipe compatibility
        std::cout << jsonOutput << std::endl;

        std::cerr << "EXTRACT_DEBUG: About to exit try block" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
        return 1;
    }

    std::cerr << "EXTRACT_DEBUG: About to exit main function" << std::endl;
    return 0;
}