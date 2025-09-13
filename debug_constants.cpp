#include "src/cpp/ASTInterpreter.hpp" 
#include "tests/test_utils.hpp"
#include <iostream>

using namespace arduino_interpreter;

int main() {
    std::cout << "=== LOW/HIGH Constants Debug ===" << std::endl;
    
    // Load test 6 (BlinkWithoutDelay) AST
    uint8_t* astData;
    size_t astSize;
    
    // Read test_data/example_006.ast
    std::string filename = "../test_data/example_006.ast";
    FILE* file = fopen(filename.c_str(), "rb");
    if (!file) {
        std::cerr << "Failed to open " << filename << std::endl;
        return 1;
    }
    
    fseek(file, 0, SEEK_END);
    astSize = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    astData = new uint8_t[astSize];
    fread(astData, 1, astSize, file);
    fclose(file);
    
    std::cout << "Loaded AST size: " << astSize << " bytes" << std::endl;
    
    // Create interpreter with proper mock values
    InterpreterOptions options;
    options.verbose = true;
    options.debug = true;
    options.maxLoopIterations = 1;
    options.syncMode = true;
    
    auto interpreter = std::make_unique<ASTInterpreter>(astData, astSize, options);
    auto mockHandler = std::make_unique<testing::MockResponseHandler>();
    
    // Set millis() to match JavaScript test expectation
    mockHandler->setDefaultMillisValue(17807);
    interpreter->setResponseHandler(mockHandler.get());
    
    try {
        // Start execution
        bool started = interpreter->start();
        if (!started) {
            std::cerr << "Failed to start interpreter" << std::endl;
            return 1;
        }
        
        // Drive execution 
        int maxTicks = 100;
        while ((interpreter->isRunning() || interpreter->isWaitingForResponse()) && maxTicks-- > 0) {
            interpreter->tick();
        }
        
        if (interpreter->isRunning()) {
            interpreter->stop();
        }
        
        std::cout << "Execution completed successfully" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }
    
    delete[] astData;
    return 0;
}