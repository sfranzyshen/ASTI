#include "src/cpp/ASTInterpreter.hpp"
#include <iostream>

using namespace arduino_interpreter;

int main() {
    std::cout << "=== C++ COMMAND GENERATION DEBUG ===" << std::endl;
    
    // Simple test code
    std::string code = R"(
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
)";
    
    std::cout << "Testing code:\n" << code << std::endl;
    
    try {
        // Parse using the existing test data (we know example_002 works)
        // For now, let's create a simple AST manually to test command generation
        std::cout << "Creating interpreter..." << std::endl;
        
        ASTInterpreterOptions options;
        options.maxLoopIterations = 1;
        options.stepDelay = 0;
        
        auto interpreter = std::make_unique<ASTInterpreter>(nullptr, options);
        
        std::cout << "Testing command emission..." << std::endl;
        
        // Test basic command emission patterns
        interpreter->emitSystemCommand(CommandType::VERSION_INFO, "Started");
        interpreter->emitSystemCommand(CommandType::PROGRAM_START, "Program execution started");
        interpreter->emitSystemCommand(CommandType::SETUP_START, "Executing setup() function");
        
        // Test PIN_MODE command
        std::vector<CommandValue> pinArgs = {13, 1};
        interpreter->handlePinOperation("pinMode", pinArgs);
        
        interpreter->emitSystemCommand(CommandType::SETUP_END, "Completed setup() function");
        
        // Test loop commands
        interpreter->emitCommand(CommandFactory::createLoopStart("main", 0));
        interpreter->emitCommand(CommandFactory::createLoopStart("loop", 1));
        
        std::vector<std::string> emptyArgs;
        interpreter->emitCommand(CommandFactory::createFunctionCall("loop", emptyArgs, false, 1));
        
        // Test hardware operations
        std::vector<CommandValue> writeArgs = {13, 1};
        interpreter->handlePinOperation("digitalWrite", writeArgs);
        
        std::vector<CommandValue> delayArgs = {1000};
        interpreter->handleTimingOperation("delay", delayArgs);
        
        writeArgs = {13, 0};
        interpreter->handlePinOperation("digitalWrite", writeArgs);
        
        delayArgs = {1000};
        interpreter->handleTimingOperation("delay", delayArgs);
        
        // Complete function call
        interpreter->emitCommand(CommandFactory::createFunctionCall("loop", emptyArgs, true, 1));
        
        // End loop
        interpreter->emitCommand(CommandFactory::createLoopEnd("loop", 1));
        
        interpreter->emitSystemCommand(CommandType::PROGRAM_END, "Program completed after 1 loop iterations (limit reached)");
        interpreter->emitSystemCommand(CommandType::PROGRAM_END, "Program execution stopped");
        
        std::cout << "✅ Commands generated successfully" << std::endl;
        std::cout << "Check the output above for command format verification" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}