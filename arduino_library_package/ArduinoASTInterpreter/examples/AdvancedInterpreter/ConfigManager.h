/**
 * ConfigManager.h
 *
 * Persistent configuration management for AdvancedInterpreter.
 * Uses ESP32 Preferences (NVS) for storing settings that persist across reboots.
 *
 * Features:
 * - Auto-start configuration
 * - Default AST file selection
 * - Status update interval configuration
 * - Load/save configuration
 * - Factory reset capability
 * - Validation and bounds checking
 */

#pragma once

#include <Arduino.h>
#include <Preferences.h>

// ============================================================================
// CONFIGURATION STRUCTURE
// ============================================================================

/**
 * Runtime configuration structure
 */
struct InterpreterConfig {
    bool autoStartEnabled;              // Auto-start interpreter on boot
    String defaultAstFile;              // Default AST file to load
    unsigned long statusUpdateInterval; // Status update interval (milliseconds)
    bool webInterfaceEnabled;           // Enable web interface (for future use)

    // Constructor with defaults
    InterpreterConfig() :
        autoStartEnabled(false),
        defaultAstFile("/blink.ast"),
        statusUpdateInterval(1000),
        webInterfaceEnabled(true) {}
};

// ============================================================================
// CONFIGURATION MANAGER CLASS
// ============================================================================

/**
 * Manages persistent configuration using NVS (Non-Volatile Storage)
 */
class ConfigManager {
private:
    Preferences prefs_;
    InterpreterConfig config_;
    bool initialized_;

    // Configuration keys
    static constexpr const char* NAMESPACE = "ast_interp";
    static constexpr const char* KEY_AUTO_START = "autoStart";
    static constexpr const char* KEY_DEFAULT_FILE = "defaultFile";
    static constexpr const char* KEY_STATUS_INTERVAL = "statusInt";
    static constexpr const char* KEY_WEB_ENABLED = "webEnabled";

    // Validation constants
    static constexpr unsigned long MIN_STATUS_INTERVAL = 100;    // 100ms minimum
    static constexpr unsigned long MAX_STATUS_INTERVAL = 60000;  // 60s maximum
    static constexpr size_t MAX_FILENAME_LENGTH = 64;            // Maximum file path length

    /**
     * Validate status update interval
     */
    bool validateInterval(unsigned long interval) const {
        return interval >= MIN_STATUS_INTERVAL && interval <= MAX_STATUS_INTERVAL;
    }

    /**
     * Validate AST filename
     */
    bool validateFilename(const String& filename) const {
        if (filename.length() == 0 || filename.length() > MAX_FILENAME_LENGTH) {
            return false;
        }

        // Must start with '/'
        if (!filename.startsWith("/")) {
            return false;
        }

        // Must end with '.ast'
        if (!filename.endsWith(".ast")) {
            return false;
        }

        return true;
    }

public:
    ConfigManager() : initialized_(false) {}

    /**
     * Initialize configuration manager and load settings
     */
    bool begin() {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   Configuration Manager");
        Serial.println("=================================================");

        // Open preferences in read-write mode
        if (!prefs_.begin(NAMESPACE, false)) {
            Serial.println("✗ ERROR: Failed to open preferences");
            return false;
        }

        Serial.println("✓ Preferences opened successfully");

        // Load configuration from NVS
        loadConfig();

        initialized_ = true;

        // Print current configuration
        printConfig();

        Serial.println("=================================================");
        Serial.println();

        return true;
    }

    /**
     * Load configuration from NVS
     */
    void loadConfig() {
        // Load auto-start setting
        config_.autoStartEnabled = prefs_.getBool(KEY_AUTO_START, false);

        // Load default AST file
        config_.defaultAstFile = prefs_.getString(KEY_DEFAULT_FILE, "/blink.ast");
        if (!validateFilename(config_.defaultAstFile)) {
            Serial.println("⚠ WARNING: Invalid default file in config, using default");
            config_.defaultAstFile = "/blink.ast";
        }

        // Load status update interval
        config_.statusUpdateInterval = prefs_.getULong(KEY_STATUS_INTERVAL, 1000);
        if (!validateInterval(config_.statusUpdateInterval)) {
            Serial.println("⚠ WARNING: Invalid status interval in config, using default");
            config_.statusUpdateInterval = 1000;
        }

        // Load web interface enabled flag
        config_.webInterfaceEnabled = prefs_.getBool(KEY_WEB_ENABLED, true);

        Serial.println("✓ Configuration loaded from NVS");
    }

