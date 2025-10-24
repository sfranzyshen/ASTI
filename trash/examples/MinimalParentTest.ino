/**
 * MinimalParentTest.ino
 *
 * ISOLATION TEST: Tests parent app (CommandExecutor + String operations) ALONE
 * NO interpreter, only command execution and String conversions
 *
 * PURPOSE: Determine if memory leak is in parent app String operations
 *
 * EXPECTED RESULTS:
 * - If heap drops: Arduino String fragmentation confirmed! (LEAK IN PARENT APP)
 * - If heap stable: Parent app is fine, leak must be in library
 */

#include "CommandExecutor.h"
#include <string>

// ============================================================================
// GLOBAL STATE
// ============================================================================

CommandExecutor executor;
unsigned long loopIteration = 0;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n");
    Serial.println("========================================");
    Serial.println("  MINIMAL PARENT APP ISOLATION TEST");
    Serial.println("========================================");
    Serial.println("Testing CommandExecutor + String operations ALONE");
    Serial.println("NO interpreter");
    Serial.println("");
    Serial.println("PURPOSE: Determine if leak is in String operations");
    Serial.println("");
    Serial.println("IF heap drops -> LEAK CONFIRMED in String operations!");
    Serial.println("IF heap stable -> Parent app is fine");
    Serial.println("========================================\n");

    // Configure LED
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);

    Serial.printf("Initial Free Heap: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("Initial Stack Free: %d bytes\n\n", uxTaskGetStackHighWaterMark(NULL));
    Serial.println("Beginning test loop...\n");
}

// ============================================================================
// LOOP
// ============================================================================

void loop() {
    // ========================================================================
    // SIMULATE WHAT ImmediateCommandExecutor DOES
    // This is the EXACT pattern used in AdvancedInterpreter
    // ========================================================================

    // Create std::string commands (this is what interpreter generates)
    std::string jsonCmd1 = "{\"type\":\"DIGITAL_WRITE\",\"timestamp\":0,\"pin\":13,\"value\":1}";
    std::string jsonCmd2 = "{\"type\":\"DELAY\",\"timestamp\":0,\"duration\":1000}";
    std::string jsonCmd3 = "{\"type\":\"DIGITAL_WRITE\",\"timestamp\":0,\"pin\":13,\"value\":0}";
    std::string jsonCmd4 = "{\"type\":\"DELAY\",\"timestamp\":0,\"duration\":1000}";

    // Convert to Arduino String (THIS IS WHERE LEAK MIGHT BE!)
    // ImmediateCommandExecutor does: String cmd(jsonCommand.c_str());
    String cmd1(jsonCmd1.c_str());
    String cmd2(jsonCmd2.c_str());
    String cmd3(jsonCmd3.c_str());
    String cmd4(jsonCmd4.c_str());

    // Execute commands
    executor.execute(cmd1);
    executor.execute(cmd2);
    executor.execute(cmd3);
    executor.execute(cmd4);

    loopIteration++;

    // Memory stats every 10 iterations
    if (loopIteration % 10 == 0) {
        Serial.printf("[%3lu] Heap: %6d bytes | Min: %6d bytes | Stack: %4d bytes\n",
            loopIteration,
            ESP.getFreeHeap(),
            ESP.getMinFreeHeap(),
            uxTaskGetStackHighWaterMark(NULL));
    }

    // Detailed analysis at key iterations
    if (loopIteration == 50 || loopIteration == 100 || loopIteration == 150) {
        Serial.println("\n========== MEMORY ANALYSIS ==========");
        Serial.printf("Iteration: %lu\n", loopIteration);
        Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
        Serial.printf("Min Free Heap Ever: %d bytes\n", ESP.getMinFreeHeap());
        Serial.printf("Largest Free Block: %d bytes\n", ESP.getMaxAllocHeap());
        Serial.printf("Heap Size: %d bytes\n", ESP.getHeapSize());
        Serial.printf("Stack Free: %d bytes\n\n", uxTaskGetStackHighWaterMark(NULL));

        // Heap fragmentation analysis
        multi_heap_info_t info;
        heap_caps_get_info(&info, MALLOC_CAP_DEFAULT);
        Serial.println("Fragmentation Analysis:");
        Serial.printf("  Total Free: %d bytes\n", info.total_free_bytes);
        Serial.printf("  Largest Block: %d bytes\n", info.largest_free_block);
        Serial.printf("  Allocated Blocks: %d\n", info.allocated_blocks);
        Serial.printf("  Free Blocks: %d\n", info.free_blocks);
        Serial.printf("  Total Allocated: %d bytes\n", info.total_allocated_bytes);

        float fragPercent = 100.0 * (1.0 - ((float)info.largest_free_block / (float)info.total_free_bytes));
        Serial.printf("  Fragmentation: %.1f%%\n", fragPercent);

        if (fragPercent > 50.0) {
            Serial.println("  *** WARNING: HIGH FRAGMENTATION DETECTED! ***");
        }

        Serial.println("=====================================\n");
    }

    // NOTE: The loop() function in Arduino has a built-in delay,
    // but we're also executing delay commands which will add time
}
