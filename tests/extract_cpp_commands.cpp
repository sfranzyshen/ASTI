/**
 * extract_cpp_commands.cpp - Extract C++ Command Stream for Single Test
 * 
 * Usage: ./extract_cpp_commands <test_number>
 * Example: ./extract_cpp_commands 4
 * 
 * Extracts and displays the C++ command stream for any test number.
 */

#include "test_utils.hpp"
#include "DeterministicDataProvider.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <thread>
#include <chrono>

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <test_number>" << std::endl;
        std::cerr << "Example: " << argv[0] << " 4" << std::endl;
        return 1;
    }
    
    int testNumber = std::atoi(argv[1]);
    if (testNumber < 0) {
        std::cerr << "ERROR: Invalid test number: " << testNumber << std::endl;
        return 1;
    }
    
    // Format test file name - use test_data/ from project root
    std::ostringstream astFileName;
    astFileName << "test_data/example_" << std::setfill('0') << std::setw(3) << testNumber << ".ast";
    std::string astFile = astFileName.str();
    
    // Headers removed for validate_cross_platform compatibility
    
    // Load AST file
    std::ifstream file(astFile, std::ios::binary | std::ios::ate);
    if (!file) {
        std::cerr << "ERROR: Cannot open " << astFile << std::endl;
        std::cerr << "Make sure test data exists. Run: node generate_test_data.js" << std::endl;
        return 1;
    }
    
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    
    std::vector<uint8_t> compactAST(size);
    file.read(reinterpret_cast<char*>(compactAST.data()), size);
    file.close();
    try {
        // Set up C++ interpreter - JSON will flow directly to stdout (no capture needed)
        MockResponseHandler responseHandler;

        InterpreterOptions options;
        options.verbose = false;
        options.debug = false;
        options.maxLoopIterations = Config::TEST_MAX_LOOP_ITERATIONS; // MATCH JAVASCRIPT: Use exactly 1 iteration like JS test data
        options.syncMode = true; // TEST MODE: Enable synchronous responses for digitalRead/analogRead

        auto interpreter = std::make_unique<ASTInterpreter>(compactAST.data(), compactAST.size(), options);
        interpreter->setResponseHandler(&responseHandler);

        // Inject deterministic data provider (parent app provides all external values)
        auto dataProvider = std::make_unique<DeterministicDataProvider>();
        interpreter->setSyncDataProvider(dataProvider.get());

        // Capture stdout to collect JSON AND let it flow to pipe
        std::ostringstream jsonBuffer;
        std::streambuf* oldCoutBuf = std::cout.rdbuf();

        // Create a custom streambuf that writes to BOTH jsonBuffer AND original stdout
        class TeeStreambuf : public std::streambuf {
            std::streambuf* sb1;
            std::streambuf* sb2;
        protected:
            virtual int overflow(int c) override {
                if (c == EOF) return !EOF;
                if (sb1->sputc(c) == EOF || sb2->sputc(c) == EOF) return EOF;
                return c;
            }
            virtual int sync() override {
                sb1->pubsync();
                sb2->pubsync();
                return 0;
            }
        public:
            TeeStreambuf(std::streambuf* s1, std::streambuf* s2) : sb1(s1), sb2(s2) {}
        };

        TeeStreambuf tee(oldCoutBuf, jsonBuffer.rdbuf());
        std::cout.rdbuf(&tee);

        // Execute interpreter (JSON flows to both stdout pipe AND jsonBuffer)
        interpreter->start();

        // Wait for completion with timeout
        auto startTime = std::chrono::steady_clock::now();
        auto timeoutMs = 5000;
        auto deadline = startTime + std::chrono::milliseconds(timeoutMs);
        while (interpreter->isRunning() && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }

        if (interpreter->isRunning()) {
            interpreter->stop();
        }

        // Restore stdout
        std::cout.rdbuf(oldCoutBuf);

        // Get JSON output from buffer
        std::string jsonOutput = jsonBuffer.str();

        // CRITICAL FIX: ALWAYS save JSON to file for debugging and analysis
        std::ostringstream outputFileName;
        outputFileName << "build/test" << testNumber << "_cpp.json";
        std::ofstream outputFile(outputFileName.str());
        if (outputFile) {
            outputFile << jsonOutput << std::endl;
            outputFile.close();
            std::cerr << "Saved C++ JSON to " << outputFileName.str() << std::endl;
        } else {
            std::cerr << "WARNING: Could not save JSON to " << outputFileName.str() << std::endl;
        }

        std::cerr << "EXTRACT_DEBUG: About to exit try block" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
        return 1;
    }

    std::cerr << "EXTRACT_DEBUG: About to exit main function" << std::endl;
    return 0;
}