    /**
     * Save configuration to NVS
     */
    bool saveConfig() {
        if (!initialized_) {
            Serial.println("✗ ERROR: ConfigManager not initialized");
            return false;
        }

        // Validate before saving
        if (!validateFilename(config_.defaultAstFile)) {
            Serial.println("✗ ERROR: Invalid default file, not saving");
            return false;
        }

        if (!validateInterval(config_.statusUpdateInterval)) {
            Serial.println("✗ ERROR: Invalid status interval, not saving");
            return false;
        }

        // Save to NVS
        prefs_.putBool(KEY_AUTO_START, config_.autoStartEnabled);
        prefs_.putString(KEY_DEFAULT_FILE, config_.defaultAstFile);
        prefs_.putULong(KEY_STATUS_INTERVAL, config_.statusUpdateInterval);
        prefs_.putBool(KEY_WEB_ENABLED, config_.webInterfaceEnabled);

        Serial.println("✓ Configuration saved to NVS");
        printConfig();

        return true;
    }

    /**
     * Factory reset - restore default configuration
     */
    void factoryReset() {
        Serial.println();
        Serial.println("========== Factory Reset ==========");

        // Clear all preferences
        prefs_.clear();

        // Restore defaults
        config_ = InterpreterConfig();

        // Save defaults to NVS
        saveConfig();

        Serial.println("✓ Configuration reset to defaults");
        Serial.println("===================================");
        Serial.println();
    }

    /**
     * Print current configuration
     */
    void printConfig() const {
        Serial.println();
        Serial.println("========== Current Configuration ==========");
        Serial.print("  Auto-start: ");
        Serial.println(config_.autoStartEnabled ? "Enabled" : "Disabled");
        Serial.print("  Default file: ");
        Serial.println(config_.defaultAstFile);
        Serial.print("  Status interval: ");
        Serial.print(config_.statusUpdateInterval);
        Serial.println(" ms");
        Serial.print("  Web interface: ");
        Serial.println(config_.webInterfaceEnabled ? "Enabled" : "Disabled");
        Serial.println("===========================================");
        Serial.println();
    }

    /**
     * Get current configuration (read-only)
     */
    const InterpreterConfig& getConfig() const {
        return config_;
    }

    /**
     * Update configuration (call saveConfig() to persist)
     */
    void updateConfig(const InterpreterConfig& newConfig) {
        config_ = newConfig;
    }

    /**
     * Set auto-start enabled
     */
    void setAutoStart(bool enabled) {
        config_.autoStartEnabled = enabled;
    }

    /**
     * Get auto-start enabled
     */
    bool isAutoStartEnabled() const {
        return config_.autoStartEnabled;
    }

    /**
     * Set default AST file
     */
    bool setDefaultFile(const String& filename) {
        if (!validateFilename(filename)) {
            Serial.println("✗ ERROR: Invalid filename");
            return false;
        }
        config_.defaultAstFile = filename;
        return true;
    }

    /**
     * Get default AST file
     */
    String getDefaultFile() const {
        return config_.defaultAstFile;
    }

    /**
     * Set status update interval
     */
    bool setStatusInterval(unsigned long interval) {
        if (!validateInterval(interval)) {
            Serial.println("✗ ERROR: Invalid interval (must be 100-60000ms)");
            return false;
        }
        config_.statusUpdateInterval = interval;
        return true;
    }

    /**
     * Get status update interval
     */
    unsigned long getStatusInterval() const {
        return config_.statusUpdateInterval;
    }

    /**
     * Set web interface enabled
     */
    void setWebInterfaceEnabled(bool enabled) {
        config_.webInterfaceEnabled = enabled;
    }

    /**
     * Get web interface enabled
     */
    bool isWebInterfaceEnabled() const {
        return config_.webInterfaceEnabled;
    }

    /**
     * Export configuration as JSON string
     */
    String toJSON() const {
        String json = "{";
        json += "\"autoStart\":";
        json += config_.autoStartEnabled ? "true" : "false";
        json += ",\"defaultFile\":\"";
        json += config_.defaultAstFile;
        json += "\",\"statusInterval\":";
        json += String(config_.statusUpdateInterval);
        json += ",\"webEnabled\":";
        json += config_.webInterfaceEnabled ? "true" : "false";
        json += "}";
        return json;
    }

    /**
     * Close preferences (call in destructor or when done)
     */
    void end() {
        if (initialized_) {
            prefs_.end();
            initialized_ = false;
        }
    }

    /**
     * Destructor
     */
    ~ConfigManager() {
        end();
    }
};
