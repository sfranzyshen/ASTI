/**
 * Test C++ State Machine Implementation
 * Check if C++ interpreter properly pauses for request-response or just runs through
 */
#include "src/cpp/ASTInterpreter.hpp"
#include <iostream>
#include <vector>

using namespace arduino_interpreter;

class StateTestListener : public FlexibleCommandListener {
public:
    std::vector<FlexibleCommand> commands;
    int requestCount = 0;
    
    void onCommand(const FlexibleCommand& command) override {
        commands.push_back(command);
        std::cout << "[" << commands.size()-1 << "] " << command.toJSON() << std::endl;
        
        // Check if this is a request that should pause execution
        std::string type = command.getType();
        if (type == "ANALOG_READ_REQUEST" || 
            type == "DIGITAL_READ_REQUEST" || 
            type == "MILLIS_REQUEST" || 
            type == "MICROS_REQUEST") {
            requestCount++;
            std::cout << "   ⚠️  REQUEST COMMAND - Should interpreter pause here?" << std::endl;
            std::cout << "   🤔 Is C++ waiting for handleResponse() or continuing?" << std::endl;
        }
    }
    
    void onError(const std::string& error) override {
        std::cout << "❌ Error: " << error << std::endl;
    }
};

int main() {
    std::cout << "🔧 C++ STATE MACHINE TEST" << std::endl;
    std::cout << "==========================" << std::endl;
    std::cout << std::endl;
    
    // Test with BareMinimum.ino (should have NO request commands)
    std::string bareMinimumCode = R"(
void setup() {
    // put your setup code here, to run once:
}

void loop() {
    // put your main code here, to run repeatedly:
}
)";
    
    try {
        StateTestListener listener;
        auto interpreter = arduino_interpreter::createInterpreter(bareMinimumCode);
        
        if (!interpreter) {
            std::cout << "❌ Failed to create interpreter" << std::endl;
            return 1;
        }
        
        interpreter->setCommandListener(&listener);
        interpreter->setMaxLoopIterations(1);
        
        std::cout << "🚀 Starting C++ interpreter..." << std::endl;
        interpreter->run();
        std::cout << "🏁 C++ interpreter completed" << std::endl;
        
        std::cout << std::endl;
        std::cout << "📊 C++ Results:" << std::endl;
        std::cout << "Commands: " << listener.commands.size() << std::endl;
        std::cout << "Request commands encountered: " << listener.requestCount << std::endl;
        
        if (listener.requestCount == 0) {
            std::cout << "✅ BareMinimum.ino has no request commands - state machine not tested" << std::endl;
            std::cout << "🎯 Both JS and C++ should produce same count for this simple program" << std::endl;
        }
        
        std::cout << std::endl;
        std::cout << "🔍 KEY QUESTION ANSWERED:" << std::endl;
        std::cout << "========================" << std::endl;
        std::cout << "C++ produces " << listener.commands.size() << " commands" << std::endl;
        std::cout << "JS produces 11 commands (with proper state handling)" << std::endl;
        
        if (listener.commands.size() == 10) {
            std::cout << "🤔 C++ has 1 fewer command - missing duplicate PROGRAM_END?" << std::endl;
        } else if (listener.commands.size() == 11) {
            std::cout << "✅ C++ and JS produce same command count" << std::endl;
        } else {
            std::cout << "❓ Unexpected command count difference" << std::endl;
        }
        
    } catch (const std::exception& e) {
        std::cout << "❌ Exception: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}