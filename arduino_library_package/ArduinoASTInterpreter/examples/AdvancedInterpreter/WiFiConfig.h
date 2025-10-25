/**
 * WiFiConfig.h
 *
 * WiFi configuration and management for AdvancedInterpreter web interface.
 * Handles WiFi connection with DHCP IP assignment and mDNS setup.
 *
 * Features:
 * - DHCP automatic IP assignment from router
 * - Automatic connection with retry logic
 * - Connection status monitoring
 * - mDNS responder for easy access (e.g., http://astinterpreter.local)
 * - Connection recovery on disconnect
 * - IP address displayed in Serial Monitor
 */

#pragma once

#include <WiFi.h>
#include <ESPmDNS.h>

// ============================================================================
// WIFI CONFIGURATION (MODIFY THESE VALUES)
// ============================================================================

namespace WiFiConfig {

// WiFi Credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";           // Change to your WiFi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // Change to your WiFi password

// mDNS Configuration
const char* MDNS_HOSTNAME = "astinterpreter";       // Access via http://astinterpreter.local

// Connection Settings
const unsigned long CONNECT_TIMEOUT = 20000;        // 20 seconds connection timeout
const unsigned long RECONNECT_INTERVAL = 30000;     // 30 seconds between reconnect attempts
const uint8_t MAX_CONNECT_RETRIES = 3;              // Maximum connection retries

// Network Configuration Notes:
// - IP address automatically assigned by DHCP
// - No manual IP configuration needed
// - Assigned IP shown in Serial Monitor after connection
// - Use mDNS hostname for consistent access regardless of IP

} // namespace WiFiConfig

// ============================================================================
// WIFI MANAGER CLASS
// ============================================================================

/**
 * Manages WiFi connection and mDNS setup
 */
class WiFiManager {
private:
    bool connected_;
    unsigned long lastConnectAttempt_;
    uint8_t retryCount_;
    String localIP_;
    String mdnsURL_;

    /**
     * Setup mDNS responder
     */
    bool setupMDNS() {
        if (!MDNS.begin(WiFiConfig::MDNS_HOSTNAME)) {
            Serial.println("✗ ERROR: Failed to start mDNS responder");
            return false;
        }

        mdnsURL_ = "http://";
        mdnsURL_ += WiFiConfig::MDNS_HOSTNAME;
        mdnsURL_ += ".local";

        Serial.println("✓ mDNS responder started");
        Serial.print("  Hostname: ");
        Serial.println(WiFiConfig::MDNS_HOSTNAME);
        Serial.print("  URL: ");
        Serial.println(mdnsURL_);

        // Add service to mDNS-SD
        MDNS.addService("http", "tcp", 80);

        return true;
    }

public:
    WiFiManager() : connected_(false), lastConnectAttempt_(0), retryCount_(0) {}

    /**
     * Initialize WiFi and connect to network
     */
    bool begin() {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   WiFi Configuration (DHCP)");
        Serial.println("=================================================");

        // Set WiFi mode to station
        WiFi.mode(WIFI_STA);
        WiFi.setHostname(WiFiConfig::MDNS_HOSTNAME);

        // Connect to WiFi (DHCP automatic)
        Serial.println();
        Serial.print("Connecting to WiFi: ");
        Serial.println(WiFiConfig::WIFI_SSID);
        Serial.println("Using DHCP for IP assignment...");

        WiFi.begin(WiFiConfig::WIFI_SSID, WiFiConfig::WIFI_PASSWORD);

        // Wait for connection
        unsigned long startTime = millis();
        while (WiFi.status() != WL_CONNECTED &&
               millis() - startTime < WiFiConfig::CONNECT_TIMEOUT) {
            delay(500);
            Serial.print(".");
        }
        Serial.println();

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("✗ ERROR: WiFi connection failed");
            Serial.print("  Status: ");
            Serial.println(getStatusString());
            return false;
        }

