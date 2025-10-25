# Advanced Interpreter Web Interface

Complete browser-based control interface for the ArduinoASTInterpreter with WiFi connectivity, real-time status updates, file management, and persistent configuration.

---

## ✨ Features

### Core Functionality
- **Real-time Status Monitoring**: Live updates via WebSocket (sub-second refresh)
- **Execution Control**: Run, Pause, Reset, and Step commands from browser
- **File Management**: List, load, and delete .ast files from LittleFS
- **Persistent Configuration**: Auto-start, default file, and update interval settings
- **Dual Interface**: Web interface + Serial menu (both work simultaneously)

### Network Features
- **DHCP IP Assignment**: Automatic IP configuration from router
- **mDNS Support**: Access via `http://astinterpreter.local`
- **Auto-reconnect**: Automatic WiFi connection recovery
- **CORS Support**: Development-friendly API access

### Web Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: WebSocket with HTTP polling fallback
- **Dark Theme**: Modern, eye-friendly interface
- **Toast Notifications**: User-friendly feedback
- **Zero External Dependencies**: All resources embedded

---

## 🚀 Quick Start

### 1. Configure WiFi Credentials

Edit `WiFiConfig.h` and update your WiFi credentials:

```cpp
// WiFi Credentials (DHCP automatic IP assignment)
const char* WIFI_SSID = "YOUR_WIFI_SSID";           // Your WiFi network name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // Your WiFi password

// mDNS Configuration
const char* MDNS_HOSTNAME = "astinterpreter";       // Device hostname (no hyphens)
```

**Note:** IP address is automatically assigned by your router via DHCP. The assigned IP will be displayed in the Serial Monitor after connection.

### 2. Install Required Libraries

Using Arduino Library Manager or PlatformIO:

```
- ESPAsyncWebServer
- AsyncTCP
- ArduinoJson (v6.x)
- LittleFS (built-in for ESP32)
- WiFi (built-in)
- ESPmDNS (built-in)
- Preferences (built-in)
```

**Arduino IDE:**
- Tools → Manage Libraries → Search and install each library

**PlatformIO:**
```ini
lib_deps =
    me-no-dev/ESPAsyncWebServer
    me-no-dev/AsyncTCP
    bblanchon/ArduinoJson @ ^6.21.0
```

### 3. Upload Web Interface Files

#### Option A: PlatformIO (Recommended)
```bash
pio run --target uploadfs
```

#### Option B: Arduino IDE with LittleFS Plugin
1. Install ESP32 LittleFS plugin:
   - Download from: https://github.com/lorol/arduino-esp32littlefs-plugin
   - Extract to: `<Arduino>/tools/ESP32LittleFS/tool/esp32littlefs.jar`
2. Restart Arduino IDE
3. Select: Tools → ESP32 Sketch Data Upload
4. Wait for upload to complete

#### Option C: Manual Upload (esptool.py)
```bash
# Generate LittleFS image
mklittlefs -c data -s 0x100000 littlefs.bin

# Upload to ESP32
esptool.py --chip esp32 --port /dev/ttyUSB0 write_flash 0x310000 littlefs.bin
```

### 4. Upload Sketch
1. Open `AdvancedInterpreter.ino`
2. Select your board (ESP32-S3, Nano ESP32, etc.)
3. Upload sketch
4. Open Serial Monitor (115200 baud)

### 5. Access Web Interface

After successful upload and WiFi connection, you'll see:

```
=================================================
   WEB INTERFACE READY
=================================================
   http://astinterpreter.local
   IP Address: 192.168.x.xxx (DHCP assigned)
=================================================
```

**Primary Access:** http://astinterpreter.local (mDNS)
**Fallback:** Use the DHCP-assigned IP address shown in Serial Monitor

---

## 🎮 Web Interface Guide

### Status Panel
- **State**: Current execution state (stopped/running/paused/step)
- **Iteration**: Number of loop iterations executed
- **Uptime**: Time since interpreter started
- **Commands**: Total commands executed
- **Memory Free**: Available heap memory

### Control Buttons
- **▶ RUN**: Start or resume program execution
- **⏸ PAUSE**: Pause execution at current state
- **⟳ RESET**: Reset interpreter to initial state
- **⏭ STEP**: Execute one command (single-step debugging)

### File Manager
- **List Files**: Displays all .ast files on LittleFS
- **Load**: Load selected file and reset interpreter
- **Delete**: Remove file from filesystem (confirmation required)
- Shows file size and total storage used

### Configuration
- **Auto-start**: Enable to automatically start execution on power-up
- **Default File**: AST file to load on startup
- **Status Interval**: WebSocket status update frequency (100-60000ms)
- **Save**: Persist configuration to NVS (survives reboots)

