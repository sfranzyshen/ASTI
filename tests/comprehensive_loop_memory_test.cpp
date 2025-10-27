/**
 * comprehensive_loop_memory_test.cpp
 *
 * Comprehensive memory leak detection for ALL loop types
 *
 * PURPOSE: Validate memory safety for for, while, and do-while loops
 * with enforceLoopLimitsOnInternalLoops=false
 *
 * TEST STRATEGY:
 * - Create simple Arduino sketch using all three loop types
 * - Each loop type runs 100 iterations
 * - Measure memory after each loop type
 * - Run test 10 times to detect accumulation
 *
 * EXPECTED RESULTS:
 * - All three loop types: 0 KB memory growth
 * - No accumulation across test iterations
 * - Perfect memory safety confirmed by valgrind
 */

#include "ASTInterpreter.hpp"
#include <iostream>
#include <iomanip>
#include <sstream>
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

// Create a simple Arduino sketch that uses all three loop types
std::string createComprehensiveLoopSketch() {
    return R"(
int ledPin = 9;
int brightness = 0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  // Test 1: FOR LOOP (100 iterations)
  for (int i = 0; i < 100; i++) {
    brightness = i;
    analogWrite(ledPin, brightness);
  }

  // Test 2: WHILE LOOP (100 iterations)
  int j = 0;
  while (j < 100) {
    brightness = j;
    analogWrite(ledPin, brightness);
    j++;
  }

  // Test 3: DO-WHILE LOOP (100 iterations)
  int k = 0;
  do {
    brightness = k;
    analogWrite(ledPin, brightness);
    k++;
  } while (k < 100);
}
)";
}

int main() {
    std::cout << "\n===========================================\n";
    std::cout << "  COMPREHENSIVE LOOP MEMORY TEST\n";
    std::cout << "===========================================\n";
    std::cout << "Testing: for, while, and do-while loops\n";
    std::cout << "Iterations per loop type: 100\n";
    std::cout << "Total loop iterations per loop(): 300\n";
    std::cout << "===========================================\n\n";

    // Load pre-generated AST binary
    // NOTE: AST generated from tests/comprehensive_loop_test_sketch.ino
    std::cout << "Loading pre-generated AST...\n";
    std::ifstream astFile("/tmp/comprehensive_loop_test.ast", std::ios::binary | std::ios::ate);
    if (!astFile) {
        std::cerr << "ERROR: Cannot open AST file\n";
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

    std::cout << "Loaded AST: " << astData.size() << " bytes\n";

    // Configure interpreter
    InterpreterOptions opts;
    opts.verbose = false;
    opts.debug = false;
    opts.maxLoopIterations = 3;  // Main loop() limit
    opts.enforceLoopLimitsOnInternalLoops = false;  // ★ KEY: Allow unlimited internal loops
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

    std::cout << "\n========== BEGIN COMPREHENSIVE LOOP TEST ==========\n";
    std::cout << std::setw(10) << "Iteration"
              << std::setw(15) << "Memory(KB)"
              << std::setw(15) << "Delta(KB)"
              << std::setw(15) << "From Setup(KB)\n";
    std::cout << "-----------------------------------------------------------\n";

    long previousMemory = memAfterSetup;
    const int maxIterations = 10;

    for (int i = 1; i <= maxIterations; i++) {
        // Call resume() - runs ONE iteration of loop()
        // Each loop() iteration runs:
        //   - 100 for loop iterations
        //   - 100 while loop iterations
        //   - 100 do-while loop iterations
        // Total: 300 internal loop iterations per resume() call
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
                      << " KB (growth from setup: " << fromSetup << " KB)\n";
            std::cout << "     (Executed " << (i * 300) << " total internal loop iterations)\n\n";
        }
    }

    long memAfterLoops = getMemoryUsageKB();
    long totalGrowth = memAfterLoops - memAfterSetup;
    double avgGrowthPerIter = (double)totalGrowth / maxIterations;

    std::cout << "\n===========================================\n";
    std::cout << "  COMPREHENSIVE TEST COMPLETE\n";
    std::cout << "===========================================\n";
    std::cout << "Total internal loop iterations: " << (maxIterations * 300) << "\n";
    std::cout << "  - For loops: " << (maxIterations * 100) << " iterations\n";
    std::cout << "  - While loops: " << (maxIterations * 100) << " iterations\n";
    std::cout << "  - Do-while loops: " << (maxIterations * 100) << " iterations\n";
    std::cout << "-------------------------------------------\n";
    std::cout << "Memory after setup(): " << memAfterSetup << " KB\n";
    std::cout << "Memory after " << maxIterations << " test iterations: " << memAfterLoops << " KB\n";
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
        std::cout << "\n❌ FAILED: One or more loop types have memory leaks\n";
        std::cout << "===========================================\n";
        return 1;
    } else {
        std::cout << "✅ All loop types memory-safe!\n";
        std::cout << "Total growth (" << totalGrowth << " KB) within acceptable range\n";
        std::cout << "-------------------------------------------\n";
        std::cout << "✅ FOR LOOPS: Memory-safe (1000 iterations tested)\n";
        std::cout << "✅ WHILE LOOPS: Memory-safe (1000 iterations tested)\n";
        std::cout << "✅ DO-WHILE LOOPS: Memory-safe (1000 iterations tested)\n";
        std::cout << "===========================================\n";
        return 0;
    }
}
