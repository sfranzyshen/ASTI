/**
 * AdvancedInterpreter.ino
 *
 * Advanced demonstration of ArduinoASTInterpreter with continuous execution and menu control.
 * Hosts the REAL interpreter, processes commands, and executes on real ESP32 hardware.
 *
 * FEATURES:
 * - Continuous Loop Execution: Runs infinitely (not just once)
 * - Menu-Driven Interface: Serial Monitor control (Run/Pause/Reset/Status/Step)
 * - Real Command Processing: Executes pinMode, digitalWrite, delay on real hardware
 * - Status Updates: Periodic iteration count and uptime display
 * - Real Hardware: Blinks LED_BUILTIN at 1Hz
 * - Dual Modes: Embedded (PROGMEM) and Filesystem (LittleFS) modes
 *
 * DUAL-MODE OPERATION:
 * - Embedded Mode (USE_FILESYSTEM=false): Uses PROGMEM array (default)
 * - Filesystem Mode (USE_FILESYSTEM=true): Loads AST from LittleFS filesystem
 *
 * Hardware: Arduino Nano ESP32 (FQBN: arduino:esp32:nano_nora)
 *           8MB Flash, 8MB PSRAM, LittleFS partition
 *
 * MENU COMMANDS:
 * - 1 or R: Run/Resume execution
 * - 2 or P: Pause execution
 * - 3 or X: Reset program
 * - 4 or S: Show detailed status
 * - 5 or H: Show help menu
 * - 6 or T: Step (execute one command)
 */

#include <ArduinoASTInterpreter.h>
#include "FS.h"
#include <LittleFS.h>
#include "CommandQueue.h"
#include "CommandExecutor.h"
#include "ESP32DataProvider.h"
#include "SerialMenu.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

// Set to true to load AST from LittleFS filesystem, false for embedded mode
#define USE_FILESYSTEM false

// LittleFS filesystem configuration
#define LITTLEFS_FORMAT_ON_FAIL true

// Default AST file to load (filesystem mode only)
#define DEFAULT_AST_FILE "/blink.ast"

// LED pin for Blink program
#define BLINK_LED LED_BUILTIN

// Status update interval (milliseconds)
#define STATUS_UPDATE_INTERVAL 10000  // Status every 10 seconds

// ============================================================================
// EMBEDDED MODE AST BINARY - Blink.ino
// ============================================================================

