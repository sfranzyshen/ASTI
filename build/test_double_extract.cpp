#include "../tests/test_utils.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <thread>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

std::string extractCppCommands(int testNumber) {
    std::ostringstream astFileName;
    astFileName << "../test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".ast";
    std::string astFile = astFileName.str();

    // Load AST file
    std::ifstream file(astFile, std::ios::binary | std::ios::ate);
    if (!file) {
        return "";
    }

    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);

    std::vector<uint8_t> compactAST(size);
    file.read(reinterpret_cast<char*>(compactAST.data()), size);
    file.close();

    try {
        CommandStreamCapture capture;
        MockResponseHandler responseHandler;

        responseHandler.setDefaultAnalogValue(975);
        responseHandler.setDefaultDigitalValue(1);
        responseHandler.setDefaultMillisValue(17807);

        InterpreterOptions options;
        options.verbose = false;
        options.debug = false;
        options.maxLoopIterations = 1;
        options.syncMode = true;

        std::streambuf* orig = std::cerr.rdbuf();
        std::ostringstream nullStream;
        std::cerr.rdbuf(nullStream.rdbuf());

        auto interpreter = std::make_unique<ASTInterpreter>(compactAST.data(), compactAST.size(), options);
        interpreter->setCommandListener(&capture);
        interpreter->setResponseHandler(&responseHandler);

        interpreter->start();

        auto startTime = std::chrono::steady_clock::now();
        auto deadline = startTime + std::chrono::milliseconds(5000);
        while (interpreter->isRunning() && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }

        if (interpreter->isRunning()) {
            interpreter->stop();
        }

        std::cerr.rdbuf(orig);

        std::string fullOutput = capture.getCommandsAsJson();

        size_t jsonStart = fullOutput.find('[');
        size_t jsonEnd = fullOutput.rfind(']');
        if (jsonStart != std::string::npos && jsonEnd != std::string::npos && jsonEnd > jsonStart) {
            return fullOutput.substr(jsonStart, jsonEnd - jsonStart + 1);
        }
        return fullOutput;

    } catch (const std::exception& e) {
        std::cout << "Exception in extraction: " << e.what() << std::endl;
        return "";
    }
}

int main() {
    std::cout << "Testing double extraction of test 114..." << std::endl;

    std::cout << "First extraction..." << std::endl;
    std::string result1 = extractCppCommands(114);
    std::cout << "First extraction result length: " << result1.length() << std::endl;

    std::cout << "Second extraction..." << std::endl;
    std::string result2 = extractCppCommands(114);
    std::cout << "Second extraction result length: " << result2.length() << std::endl;

    if (result1.empty() || result2.empty()) {
        std::cout << "ERROR: One extraction failed" << std::endl;
        return 1;
    }

    std::cout << "SUCCESS: Both extractions completed" << std::endl;
    return 0;
}