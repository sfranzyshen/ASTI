/**
 * WebAPI.h
 *
 * RESTful API handlers for AdvancedInterpreter web interface.
 * Provides HTTP endpoints for control, status, file management, and configuration.
 *
 * API Endpoints:
 * - GET  /api/status          - Get current execution status
 * - POST /api/control/run     - Start/resume execution
 * - POST /api/control/pause   - Pause execution
 * - POST /api/control/reset   - Reset interpreter
 * - POST /api/control/step    - Execute one step
 * - GET  /api/files           - List .ast files
 * - POST /api/files/load      - Load specific .ast file
 * - DELETE /api/files/:name   - Delete .ast file
 * - GET  /api/config          - Get configuration
 * - POST /api/config          - Update configuration
 */

#pragma once

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "ConfigManager.h"

// Forward declarations (these will be defined in AdvancedInterpreter.ino)
extern AppExecutionState state;
extern unsigned long loopIteration;
extern unsigned long startTime;
extern unsigned long commandsExecuted;
extern ASTInterpreter* interpreter;
extern ConfigManager configManager;
extern ImmediateCommandExecutor immediateExecutor;

// Function pointers for control actions (will be set by AdvancedInterpreter.ino)
extern void startExecution();
extern void pauseExecution();
extern void resumeExecution();
extern void resetInterpreter();
extern void executeOneCommand();

// ============================================================================
// WEB API CLASS
// ============================================================================

/**
 * RESTful API handler for web interface
 */
class WebAPI {
private:
    AsyncWebServer* server_;
    bool filesystemEnabled_;

