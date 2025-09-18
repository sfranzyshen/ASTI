/**
 * Test flexible command system
 */
#include "src/cpp/FlexibleCommand.hpp"
#include <iostream>

using namespace arduino_interpreter;

int main() {
    std::cout << "Testing FlexibleCommand system..." << std::endl;
    
    // Test VERSION_INFO
    auto versionCmd = FlexibleCommandFactory::createVersionInfo("interpreter", "7.3.0", "started");
    std::cout << "VERSION_INFO: " << versionCmd.toJSON() << std::endl;
    
    // Test PROGRAM_START
    auto programStart = FlexibleCommandFactory::createProgramStart();
    std::cout << "PROGRAM_START: " << programStart.toJSON() << std::endl;
    
    // Test FUNCTION_CALL variant 1 (Serial.begin)
    auto serialBegin = FlexibleCommandFactory::createFunctionCallSerialBegin(9600);
    std::cout << "FUNCTION_CALL (Serial.begin): " << serialBegin.toJSON() << std::endl;
    
    // Test FUNCTION_CALL variant 2 (loop execution)
    auto loopExec = FlexibleCommandFactory::createFunctionCallLoop(1, false);
    std::cout << "FUNCTION_CALL (loop exec): " << loopExec.toJSON() << std::endl;
    
    // Test FUNCTION_CALL variant 2 (loop completed)
    auto loopComplete = FlexibleCommandFactory::createFunctionCallLoop(1, true);
    std::cout << "FUNCTION_CALL (loop complete): " << loopComplete.toJSON() << std::endl;
    
    // Test VAR_SET
    auto varSet = FlexibleCommandFactory::createVarSet("sensorValue", static_cast<int32_t>(409));
    std::cout << "VAR_SET: " << varSet.toJSON() << std::endl;
    
    // Test ANALOG_READ_REQUEST
    auto analogRead = FlexibleCommandFactory::createAnalogReadRequest(14, "analogRead_1757418934838_0.25664911194496565");
    std::cout << "ANALOG_READ_REQUEST: " << analogRead.toJSON() << std::endl;
    
    return 0;
}