/**
 * loop_memory_test.cpp
 *
 * Memory leak detection for internal for/while/do-while loops
 *
 * PURPOSE: Test memory usage when enforceLoopLimitsOnInternalLoops=false
 * allowing for loops to run hundreds of iterations (like RGB cycling)
 *
 * TEST CASE: Test 19 (Fading.ino) - analogWrite in for loop
 * - Loop 1: 52 iterations (0 to 255, step 5)
 * - Loop 2: 52 iterations (255 to 0, step 5)
 * - Total: 104 loop iterations with analogWrite + delay
 *
 * EXPECTED RESULTS:
 * - Memory should be stable after loop execution
 * - No accumulation over loop iterations
 * - ESP32 OUT_OF_MEMORY error should not occur
 */

#include "ASTInterpreter.hpp"
#include <iostream>
#include <iomanip>
#include <fstream>
#include <vector>
#include <sys/resource.h>

using namespace arduino_interpreter;

// Get current memory usage in KB
long getMemoryUsageKB() {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return usage.ru_maxrss;  // Maximum resident set size in KB
}

// Load AST binary from file
std::vector<uint8_t> loadASTFile(const std::string& filename) {
    std::ifstream file(filename, std::ios::binary | std::ios::ate);
    if (!file) {
        std::cerr << "ERROR: Cannot open " << filename << "\n";
        return {};
    }

    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);

    std::vector<uint8_t> buffer(size);
    if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
        std::cerr << "ERROR: Cannot read " << filename << "\n";
        return {};
    }

    return buffer;
}

int main(int argc, char* argv[]) {
    std::string astFile = "test_data/test19_js.ast";  // Fading.ino

    if (argc > 1) {
        astFile = argv[1];
    }

    std::cout << "\n===========================================\n";
    std::cout << "  LOOP MEMORY LEAK TEST\n";
    std::cout << "===========================================\n";
    std::cout << "AST File: " << astFile << "\n";
    std::cout << "Test: For loops with enforceLoopLimitsOnInternalLoops=false\n";
    std::cout << "===========================================\n\n";

    // Load AST file
    auto astData = loadASTFile(astFile);
    if (astData.empty()) {
        return 1;
    }

    std::cout << "Loaded AST: " << astData.size() << " bytes\n";

    // Configure interpreter with loop limits DISABLED
    InterpreterOptions opts;
    opts.verbose = false;  // Don't print command stream
    opts.debug = false;
    opts.maxLoopIterations = 3;  // Main loop() limit (like test data generation)
    opts.enforceLoopLimitsOnInternalLoops = false;  // ★ KEY: Allow unlimited for/while/do-while
    opts.syncMode = true;

    std::cout << "\nConfiguration:\n";
    std::cout << "  maxLoopIterations: " << opts.maxLoopIterations << "\n";
    std::cout << "  enforceLoopLimitsOnInternalLoops: " << (opts.enforceLoopLimitsOnInternalLoops ? "true" : "false") << "\n\n";

    long memBefore = getMemoryUsageKB();
    std::cout << "Memory before interpreter creation: " << memBefore << " KB\n";

    // Create interpreter
    std::cout << "Creating interpreter...\n";
    ASTInterpreter* interpreter = new ASTInterpreter(astData.data(), astData.size(), opts);

    if (!interpreter) {
        std::cerr << "ERROR: Failed to create interpreter\n";
        return 1;
    }

    long memAfterCreate = getMemoryUsageKB();
    std::cout << "Memory after creation: " << memAfterCreate << " KB (+"
              << (memAfterCreate - memBefore) << " KB)\n";

    // Start interpreter (runs setup())
    std::cout << "\nStarting interpreter (running setup())...\n";
    if (!interpreter->start()) {
        std::cerr << "ERROR: Failed to start interpreter\n";
        delete interpreter;
        return 1;
    }

    long memAfterSetup = getMemoryUsageKB();
    std::cout << "Memory after setup(): " << memAfterSetup << " KB (+"
              << (memAfterSetup - memAfterCreate) << " KB)\n";

    std::cout << "\n========== BEGIN LOOP EXECUTION ==========\n";
    std::cout << std::setw(10) << "Iteration"
              << std::setw(15) << "Memory(KB)"
              << std::setw(15) << "Delta(KB)"
              << std::setw(15) << "From Setup(KB)\n";
    std::cout << "------------------------------------------------------\n";

    long previousMemory = memAfterSetup;
    const int maxIterations = 10;  // Run loop() 10 times

    for (int i = 1; i <= maxIterations; i++) {
        // Call resume() - runs ONE iteration of loop()
        interpreter->resume();

        long currentMemory = getMemoryUsageKB();
        long delta = currentMemory - previousMemory;
        long fromSetup = currentMemory - memAfterSetup;

        std::cout << std::setw(10) << i
                  << std::setw(15) << currentMemory
                  << std::setw(15) << delta
                  << std::setw(15) << fromSetup
                  << "\n";

        previousMemory = currentMemory;

        // Detailed checkpoints
        if (i == 1 || i == 5 || i == 10) {
            std::cout << "\n  ★ Checkpoint " << i << ": Memory = " << currentMemory
                      << " KB (growth from setup: " << fromSetup << " KB)\n\n";
        }
    }

    long memAfterLoops = getMemoryUsageKB();
    long totalGrowth = memAfterLoops - memAfterSetup;
    double avgGrowthPerIter = (double)totalGrowth / maxIterations;

    std::cout << "\n===========================================\n";
    std::cout << "  LOOP EXECUTION COMPLETE\n";
    std::cout << "===========================================\n";
    std::cout << "Memory after setup(): " << memAfterSetup << " KB\n";
    std::cout << "Memory after " << maxIterations << " iterations: " << memAfterLoops << " KB\n";
    std::cout << "Total growth: " << totalGrowth << " KB\n";
    std::cout << "Average growth/iteration: " << std::fixed << std::setprecision(2)
              << avgGrowthPerIter << " KB\n";
    std::cout << "===========================================\n";

    delete interpreter;

    long memAfterDelete = getMemoryUsageKB();
    std::cout << "\nMemory after deletion: " << memAfterDelete << " KB (cleanup: "
              << (memAfterLoops - memAfterDelete) << " KB)\n";

    // Verdict
    std::cout << "\n===========================================\n";
    if (totalGrowth > 50) {
        std::cout << "⚠️  MEMORY LEAK DETECTED!\n";
        std::cout << "Growth: " << totalGrowth << " KB over " << maxIterations << " iterations\n";
        std::cout << "Leak rate: " << std::fixed << std::setprecision(2) << avgGrowthPerIter << " KB/iteration\n";
        std::cout << "===========================================\n";
        return 1;
    } else {
        std::cout << "✅ Memory appears stable\n";
        std::cout << "Total growth (" << totalGrowth << " KB) within acceptable range\n";
        std::cout << "===========================================\n";
        return 0;
    }
}
