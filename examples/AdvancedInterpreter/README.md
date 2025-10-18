# AdvancedInterpreter Example

Advanced demonstration of ArduinoASTInterpreter with continuous execution, real command processing, and menu-driven control.

## Overview

This example demonstrates **production-ready** interpreter usage with:
- **Real Interpreter Execution**: Hosts actual ASTInterpreter instance
- **Real Command Processing**: Executes pinMode, digitalWrite, delay on real hardware
- **Continuous Loop Execution**: Runs infinitely (not just once)
- **Menu-Driven Interface**: Serial Monitor control (Run/Pause/Reset/Status/Step)
- **Step Mode**: Execute one command at a time for debugging
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
6 or T - Step (execute one command)
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
6. Step (execute one command)
====================================

Enter command (1-6): 1

[RUNNING] Execution started

[STATUS] Iteration: 1 | Uptime: 2.0s
[STATUS] Iteration: 2 | Uptime: 4.1s

Enter command (1-6): 2
[PAUSED] Paused at iteration 3

Enter command (1-6): 6
[STEP] Executed: {"type":"DIGITAL_WRITE","pin":13,"value":"HIGH"}

Enter command (1-6): 4
========== STATUS ==========
  State: STEP
  Iterations: 3
  Uptime: 6.5s
  Commands: 15
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
├── AdvancedInterpreter.ino    # Main sketch with real interpreter
├── CommandQueue.h             # Command queue (CommandCallback impl)
├── CommandExecutor.h          # Hardware execution engine (JSON → GPIO)
├── ESP32DataProvider.h        # Real sensor data (SyncDataProvider impl)
├── SerialMenu.h               # Menu interface
├── data/                      # LittleFS files
│   ├── blink.ast             # Blink program AST
│   └── README.txt            # Upload instructions
└── README.md                  # This file
```

## How It Works

### Architecture

```
                        ┌─────────────────────┐
                        │  ASTInterpreter     │
                        │  (Blink Program)    │
                        └──────────┬──────────┘
                                   │ CommandCallback
                                   ▼
                        ┌─────────────────────┐
                        │  CommandQueue       │
                        │  (onCommand)        │
                        └──────────┬──────────┘
                                   │ JSON Commands
                                   ▼
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ Serial Menu  │────▶│ Execution Control   │────▶│ Command      │
│ (User Input) │     │ (State Machine)     │     │ Executor     │
└──────────────┘     └─────────────────────┘     └──────┬───────┘
                                                          │ pinMode()
                                                          │ digitalWrite()
                                                          │ delay()
                                                          ▼
                                                  ┌──────────────┐
                                                  │ LED_BUILTIN  │
                                                  │ (Real HW)    │
                                                  └──────────────┘
```

### Real Command Flow

1. **Interpreter Generates Commands**:
   - `interpreter->start()` executes setup()
   - `interpreter->resume()` executes loop()
   - Commands passed to CommandQueue via callback

2. **Commands Queued**:
   - CommandQueue::onCommand() receives JSON
   - Queue stores commands for processing
   - Parent app controls execution rate

3. **Commands Executed**:
   - CommandExecutor parses JSON
   - Calls real Arduino functions (pinMode, digitalWrite, delay)
   - LED blinks on real hardware

### Execution States

```cpp
enum ExecutionState {
    STATE_STOPPED,      // Interpreter not running
    STATE_RUNNING,      // Continuous execution
    STATE_PAUSED,       // Execution halted, state preserved
    STATE_STEP_MODE     // Execute one command at a time
};
```

### Execution Flow

1. **Setup**:
   - Initialize Serial Monitor (115200 baud)
   - Configure LED_BUILTIN as OUTPUT
   - Load AST (embedded or filesystem)
   - Create interpreter instance
   - Connect CommandQueue (callback)
   - Connect ESP32DataProvider (sensor data)
   - Display menu

2. **Loop** (when RUNNING):
   - Check for serial commands
   - Generate commands: `interpreter->resume()`
   - Execute queued commands on real hardware
   - Update iteration count
   - Display periodic status

3. **Loop** (when STEP_MODE):
   - Wait for step command
   - Generate one command batch
   - Execute ONE command only
   - Display executed command
   - Wait for next step

4. **Menu Handling**:
   - Run/Resume: Start/continue execution
   - Pause: Stop execution, maintain state
   - Reset: Delete interpreter, recreate from scratch
   - Status: Show detailed execution info
   - Step: Execute single command (debug mode)
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
- Status updates appear every 10 seconds
- Each iteration = one loop() execution

### 4. Control Execution

- Press `2` or `P` to pause
- Press `1` or `R` to resume
- Press `3` or `X` to reset (recreates interpreter)
- Press `4` or `S` for detailed status
- Press `6` or `T` for step-by-step debugging

### 5. Step Mode Debugging

```
Enter command: 6
[STEP] Executed: {"type":"DIGITAL_WRITE","pin":13,"value":"HIGH"}

