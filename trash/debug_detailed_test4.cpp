#include <iostream>
#include <fstream>
#include <vector>
#include "tests/test_utils.hpp"

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// Custom command listener to track exactly what's happening
class DetailedCommandCapture : public FlexibleCommandListener {
private:
    std::vector<FlexibleCommand> commands_;
    int commandIndex = 0;
    
public:
    void onCommand(const FlexibleCommand& command) override {
        std::cout << "COMMAND[" << commandIndex++ << "]: " << command.toJSON() << std::endl;
        commands_.push_back(command);
    }
    
    void onError(const std::string& error) override {
        std::cout << "ERROR: " << error << std::endl;
    }
    
    const std::vector<FlexibleCommand>& getCommands() const { return commands_; }
};

int main() {
    std::cout << "=== DETAILED C++ EXECUTION DEBUG FOR TEST 4 ===" << std::endl;
    
    // Load AST
    std::ifstream astFile("test_data/example_004.ast", std::ios::binary);
    if (!astFile) {
        std::cout << "ERROR: Cannot open test_data/example_004.ast" << std::endl;
        return 1;
    }
    
    std::vector<uint8_t> astData((std::istreambuf_iterator<char>(astFile)), std::istreambuf_iterator<char>());
    astFile.close();
    
    // Create interpreter with debug enabled
    InterpreterOptions options;
    options.verbose = true; // Enable all debug output
    options.debug = true;
    options.maxLoopIterations = 1;
    options.syncMode = true;
    
    auto interpreter = std::make_unique<ASTInterpreter>(astData.data(), astData.size(), options);
    
    // Set up detailed monitoring
    DetailedCommandCapture capture;
    MockResponseHandler mockHandler;
    
    interpreter->setCommandListener(&capture);
    interpreter->setResponseHandler(&mockHandler);
    
    std::cout << "\n=== STARTING DETAILED EXECUTION ===" << std::endl;
    
    if (!interpreter->start()) {
        std::cout << "ERROR: Failed to start interpreter" << std::endl;
        return 1;
    }
    
    // Run with detailed monitoring
    int tickCount = 0;
    while ((interpreter->isRunning() || interpreter->isWaitingForResponse()) && tickCount < 100) {
        std::cout << "\n--- TICK " << tickCount++ << " ---" << std::endl;
        std::cout << "State: " << static_cast<int>(interpreter->getState()) << std::endl;
        
        interpreter->tick();
        
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    std::cout << "\n=== EXECUTION ANALYSIS ===" << std::endl;
    std::cout << "Total ticks: " << tickCount << std::endl;
    std::cout << "Total commands: " << capture.getCommands().size() << std::endl;
    
    // Analyze command sequence
    bool foundAnalogWrite = false;
    bool foundVarSet = false;
    bool foundIfStatement = false;
    
    for (const auto& cmd : capture.getCommands()) {
        std::string type = cmd.getType();
        if (type == "ANALOG_WRITE") foundAnalogWrite = true;
        if (type == "VAR_SET") foundVarSet = true;
        if (type == "IF_STATEMENT") foundIfStatement = true;
    }
    
    std::cout << "\n=== COMMAND ANALYSIS ===" << std::endl;
    std::cout << "Found ANALOG_WRITE: " << (foundAnalogWrite ? "YES" : "NO") << std::endl;
    std::cout << "Found VAR_SET (brightness assignment): " << (foundVarSet ? "YES" : "NO") << std::endl;
    std::cout << "Found IF_STATEMENT: " << (foundIfStatement ? "YES" : "NO") << std::endl;
    
    if (!foundVarSet) {
        std::cout << "\n❌ CRITICAL ISSUE: VAR_SET command for brightness assignment is MISSING!" << std::endl;
        std::cout << "This confirms the assignment statement is not being executed." << std::endl;
    }
    
    return 0;
}