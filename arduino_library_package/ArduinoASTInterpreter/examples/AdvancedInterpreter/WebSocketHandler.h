/**
 * WebSocketHandler.h
 *
 * WebSocket handler for real-time bidirectional communication.
 * Provides instant status updates to web interface without polling.
 *
 * Features:
 * - Real-time status broadcasts to all connected clients
 * - Event-driven architecture
 * - Automatic client management
 * - Connection/disconnection tracking
 * - Configurable update intervals
 * - JSON message format
 *
 * WebSocket Events:
 * - status_update: Real-time execution status
 * - file_loaded: File loading confirmation
 * - error: Error notifications
 * - connection_info: Connection establishment info
 */

#pragma once

#include <Arduino.h>
#include <AsyncWebSocket.h>
#include <ArduinoJson.h>

#if USE_INTERPRETER
// Forward declarations
extern AppExecutionState state;
extern unsigned long loopIteration;
extern unsigned long startTime;
extern unsigned long commandsExecuted;
#endif

// ============================================================================
// WEBSOCKET CONFIGURATION
// ============================================================================

namespace WebSocketConfig {
    const char* WS_PATH = "/ws";                        // WebSocket endpoint path
    const size_t MAX_CLIENTS = 4;                       // Maximum concurrent clients
    const unsigned long STATUS_BROADCAST_INTERVAL = 500; // Broadcast interval (ms)
    const size_t MAX_MESSAGE_SIZE = 1024;               // Maximum message size
}

// ============================================================================
// WEBSOCKET HANDLER CLASS
// ============================================================================

/**
 * Manages WebSocket connections and real-time updates
 */
class WebSocketHandler {
private:
    AsyncWebSocket* ws_;
    unsigned long lastBroadcast_;
    uint32_t connectedClients_;
    bool autoStatusBroadcast_;

#if USE_INTERPRETER
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
#endif

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
     * Create status update JSON message
     */
    String createStatusUpdate() {
        StaticJsonDocument<512> doc;

        doc["type"] = "status_update";
        doc["timestamp"] = millis();

        JsonObject data = doc.createNestedObject("data");
#if USE_INTERPRETER
        data["state"] = getStateString();
        data["iteration"] = loopIteration;
        data["uptime"] = millis() - startTime;
        data["uptimeStr"] = formatUptime(millis() - startTime);
        data["commandsExecuted"] = commandsExecuted;
#endif
        data["memoryFree"] = ESP.getFreeHeap();
        data["connectedClients"] = connectedClients_;

        String output;
        serializeJson(doc, output);
        return output;
    }

    /**
     * Handle WebSocket events
     */
    void handleWebSocketEvent(AsyncWebSocket* server, AsyncWebSocketClient* client,
                              AwsEventType type, void* arg, uint8_t* data, size_t len) {
        switch (type) {
            case WS_EVT_CONNECT: {
                connectedClients_++;
                Serial.print("[WebSocket] Client connected: ");
                Serial.print(client->id());
                Serial.print(" (");
                Serial.print(client->remoteIP().toString());
                Serial.print(") - Total clients: ");
                Serial.println(connectedClients_);

                // Send connection info to new client
                StaticJsonDocument<256> doc;
                doc["type"] = "connection_info";
                doc["clientId"] = client->id();
                doc["message"] = "Connected to AST Interpreter";

                String output;
                serializeJson(doc, output);
                client->text(output);

                // Send initial status update
                client->text(createStatusUpdate());
                break;
            }

            case WS_EVT_DISCONNECT: {
                connectedClients_--;
                Serial.print("[WebSocket] Client disconnected: ");
                Serial.print(client->id());
                Serial.print(" - Total clients: ");
                Serial.println(connectedClients_);
                break;
            }

            case WS_EVT_DATA: {
                // Handle incoming messages from clients
                AwsFrameInfo* info = (AwsFrameInfo*)arg;

                if (info->final && info->index == 0 && info->len == len &&
                    info->opcode == WS_TEXT) {
                    // Complete text message received
                    data[len] = 0;  // Null-terminate
                    String message = String((char*)data);

                    Serial.print("[WebSocket] Message from client ");
                    Serial.print(client->id());
                    Serial.print(": ");
                    Serial.println(message);

                    // Parse and handle message
                    handleClientMessage(client, message);
                }
                break;
            }

            case WS_EVT_PONG:
            case WS_EVT_ERROR:
                break;
        }
    }

    /**
     * Handle client messages
     */
    void handleClientMessage(AsyncWebSocketClient* client, const String& message) {
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, message);

        if (error) {
            sendError(client->id(), "Invalid JSON");
            return;
        }

        String type = doc["type"] | "";

