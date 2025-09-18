/**
 * Test if C++ interpreter actually executes flow control
 * This tests if loops actually loop and if statements actually branch
 */
#include "src/cpp/FlexibleCommand.hpp"
#include <iostream>
#include <vector>

using namespace arduino_interpreter;

class FlowTestListener : public FlexibleCommandListener {
public:
    std::vector<std::string> commands;
    
    void onCommand(const FlexibleCommand& command) override {
        std::string json = command.toJSON();
        commands.push_back(json);
        std::cout << "[" << commands.size()-1 << "] " << json << std::endl;
    }
    
    void onError(const std::string& error) override {
        std::cout << "❌ Error: " << error << std::endl;
    }
};

int main() {
    std::cout << "🔧 C++ FLOW CONTROL TEST" << std::endl;
    std::cout << "=========================" << std::endl;
    
    // Test with a simple loop that should produce multiple PIN_MODE commands
    std::string testCode = R"(
void setup() {
    for (int i = 0; i < 3; i++) {
        pinMode(13, OUTPUT);
    }
}

void loop() {
    // Empty loop
}
)";
    
    std::cout << "📋 Test Code:" << std::endl;
    std::cout << testCode << std::endl;
    std::cout << "🚀 Expected: 3 pinMode commands inside for loop" << std::endl;
    std::cout << "📤 C++ Output:" << std::endl;
    std::cout << std::endl;
    
    try {
        FlowTestListener listener;
        auto interpreter = arduino_interpreter::createInterpreter(testCode);
        
        if (!interpreter) {
            std::cout << "❌ Failed to create interpreter" << std::endl;
            return 1;
        }
        
        interpreter->setCommandListener(&listener);
        interpreter->setMaxLoopIterations(5); // Allow enough iterations
        
        interpreter->run();
        
        std::cout << std::endl;
        std::cout << "📊 Results:" << std::endl;
        std::cout << "Total commands: " << listener.commands.size() << std::endl;
        
        // Count PIN_MODE commands
        int pinModeCount = 0;
        for (const auto& cmd : listener.commands) {
            if (cmd.find("\"type\":\"PIN_MODE\"") != std::string::npos) {
                pinModeCount++;
            }
        }
        
        std::cout << "PIN_MODE commands: " << pinModeCount << std::endl;
        
        if (pinModeCount == 3) {
            std::cout << "✅ SUCCESS: C++ interpreter DOES execute flow control!" << std::endl;
            std::cout << "✅ For loop ran 3 iterations, generated 3 pinMode commands" << std::endl;
        } else if (pinModeCount == 1) {
            std::cout << "❌ FAILURE: C++ interpreter only emitted 1 pinMode command" << std::endl;
            std::cout << "❌ For loop did NOT actually loop - just processed structure once" << std::endl;
        } else {
            std::cout << "❓ UNEXPECTED: Got " << pinModeCount << " pinMode commands" << std::endl;
        }
        
    } catch (const std::exception& e) {
        std::cout << "❌ Exception: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}