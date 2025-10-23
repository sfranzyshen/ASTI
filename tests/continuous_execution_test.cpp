/**
 * continuous_execution_test.cpp
 *
 * Linux test to reproduce ESP32 memory leak and iteration 140 crash
 *
 * PURPOSE: Run interpreter->resume() continuously for 150+ iterations
 * in a SINGLE process to reproduce the leak that only shows up with
 * continuous execution (not visible in separate process tests).
 *
 * EXPECTED RESULTS:
 * - If leak exists: Memory grows linearly (~7KB per iteration)
 * - If crash at 140: Same crash occurs on Linux
 */

#include "ASTInterpreter.hpp"
#include <iostream>
#include <iomanip>
#include <sys/resource.h>
#include <unistd.h>

using namespace arduino_interpreter;

// Same Blink.ino AST binary used by MinimalLibraryTest.ino
const uint8_t astBinary[] = {
  0x41, 0x53, 0x54, 0x50, 0x00, 0x01, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x3c, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x04, 0x00, 0x76, 0x6f,
  0x69, 0x64, 0x00, 0x05, 0x00, 0x73, 0x65, 0x74, 0x75, 0x70, 0x00, 0x07,
  0x00, 0x70, 0x69, 0x6e, 0x4d, 0x6f, 0x64, 0x65, 0x00, 0x04, 0x00, 0x6c,
  0x6f, 0x6f, 0x70, 0x00, 0x0c, 0x00, 0x64, 0x69, 0x67, 0x69, 0x74, 0x61,
  0x6c, 0x57, 0x72, 0x69, 0x74, 0x65, 0x00, 0x05, 0x00, 0x64, 0x65, 0x6c,
  0x61, 0x79, 0x00, 0x00, 0x01, 0x01, 0x04, 0x00, 0x01, 0x00, 0x0a, 0x00,
  0x21, 0x01, 0x06, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00, 0x50, 0x02,
  0x03, 0x00, 0x0c, 0x00, 0x00, 0x51, 0x02, 0x03, 0x00, 0x0c, 0x01, 0x00,
  0x10, 0x01, 0x02, 0x00, 0x05, 0x00, 0x11, 0x01, 0x02, 0x00, 0x06, 0x00,
  0x33, 0x01, 0x06, 0x00, 0x07, 0x00, 0x08, 0x00, 0x09, 0x00, 0x43, 0x02,
  0x03, 0x00, 0x0c, 0x02, 0x00, 0x40, 0x02, 0x02, 0x00, 0x03, 0x0d, 0x40,
  0x02, 0x02, 0x00, 0x03, 0x01, 0x21, 0x01, 0x06, 0x00, 0x0b, 0x00, 0x0c,
  0x00, 0x0d, 0x00, 0x50, 0x02, 0x03, 0x00, 0x0c, 0x00, 0x00, 0x51, 0x02,
  0x03, 0x00, 0x0c, 0x03, 0x00, 0x10, 0x01, 0x08, 0x00, 0x0e, 0x00, 0x13,
  0x00, 0x17, 0x00, 0x1c, 0x00, 0x11, 0x01, 0x02, 0x00, 0x0f, 0x00, 0x33,
  0x01, 0x06, 0x00, 0x10, 0x00, 0x11, 0x00, 0x12, 0x00, 0x43, 0x02, 0x03,
  0x00, 0x0c, 0x04, 0x00, 0x40, 0x02, 0x02, 0x00, 0x03, 0x0d, 0x40, 0x02,
  0x02, 0x00, 0x03, 0x01, 0x11, 0x01, 0x02, 0x00, 0x14, 0x00, 0x33, 0x01,
  0x04, 0x00, 0x15, 0x00, 0x16, 0x00, 0x43, 0x02, 0x03, 0x00, 0x0c, 0x05,
  0x00, 0x40, 0x02, 0x03, 0x00, 0x05, 0xe8, 0x03, 0x11, 0x01, 0x02, 0x00,
  0x18, 0x00, 0x33, 0x01, 0x06, 0x00, 0x19, 0x00, 0x1a, 0x00, 0x1b, 0x00,
  0x43, 0x02, 0x03, 0x00, 0x0c, 0x04, 0x00, 0x40, 0x02, 0x02, 0x00, 0x03,
  0x0d, 0x40, 0x02, 0x02, 0x00, 0x03, 0x00, 0x11, 0x01, 0x02, 0x00, 0x1d,
  0x00, 0x33, 0x01, 0x04, 0x00, 0x1e, 0x00, 0x1f, 0x00, 0x43, 0x02, 0x03,
  0x00, 0x0c, 0x05, 0x00, 0x40, 0x02, 0x03, 0x00, 0x05, 0xe8, 0x03
};

