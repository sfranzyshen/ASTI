/**
 * AdvancedInterpreter.ino
 *
 * Advanced demonstration of ArduinoASTInterpreter with continuous execution and menu control.
 * Hosts the REAL interpreter, processes commands, and executes on real ESP32 hardware.
 *
 * ============================================================================
 * FEATURES
 * ============================================================================
 * - Continuous Loop Execution: Runs infinitely (not just once)
 * - Menu-Driven Interface: Serial Monitor control (Run/Pause/Reset/Status/Step)
 * - Web Interface: Browser-based control with real-time status updates
 * - WiFi Connectivity: DHCP with mDNS support (astinterpreter.local)
 * - Real Command Processing: Executes pinMode, digitalWrite, delay on real hardware
 * - Status Updates: Periodic iteration count and uptime display
 * - Real Hardware: Blinks LED_BUILTIN at 1Hz
 * - Dual Modes: Embedded (PROGMEM) and Filesystem (LittleFS) modes
 * - File Management: List, load, and delete .ast files via web interface
 * - Persistent Configuration: Auto-start, default file, status interval settings
 * - Real-time WebSocket: Sub-second status updates in browser
 * - RESTful API: Complete control via HTTP endpoints
 *
 * ============================================================================
 * HARDWARE REQUIREMENTS
 * ============================================================================
 * - ESP32-based board (ESP32, ESP32-S3, Nano ESP32, etc.)
 * - Minimum 4MB Flash (8MB recommended)
 * - WiFi capability (built-in to ESP32)
 * - LittleFS partition for file storage
 *
 * Tested Boards:
 * - Arduino Nano ESP32 (FQBN: arduino:esp32:nano_nora)
 * - ESP32 DevKit C (FQBN: esp32:esp32:esp32)
 * - ESP32-S3 DevKit-C (FQBN: esp32:esp32:esp32s3)
 *
 * ============================================================================
 * REQUIRED LIBRARIES
 * ============================================================================
 * Install via Arduino Library Manager or PlatformIO:
 *
 * 1. ESPAsyncWebServer (by me-no-dev)
 *    - Asynchronous web server library
 *    - GitHub: https://github.com/me-no-dev/ESPAsyncWebServer
 *
 * 2. AsyncTCP (by me-no-dev)
 *    - Dependency for ESPAsyncWebServer
 *    - GitHub: https://github.com/me-no-dev/AsyncTCP
 *
 * 3. ArduinoJson (by Benoit Blanchon) - v6.x
 *    - JSON serialization/deserialization
 *    - Install: Tools → Manage Libraries → "ArduinoJson"
 *
 * Built-in Libraries (no installation needed):
 * - WiFi.h (ESP32 built-in)
 * - ESPmDNS.h (ESP32 built-in)
 * - LittleFS.h (ESP32 built-in)
 * - Preferences.h (ESP32 built-in)
 * - FS.h (ESP32 built-in)
 *
 * ============================================================================
 * SETUP INSTRUCTIONS
 * ============================================================================
 *
 * STEP 1: Configure WiFi Credentials
 * ------------------------------------
 * Edit WiFiConfig.h and update:
 *   - WIFI_SSID: Your WiFi network name
 *   - WIFI_PASSWORD: Your WiFi password
 *   - MDNS_HOSTNAME: Device name for mDNS (default: "astinterpreter")
 *
 * Note: IP address is automatically assigned by your router via DHCP.
 *       The assigned IP will be displayed in the Serial Monitor after connection.
 *
 * STEP 2: Install Required Libraries
 * -----------------------------------
 * Using Arduino IDE:
 *   Tools → Manage Libraries → Search and install:
 *   - ESPAsyncWebServer
 *   - AsyncTCP
 *   - ArduinoJson (v6.x)
 *
 * Using PlatformIO:
 *   Add to platformio.ini:
 *   lib_deps =
 *       me-no-dev/ESPAsyncWebServer
 *       me-no-dev/AsyncTCP
 *       bblanchon/ArduinoJson @ ^6.21.0
 *
 * STEP 3: Upload Web Interface Files
 * -----------------------------------
 * The web interface files in data/ folder must be uploaded to LittleFS.
 *
 * PlatformIO (Recommended):
 *   pio run --target uploadfs
 *
 * Arduino IDE with LittleFS Plugin:
 *   1. Install plugin: https://github.com/lorol/arduino-esp32littlefs-plugin
 *   2. Tools → ESP32 Sketch Data Upload
 *
 * STEP 4: Upload This Sketch
 * ---------------------------
 * 1. Select your board in Tools → Board
 * 2. Select correct port in Tools → Port
 * 3. Upload sketch
 * 4. Open Serial Monitor at 115200 baud
 *
 * STEP 5: Access Web Interface
 * -----------------------------
 * After successful WiFi connection, Serial Monitor will show:
 *
 *   =================================================
 *      WEB INTERFACE READY
 *   =================================================
 *      http://astinterpreter.local
 *      IP Address: 192.168.x.xxx (DHCP assigned)
 *   =================================================
 *
 * Primary Access: http://astinterpreter.local (mDNS)
 * Fallback: Use the DHCP-assigned IP address shown above
 *
 * ============================================================================
 * DUAL-MODE OPERATION
 * ============================================================================
 * - Embedded Mode (USE_FILESYSTEM=false): Uses PROGMEM array (default)
 * - Filesystem Mode (USE_FILESYSTEM=true): Loads AST from LittleFS filesystem
 *
 * Change mode by modifying USE_FILESYSTEM define below.
 *
 * ============================================================================
 * SERIAL MENU COMMANDS
 * ============================================================================
 * The serial interface continues to work alongside the web interface:
 * - 1 or R: Run/Resume execution
 * - 2 or P: Pause execution
 * - 3 or X: Reset program
 * - 4 or S: Show detailed status
 * - 5 or H: Show help menu
 * - 6 or T: Step (execute one command)
 *
 * ============================================================================
 * WEB INTERFACE FEATURES
 * ============================================================================
 * Access via: http://astinterpreter.local OR http://<dhcp-assigned-ip>
 *
 * Control Panel:
 * - ▶ RUN: Start/resume execution
 * - ⏸ PAUSE: Pause execution
 * - ⟳ RESET: Reset interpreter
 * - ⏭ STEP: Single-step execution
 *
 * Status Panel (real-time):
 * - Current execution state
 * - Loop iteration count
 * - Uptime since start
 * - Commands executed
 * - Free memory
 *
 * File Manager:
 * - List all .ast files on LittleFS
 * - Load any file to execute
 * - Delete files
 * - Shows file sizes
 *
 * Configuration:
 * - Auto-start on power-up
 * - Default AST file selection
 * - Status update interval
 * - Persistent storage (survives reboots)
 *
 * ============================================================================
 * API ENDPOINTS
 * ============================================================================
 * RESTful API for programmatic control:
 *
 * Status:
 *   GET /api/status - Get current execution status
 *
 * Control:
 *   POST /api/control/run - Start/resume
 *   POST /api/control/pause - Pause
 *   POST /api/control/reset - Reset
 *   POST /api/control/step - Single step
 *
 * Files:
 *   GET /api/files - List .ast files
 *   POST /api/files/load - Load specific file
 *   DELETE /api/files/delete?name=<file> - Delete file
 *
 * Configuration:
 *   GET /api/config - Get configuration
 *   POST /api/config - Update configuration
 *
 * WebSocket:
 *   ws://<ip>/ws - Real-time status updates
 *
 * See README_WebInterface.md for complete API documentation.
 *
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 * WiFi Not Connecting:
 * - Verify SSID and password in WiFiConfig.h
 * - Check router allows DHCP clients
 * - Verify WiFi signal strength is adequate
 * - Review Serial Monitor for connection status
 *
 * Web Interface 404:
 * - Web files not uploaded to LittleFS
 * - Use correct upload method for your platform
 * - Serial Monitor will show "Found /index.html" if uploaded correctly
 *
 * mDNS Not Working:
 * - Use DHCP-assigned IP address as fallback (shown in Serial Monitor)
 * - mDNS requires compatible router/network
 * - Apple devices (iOS/macOS) support mDNS natively
 * - Android/Windows may need Bonjour service or avahi
 *
 * See README_WebInterface.md for complete troubleshooting guide.
 *
 * ============================================================================
 * VERSION INFORMATION
 * ============================================================================
 * Sketch Version: 22.0.0
 * ASTInterpreter: 22.0.0
 * CompactAST: 3.2.0
 * ArduinoParser: 6.0.0
 *
 * ============================================================================
 * ADDITIONAL DOCUMENTATION
 * ============================================================================
 * - README_WebInterface.md: Complete web interface documentation
 * - docs/ESP32_DEPLOYMENT_GUIDE.md: ESP32 deployment details
 * - CLAUDE.md: Project-wide documentation and version history
 */

