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
    
    std::cout << "=== C++ COMMAND STREAM EXTRACTION ===" << std::endl;
    std::cout << "Test Number: " << testNumber << std::endl;
    std::cout << "AST File: " << astFile << std::endl;
    std::cout << std::endl;
    
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
    
    std::cout << "Loaded " << size << " bytes from AST file" << std::endl;
    
    try {
        // Set up C++ interpreter with command capture - use constructor that loads compact AST directly
        CommandStreamCapture capture;
        MockResponseHandler responseHandler;
        
        InterpreterOptions options;
        options.verbose = false;
        options.debug = false;
        options.maxLoopIterations = 1; // MATCH JAVASCRIPT: Use exactly 1 iteration like JS test data
        options.syncMode = true; // TEST MODE: Enable synchronous responses for digitalRead/analogRead
        
        auto interpreter = std::make_unique<ASTInterpreter>(compactAST.data(), compactAST.size(), options);
        interpreter->setCommandListener(&capture);
        interpreter->setResponseHandler(&responseHandler);
        
        // Execute interpreter
        std::cout << "DEBUG: About to start interpreter..." << std::endl;
        interpreter->start();
        std::cout << "DEBUG: Interpreter start() completed" << std::endl;
        
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
        
        std::cout << "Executed interpreter successfully" << std::endl;
        std::cout << "Captured " << capture.getCommandCount() << " commands" << std::endl;
        std::cout << std::endl;
        
        // Output the complete C++ command stream
        std::cout << "C++ COMMAND STREAM:" << std::endl;
        std::cout << "==================" << std::endl;
        std::cout << capture.getCommandsAsJson() << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}