// Get current memory usage in KB
long getMemoryUsageKB() {
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    return usage.ru_maxrss;  // Maximum resident set size in KB
}

int main(int argc, char* argv[]) {
    int maxIterations = 150;  // Default

    if (argc > 1) {
        maxIterations = atoi(argv[1]);
    }

    std::cout << "\n===========================================\n";
    std::cout << "  CONTINUOUS EXECUTION TEST (Linux)\n";
    std::cout << "===========================================\n";
    std::cout << "Testing memory leak reproduction\n";
    std::cout << "Max iterations: " << maxIterations << "\n";
    std::cout << "===========================================\n\n";

    // Create interpreter with same options as MinimalLibraryTest
    InterpreterOptions opts;
    opts.verbose = false;  // Don't print command JSON
    opts.debug = false;
    opts.maxLoopIterations = 1;  // One loop iteration per resume()
    opts.syncMode = true;

    std::cout << "Creating interpreter...\n";
    ASTInterpreter* interpreter = new ASTInterpreter(astBinary, sizeof(astBinary), opts);

    if (!interpreter) {
        std::cerr << "ERROR: Failed to create interpreter\n";
        return 1;
    }

    std::cout << "Starting interpreter...\n";
    if (!interpreter->start()) {
        std::cerr << "ERROR: Failed to start interpreter\n";
        delete interpreter;
        return 1;
    }

    long initialMemory = getMemoryUsageKB();
    std::cout << "Initial Memory: " << initialMemory << " KB\n\n";
    std::cout << "Beginning continuous execution...\n\n";

    std::cout << std::setw(6) << "Iter"
              << std::setw(12) << "Memory(KB)"
              << std::setw(12) << "Delta(KB)"
              << std::setw(15) << "Leak/Iter(KB)\n";
    std::cout << "------------------------------------------------------\n";

    long previousMemory = initialMemory;

    for (int i = 1; i <= maxIterations; i++) {
        // Call resume() - same as ESP32 does
        interpreter->resume();

        // Track memory every 10 iterations
        if (i % 10 == 0 || i == 1 || i == 2 || i == 5) {
            long currentMemory = getMemoryUsageKB();
            long delta = currentMemory - initialMemory;
            double leakPerIter = (i > 0) ? (double)delta / i : 0;

            std::cout << std::setw(6) << i
                      << std::setw(12) << currentMemory
                      << std::setw(12) << delta
                      << std::setw(15) << std::fixed << std::setprecision(2) << leakPerIter
                      << "\n";

            previousMemory = currentMemory;
        }

        // Detailed checkpoint at key iterations
        if (i == 50 || i == 100 || i == 140) {
            long currentMemory = getMemoryUsageKB();
            std::cout << "\n========== CHECKPOINT (Iteration " << i << ") ==========\n";
            std::cout << "Memory: " << currentMemory << " KB\n";
            std::cout << "Total growth: " << (currentMemory - initialMemory) << " KB\n";
            std::cout << "Average leak/iter: " << std::fixed << std::setprecision(2)
                      << ((double)(currentMemory - initialMemory) / i) << " KB\n";
            std::cout << "================================================\n\n";
        }
    }

    long finalMemory = getMemoryUsageKB();
    long totalLeak = finalMemory - initialMemory;
    double avgLeakPerIter = (double)totalLeak / maxIterations;

    std::cout << "\n===========================================\n";
    std::cout << "  TEST COMPLETE\n";
    std::cout << "===========================================\n";
    std::cout << "Initial Memory: " << initialMemory << " KB\n";
    std::cout << "Final Memory: " << finalMemory << " KB\n";
    std::cout << "Total Leak: " << totalLeak << " KB\n";
    std::cout << "Average Leak/Iteration: " << std::fixed << std::setprecision(2) << avgLeakPerIter << " KB\n";
    std::cout << "===========================================\n";

    delete interpreter;

    if (totalLeak > 100) {
        std::cout << "\n⚠️  MEMORY LEAK CONFIRMED!\n";
        std::cout << "Leak is CROSS-PLATFORM (affects Linux, WASM, ESP32)\n";
        return 1;
    } else {
        std::cout << "\n✅ Memory appears stable (no significant leak)\n";
        std::cout << "Leak might be ESP32-specific\n";
        return 0;
    }
}