        if (type == "ping") {
            // Respond to ping with pong
            StaticJsonDocument<128> response;
            response["type"] = "pong";
            response["timestamp"] = millis();

            String output;
            serializeJson(response, output);
            client->text(output);
        } else if (type == "request_status") {
            // Send status update to requesting client
            client->text(createStatusUpdate());
        } else {
            sendError(client->id(), "Unknown message type: " + type);
        }
    }

public:
    WebSocketHandler() :
        ws_(nullptr),
        lastBroadcast_(0),
        connectedClients_(0),
        autoStatusBroadcast_(true) {}

    /**
     * Initialize WebSocket handler
     */
    void begin(AsyncWebServer* server) {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   WebSocket Initialization");
        Serial.println("=================================================");

        // Create WebSocket instance
        ws_ = new AsyncWebSocket(WebSocketConfig::WS_PATH);

        if (!ws_) {
            Serial.println("✗ ERROR: Failed to create WebSocket");
            return;
        }

        // Set event handler using lambda to capture 'this'
        ws_->onEvent([this](AsyncWebSocket* server, AsyncWebSocketClient* client,
                           AwsEventType type, void* arg, uint8_t* data, size_t len) {
            this->handleWebSocketEvent(server, client, type, arg, data, len);
        });

        // Add WebSocket to server
        server->addHandler(ws_);

        Serial.print("✓ WebSocket initialized on path: ");
        Serial.println(WebSocketConfig::WS_PATH);
        Serial.print("  Max clients: ");
        Serial.println(WebSocketConfig::MAX_CLIENTS);
        Serial.print("  Status broadcast interval: ");
        Serial.print(WebSocketConfig::STATUS_BROADCAST_INTERVAL);
        Serial.println(" ms");
        Serial.println("=================================================");
        Serial.println();
    }

    /**
     * Broadcast status update to all connected clients
     * Call this periodically from loop()
     */
    void broadcastStatus() {
        if (!ws_ || connectedClients_ == 0) {
            return;
        }

        unsigned long now = millis();
        if (!autoStatusBroadcast_ ||
            now - lastBroadcast_ < WebSocketConfig::STATUS_BROADCAST_INTERVAL) {
            return;
        }

        lastBroadcast_ = now;

        String statusJSON = createStatusUpdate();
        ws_->textAll(statusJSON);
    }

    /**
     * Send file loaded event
     */
    void sendFileLoaded(const String& filename, size_t size) {
        if (!ws_ || connectedClients_ == 0) {
            return;
        }

        StaticJsonDocument<256> doc;
        doc["type"] = "file_loaded";
        doc["timestamp"] = millis();

        JsonObject data = doc.createNestedObject("data");
        data["filename"] = filename;
        data["size"] = size;

        String output;
        serializeJson(doc, output);
        ws_->textAll(output);
    }

    /**
     * Send error event
     */
    void sendError(const String& message) {
        if (!ws_ || connectedClients_ == 0) {
            return;
        }

        StaticJsonDocument<256> doc;
        doc["type"] = "error";
        doc["timestamp"] = millis();
        doc["message"] = message;

        String output;
        serializeJson(doc, output);
        ws_->textAll(output);
    }

    /**
     * Send error to specific client
     */
    void sendError(uint32_t clientId, const String& message) {
        if (!ws_) {
            return;
        }

        StaticJsonDocument<256> doc;
        doc["type"] = "error";
        doc["timestamp"] = millis();
        doc["message"] = message;

        String output;
        serializeJson(doc, output);
        ws_->text(clientId, output);
    }

    /**
     * Get connected client count
     */
    uint32_t getConnectedClients() const {
        return connectedClients_;
    }

    /**
     * Enable/disable automatic status broadcasts
     */
    void setAutoStatusBroadcast(bool enabled) {
        autoStatusBroadcast_ = enabled;
    }

    /**
     * Cleanup WebSocket connections
     */
    void cleanupClients() {
        if (ws_) {
            ws_->cleanupClients();
        }
    }

    /**
     * Print WebSocket statistics
     */
    void printStats() const {
        Serial.println();
        Serial.println("========== WebSocket Stats ==========");
        Serial.print("  Connected Clients: ");
        Serial.println(connectedClients_);
        Serial.print("  Auto Broadcast: ");
        Serial.println(autoStatusBroadcast_ ? "Enabled" : "Disabled");
        Serial.print("  Last Broadcast: ");
        Serial.print((millis() - lastBroadcast_) / 1000);
        Serial.println(" seconds ago");
        Serial.println("=====================================");
        Serial.println();
    }

    /**
     * Destructor
     */
    ~WebSocketHandler() {
        if (ws_) {
            delete ws_;
        }
    }
};
