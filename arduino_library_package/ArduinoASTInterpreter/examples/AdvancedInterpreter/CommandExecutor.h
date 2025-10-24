/**
 * CommandExecutor.h
 *
 * Parses JSON commands from interpreter and executes on real hardware.
 * Supports core Arduino operations: pinMode, digitalWrite, analogWrite, delay, etc.
 *
 * Lightweight JSON parsing without external libraries - extracts only needed fields.
 */

#pragma once

#include <Arduino.h>

// ============================================================================
// SIMPLE JSON PARSER
// ============================================================================

/**
 * Extract string value from JSON by key
 * Example: extractString(json, "type") from {"type":"DELAY"} returns "DELAY"
 */
String extractString(const String& json, const String& key) {
    String searchKey = "\"" + key + "\"";
    int keyPos = json.indexOf(searchKey);
    if (keyPos == -1) return "";

    int colonPos = json.indexOf(':', keyPos);
    if (colonPos == -1) return "";

    int startQuote = json.indexOf('"', colonPos);
    if (startQuote == -1) return "";

    int endQuote = json.indexOf('"', startQuote + 1);
    if (endQuote == -1) return "";

    return json.substring(startQuote + 1, endQuote);
}

/**
 * Extract integer value from JSON by key
 * Example: extractInt(json, "pin") from {"pin":13} returns 13
 */
int extractInt(const String& json, const String& key) {
    String searchKey = "\"" + key + "\"";
    int keyPos = json.indexOf(searchKey);
    if (keyPos == -1) return 0;

    int colonPos = json.indexOf(':', keyPos);
    if (colonPos == -1) return 0;

    // Skip whitespace after colon
    int valueStart = colonPos + 1;
    while (valueStart < json.length() && (json[valueStart] == ' ' || json[valueStart] == '\t')) {
        valueStart++;
    }

    // Extract number (stop at comma, brace, or end)
    String valueStr = "";
    for (int i = valueStart; i < json.length(); i++) {
        char c = json[i];
        if (c >= '0' && c <= '9') {
            valueStr += c;
        } else if (c == '-' && valueStr.length() == 0) {
            valueStr += c;  // Negative number
        } else {
            break;  // End of number
        }
    }

    return valueStr.toInt();
}

/**
 * Extract unsigned long value from JSON by key
 * Example: extractULong(json, "duration") from {"duration":1000} returns 1000
 */
unsigned long extractULong(const String& json, const String& key) {
    // Same as extractInt but cast to unsigned long
    String searchKey = "\"" + key + "\"";
    int keyPos = json.indexOf(searchKey);
    if (keyPos == -1) return 0;

    int colonPos = json.indexOf(':', keyPos);
    if (colonPos == -1) return 0;

    int valueStart = colonPos + 1;
    while (valueStart < json.length() && (json[valueStart] == ' ' || json[valueStart] == '\t')) {
        valueStart++;
    }

    String valueStr = "";
    for (int i = valueStart; i < json.length(); i++) {
        char c = json[i];
        if (c >= '0' && c <= '9') {
            valueStr += c;
        } else {
            break;
        }
    }

    return (unsigned long)valueStr.toInt();
}

// ============================================================================
// COMMAND EXECUTOR CLASS
// ============================================================================

/**
 * Executes interpreter commands on real ESP32 hardware
 */
class CommandExecutor {
private:
    // Execution statistics
    unsigned long commandsExecuted_;
    unsigned long lastCommandTime_;
    String lastCommandType_;

    // Hardware state tracking
    bool ledState_;
    int lastPin_;
    int lastValue_;

public:
    CommandExecutor()
        : commandsExecuted_(0), lastCommandTime_(0), lastCommandType_(""),
          ledState_(false), lastPin_(-1), lastValue_(0) {}