    /**
     * Add CORS headers to response
     */
    void addCORSHeaders(AsyncWebServerResponse* response) {
        response->addHeader("Access-Control-Allow-Origin", "*");
        response->addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        response->addHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    /**
     * Create JSON error response
     */
    String createErrorJSON(const String& message) {
        StaticJsonDocument<256> doc;
        doc["success"] = false;
        doc["error"] = message;

        String output;
        serializeJson(doc, output);
        return output;
    }

    /**
     * Create JSON success response
     */
    String createSuccessJSON(const String& message = "") {
        StaticJsonDocument<256> doc;
        doc["success"] = true;
        if (message.length() > 0) {
            doc["message"] = message;
        }

        String output;
        serializeJson(doc, output);
        return output;
    }

    /**
     * Get state as string
     */
    String getStateString() const {
        switch (state) {
            case STATE_STOPPED: return "stopped";
            case STATE_RUNNING: return "running";
            case STATE_PAUSED: return "paused";
            case STATE_STEP_MODE: return "step";
            default: return "unknown";
        }
    }

    /**
     * Format uptime as string
     */
    String formatUptime(unsigned long ms) const {
        unsigned long seconds = ms / 1000;
        unsigned long minutes = seconds / 60;
        unsigned long hours = minutes / 60;

        char buffer[32];
        if (hours > 0) {
            snprintf(buffer, sizeof(buffer), "%luh %lum %lus",
                    hours, minutes % 60, seconds % 60);
        } else if (minutes > 0) {
            snprintf(buffer, sizeof(buffer), "%lum %lus",
                    minutes, seconds % 60);
        } else {
            snprintf(buffer, sizeof(buffer), "%lu.%lus",
                    seconds, (ms % 1000) / 100);
        }
        return String(buffer);
    }

    /**
     * Get status endpoint: GET /api/status
     */
    void handleGetStatus(AsyncWebServerRequest* request) {
        StaticJsonDocument<512> doc;

        doc["state"] = getStateString();
        doc["iteration"] = loopIteration;
        doc["uptime"] = millis() - startTime;
        doc["uptimeStr"] = formatUptime(millis() - startTime);
        doc["commandsExecuted"] = commandsExecuted;
        doc["memoryFree"] = ESP.getFreeHeap();
        doc["filesystemEnabled"] = filesystemEnabled_;
        doc["timestamp"] = millis();

        String output;
        serializeJson(doc, output);

        auto response = request->beginResponse(200, "application/json", output);
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Control run endpoint: POST /api/control/run
     */
    void handleControlRun(AsyncWebServerRequest* request) {
        if (state == STATE_STOPPED) {
            startExecution();
        } else if (state == STATE_PAUSED || state == STATE_STEP_MODE) {
            resumeExecution();
        }

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("Execution started/resumed"));
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Control pause endpoint: POST /api/control/pause
     */
    void handleControlPause(AsyncWebServerRequest* request) {
        pauseExecution();

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("Execution paused"));
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Control reset endpoint: POST /api/control/reset
     */
    void handleControlReset(AsyncWebServerRequest* request) {
        state = STATE_STOPPED;
        resetInterpreter();

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("Interpreter reset"));
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Control step endpoint: POST /api/control/step
     */
    void handleControlStep(AsyncWebServerRequest* request) {
        state = STATE_STEP_MODE;
        executeOneCommand();

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("Step executed"));
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Get files endpoint: GET /api/files
     */
    void handleGetFiles(AsyncWebServerRequest* request) {
        // Check if filesystem is available
        if (!filesystemEnabled_) {
            auto response = request->beginResponse(503, "application/json",
                                                  createErrorJSON("Filesystem not available. Set USE_FILESYSTEM=true and upload files to enable file management."));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        DynamicJsonDocument doc(2048);
        JsonArray files = doc.createNestedArray("files");

        File root = LittleFS.open("/");
        if (!root || !root.isDirectory()) {
            auto response = request->beginResponse(500, "application/json",
                                                  createErrorJSON("Failed to open root directory"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        // Iterate through all files
        File file = root.openNextFile();
        while (file) {
            String filename = file.name();

            // Only include .ast files
            if (filename.endsWith(".ast")) {
                JsonObject fileObj = files.createNestedObject();
                fileObj["name"] = filename;
                fileObj["size"] = file.size();
                fileObj["path"] = String("/") + filename;
            }

            file = root.openNextFile();
        }

        doc["count"] = files.size();

        String output;
        serializeJson(doc, output);

        auto response = request->beginResponse(200, "application/json", output);
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Load file endpoint: POST /api/files/load
     * Body: {"filename": "/path/to/file.ast"}
     */
    void handleLoadFile(AsyncWebServerRequest* request, uint8_t* data, size_t len,
                       size_t index, size_t total) {
        // Check if filesystem is available
        if (!filesystemEnabled_) {
            auto response = request->beginResponse(503, "application/json",
                                                  createErrorJSON("Filesystem not available. Set USE_FILESYSTEM=true and upload files to enable file management."));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        // This will be called with the complete body
        // Parse JSON body
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, data, len);

        if (error) {
            auto response = request->beginResponse(400, "application/json",
                                                  createErrorJSON("Invalid JSON"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        String filename = doc["filename"] | "";
        if (filename.length() == 0) {
            auto response = request->beginResponse(400, "application/json",
                                                  createErrorJSON("Missing filename"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        // Check if file exists
        if (!LittleFS.exists(filename)) {
            auto response = request->beginResponse(404, "application/json",
                                                  createErrorJSON("File not found"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        // Reset and reload interpreter with new file
        // TODO: Implement file loading logic in main sketch
        Serial.print("[API] Loading file: ");
        Serial.println(filename);

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("File loaded: " + filename));
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Delete file endpoint: DELETE /api/files/:name
     */
    void handleDeleteFile(AsyncWebServerRequest* request) {
        // Check if filesystem is available
        if (!filesystemEnabled_) {
            auto response = request->beginResponse(503, "application/json",
                                                  createErrorJSON("Filesystem not available. Set USE_FILESYSTEM=true and upload files to enable file management."));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        if (!request->hasParam("name")) {
            auto response = request->beginResponse(400, "application/json",
                                                  createErrorJSON("Missing filename"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        String filename = request->getParam("name")->value();

        // Add leading slash if not present
        if (!filename.startsWith("/")) {
            filename = "/" + filename;
        }

        // Check if file exists
        if (!LittleFS.exists(filename)) {
            auto response = request->beginResponse(404, "application/json",
                                                  createErrorJSON("File not found"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        // Delete file
        if (!LittleFS.remove(filename)) {
            auto response = request->beginResponse(500, "application/json",
                                                  createErrorJSON("Failed to delete file"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        Serial.print("[API] Deleted file: ");
        Serial.println(filename);

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("File deleted: " + filename));
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Get config endpoint: GET /api/config
     */
    void handleGetConfig(AsyncWebServerRequest* request) {
        String configJSON = configManager.toJSON();

        auto response = request->beginResponse(200, "application/json", configJSON);
        addCORSHeaders(response);
        request->send(response);
    }

    /**
     * Update config endpoint: POST /api/config
     * Body: {"autoStart": true, "defaultFile": "/blink.ast", "statusInterval": 1000}
     */
    void handleUpdateConfig(AsyncWebServerRequest* request, uint8_t* data, size_t len,
                           size_t index, size_t total) {
        // Parse JSON body
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, data, len);

        if (error) {
            auto response = request->beginResponse(400, "application/json",
                                                  createErrorJSON("Invalid JSON"));
            addCORSHeaders(response);
            request->send(response);
            return;
        }

        // Update configuration
        bool changed = false;

        if (doc.containsKey("autoStart")) {
            configManager.setAutoStart(doc["autoStart"]);
            changed = true;
        }

        if (doc.containsKey("defaultFile")) {
            String defaultFile = doc["defaultFile"];
            if (configManager.setDefaultFile(defaultFile)) {
                changed = true;
            }
        }

        if (doc.containsKey("statusInterval")) {
            unsigned long interval = doc["statusInterval"];
            if (configManager.setStatusInterval(interval)) {
                changed = true;
            }
        }

        // Save configuration
        if (changed) {
            if (!configManager.saveConfig()) {
                auto response = request->beginResponse(500, "application/json",
                                                      createErrorJSON("Failed to save configuration"));
                addCORSHeaders(response);
                request->send(response);
                return;
            }
        }

        auto response = request->beginResponse(200, "application/json",
                                              createSuccessJSON("Configuration updated"));
        addCORSHeaders(response);
        request->send(response);
    }

public:
    WebAPI() : server_(nullptr), filesystemEnabled_(false) {}

    /**
     * Initialize API handlers
     */
    void begin(AsyncWebServer* server) {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   Web API Initialization");
        Serial.println("=================================================");

        server_ = server;

        // Status endpoint
        server_->on("/api/status", HTTP_GET, [this](AsyncWebServerRequest* request) {
            handleGetStatus(request);
        });

        // Control endpoints
        server_->on("/api/control/run", HTTP_POST, [this](AsyncWebServerRequest* request) {
            handleControlRun(request);
        });

        server_->on("/api/control/pause", HTTP_POST, [this](AsyncWebServerRequest* request) {
            handleControlPause(request);
        });

        server_->on("/api/control/reset", HTTP_POST, [this](AsyncWebServerRequest* request) {
            handleControlReset(request);
        });

        server_->on("/api/control/step", HTTP_POST, [this](AsyncWebServerRequest* request) {
            handleControlStep(request);
        });

        // Files list endpoint
        server_->on("/api/files", HTTP_GET, [this](AsyncWebServerRequest* request) {
            handleGetFiles(request);
        });

        // Files load endpoint (with body)
        server_->on("/api/files/load", HTTP_POST,
                   [](AsyncWebServerRequest* request) {},
                   nullptr,
                   [this](AsyncWebServerRequest* request, uint8_t* data, size_t len,
                         size_t index, size_t total) {
            handleLoadFile(request, data, len, index, total);
        });

        // Files delete endpoint
        server_->on("/api/files/delete", HTTP_DELETE, [this](AsyncWebServerRequest* request) {
            handleDeleteFile(request);
        });

        // Config endpoints
        server_->on("/api/config", HTTP_GET, [this](AsyncWebServerRequest* request) {
            handleGetConfig(request);
        });

        server_->on("/api/config", HTTP_POST,
                   [](AsyncWebServerRequest* request) {},
                   nullptr,
                   [this](AsyncWebServerRequest* request, uint8_t* data, size_t len,
                         size_t index, size_t total) {
            handleUpdateConfig(request, data, len, index, total);
        });

        Serial.println("✓ API endpoints registered:");
        Serial.println("  - GET  /api/status");
        Serial.println("  - POST /api/control/run");
        Serial.println("  - POST /api/control/pause");
        Serial.println("  - POST /api/control/reset");
        Serial.println("  - POST /api/control/step");
        Serial.println("  - GET  /api/files");
        Serial.println("  - POST /api/files/load");
        Serial.println("  - DELETE /api/files/delete");
        Serial.println("  - GET  /api/config");
        Serial.println("  - POST /api/config");
        Serial.println("=================================================");
        Serial.println();
    }

    /**
     * Set filesystem availability
     * Call this after LittleFS mount to enable file management endpoints
     */
    void setFilesystemEnabled(bool enabled) {
        filesystemEnabled_ = enabled;
        Serial.print("[WebAPI] Filesystem support: ");
        Serial.println(enabled ? "ENABLED" : "DISABLED");
    }
};
