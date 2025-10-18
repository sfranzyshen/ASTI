# AdvancedInterpreter Example

Advanced demonstration of ArduinoASTInterpreter with continuous execution and menu-driven control.

## Overview

This example extends BasicInterpreter to provide:
- **Continuous Loop Execution**: Runs infinitely (not just once)
- **Menu-Driven Interface**: Serial Monitor control (Run/Pause/Reset/Status/Help)
- **Status Updates**: Periodic iteration count and uptime display
- **Real Hardware**: Blinks LED_BUILTIN at 1Hz
- **Dual Modes**: Embedded (PROGMEM) and Filesystem (LittleFS) modes

## Features

### Menu Commands
```
1 or R - Run/Resume execution
2 or P - Pause execution
3 or X - Reset program
4 or S - Show detailed status
5 or H - Show help menu
```

### Serial Monitor Output Example
```
=================================================
   Arduino Advanced AST Interpreter 21.2.1
=================================================
Platform: ESP32
Mode: Embedded
Program: Blink (LED_BUILTIN)
=================================================

=============== MENU ===============
1. Run/Resume
2. Pause
3. Reset Program
4. Show Status
5. Help (this menu)
====================================

Enter command (1-5): 1

[RUNNING] Execution started

[STATUS] Iteration: 100 | Uptime: 100.2s
[STATUS] Iteration: 200 | Uptime: 200.5s

Enter command (1-5): 2
[PAUSED] Paused at iteration 234

Enter command (1-5): 4
========== STATUS ==========
  State: PAUSED
  Iterations: 234
  Uptime: 3m 54s
  Commands: 936
  LED: HIGH
============================
```

## Hardware Requirements

- **Arduino Nano ESP32** (or compatible ESP32-S3 board)
- Built-in LED (or external LED connected to LED_BUILTIN pin)
- USB cable for Serial Monitor

## Configuration

### Embedded Mode (Default)
```cpp
#define USE_FILESYSTEM false
```
- Uses PROGMEM-embedded Blink AST
- No filesystem required
- Immediate operation

### Filesystem Mode
```cpp
#define USE_FILESYSTEM true
```
- Loads blink.ast from LittleFS
- Requires ESP32 Sketch Data Upload
- See `data/README.txt` for upload instructions

## File Structure

```
AdvancedInterpreter/
├── AdvancedInterpreter.ino    # Main sketch
├── CommandBuffer.h            # Command stream capture
├── CommandExecutor.h          # Hardware execution engine
├── SerialMenu.h               # Menu interface
├── data/                      # LittleFS files
│   ├── blink.ast             # Blink program AST
│   └── README.txt            # Upload instructions
└── README.md                  # This file
```

## How It Works

### Architecture

```
User Input → Serial Menu → Execution Control → LED Blink
                              ↓
                         Status Updates
```

### Execution Flow

1. **Setup**:
   - Initialize Serial Monitor (115200 baud)
   - Configure LED_BUILTIN as OUTPUT
   - Load AST (embedded or filesystem)
   - Display menu

2. **Loop** (when RUNNING):
   - Check for serial commands
   - Execute Blink logic (toggle LED every second)
   - Update iteration count
   - Display periodic status

3. **Menu Handling**:
   - Run/Resume: Start/continue execution
   - Pause: Stop execution, maintain state
   - Reset: Clear state, restart from beginning
   - Status: Show detailed execution info
   - Help: Display command reference

## Usage

### 1. Upload Sketch

**Arduino IDE**:
```
File > Open > AdvancedInterpreter.ino
Tools > Board > Arduino Nano ESP32
Tools > Upload
```

**PlatformIO**:
```bash
cd examples/AdvancedInterpreter
pio run -t upload
```

### 2. Open Serial Monitor

- Set baud rate to **115200**
- Watch for menu and banner

### 3. Start Execution

- Press `1` or type `R` and press Enter
- LED should start blinking
- Status updates appear every 100 iterations

### 4. Control Execution

- Press `2` or `P` to pause
- Press `1` or `R` to resume
- Press `3` or `X` to reset
- Press `4` or `S` for status

## Filesystem Mode Setup

### Upload Data Files

1. **Install LittleFS Upload Plugin**:
   - Download: https://github.com/earlephilhower/arduino-littlefs-upload
   - Extract to `Arduino/tools/`
   - Restart Arduino IDE

2. **Upload Data**:
   - Arduino IDE: `Tools > ESP32 Sketch Data Upload`
   - Wait for "LittleFS Image Uploaded" message

3. **Enable Filesystem Mode**:
   ```cpp
   #define USE_FILESYSTEM true
   ```

4. **Upload Sketch** and verify Serial Monitor shows:
   ```
   ✓ LittleFS mounted successfully
   Loaded: /blink.ast (1389 bytes)
   ```

## Technical Notes

### Why Manual Blink Implementation?

This demonstration uses manual LED control instead of parsing interpreter commands because:

1. **OUTPUT_STREAM Complexity**: ESP32's OUTPUT_STREAM (std::cout → Serial) is difficult to redirect at runtime
2. **Pragmatic Demonstration**: Shows the CONCEPT of continuous execution and menu control
3. **Production Path**: A full implementation would:
   - Modify PlatformAbstraction.hpp to add custom stream
   - Capture JSON command stream
   - Parse with CommandExecutor
   - Execute on real hardware

### Command Processing Components

While not used in this simplified demo, the included headers demonstrate production architecture:

- **CommandBuffer.h**: Captures interpreter JSON output
- **CommandExecutor.h**: Parses JSON and executes hardware operations
- **SerialMenu.h**: Menu interface (actively used)

These provide a foundation for full command-processing implementations.

## Customization

### Change Blink Rate

Modify the cycle time in `loop()`:
```cpp
unsigned long cycleTime = currentTime % 2000;  // 2-second cycle (2000ms)
```

Change to 4000 for 2-second blink, 1000 for 0.5-second blink, etc.

### Change Status Interval

```cpp
#define STATUS_UPDATE_INTERVAL 100  // Status every 100 iterations
```

### Different LED Pin

```cpp
#define BLINK_LED LED_BUILTIN  // Change to any GPIO pin
```

## Troubleshooting

### LED Doesn't Blink
- Verify LED_BUILTIN is correctly defined for your board
- Check LED connection if using external LED
- Try different LED pin

### Menu Not Responding
- Check Serial Monitor baud rate (must be 115200)
- Verify USB connection
- Try resetting board

### Filesystem Mount Failed
- See `data/README.txt` for LittleFS upload instructions
- Set `USE_FILESYSTEM=false` to use embedded mode
- Check board has 8MB flash with LittleFS partition

## Next Steps

- **Add Custom Programs**: Replace blink.ast with your own AST files
- **Implement Full Command Processing**: Use CommandBuffer + CommandExecutor
- **Add Web Interface**: Serve controls over WiFi
- **Log to SD Card**: Record execution history

## See Also

- `examples/BasicInterpreter/` - Simple one-shot execution example
- `docs/ESP32_DEPLOYMENT_GUIDE.md` - Comprehensive ESP32 setup guide
- Main README.md - Project overview and architecture

