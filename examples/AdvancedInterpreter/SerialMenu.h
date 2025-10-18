/**
 * SerialMenu.h
 *
 * Menu-driven Serial Monitor interface for AdvancedInterpreter.
 * Provides user control over program execution: Run/Pause/Reset/Status.
 *
 * Simple numbered menu system for easy interaction.
 */

#pragma once

#include <Arduino.h>

// ============================================================================
// MENU COMMANDS
// ============================================================================

enum MenuCommand {
    CMD_NONE = 0,
    CMD_RUN_RESUME = 1,
    CMD_PAUSE = 2,
    CMD_RESET = 3,
    CMD_STATUS = 4,
    CMD_HELP = 5
};

// ============================================================================
// SERIAL MENU CLASS
// ============================================================================

/**
 * Menu-driven interface for interpreter control
 */
class SerialMenu {
private:
    unsigned long lastStatusTime_;
    bool autoStatus_;

public:
    SerialMenu() : lastStatusTime_(0), autoStatus_(false) {}

    /**
     * Print welcome banner
     */
    void printBanner(const String& version, const String& platform,
                     const String& mode, const String& program) {
        Serial.println();
        Serial.println("=================================================");
        Serial.print("   Arduino Advanced AST Interpreter ");
        Serial.println(version);
        Serial.println("=================================================");
        Serial.print("Platform: ");
        Serial.println(platform);
        Serial.print("Mode: ");
        Serial.println(mode);
        Serial.print("Program: ");
        Serial.println(program);
        Serial.println("=================================================");
        Serial.println();
    }

    /**
     * Print menu
     */
    void printMenu() {
        Serial.println();
        Serial.println("=============== MENU ===============");
        Serial.println("1. Run/Resume");
        Serial.println("2. Pause");
        Serial.println("3. Reset Program");
        Serial.println("4. Show Status");
        Serial.println("5. Help (this menu)");
        Serial.println("====================================");
        Serial.println();
        Serial.print("Enter command (1-5): ");
    }

    /**
     * Read and parse menu command from Serial
     * Returns MenuCommand enum value
     */
    MenuCommand readCommand() {
        if (Serial.available() == 0) {
            return CMD_NONE;
        }

        // Read until newline or timeout
        String input = Serial.readStringUntil('\n');
        input.trim();

        // Echo user input
        Serial.println(input);

        // Parse command
        if (input.length() == 0) {
            return CMD_NONE;
        }

        // Check if it's a number
        int cmd = input.toInt();
        if (cmd >= CMD_RUN_RESUME && cmd <= CMD_HELP) {
            return (MenuCommand)cmd;
        }

        // Check for letter shortcuts
        char c = input.charAt(0);
        switch (c) {
            case 'r':
            case 'R':
                return CMD_RUN_RESUME;
            case 'p':
            case 'P':
                return CMD_PAUSE;
            case 'x':
            case 'X':
                return CMD_RESET;
            case 's':
            case 'S':
                return CMD_STATUS;
            case 'h':
            case 'H':
            case '?':
                return CMD_HELP;
            default:
                Serial.print("Unknown command: ");
                Serial.println(input);
                return CMD_NONE;
        }
    }

    /**
     * Print compact status update
     */
    void printStatus(unsigned long iteration, const String& state,
                     unsigned long uptime, bool ledState,
                     unsigned long commandCount) {
        Serial.println();
        Serial.println("========== STATUS ==========");

        Serial.print("  State: ");
        Serial.println(state);

        Serial.print("  Iterations: ");
        Serial.println(iteration);

        Serial.print("  Uptime: ");
        printUptime(uptime);

        Serial.print("  Commands: ");
        Serial.println(commandCount);

        Serial.print("  LED: ");
        Serial.println(ledState ? "HIGH" : "LOW");

        Serial.println("============================");
        Serial.println();
    }

    /**
     * Print brief status line (for periodic updates)
     */
    void printBriefStatus(unsigned long iteration, unsigned long uptime) {
        Serial.print("[STATUS] Iteration: ");
        Serial.print(iteration);
        Serial.print(" | Uptime: ");
        printUptime(uptime);
        Serial.println();
    }

    /**
     * Print state change message
     */
    void printStateChange(const String& newState, const String& message = "") {
        Serial.println();
        Serial.print("[");
        Serial.print(newState);
        Serial.print("] ");
        if (message.length() > 0) {
            Serial.println(message);
        } else {
            Serial.println("State changed");
        }
        Serial.println();
    }

    /**
     * Print error message
     */
    void printError(const String& message) {
        Serial.println();
        Serial.print("✗ ERROR: ");
        Serial.println(message);
        Serial.println();
    }

    /**
     * Print success message
     */
    void printSuccess(const String& message) {
        Serial.println();
        Serial.print("✓ ");
        Serial.println(message);
        Serial.println();
    }

    /**
     * Print uptime in human-readable format
     */
    void printUptime(unsigned long ms) {
        unsigned long seconds = ms / 1000;
        unsigned long minutes = seconds / 60;
        unsigned long hours = minutes / 60;

        if (hours > 0) {
            Serial.print(hours);
            Serial.print("h ");
            Serial.print(minutes % 60);
            Serial.print("m");
        } else if (minutes > 0) {
            Serial.print(minutes);
            Serial.print("m ");
            Serial.print(seconds % 60);
            Serial.print("s");
        } else {
            Serial.print(seconds);
            Serial.print(".");
            Serial.print((ms % 1000) / 100);
            Serial.print("s");
        }
    }

    /**
     * Enable/disable automatic status updates
     */
    void setAutoStatus(bool enabled) {
        autoStatus_ = enabled;
    }

    /**
     * Check if auto status update is due
     */
    bool isAutoStatusDue(unsigned long interval) {
        if (!autoStatus_) return false;

        unsigned long now = millis();
        if (now - lastStatusTime_ >= interval) {
            lastStatusTime_ = now;
            return true;
        }
        return false;
    }

    /**
     * Print command help
     */
    void printHelp() {
        Serial.println();
        Serial.println("=============== HELP ===============");
        Serial.println("Commands:");
        Serial.println("  1 or R - Run/Resume execution");
        Serial.println("  2 or P - Pause execution");
        Serial.println("  3 or X - Reset program");
        Serial.println("  4 or S - Show status");
        Serial.println("  5 or H - Show this help");
        Serial.println();
        Serial.println("Notes:");
        Serial.println("  - Program runs infinitely when started");
        Serial.println("  - Use Pause to stop execution");
        Serial.println("  - Use Reset to restart from beginning");
        Serial.println("  - Status shows iteration count and LED state");
        Serial.println("====================================");
        Serial.println();
    }

    /**
     * Print program info (filesystem mode)
     */
    void printProgramInfo(const String& filename, size_t size) {
        Serial.println();
        Serial.print("Loaded: ");
        Serial.print(filename);
        Serial.print(" (");
        Serial.print(size);
        Serial.println(" bytes)");
        Serial.println();
    }

    /**
     * Prompt for user action
     */
    void promptForAction(const String& message) {
        Serial.println();
        Serial.print("➜ ");
        Serial.println(message);
        Serial.println();
    }
};

