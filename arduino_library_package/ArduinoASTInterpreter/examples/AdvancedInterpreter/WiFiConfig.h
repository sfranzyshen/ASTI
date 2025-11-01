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
 * - AP mode for initial configuration
 */

#pragma once

#include <WiFi.h>
#include <ESPmDNS.h>
#include <Preferences.h>

// Default mDNS hostname
#define MDNS_HOSTNAME "astinterpreter"

// ============================================================================
// WIFI MANAGER CLASS
// ============================================================================

class WiFiManager {
private:
    bool connected_;
    unsigned long lastConnectAttempt_;
    uint8_t retryCount_;
    String localIP_;
    String mdnsURL_;
    String ssid_;
    String password_;
    String hostname_;
    Preferences preferences_;

    const char* ap_ssid_ = "ASTInterpreter-Setup";

    bool setupMDNS() {
        if (!MDNS.begin(hostname_.c_str())) {
            Serial.println("✗ ERROR: Failed to start mDNS responder");
            return false;
        }

        mdnsURL_ = "http://" + hostname_ + ".local";

        Serial.println("✓ mDNS responder started");
        Serial.print("  Hostname: ");
        Serial.print(hostname_);
        Serial.print("  URL: ");
        Serial.println(mdnsURL_);

        MDNS.addService("http", "tcp", 80);

        return true;
    }

    void loadCredentials() {
        preferences_.begin("wifi-config", false);
        ssid_ = preferences_.getString("ssid", "");
        password_ = preferences_.getString("password", "");
        hostname_ = preferences_.getString("hostname", MDNS_HOSTNAME);
        preferences_.end();
    }

public:
    WiFiManager() : connected_(false), lastConnectAttempt_(0), retryCount_(0) {}

    bool begin() {
        loadCredentials();

        if (ssid_ == "") {
            startAPMode();
            return false; // Not connected to a station, but AP is running
        } else {
            return connectToWiFi();
        }
    }

    bool connectToWiFi() {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   WiFi Configuration (DHCP)");
        Serial.println("=================================================");

        WiFi.mode(WIFI_STA);
        WiFi.setHostname(hostname_.c_str());

        Serial.println();
        Serial.print("Connecting to WiFi: ");
        Serial.println(ssid_);
        Serial.println("Using DHCP for IP assignment...");

        WiFi.begin(ssid_.c_str(), password_.c_str());

        unsigned long startTime = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - startTime < 20000) {
            delay(500);
            Serial.print(".");
        }
        Serial.println();

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("✗ ERROR: WiFi connection failed");
            Serial.print("  Status: ");
            Serial.println(getStatusString());
            startAPMode(); // Fallback to AP mode
            return false;
        }

        connected_ = true;
        localIP_ = WiFi.localIP().toString();

        Serial.println("✓ WiFi connected successfully");
        Serial.print("  IP Address (DHCP): ");
        Serial.println(localIP_);

        if (!setupMDNS()) {
            Serial.println("⚠ WARNING: mDNS setup failed, use IP address instead");
        }

        Serial.println("=================================================");
        Serial.println();

        return true;
    }

    void startAPMode() {
        Serial.println();
        Serial.println("=================================================");
        Serial.println("   WiFi Access Point Mode");
        Serial.println("=================================================");

        WiFi.mode(WIFI_AP);
        WiFi.softAP(ap_ssid_);

        localIP_ = WiFi.softAPIP().toString();
        Serial.print("  AP SSID: ");
        Serial.println(ap_ssid_);
        Serial.print("  AP IP Address: ");
        Serial.println(localIP_);
        
        if (!setupMDNS()) {
            Serial.println("⚠ WARNING: mDNS setup failed, use IP address instead");
        }

        Serial.println("  Connect to this network to configure WiFi.");
        Serial.println("=================================================");
        Serial.println();
        connected_ = false;
    }

    void maintain() {
        if (ssid_ != "" && WiFi.status() != WL_CONNECTED) {
            if (millis() - lastConnectAttempt_ > 30000) {
                lastConnectAttempt_ = millis();
                Serial.println("[WiFi] Connection lost. Attempting to reconnect...");
                WiFi.disconnect();
                WiFi.reconnect();
            }
        }
    }

    void saveCredentials(const String& ssid, const String& password, const String& hostname) {
        preferences_.begin("wifi-config", false);
        preferences_.putString("ssid", ssid);
        preferences_.putString("password", password);
        if (hostname != "") {
            preferences_.putString("hostname", hostname);
            hostname_ = hostname;
        }
        preferences_.end();
        ssid_ = ssid;
        password_ = password;
    }

    String getSSID() {
        return ssid_;
    }

    bool isConnected() const {
        return connected_ && WiFi.status() == WL_CONNECTED;
    }

    String getLocalIP() const {
        return localIP_;
    }

    String getHostname() const {
        return hostname_;
    }

    String getMDNSURL() const {
        return mdnsURL_;
    }

    String getStatusString() const {
        switch (WiFi.status()) {
            case WL_IDLE_STATUS: return "Idle";
            case WL_NO_SSID_AVAIL: return "No SSID Available";
            case WL_SCAN_COMPLETED: return "Scan Completed";
            case WL_CONNECTED: return "Connected";
            case WL_CONNECT_FAILED: return "Connection Failed";
            case WL_CONNECTION_LOST: return "Connection Lost";
            case WL_DISCONNECTED: return "Disconnected";
            default: return "Unknown";
        }
    }

    void printInfo() const {
        Serial.println();
        Serial.println("========== WiFi Status ==========");
        Serial.print("  Mode: ");
        Serial.println(WiFi.getMode() == WIFI_AP ? "Access Point" : "Station");
        Serial.print("  Status: ");
        Serial.println(getStatusString());

        if (isConnected()) {
            Serial.print("  SSID: ");
            Serial.println(ssid_);
            Serial.print("  IP Address (DHCP): ");
            Serial.println(localIP_);
            Serial.print("  mDNS URL: ");
            Serial.println(mdnsURL_);
        } else if (WiFi.getMode() == WIFI_AP) {
            Serial.print("  AP SSID: ");
            Serial.println(ap_ssid_);
            Serial.print("  AP IP Address: ");
            Serial.println(localIP_);
        }

        Serial.println("=================================");
        Serial.println();
    }
};