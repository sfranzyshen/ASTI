#include "src/cpp/ASTInterpreter.hpp" 
#include "tests/test_utils.hpp"
#include <fstream>
#include <iostream>

int main() {
    try {
        // Load BareMinimum AST file
        std::ifstream file("test_data/example_001.ast", std::ios::binary);
        if (!file) {
            std::cerr << "Could not open example_001.ast" << std::endl;
            return 1;
        }
        
        file.seekg(0, std::ios::end);
        size_t size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<uint8_t> astData(size);
        file.read(reinterpret_cast<char*>(astData.data()), size);
        
        std::cout << "Loaded AST file: " << size << " bytes" << std::endl;
        
        // Create interpreter with same options as test
        arduino_interpreter::InterpreterOptions options;
        options.verbose = false;
        options.debug = false;
        options.maxLoopIterations = 3;  // MATCH JAVASCRIPT
        options.version = "7.3.0";     // UPDATED VERSION
        
        arduino_interpreter::ASTInterpreter interpreter(astData.data(), size, options);
        
        // Set up command capture
        arduino_interpreter::testing::CommandStreamCapture capture(false);
        arduino_interpreter::testing::MockResponseHandler mockHandler;
        
        interpreter.setCommandListener(&capture);
        interpreter.setResponseHandler(&mockHandler);
        
        // Run interpreter
        std::cout << "Running interpreter..." << std::endl;
        bool started = interpreter.start();
        if (!started) {
            std::cerr << "Failed to start interpreter" << std::endl;
            return 1;
        }
        
        // Wait for completion
        while (interpreter.isRunning()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        // Print results
        std::cout << "\nC++ Command Stream (" << capture.getCommandCount() << " commands):\n";
        std::cout << capture.getCommandsAsJson() << std::endl;
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
}