// Pre-compiled CompactAST binary for Blink.ino:
//   void setup() {
//     pinMode(LED_BUILTIN, OUTPUT);
//   }
//   void loop() {
//     digitalWrite(LED_BUILTIN, HIGH);
//     delay(1000);
//     digitalWrite(LED_BUILTIN, LOW);
//     delay(1000);
//   }
//
// Generated from: examples/AdvancedInterpreter/data/blink.ast
// Size: 1389 bytes (example placeholder - replace with actual blink.ast binary)
const uint8_t PROGMEM astBinary[] = {
  // TODO: Replace with actual blink.ast binary data
  // For now, using BareMinimum as placeholder
  0x41, 0x53, 0x54, 0x50, 0x00, 0x01, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00,
  0x1c, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x76, 0x6f,
  0x69, 0x64, 0x00, 0x05, 0x00, 0x73, 0x65, 0x74, 0x75, 0x70, 0x00, 0x04,
  0x00, 0x6c, 0x6f, 0x6f, 0x70, 0x00, 0x00, 0x00, 0x01, 0x01, 0x04, 0x00,
  0x01, 0x00, 0x05, 0x00, 0x21, 0x01, 0x06, 0x00, 0x02, 0x00, 0x03, 0x00,
  0x04, 0x00, 0x50, 0x02, 0x03, 0x00, 0x0c, 0x00, 0x00, 0x51, 0x02, 0x03,
  0x00, 0x0c, 0x01, 0x00, 0x10, 0x00, 0x00, 0x00, 0x21, 0x01, 0x06, 0x00,
  0x06, 0x00, 0x07, 0x00, 0x08, 0x00, 0x50, 0x02, 0x03, 0x00, 0x0c, 0x00,
  0x00, 0x51, 0x02, 0x03, 0x00, 0x0c, 0x02, 0x00, 0x10, 0x00, 0x00, 0x00
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Execution state
enum ExecutionState {
    STATE_STOPPED,
    STATE_RUNNING,
    STATE_PAUSED,
    STATE_STEP_MODE
};

ExecutionState state = STATE_STOPPED;
unsigned long loopIteration = 0;
unsigned long startTime = 0;
unsigned long commandsExecuted = 0;
unsigned long lastStatusTime = 0;

// Components
SerialMenu menu;
CommandQueue commandQueue;
CommandExecutor executor;
ESP32DataProvider dataProvider;
ASTInterpreter* interpreter = nullptr;
uint8_t* astBuffer = nullptr;

// ============================================================================
// FILESYSTEM HELPER FUNCTIONS
// ============================================================================

bool initFilesystem() {
    Serial.println("Initializing LittleFS filesystem...");

    if (!LittleFS.begin(LITTLEFS_FORMAT_ON_FAIL)) {
        Serial.println("✗ ERROR: LittleFS mount failed");
        return false;
    }

    Serial.println("✓ LittleFS mounted successfully");
    return true;
}

uint8_t* readASTFromFile(const char* path, size_t* size) {
    Serial.print("Reading AST file: ");
    Serial.println(path);

    File file = LittleFS.open(path, "r");
    if (!file) {
        Serial.println("✗ ERROR: Failed to open file");
        return nullptr;
    }

    *size = file.size();
    Serial.print("  File size: ");
    Serial.print(*size);
    Serial.println(" bytes");

    uint8_t* buffer = (uint8_t*)malloc(*size);
    if (!buffer) {
        Serial.println("✗ ERROR: Memory allocation failed");
        file.close();
        return nullptr;
    }

    size_t bytesRead = file.read(buffer, *size);
    file.close();

    if (bytesRead != *size) {
        Serial.println("✗ ERROR: Read mismatch");
        free(buffer);
        return nullptr;
    }

    Serial.println("✓ File read successfully");
    return buffer;
}

// ============================================================================
// INTERPRETER MANAGEMENT
// ============================================================================

void resetInterpreter() {
    Serial.println("[RESET] Resetting interpreter state...");

    if (interpreter) {
        delete interpreter;
        interpreter = nullptr;
    }

    commandQueue.clear();
    loopIteration = 0;
    commandsExecuted = 0;
    startTime = millis();

    // Configure interpreter options
    InterpreterOptions opts;
    opts.verbose = false;     // Status-only mode (no command stream to Serial)
    opts.debug = false;
    opts.maxLoopIterations = 0;  // Infinite loop (0 = no limit)
    opts.syncMode = true;

    const uint8_t* astData = nullptr;
    size_t astSize = 0;
    bool useFilesystem = USE_FILESYSTEM;

    // Load AST from filesystem or embedded
    #if USE_FILESYSTEM
    {
        if (astBuffer) {
            free(astBuffer);
            astBuffer = nullptr;
        }

        if (initFilesystem()) {
            astBuffer = readASTFromFile(DEFAULT_AST_FILE, &astSize);
            if (astBuffer) {
                astData = astBuffer;
            } else {
                Serial.println("⚠ WARNING: Falling back to embedded mode");
                useFilesystem = false;
            }
        } else {
            useFilesystem = false;
        }
    }
    #endif

    if (!useFilesystem) {
        astData = astBinary;
        astSize = sizeof(astBinary);
    }

    // Create interpreter
    Serial.println("Creating interpreter...");
    interpreter = new ASTInterpreter(astData, astSize, opts);

    if (!interpreter) {
        Serial.println("✗ ERROR: Failed to create interpreter");
        return;
    }

    // Free filesystem buffer (interpreter has internal copy)
    if (useFilesystem && astBuffer) {
        free(astBuffer);
        astBuffer = nullptr;
    }

    // Connect providers
    interpreter->setSyncDataProvider(&dataProvider);
    interpreter->setCommandCallback(&commandQueue);

    Serial.println("✓ Interpreter reset complete");
}

void startExecution() {
    if (!interpreter) {
        menu.printError("Interpreter not initialized");
        return;
    }

    if (state == STATE_RUNNING) {
        menu.printSuccess("Already running");
        return;
    }

    Serial.println("[STARTING] Beginning program execution...");

    // Start interpreter (executes setup() and first loop iteration)
    if (!interpreter->start()) {
        menu.printError("Failed to start interpreter");
        return;
    }

    state = STATE_RUNNING;
    startTime = millis();
    menu.printStateChange("RUNNING", "Execution started");
}

void pauseExecution() {
    if (state != STATE_RUNNING && state != STATE_STEP_MODE) {
        menu.printSuccess("Already paused");
        return;
    }

    state = STATE_PAUSED;
    String msg = "Paused at iteration " + String(loopIteration);
    menu.printStateChange("PAUSED", msg);
}

void resumeExecution() {
    if (state == STATE_RUNNING) {
        menu.printSuccess("Already running");
        return;
    }

    state = STATE_RUNNING;
    menu.printStateChange("RUNNING", "Execution resumed");
}

void executeOneCommand() {
    if (!commandQueue.hasCommands()) {
        // No commands queued - ask interpreter to resume and generate more
        if (interpreter) {
            interpreter->resume();
            loopIteration++;
        }
    }

    if (commandQueue.hasCommands()) {
        String cmd = commandQueue.pop();
        executor.execute(cmd);
        commandsExecuted++;

        Serial.print("[STEP] Executed: ");
        Serial.println(cmd);
    } else {
        Serial.println("[STEP] No commands available");
    }
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    // Configure LED pin
    pinMode(BLINK_LED, OUTPUT);
    digitalWrite(BLINK_LED, LOW);

    // Print banner
    #if USE_FILESYSTEM
        menu.printBanner("21.2.1", PLATFORM_NAME, "Filesystem", "Blink (LED_BUILTIN)");
    #else
        menu.printBanner("21.2.1", PLATFORM_NAME, "Embedded", "Blink (LED_BUILTIN)");
    #endif

    // Initialize interpreter
    resetInterpreter();

    // Print menu
    menu.printMenu();
}

// ============================================================================
// LOOP
// ============================================================================

void loop() {
    // Check for menu commands
    MenuCommand cmd = menu.readCommand();

    switch (cmd) {
        case CMD_RUN_RESUME:
            if (state == STATE_STOPPED) {
                startExecution();
            } else {
                resumeExecution();
            }
            break;

        case CMD_PAUSE:
            pauseExecution();
            break;

        case CMD_RESET:
            state = STATE_STOPPED;
            resetInterpreter();
            menu.printStateChange("STOPPED", "Program reset complete");
            break;

        case CMD_STATUS:
            {
                String stateStr;
                switch (state) {
                    case STATE_STOPPED: stateStr = "STOPPED"; break;
                    case STATE_RUNNING: stateStr = "RUNNING"; break;
                    case STATE_PAUSED: stateStr = "PAUSED"; break;
                    case STATE_STEP_MODE: stateStr = "STEP"; break;
                }

                unsigned long uptime = millis() - startTime;
                bool ledState = digitalRead(BLINK_LED);
                menu.printStatus(loopIteration, stateStr, uptime, ledState, commandsExecuted);
            }
            break;

        case CMD_HELP:
            menu.printHelp();
            menu.printMenu();
            break;

        case CMD_STEP:
            state = STATE_STEP_MODE;
            executeOneCommand();
            break;

        case CMD_NONE:
            // No command - continue normal operation
            break;
    }

    // Process execution based on state
    if (state == STATE_RUNNING) {
        // Generate commands if queue is empty
        if (!commandQueue.hasCommands()) {
            if (interpreter) {
                interpreter->resume();  // Generate next loop iteration
                loopIteration++;
            }
        }

        // Execute all queued commands
        while (commandQueue.hasCommands()) {
            String cmd = commandQueue.pop();
            executor.execute(cmd);
            commandsExecuted++;
        }

        // Periodic status updates
        unsigned long now = millis();
        if (now - lastStatusTime >= STATUS_UPDATE_INTERVAL) {
            lastStatusTime = now;
            unsigned long uptime = now - startTime;
            menu.printBriefStatus(loopIteration, uptime);
        }
    }

    // Small delay to prevent CPU spinning
    delay(1);
}