        connected_ = true;
        localIP_ = WiFi.localIP().toString();

        Serial.println("✓ WiFi connected successfully");
        Serial.print("  IP Address (DHCP): ");
        Serial.println(localIP_);
        Serial.print("  Gateway: ");
        Serial.println(WiFi.gatewayIP().toString());
        Serial.print("  Subnet: ");
        Serial.println(WiFi.subnetMask().toString());
        Serial.print("  DNS: ");
        Serial.println(WiFi.dnsIP().toString());
        Serial.print("  Signal Strength: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");

        // Setup mDNS
        if (!setupMDNS()) {
            Serial.println("⚠ WARNING: mDNS setup failed, use IP address instead");
            // Continue anyway - can still use IP address
        }

        Serial.println("=================================================");
        Serial.println();

        return true;
    }

    /**
     * Check and maintain WiFi connection
     * Call this periodically in loop()
     */
    void maintain() {
        // Check if we're connected
        if (WiFi.status() == WL_CONNECTED) {
            if (!connected_) {
                // Reconnected
                connected_ = true;
                retryCount_ = 0;
                localIP_ = WiFi.localIP().toString();
                Serial.println("[WiFi] Reconnected to network");
                Serial.print("  IP Address (DHCP): ");
                Serial.println(localIP_);
            }
            return;
        }

        // We're disconnected
        if (connected_) {
            connected_ = false;
            Serial.println("[WiFi] Connection lost");
        }

        // Attempt reconnection if enough time has passed
        unsigned long now = millis();
        if (now - lastConnectAttempt_ < WiFiConfig::RECONNECT_INTERVAL) {
            return;
        }

        lastConnectAttempt_ = now;
        retryCount_++;

        if (retryCount_ > WiFiConfig::MAX_CONNECT_RETRIES) {
            Serial.println("[WiFi] Max retries reached, waiting before next attempt...");
            retryCount_ = 0;
            return;
        }

        Serial.println("[WiFi] Attempting to reconnect...");
        WiFi.disconnect();
        WiFi.reconnect();
    }

    /**
     * Get connection status
     */
    bool isConnected() const {
        return connected_ && WiFi.status() == WL_CONNECTED;
    }

    /**
     * Get local IP address as string
     */
    String getLocalIP() const {
        return localIP_;
    }

    /**
     * Get mDNS URL
     */
    String getMDNSURL() const {
        return mdnsURL_;
    }

    /**
     * Get WiFi signal strength in dBm
     */
    int getRSSI() const {
        return WiFi.RSSI();
    }

    /**
     * Get human-readable status string
     */
    String getStatusString() const {
        switch (WiFi.status()) {
            case WL_IDLE_STATUS:
                return "Idle";
            case WL_NO_SSID_AVAIL:
                return "No SSID Available";
            case WL_SCAN_COMPLETED:
                return "Scan Completed";
            case WL_CONNECTED:
                return "Connected";
            case WL_CONNECT_FAILED:
                return "Connection Failed";
            case WL_CONNECTION_LOST:
                return "Connection Lost";
            case WL_DISCONNECTED:
                return "Disconnected";
            default:
                return "Unknown";
        }
    }

    /**
     * Print connection information
     */
    void printInfo() const {
        Serial.println();
        Serial.println("========== WiFi Status ==========");
        Serial.print("  Status: ");
        Serial.println(getStatusString());

        if (isConnected()) {
            Serial.print("  IP Address (DHCP): ");
            Serial.println(localIP_);
            Serial.print("  mDNS URL: ");
            Serial.println(mdnsURL_);
            Serial.print("  Signal Strength: ");
            Serial.print(getRSSI());
            Serial.println(" dBm");
        }

        Serial.println("=================================");
        Serial.println();
    }

    /**
     * Disconnect from WiFi
     */
    void disconnect() {
        if (connected_) {
            WiFi.disconnect();
            connected_ = false;
            Serial.println("[WiFi] Disconnected");
        }
    }
};