// ============================================================================
// EXECUTION STATE ENUM (must be defined before includes)
// ============================================================================

// Execution state
enum AppExecutionState {
    STATE_STOPPED,
    STATE_RUNNING,
    STATE_PAUSED,
    STATE_STEP_MODE
};

// ============================================================================
// INCLUDES
// ============================================================================

#include <ArduinoASTInterpreter.h>
#include "FS.h"
#include <LittleFS.h>
#include "ImmediateCommandExecutor.h"
#include "CommandExecutor.h"
#include "ESP32DataProvider.h"
#include "SerialMenu.h"

#include "ConfigManager.h"
#include "WebServerManager.h"
#include "WebAPI.h"
#include "WebSocketHandler.h"
#include "esp_task_wdt.h"  // Task watchdog timer configuration

// ============================================================================
// CONFIGURATION
// ============================================================================

// Set to true to load AST from LittleFS filesystem, false for embedded mode
#define USE_FILESYSTEM true

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
// Generated from: test_data/test2_js.ast (Blink.ino)
// Size: 1389 bytes
const uint8_t PROGMEM astBinary[] = {
  0x41, 0x53, 0x54, 0x50, 0x00, 0x01, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x3c, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x04, 0x00, 0x76, 0x6f,
  0x69, 0x64, 0x00, 0x05, 0x00, 0x73, 0x65, 0x74, 0x75, 0x70, 0x00, 0x07,
  0x00, 0x70, 0x69, 0x6e, 0x4d, 0x6f, 0x64, 0x65, 0x00, 0x04, 0x00, 0x6c,
  0x6f, 0x6f, 0x70, 0x00, 0x0c, 0x00, 0x64, 0x69, 0x67, 0x69, 0x74, 0x61,
  0x6c, 0x57, 0x72, 0x69, 0x74, 0x65, 0x00, 0x05, 0x00, 0x64, 0x65, 0x6c,
  0x61, 0x79, 0x00, 0x00, 0x01, 0x01, 0x04, 0x00, 0x01, 0x00, 0x0a, 0x00,
  0x21, 0x01, 0x06, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00, 0x50, 0x02,
  0x03, 0x00, 0x0c, 0x00, 0x00, 0x51, 0x02, 0x03, 0x00, 0x0c, 0x01, 0x00,
  0x10, 0x01, 0x02, 0x00, 0x05, 0x00, 0x11, 0x01, 0x02, 0x00, 0x06, 0x00,
  0x33, 0x01, 0x06, 0x00, 0x07, 0x00, 0x08, 0x00, 0x09, 0x00, 0x43, 0x02,
  0x03, 0x00, 0x0c, 0x02, 0x00, 0x40, 0x02, 0x02, 0x00, 0x03, 0x0d, 0x40,
  0x02, 0x02, 0x00, 0x03, 0x01, 0x21, 0x01, 0x06, 0x00, 0x0b, 0x00, 0x0c,
  0x00, 0x0d, 0x00, 0x50, 0x02, 0x03, 0x00, 0x0c, 0x00, 0x00, 0x51, 0x02,
  0x03, 0x00, 0x0c, 0x03, 0x00, 0x10, 0x01, 0x08, 0x00, 0x0e, 0x00, 0x13,
  0x00, 0x17, 0x00, 0x1c, 0x00, 0x11, 0x01, 0x02, 0x00, 0x0f, 0x00, 0x33,
  0x01, 0x06, 0x00, 0x10, 0x00, 0x11, 0x00, 0x12, 0x00, 0x43, 0x02, 0x03,
  0x00, 0x0c, 0x04, 0x00, 0x40, 0x02, 0x02, 0x00, 0x03, 0x0d, 0x40, 0x02,
  0x02, 0x00, 0x03, 0x01, 0x11, 0x01, 0x02, 0x00, 0x14, 0x00, 0x33, 0x01,
  0x04, 0x00, 0x15, 0x00, 0x16, 0x00, 0x43, 0x02, 0x03, 0x00, 0x0c, 0x05,
  0x00, 0x40, 0x02, 0x03, 0x00, 0x05, 0xe8, 0x03, 0x11, 0x01, 0x02, 0x00,
  0x18, 0x00, 0x33, 0x01, 0x06, 0x00, 0x19, 0x00, 0x1a, 0x00, 0x1b, 0x00,
  0x43, 0x02, 0x03, 0x00, 0x0c, 0x04, 0x00, 0x40, 0x02, 0x02, 0x00, 0x03,
  0x0d, 0x40, 0x02, 0x02, 0x00, 0x03, 0x00, 0x11, 0x01, 0x02, 0x00, 0x1d,
  0x00, 0x33, 0x01, 0x04, 0x00, 0x1e, 0x00, 0x1f, 0x00, 0x43, 0x02, 0x03,
  0x00, 0x0c, 0x05, 0x00, 0x40, 0x02, 0x03, 0x00, 0x05, 0xe8, 0x03, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

AppExecutionState state = STATE_STOPPED;
unsigned long loopIteration = 0;
unsigned long startTime = 0;
unsigned long commandsExecuted = 0;
unsigned long lastStatusTime = 0;

// Components
SerialMenu menu;
CommandExecutor executor;
ImmediateCommandExecutor immediateExecutor(&executor);  // Zero-copy command execution
ESP32DataProvider dataProvider;
ASTInterpreter* interpreter = nullptr;
uint8_t* astBuffer = nullptr;

// Network and Configuration
WiFiManager wifiManager;
ConfigManager configManager;
WebServerManager webServer;
WebAPI webAPI;
WebSocketHandler webSocket;

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

/**
 * Load a specific AST file from filesystem
 * Stops current execution and loads the specified file
 * Returns true on success, false on failure
 */
bool loadASTFile(const char* filename) {
    Serial.print("[LOAD] Loading AST file: ");
    Serial.println(filename);

    #if !USE_FILESYSTEM
    Serial.println("✗ ERROR: Filesystem not enabled (USE_FILESYSTEM=false)");
    return false;
    #else

    // Check if filesystem is initialized
    if (!initFilesystem()) {
        Serial.println("✗ ERROR: Filesystem initialization failed");
        return false;
    }

    // Check if file exists
    if (!LittleFS.exists(filename)) {
        Serial.println("✗ ERROR: File not found");
        return false;
    }

    // Stop current execution
    if (state == STATE_RUNNING) {
        Serial.println("  Stopping current execution...");
        state = STATE_STOPPED;
    }

    // Delete old interpreter
    if (interpreter) {
        delete interpreter;
        interpreter = nullptr;
    }

    // Free old AST buffer
    if (astBuffer) {
        free(astBuffer);
        astBuffer = nullptr;
    }

    // Reset statistics
    immediateExecutor.resetStats();
    loopIteration = 0;
    commandsExecuted = 0;
    startTime = millis();

    // Load new AST file
    size_t astSize = 0;
    astBuffer = readASTFromFile(filename, &astSize);

    if (!astBuffer) {
        Serial.println("✗ ERROR: Failed to read AST file");
        return false;
    }

    // Configure interpreter options
    InterpreterOptions opts;
    opts.verbose = false;     // Status-only mode
    opts.debug = false;
    opts.maxLoopIterations = 1;  // Run ONE iteration per call
    opts.enforceLoopLimitsOnInternalLoops = false;  // Allow unlimited for/while/do-while loops
    opts.syncMode = true;

    // Create new interpreter
    Serial.println("  Creating interpreter...");
    interpreter = new ASTInterpreter(astBuffer, astSize, opts);

    if (!interpreter) {
        Serial.println("✗ ERROR: Failed to create interpreter");
        free(astBuffer);
        astBuffer = nullptr;
        return false;
    }

    // Free filesystem buffer (interpreter has internal copy)
    free(astBuffer);
    astBuffer = nullptr;

    // Connect providers
    interpreter->setSyncDataProvider(&dataProvider);
    interpreter->setCommandCallback(&immediateExecutor);

    Serial.println("✓ File loaded successfully");
    return true;

    #endif
}

void resetInterpreter() {
    Serial.println("[RESET] Resetting interpreter state...");

    if (interpreter) {
        delete interpreter;
        interpreter = nullptr;
    }

    immediateExecutor.resetStats();
    loopIteration = 0;
    commandsExecuted = 0;
    startTime = millis();

    // Configure interpreter options
    InterpreterOptions opts;
    opts.verbose = false;     // Status-only mode (no command stream to Serial)
    opts.debug = false;
    opts.maxLoopIterations = 1;  // Run ONE iteration per call (parent controls repetition)
    opts.enforceLoopLimitsOnInternalLoops = false;  // Allow unlimited for/while/do-while loops
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
            // Use configured default file instead of hardcoded constant
            String defaultFile = configManager.getDefaultFile();
            Serial.print("[RESET] Loading configured default file: ");
            Serial.println(defaultFile);

            astBuffer = readASTFromFile(defaultFile.c_str(), &astSize);
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
    interpreter->setCommandCallback(&immediateExecutor);

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
    // With immediate execution, we just call resume() once
    // Commands execute automatically via callback
    if (interpreter) {
        size_t beforeCount = immediateExecutor.getTotalExecuted();
        interpreter->resume();
        loopIteration++;
        size_t afterCount = immediateExecutor.getTotalExecuted();

        Serial.print("[STEP] Executed ");
        Serial.print(afterCount - beforeCount);
        Serial.println(" commands");
    }
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    // CRITICAL: Configure Task Watchdog Timer
    // ESP32 default is ~5 seconds, we need more for intensive interpreter loops
    // Rainbow with i++ takes ~7.68 seconds, so we set 15 seconds to be safe
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = 15000,      // 15 second timeout (in milliseconds)
        .idle_core_mask = 0,      // Don't watch idle tasks
        .trigger_panic = true     // Panic on timeout (for debugging)
    };
    esp_task_wdt_init(&wdt_config);

    Serial.println("========================================");
    Serial.println("  TASK WATCHDOG CONFIGURATION");
    Serial.println("========================================");
    Serial.println("  Timeout: 15 seconds");
    Serial.println("  Allows long interpreter loops without reboot");
    Serial.println("========================================");
    Serial.println();

    // Configure LED pin
    pinMode(BLINK_LED, OUTPUT);
    digitalWrite(BLINK_LED, LOW);

    // Print banner
    #if USE_FILESYSTEM
        menu.printBanner("22.0.0", PLATFORM_NAME, "Filesystem + Web", "Blink (LED_BUILTIN)");
    #else
        menu.printBanner("22.0.0", PLATFORM_NAME, "Embedded + Web", "Blink (LED_BUILTIN)");
    #endif

    // Initialize configuration manager
    if (!configManager.begin()) {
        Serial.println("⚠ WARNING: Failed to initialize configuration, using defaults");
    }

        #include <time.h>

        

        // ... (other includes)

        

        // NTP server configuration

        const char* ntpServer = "pool.ntp.org";

        const long  gmtOffset_sec = 0;

        const int   daylightOffset_sec = 3600;

        

        // ... (global variables)

        

        // ... (setup function)

            // Initialize WiFi and mDNS

            wifiManager.begin();

        

            // Set time via NTP

            configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

            struct tm timeinfo;

            if (getLocalTime(&timeinfo)) {

                Serial.println("✓ Time set via NTP");

            } else {

                Serial.println("✗ ERROR: Failed to set time via NTP");

            }

        

    

        // Initialize web server

        if (webServer.begin()) {

            // Initialize WebSocket handler

            webSocket.begin(webServer.getServer());

    

            // Initialize Web API

            webAPI.begin(webServer.getServer());

    

            // Enable filesystem support in API if USE_FILESYSTEM is enabled

            #if USE_FILESYSTEM

                webAPI.setFilesystemEnabled(true);

            #else

                webAPI.setFilesystemEnabled(false);

            #endif

    

            // Print access URLs

            Serial.println();

            Serial.println("========================================");

            Serial.println("   WEB INTERFACE READY");

            Serial.println("========================================");

            if (wifiManager.isConnected()) {

                Serial.print("   ");

                Serial.println(wifiManager.getMDNSURL());

                Serial.print("   http://");

                Serial.println(wifiManager.getLocalIP());

            } else {

                Serial.print("   http://");

                Serial.println(wifiManager.getLocalIP());

            }

            Serial.println("========================================");

            Serial.println();

        } else {

            Serial.println("⚠ WARNING: Web server initialization failed");

        }

    // Initialize interpreter
    resetInterpreter();

    // Check for auto-start
    if (configManager.isAutoStartEnabled()) {
        Serial.println();
        Serial.println("========================================");
        Serial.println("  Auto-start enabled - starting now...");
        Serial.println("========================================");
        Serial.println();
        delay(1000);
        startExecution();
    }

    // Print menu
    menu.printMenu();
}

// ============================================================================
// LOOP
// ============================================================================

void loop() {
    // Maintain WiFi connection
    wifiManager.maintain();

    // Broadcast status updates via WebSocket
    webSocket.broadcastStatus();

    // Cleanup disconnected WebSocket clients (every 5 seconds)
    static unsigned long lastCleanup = 0;
    if (millis() - lastCleanup > 5000) {
        webSocket.cleanupClients();
        lastCleanup = millis();
    }

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
        // With immediate execution, just call resume()
        // Commands execute automatically via callback
        if (interpreter) {
            interpreter->resume();
            loopIteration++;
            Serial.printf("Iteration: %lu\n", loopIteration);
            commandsExecuted = immediateExecutor.getTotalExecuted();
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
