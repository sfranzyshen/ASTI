/**
 * extended_continuous_test.cpp
 *
 * Extended continuous execution test to reproduce ESP32 memory leak
 * with enforceLoopLimitsOnInternalLoops=false (ESP32 production mode)
 *
 * PURPOSE: Run 500+ iterations with same configuration as ESP32 to catch
 * memory leaks NOT detected by shorter tests.
 *
 * CONFIGURATION:
 * - enforceLoopLimitsOnInternalLoops = false (matches ESP32)
 * - maxLoopIterations = 1 (matches ESP32 - one loop() per resume())
 * - Uses Test 19 (Fading.ino) with 104 internal for loop iterations
 *
 * EXPECTED RESULTS (if all leaks fixed):
 * - Memory growth < 50 KB over 500 iterations
 * - Linear trend = 0 KB/iteration
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
    return usage.ru_maxrss;
}

int main(int argc, char* argv[]) {
    int maxIterations = 500;  // Extended test

    if (argc > 1) {
        maxIterations = atoi(argv[1]);
    }

    std::cout << "\n===========================================\n";
    std::cout << "  EXTENDED CONTINUOUS TEST\n";
    std::cout << "===========================================\n";
    std::cout << "Testing ESP32-mode memory leaks\n";
    std::cout << "Configuration: enforceLoopLimitsOnInternalLoops = false\n";
    std::cout << "Max iterations: " << maxIterations << "\n";
    std::cout << "===========================================\n\n";

    // Load Test 19 (Fading.ino) AST
    std::ifstream astFile("test_data/test19_js.ast", std::ios::binary | std::ios::ate);
    if (!astFile) {
        std::cerr << "ERROR: Cannot open test_data/test19_js.ast\n";
        std::cerr << "Run from project root directory\n";
        return 1;
    }

    std::streamsize size = astFile.tellg();
    astFile.seekg(0, std::ios::beg);
    std::vector<uint8_t> astData(size);
    if (!astFile.read(reinterpret_cast<char*>(astData.data()), size)) {
        std::cerr << "ERROR: Cannot read AST file\n";
        return 1;
    }
    astFile.close();

    std::cout << "Loaded AST: " << astData.size() << " bytes (Fading.ino)\n";
    std::cout << "Internal loop iterations per loop(): 104 (52 fade in + 52 fade out)\n\n";

    // Configure with ESP32 production settings
    InterpreterOptions opts;
    opts.verbose = false;
    opts.debug = false;
    opts.maxLoopIterations = 1;  // One loop() iteration per resume()
    opts.enforceLoopLimitsOnInternalLoops = false;  // ★ KEY: ESP32 mode - unlimited internal loops
    opts.syncMode = true;

    long memBefore = getMemoryUsageKB();
    std::cout << "Memory before interpreter creation: " << memBefore << " KB\n";

    // Create interpreter
    ASTInterpreter* interpreter = new ASTInterpreter(astData.data(), astData.size(), opts);
    if (!interpreter) {
        std::cerr << "ERROR: Failed to create interpreter\n";
        return 1;
    }

    long memAfterCreate = getMemoryUsageKB();
    std::cout << "Memory after creation: " << memAfterCreate << " KB (+"
              << (memAfterCreate - memBefore) << " KB)\n";

    // Start interpreter
    if (!interpreter->start()) {
        std::cerr << "ERROR: Failed to start interpreter\n";
        delete interpreter;
        return 1;
    }

    long memAfterSetup = getMemoryUsageKB();
    std::cout << "Memory after setup(): " << memAfterSetup << " KB (+"
              << (memAfterSetup - memAfterCreate) << " KB)\n\n";

    std::cout << "========== BEGIN EXTENDED EXECUTION TEST ==========\n";
    std::cout << std::setw(10) << "Iteration"
              << std::setw(15) << "Memory(KB)"
              << std::setw(15) << "Delta(KB)"
              << std::setw(15) << "Total(KB)"
              << std::setw(20) << "Avg/Iter(KB)\n";
    std::cout << "--------------------------------------------------------------------\n";

    long previousMemory = memAfterSetup;
    long totalGrowth = 0;

    for (int i = 1; i <= maxIterations; i++) {
        // Call resume() - runs ONE loop() iteration with 104 internal for loop iterations
        interpreter->resume();

        // Measure memory every iteration
        long currentMemory = getMemoryUsageKB();
        long delta = currentMemory - previousMemory;
        totalGrowth = currentMemory - memAfterSetup;
        double avgPerIter = (double)totalGrowth / i;

        // Print progress every 10 iterations, plus checkpoints
        if (i % 10 == 0 || i == 1 || i == 50 || i == 100 || i == 200 || i == maxIterations) {
            std::cout << std::setw(10) << i
                      << std::setw(15) << currentMemory
                      << std::setw(15) << delta
                      << std::setw(15) << totalGrowth
                      << std::setw(20) << std::fixed << std::setprecision(2) << avgPerIter
                      << "\n";
        }

        // Detailed checkpoints
        if (i == 50 || i == 100 || i == 200 || i == 500) {
            std::cout << "\n  ★ Checkpoint " << i << ": "
                      << "Memory = " << currentMemory << " KB, "
                      << "Total Growth = " << totalGrowth << " KB, "
                      << "Avg = " << std::fixed << std::setprecision(2) << avgPerIter << " KB/iter\n";
            std::cout << "     (Executed " << (i * 104) << " total internal for loop iterations)\n\n";
        }

        previousMemory = currentMemory;
    }

    long memAfterLoops = getMemoryUsageKB();
    double finalAvg = (double)totalGrowth / maxIterations;

    std::cout << "\n===========================================\n";
    std::cout << "  EXTENDED TEST COMPLETE\n";
    std::cout << "===========================================\n";
    std::cout << "Total loop() iterations: " << maxIterations << "\n";
    std::cout << "Total internal for loop iterations: " << (maxIterations * 104) << "\n";
    std::cout << "-------------------------------------------\n";
    std::cout << "Memory after setup(): " << memAfterSetup << " KB\n";
    std::cout << "Memory after " << maxIterations << " iterations: " << memAfterLoops << " KB\n";
    std::cout << "Total growth: " << totalGrowth << " KB\n";
    std::cout << "Average growth/iteration: " << std::fixed << std::setprecision(2)
              << finalAvg << " KB\n";
    std::cout << "===========================================\n";

    delete interpreter;

    long memAfterDelete = getMemoryUsageKB();
    std::cout << "\nMemory after deletion: " << memAfterDelete << " KB (cleanup: "
              << (memAfterLoops - memAfterDelete) << " KB)\n";

    // Verdict
    std::cout << "\n===========================================\n";
    if (totalGrowth > 100) {
        std::cout << "⚠️  MEMORY LEAK DETECTED!\n";
        std::cout << "Growth: " << totalGrowth << " KB over " << maxIterations << " iterations\n";
        std::cout << "Leak rate: " << std::fixed << std::setprecision(2) << finalAvg << " KB/iteration\n";
        std::cout << "\n❌ FAILED: Additional memory leaks exist\n";
        std::cout << "===========================================\n";
        return 1;
    } else {
        std::cout << "✅ Memory stable!\n";
        std::cout << "Total growth (" << totalGrowth << " KB) within acceptable range\n";
        std::cout << "Leak rate (" << std::fixed << std::setprecision(2) << finalAvg
                  << " KB/iter) negligible\n";
        std::cout << "===========================================\n";
        return 0;
    }
}