---

## 📡 API Reference

### REST Endpoints

#### Status
```http
GET /api/status
```
Returns current execution status as JSON.

**Response:**
```json
{
  "state": "running",
  "iteration": 1234,
  "uptime": 123456,
  "uptimeStr": "2m 3.4s",
  "commandsExecuted": 2468,
  "memoryFree": 234560,
  "timestamp": 123456
}
```

#### Control Commands
```http
POST /api/control/run      # Start/resume
POST /api/control/pause    # Pause
POST /api/control/reset    # Reset
POST /api/control/step     # Single step
```

**Response:**
```json
{
  "success": true,
  "message": "Command executed"
}
```

#### File Management
```http
GET /api/files             # List all .ast files

POST /api/files/load       # Load file
Body: {"filename": "/path.ast"}

DELETE /api/files/delete?name=filename  # Delete file
```

#### Configuration
```http
GET /api/config            # Get current config

POST /api/config           # Update config
Body: {
  "autoStart": true,
  "defaultFile": "/blink.ast",
  "statusInterval": 1000
}
```

### WebSocket Events

Connect to: `ws://astinterpreter.local/ws` or `ws://<dhcp-ip>/ws`

**Server → Client Messages:**
```json
// Status Update (every 500ms when connected)
{
  "type": "status_update",
  "timestamp": 123456,
  "data": { ... }
}

// File Loaded
{
  "type": "file_loaded",
  "data": {
    "filename": "/blink.ast",
    "size": 1389
  }
}

// Error
{
  "type": "error",
  "message": "Error description"
}

// Connection Info
{
  "type": "connection_info",
  "clientId": 1,
  "message": "Connected"
}
```

**Client → Server Messages:**
```json
// Ping (keepalive)
{"type": "ping"}

// Request Status
{"type": "request_status"}
```

---

## 🔧 Troubleshooting

### WiFi Connection Issues

**Problem**: WiFi fails to connect
- Check SSID and password in `WiFiConfig.h`
- Verify router allows DHCP clients
- Check WiFi signal strength is adequate
- Review Serial Monitor for connection status

**Problem**: Need to know device IP address
- Check Serial Monitor after WiFi connection
- IP address displayed: "IP Address (DHCP): xxx.xxx.xxx.xxx"
- Use this IP if mDNS doesn't work on your network

**Problem**: IP address changes on reboot
- This is normal with DHCP
- Use mDNS hostname (`astinterpreter.local`) for consistent access
- Or configure DHCP reservation in router settings for static assignment

**Problem**: mDNS not working (`astinterpreter.local`)
- mDNS requires compatible router/network
- Apple devices (iOS/macOS) support mDNS natively
- Android/Windows may need Bonjour service or avahi
- Use DHCP-assigned IP address as fallback (shown in Serial Monitor)

### Web Interface Issues

**Problem**: 404 error on web interface
- Web files not uploaded to LittleFS
- Use correct upload method for your platform
- Verify files exist: Serial Monitor shows "Found /index.html"

**Problem**: WebSocket connection fails
- Check firewall settings
- Ensure browser supports WebSocket (all modern browsers do)
- HTTP polling fallback should work automatically
- Check Serial Monitor for WebSocket connection logs

**Problem**: API calls fail
- CORS may be blocked by browser security
- Access via mDNS hostname instead of IP
- Check ESP32 is on same network as browser
- Serial Monitor shows API request logs

### Performance Issues

**Problem**: Slow status updates
- Increase `statusInterval` in configuration
- Check WiFi signal strength (Serial Monitor shows RSSI)
- Reduce number of connected clients (max 4)

**Problem**: Memory warnings
- ESP32 heap is limited (~200-300KB free typical)
- Close unused WebSocket connections
- Reset device if memory critically low

### File Management Issues

**Problem**: Cannot upload .ast files
- LittleFS partition must be created during upload
- Use PlatformIO "Build Filesystem Image" + "Upload Filesystem"
- Arduino IDE requires LittleFS plugin installed
- Check partition table includes LittleFS partition

**Problem**: File operations fail
- LittleFS may be full (check Serial Monitor)
- File names must start with `/`
- File names are case-sensitive
- Maximum filename length is 64 characters

---

## 🔐 Security Considerations

### Current Implementation
- **No Authentication**: Web interface is open to anyone on network
- **No Encryption**: HTTP only (not HTTPS)
- **Local Network Only**: Not intended for internet exposure

### Recommendations for Production
1. **Add Authentication**: Implement HTTP Basic Auth or form-based login
2. **Use HTTPS**: Enable TLS/SSL for encrypted communication
3. **Firewall Rules**: Restrict access to specific IP ranges
4. **Change mDNS Name**: Use unique hostname to avoid conflicts
5. **Disable Web Interface**: Set `webInterfaceEnabled = false` if not needed

