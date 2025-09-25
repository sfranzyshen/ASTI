#include "../tests/test_utils.hpp"
#include <iostream>
#include <fstream>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::cout << "=== Assignment Debug Test ===" << std::endl;
    
    // Load test 4 AST
    std::ifstream file("../test_data/example_004.ast", std::ios::binary | std::ios::ate);
    if (!file) {
        std::cout << "ERROR: Cannot open test file" << std::endl;
        return 1;
    }
    
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> compactAST(size);
    file.read(reinterpret_cast<char*>(compactAST.data()), size);
    file.close();
    
    try {
        // Set up C++ interpreter with command capture
        CommandStreamCapture capture;
        MockResponseHandler responseHandler;
        
        responseHandler.setDefaultAnalogValue(723);
        responseHandler.setDefaultDigitalValue(1);
        
        InterpreterOptions options;
        options.verbose = true;  // Enable verbose output
        options.debug = true;    // Enable debug output
        options.maxLoopIterations = 1;
        options.syncMode = true;
        
        auto interpreter = std::make_unique<ASTInterpreter>(compactAST.data(), compactAST.size(), options);
        interpreter->setCommandListener(&capture);
        interpreter->setResponseHandler(&responseHandler);
        
        interpreter->start();
        
        // Let it run briefly
        auto startTime = std::chrono::steady_clock::now();
        auto deadline = startTime + std::chrono::milliseconds(1000);
        while (interpreter->isRunning() && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        if (interpreter->isRunning()) {
            interpreter->stop();
        }
        
        std::string commands = capture.getCommandsAsJson();
        std::cout << "=== COMMANDS ===" << std::endl;
        std::cout << commands << std::endl;
        
    } catch (const std::exception& e) {
        std::cout << "ERROR: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}