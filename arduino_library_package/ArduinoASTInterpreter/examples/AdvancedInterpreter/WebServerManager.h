/**
 * WebServerManager.h
 *
 * Web server management for AdvancedInterpreter.
 * Handles HTTP server initialization, static file serving, and request routing.
 *
 * Features:
 * - AsyncWebServer for non-blocking operation
 * - Serve static files from LittleFS /data/ folder
 * - CORS headers for development
 * - 404 error handling
 * - Request logging
 * - Content-type detection
 *
 * Required Libraries:
 * - ESPAsyncWebServer (install via Library Manager)
 * - AsyncTCP (install via Library Manager)
 */

#pragma once

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>

// ============================================================================
// WEB SERVER CONFIGURATION
// ============================================================================

namespace WebServerConfig {
    const uint16_t HTTP_PORT = 80;                      // HTTP server port
    const bool ENABLE_CORS = true;                      // Enable CORS headers
    const bool ENABLE_LOGGING = true;                   // Enable request logging
    const size_t MAX_REQUEST_SIZE = 8192;               // Maximum request body size
    const char* DEFAULT_INDEX = "/index.html";          // Default index file
}

// ============================================================================
// WEB SERVER MANAGER CLASS
// ============================================================================

/**
 * Manages HTTP web server and static file serving
 */
class WebServerManager {
private:
    AsyncWebServer* server_;
    bool initialized_;
    unsigned long requestCount_;

    /**
     * Get content type from file extension
     */
    String getContentType(const String& filename) const {
        if (filename.endsWith(".html") || filename.endsWith(".htm")) {
            return "text/html";
        } else if (filename.endsWith(".css")) {
            return "text/css";
        } else if (filename.endsWith(".js")) {
            return "application/javascript";
        } else if (filename.endsWith(".json")) {
            return "application/json";
        } else if (filename.endsWith(".png")) {
            return "image/png";
        } else if (filename.endsWith(".gif")) {
            return "image/gif";
        } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (filename.endsWith(".ico")) {
            return "image/x-icon";
        } else if (filename.endsWith(".svg")) {
            return "image/svg+xml";
        } else if (filename.endsWith(".xml")) {
            return "text/xml";
        } else if (filename.endsWith(".pdf")) {
            return "application/pdf";
        } else if (filename.endsWith(".zip")) {
            return "application/zip";
        } else if (filename.endsWith(".gz")) {
            return "application/x-gzip";
        } else if (filename.endsWith(".ast")) {
            return "application/octet-stream";
        }
        return "text/plain";
    }

    /**
     * Log HTTP request
     */
    void logRequest(AsyncWebServerRequest* request) {
        if (!WebServerConfig::ENABLE_LOGGING) return;

        requestCount_++;

        Serial.print("[HTTP] ");
        Serial.print(request->methodToString());
        Serial.print(" ");
        Serial.print(request->url());
        Serial.print(" from ");
        Serial.println(request->client()->remoteIP());
    }

    /**
     * Add CORS headers to response
     */
    void addCORSHeaders(AsyncWebServerResponse* response) {
        if (!WebServerConfig::ENABLE_CORS) return;

        response->addHeader("Access-Control-Allow-Origin", "*");
        response->addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS");
        response->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response->addHeader("Access-Control-Max-Age", "86400");
    }

    /**
     * Setup static file handlers
     */
    void setupStaticHandlers() {
        // Serve root as index.html
        server_->on("/", HTTP_GET, [this](AsyncWebServerRequest* request) {
            logRequest(request);

            if (!LittleFS.exists(WebServerConfig::DEFAULT_INDEX)) {
                request->send(404, "text/plain", "index.html not found in /data/ folder");
                return;
            }

            auto response = request->beginResponse(LittleFS, WebServerConfig::DEFAULT_INDEX, "text/html");
            addCORSHeaders(response);
            request->send(response);
        });

        // Serve all files from /data/ folder
        server_->serveStatic("/", LittleFS, "/")
            .setCacheControl("max-age=600");  // Cache for 10 minutes

        // Handle OPTIONS requests (CORS preflight)
        server_->onNotFound([this](AsyncWebServerRequest* request) {
            if (request->method() == HTTP_OPTIONS) {
                logRequest(request);
                auto response = request->beginResponse(200);
                addCORSHeaders(response);
                request->send(response);
                return;
            }

            // Try to serve file from LittleFS
            String path = request->url();
            if (path.endsWith("/")) {
                path += "index.html";
            }

            if (LittleFS.exists(path)) {
                logRequest(request);
                String contentType = getContentType(path);
                auto response = request->beginResponse(LittleFS, path, contentType);
                addCORSHeaders(response);
                request->send(response);
                return;
            }

            // File not found
            logRequest(request);
            Serial.print("  -> 404 Not Found: ");
            Serial.println(path);
            request->send(404, "text/plain", "File Not Found: " + path);
        });
    }

public:
    WebServerManager() : server_(nullptr), initialized_(false), requestCount_(0) {}

    /**
     * Initialize web server
     */
    bool begin() {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   Web Server Initialization");
        Serial.println("=================================================");

        // Check if LittleFS is mounted
        if (!LittleFS.begin(false)) {
            Serial.println("✗ ERROR: LittleFS not mounted");
            Serial.println("  Web interface files must be uploaded to LittleFS");
            return false;
        }

        Serial.println("✓ LittleFS mounted successfully");

        // Check if index.html exists
        if (!LittleFS.exists(WebServerConfig::DEFAULT_INDEX)) {
            Serial.println("⚠ WARNING: index.html not found in /data/ folder");
            Serial.println("  Upload web interface files to continue");
        } else {
            Serial.print("✓ Found ");
            Serial.println(WebServerConfig::DEFAULT_INDEX);
        }

        // Create server instance
        server_ = new AsyncWebServer(WebServerConfig::HTTP_PORT);
        if (!server_) {
            Serial.println("✗ ERROR: Failed to create web server");
            return false;
        }

        // Setup static file handlers
        setupStaticHandlers();

        Serial.print("✓ Static file handlers configured");
        Serial.println();

        // Start server
        server_->begin();
        initialized_ = true;

        Serial.print("✓ Web server started on port ");
        Serial.println(WebServerConfig::HTTP_PORT);
        Serial.println("=================================================");
        Serial.println();

        return true;
    }

    /**
     * Stop web server
     */
    void end() {
        if (initialized_ && server_) {
            server_->end();
            delete server_;
            server_ = nullptr;
            initialized_ = false;
            Serial.println("[WebServer] Stopped");
        }
    }

    /**
     * Check if server is initialized
     */
    bool isInitialized() const {
        return initialized_;
    }

    /**
     * Get server instance (for adding custom handlers)
     */
    AsyncWebServer* getServer() {
        return server_;
    }

    /**
     * Get request count
     */
    unsigned long getRequestCount() const {
        return requestCount_;
    }

    /**
     * Print server statistics
     */
    void printStats() const {
        Serial.println();
        Serial.println("========== Web Server Stats ==========");
        Serial.print("  Total Requests: ");
        Serial.println(requestCount_);
        Serial.print("  Status: ");
        Serial.println(initialized_ ? "Running" : "Stopped");
        Serial.println("======================================");
        Serial.println();
    }

    /**
     * Destructor
     */
    ~WebServerManager() {
        end();
    }
};