Enter command: 6
[STEP] Executed: {"type":"DELAY","ms":1000}

Enter command: 6
[STEP] Executed: {"type":"DIGITAL_WRITE","pin":13,"value":"LOW"}
```

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

### Real Interpreter Execution

This example demonstrates **production architecture** for ESP32 deployment:

1. **CommandCallback Pattern**: Interpreter NEVER outputs to Serial directly
   - Calls `commandCallback->onCommand(jsonString)`
   - Parent app receives commands via callback
   - Decouples interpreter from I/O handling

2. **CommandQueue**: Implements CommandCallback interface
   - Queues commands for parent app to process
   - Allows rate control (step mode, pause/resume)
   - Prevents command overflow

3. **CommandExecutor**: Parses JSON and executes on hardware
   - `{"type":"PIN_MODE","pin":13,"mode":"OUTPUT"}` → `pinMode(13, OUTPUT)`
   - `{"type":"DIGITAL_WRITE","pin":13,"value":"HIGH"}` → `digitalWrite(13, HIGH)`
   - `{"type":"DELAY","ms":1000}` → `delay(1000)`

4. **ESP32DataProvider**: Real sensor data for interpreter
   - Implements SyncDataProvider interface
   - Returns real values from `analogRead()`, `digitalRead()`, etc.
   - Enables interpreter to interact with physical world

### Command Processing Components

**Active Production Components**:
- **CommandQueue.h**: Command callback implementation (receives from interpreter)
- **CommandExecutor.h**: JSON parser and hardware executor (executes on ESP32)
- **ESP32DataProvider.h**: Real hardware sensor data provider
- **SerialMenu.h**: Menu interface (user control)

This is a **complete, working implementation** - not a simulation!

### Why This Architecture?

1. **Separation of Concerns**:
   - Interpreter: AST execution logic
   - Parent App: I/O, command processing, user interface

2. **Flexibility**:
   - Commands can be printed (BasicInterpreter)
   - Commands can be executed (AdvancedInterpreter)
   - Commands can be logged, transmitted, etc.

3. **Cross-Platform**:
   - Same pattern as WASM (stringstream capture)
   - Same pattern as test tools (stdout redirect)
   - Unified architecture across all platforms

## Customization

### Change Status Interval

```cpp
#define STATUS_UPDATE_INTERVAL 10000  // Status every 10 seconds
```

### Different LED Pin

```cpp
#define BLINK_LED LED_BUILTIN  // Change to any GPIO pin
```

### Add Custom Commands

Extend `CommandExecutor.h` to handle additional command types:
```cpp
if (type == "ANALOG_WRITE") {
    int pin = extractIntField(jsonObj, "pin");
    int value = extractIntField(jsonObj, "value");
    analogWrite(pin, value);
    return true;
}
```

## Troubleshooting

### LED Doesn't Blink
- Check Serial Monitor for command output in step mode
- Verify LED_BUILTIN is correctly defined for your board
- Check LED connection if using external LED
- Try step mode to see exact commands being executed

### Menu Not Responding
- Check Serial Monitor baud rate (must be 115200)
- Verify USB connection
- Try resetting board

### Filesystem Mount Failed
- See `data/README.txt` for LittleFS upload instructions
- Set `USE_FILESYSTEM=false` to use embedded mode
- Check board has 8MB flash with LittleFS partition

### Commands Not Executing
- Enable step mode to see exact JSON commands
- Check CommandExecutor.h for supported command types
- Verify pin numbers match your board

## Next Steps

- **Add Custom Programs**: Replace blink.ast with your own AST files
- **Add More Commands**: Extend CommandExecutor for analogWrite, tone, etc.
- **Add Web Interface**: Serve controls over WiFi
- **Log to SD Card**: Record execution history and commands
- **Multi-Program Support**: Load different AST files dynamically

## See Also

- `examples/BasicInterpreter/` - Simple one-shot execution example (prints commands)
- `docs/ESP32_DEPLOYMENT_GUIDE.md` - Comprehensive ESP32 setup guide
- Main README.md - Project overview and architecture