### Example: Adding Basic Authentication
```cpp
// In setup(), before webAPI.begin():
server->on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    if(!request->authenticate("admin", "password")) {
        return request->requestAuthentication();
    }
    // ... serve page
});
```

---

## 📊 Configuration Reference

### WiFiConfig.h Settings
| Setting | Default | Description |
|---------|---------|-------------|
| WIFI_SSID | "YOUR_WIFI_SSID" | WiFi network name |
| WIFI_PASSWORD | "YOUR_WIFI_PASSWORD" | WiFi password |
| MDNS_HOSTNAME | "astinterpreter" | mDNS hostname (no hyphens) |
| CONNECT_TIMEOUT | 20000ms | Connection timeout |
| RECONNECT_INTERVAL | 30000ms | Reconnect delay |

**Note:** IP address, gateway, subnet, and DNS are automatically configured by DHCP.

### Runtime Configuration (NVS)
| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| autoStart | false | bool | Auto-start on boot |
| defaultFile | "/blink.ast" | string | Default AST file |
| statusInterval | 1000ms | 100-60000ms | Update frequency |
| webEnabled | true | bool | Enable web interface |

---

## 🎯 Example Workflows

### 1. Remote Program Upload
```bash
# Generate AST on computer
node generate_ast.js myprogram.ino > myprogram.ast

# Upload via curl (use mDNS hostname)
curl -X POST http://astinterpreter.local/upload \
     --data-binary @myprogram.ast

# Load via web interface
# Click "Load" button next to myprogram.ast
```

### 2. Automated Testing
```python
import requests

# Use mDNS hostname for consistent access
BASE_URL = 'http://astinterpreter.local'

# Start execution
requests.post(f'{BASE_URL}/api/control/run')

# Wait and check status
time.sleep(5)
status = requests.get(f'{BASE_URL}/api/status').json()
assert status['state'] == 'running'

# Pause and verify
requests.post(f'{BASE_URL}/api/control/pause')
status = requests.get(f'{BASE_URL}/api/status').json()
assert status['state'] == 'paused'
```

### 3. Batch File Management
```bash
# Use mDNS hostname for reliable access
HOST="http://astinterpreter.local"

# List all files
curl $HOST/api/files

# Delete old files
for file in test1.ast test2.ast test3.ast; do
    curl -X DELETE "$HOST/api/files/delete?name=$file"
done

# Load specific file
curl -X POST $HOST/api/files/load \
     -H "Content-Type: application/json" \
     -d '{"filename": "/production.ast"}'
```

---

## 🐛 Debug Mode

Enable verbose logging in Serial Monitor:

```cpp
// In setup(), before initializing components:
Serial.setDebugOutput(true);
```

This shows:
- HTTP requests and responses
- WebSocket connections/disconnections
- API endpoint calls
- File operations
- Configuration changes
- DHCP IP assignment details

---

## 📝 Change Log

### Version 22.0.0 (2025-10-25)
- ✅ Initial web interface implementation
- ✅ WiFi connectivity with DHCP and mDNS
- ✅ RESTful API for all operations
- ✅ WebSocket real-time updates
- ✅ File management (list/load/delete)
- ✅ Persistent configuration
- ✅ Responsive HTML5 interface
- ✅ Auto-start functionality
- ✅ Dual interface (web + serial)
- ✅ mDNS hostname: astinterpreter.local

---

## 📚 Additional Resources

- **Main Documentation**: See `AdvancedInterpreter.ino` header
- **ESP32 Deployment Guide**: `docs/ESP32_DEPLOYMENT_GUIDE.md`
- **API Testing**: Use Postman or curl for REST API testing
- **WebSocket Testing**: Use browser console or wscat tool

---

## 💡 Tips and Best Practices

1. **Always test with serial interface first** before relying on web interface
2. **Keep firmware updated** for latest features and bug fixes
3. **Use meaningful .ast filenames** for easy identification
4. **Enable auto-start carefully** - ensure program is stable first
5. **Monitor memory usage** via status panel
6. **Bookmark mDNS URL** (http://astinterpreter.local) for reliable access
7. **Use single-step mode** for debugging complex programs
8. **Save configuration** after making changes
9. **Check Serial Monitor** for DHCP-assigned IP address
10. **Keep WiFi signal strong** for best WebSocket performance

---

## 🆘 Support

For issues, questions, or contributions:
- Check Serial Monitor output for diagnostic information
- Review this README and troubleshooting section
- Consult ArduinoASTInterpreter project documentation
- Report bugs with full Serial Monitor output

---

**Happy Interpreting! 🚀**