    /**
     * Execute a JSON command
     * Returns true if command was recognized and executed
     */
    bool execute(const String& jsonCommand) {
        if (jsonCommand.length() == 0) return false;

        // Extract command type
        String type = extractString(jsonCommand, "type");
        if (type.length() == 0) return false;

        // DEBUG: Show ALL commands being executed
        Serial.print("[EXEC] type=");
        Serial.println(type);

        // Update statistics
        lastCommandType_ = type;
        lastCommandTime_ = millis();
        commandsExecuted_++;

        // Execute based on type
        if (type == "PIN_MODE") {
            return executePinMode(jsonCommand);
        } else if (type == "DIGITAL_WRITE") {
            return executeDigitalWrite(jsonCommand);
        } else if (type == "ANALOG_WRITE") {
            return executeAnalogWrite(jsonCommand);
        } else if (type == "DELAY") {
            return executeDelay(jsonCommand);
        } else if (type == "DELAY_MICROSECONDS") {
            return executeDelayMicroseconds(jsonCommand);
        } else if (type == "SETUP_START" || type == "SETUP_END" ||
                   type == "LOOP_START" || type == "LOOP_END" ||
                   type == "PROGRAM_START" || type == "PROGRAM_END" ||
                   type == "VERSION_INFO") {
            // Informational commands - just acknowledge
            return true;
        }

        // Unknown command type
        Serial.print("[EXEC] UNKNOWN type=");
        Serial.println(type);
        return false;
    }

    /**
     * Execute PIN_MODE command
     * JSON: {"type":"PIN_MODE","pin":13,"mode":1}
     */
    bool executePinMode(const String& json) {
        int pin = extractInt(json, "pin");
        int mode = extractInt(json, "mode");

        if (pin < 0) return false;

        // Convert mode number to Arduino constants
        uint8_t arduinoMode;
        switch (mode) {
            case 0: arduinoMode = INPUT; break;
            case 1: arduinoMode = OUTPUT; break;
            case 2: arduinoMode = INPUT_PULLUP; break;
            default: return false;
        }

        pinMode(pin, arduinoMode);
        lastPin_ = pin;
        return true;
    }

    /**
     * Execute DIGITAL_WRITE command
     * JSON: {"type":"DIGITAL_WRITE","pin":13,"value":1}
     */
    bool executeDigitalWrite(const String& json) {
        int pin = extractInt(json, "pin");
        int value = extractInt(json, "value");

        if (pin < 0) return false;

        digitalWrite(pin, value ? HIGH : LOW);

        Serial.print("[DWRITE] pin=");
        Serial.print(pin);
        Serial.print(" val=");
        Serial.println(value);

        lastPin_ = pin;
        lastValue_ = value;
        if (pin == LED_BUILTIN) {
            ledState_ = (value != 0);
        }

        return true;
    }

    /**
     * Execute ANALOG_WRITE command
     * JSON: {"type":"ANALOG_WRITE","pin":13,"value":128}
     */
    bool executeAnalogWrite(const String& json) {
        int pin = extractInt(json, "pin");
        int value = extractInt(json, "value");

        if (pin < 0 || value < 0 || value > 255) return false;

        analogWrite(pin, value);

        lastPin_ = pin;
        lastValue_ = value;

        return true;
    }

    /**
     * Execute DELAY command
     * JSON: {"type":"DELAY","duration":1000}
     */
    bool executeDelay(const String& json) {
        unsigned long duration = extractULong(json, "duration");

        if (duration > 0) {
            delay(duration);
        }

        return true;
    }

    /**
     * Execute DELAY_MICROSECONDS command
     * JSON: {"type":"DELAY_MICROSECONDS","duration":100}
     */
    bool executeDelayMicroseconds(const String& json) {
        unsigned long duration = extractULong(json, "duration");

        if (duration > 0) {
            delayMicroseconds(duration);
        }

        return true;
    }

    // ========================================================================
    // STATISTICS AND STATE
    // ========================================================================

    /**
     * Get total commands executed
     */
    unsigned long getCommandCount() const {
        return commandsExecuted_;
    }

    /**
     * Get last command type executed
     */
    String getLastCommandType() const {
        return lastCommandType_;
    }

    /**
     * Get time of last command execution
     */
    unsigned long getLastCommandTime() const {
        return lastCommandTime_;
    }

    /**
     * Get current LED state (if tracking LED_BUILTIN)
     */
    bool getLEDState() const {
        return ledState_;
    }

    /**
     * Get last pin operated on
     */
    int getLastPin() const {
        return lastPin_;
    }

    /**
     * Get last value written
     */
    int getLastValue() const {
        return lastValue_;
    }

    /**
     * Reset statistics
     */
    void reset() {
        commandsExecuted_ = 0;
        lastCommandTime_ = 0;
        lastCommandType_ = "";
        ledState_ = false;
        lastPin_ = -1;
        lastValue_ = 0;
    }
};

