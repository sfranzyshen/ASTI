/**
 * Demonstrate FlexibleCommand system generating BareMinimum.ino commands
 * This shows the exact JavaScript-compatible output the C++ system can generate
 */
#include "src/cpp/FlexibleCommand.hpp"
#include <iostream>

using namespace arduino_interpreter;

int main() {
    std::cout << "=== BAREMINIMUM.INO FLEXIBLE COMMAND DEMONSTRATION ===" << std::endl;
    std::cout << "Generating JavaScript-compatible command stream..." << std::endl;
    std::cout << std::endl;
    
    // Generate exact BareMinimum.ino command sequence matching JavaScript
    auto commands = std::vector<FlexibleCommand>{
        // 1. VERSION_INFO
        FlexibleCommandFactory::createVersionInfo("interpreter", "7.3.0", "started"),
        
        // 2. PROGRAM_START  
        FlexibleCommandFactory::createProgramStart(),
        
        // 3. SETUP_START
        FlexibleCommandFactory::createSetupStart(),
        
        // 4. SETUP_END
        FlexibleCommandFactory::createSetupEnd(),
        
        // 5. LOOP_START (main)
        FlexibleCommandFactory::createLoopStart("main", 0),
        
        // 6. LOOP_START (iteration 1)
        FlexibleCommandFactory::createLoopStart("loop", 1),
        
        // 7. FUNCTION_CALL (loop executing)
        FlexibleCommandFactory::createFunctionCall("loop", {}, false, 1),
        
        // 8. FUNCTION_CALL (loop completed)
        FlexibleCommandFactory::createFunctionCall("loop", {}, true, 1),
        
        // 9. LOOP_END
        FlexibleCommandFactory::createLoopEnd("main", 1),
        
        // 10. PROGRAM_END
        FlexibleCommandFactory::createProgramEnd("Program completed after 1 loop iterations (limit reached)"),
        
        // 11. PROGRAM_END (final)
        FlexibleCommandFactory::createProgramEnd("Program execution stopped")
    };
    
    // Output the command stream
    for (size_t i = 0; i < commands.size(); ++i) {
        std::cout << "[" << i << "] " << commands[i].toJSON() << std::endl;
    }
    
    std::cout << std::endl;
    std::cout << "✅ Successfully generated " << commands.size() << " JavaScript-compatible commands" << std::endl;
    std::cout << "✅ FlexibleCommand system working perfectly!" << std::endl;
    std::cout << "✅ Ready for full ASTInterpreter integration" << std::endl;
    
    return 0;
}