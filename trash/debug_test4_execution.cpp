#include <iostream>
#include <fstream>
#include <vector>
#include "tests/test_utils.hpp"

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main() {
    std::cout << "=== DEBUGGING C++ EXECUTION ORDER FOR TEST 4 ===" << std::endl;
    
    // Load AST file
    std::ifstream astFile("test_data/example_004.ast", std::ios::binary);
    if (!astFile) {
        std::cout << "ERROR: Cannot open test_data/example_004.ast" << std::endl;
        return 1;
    }
    
    // Read AST data
    std::vector<uint8_t> astData((std::istreambuf_iterator<char>(astFile)), std::istreambuf_iterator<char>());
    astFile.close();
    std::cout << "Loaded AST: " << astData.size() << " bytes" << std::endl;
    
    // Create interpreter from binary AST
    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
    if (!interpreter) {
        std::cout << "ERROR: Failed to create interpreter" << std::endl;
        return 1;
    }
    std::cout << "Interpreter created successfully" << std::endl;
    
    // Create command capture with verbose logging
    CommandStreamCapture capture(true);
    MockResponseHandler mockHandler;
    
    interpreter->setCommandListener(&capture);
    interpreter->setResponseHandler(&mockHandler);
    
    std::cout << "\n=== STARTING EXECUTION ===" << std::endl;
    
    // Start interpreter
    bool started = interpreter->start();
    if (!started) {
        std::cout << "ERROR: Failed to start interpreter" << std::endl;
        return 1;
    }
    
    // Run interpreter with step-by-step execution
    int tickCount = 0;
    while ((interpreter->isRunning() || interpreter->isWaitingForResponse()) && tickCount < 1000) {
        tickCount++;
        std::cout << "\n--- TICK " << tickCount << " ---" << std::endl;
        
        size_t beforeCount = capture.getCommandCount();
        interpreter->tick();
        size_t afterCount = capture.getCommandCount();
        
        if (afterCount > beforeCount) {
            std::cout << "New commands generated: " << (afterCount - beforeCount) << std::endl;
            auto commands = capture.getCommands();
            for (size_t i = beforeCount; i < afterCount; ++i) {
                std::cout << "COMMAND[" << i << "]: " << commands[i].toJSON() << std::endl;
            }
        } else {
            std::cout << "No new commands generated" << std::endl;
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    std::cout << "\n=== EXECUTION COMPLETED ===" << std::endl;
    std::cout << "Total ticks: " << tickCount << std::endl;
    std::cout << "Total commands: " << capture.getCommandCount() << std::endl;
    
    // Print execution log
    std::cout << "\n=== EXECUTION LOG ===" << std::endl;
    std::cout << capture.getLog() << std::endl;
    
    return 0;
}