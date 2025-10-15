# BasicInterpreter Example

Basic example demonstrating the ArduinoASTInterpreter library on ESP32-S3.

## Description

This example executes a pre-compiled Arduino program (BareMinimum.ino) from CompactAST binary format. It demonstrates:

- How to include the library
- How to embed a CompactAST binary in your sketch
- How to create a simple SyncDataProvider
- How to configure and start the interpreter

## Hardware Requirements

- ESP32-S3 DevKit-C (or compatible)
- USB-C cable for programming and serial monitor

## Setup

1. Install ESP32 board support in Arduino IDE:
   - File → Preferences → Additional Board Manager URLs
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board → Boards Manager → Search "ESP32" → Install

2. Install ArduinoASTInterpreter library:
   - Library Manager → Search "ArduinoASTInterpreter" → Install
   - Or manually copy library folder to Arduino/libraries/

3. Select board:
   - Tools → Board → ESP32 Arduino → ESP32S3 Dev Module

4. Open this example:
   - File → Examples → ArduinoASTInterpreter → BasicInterpreter

## Expected Output

```
=== Arduino AST Interpreter v15.0.0 ===
Platform: ESP32-S3
AST Binary Size: 1132 bytes

Creating interpreter...
Starting interpreter...
✓ Program started successfully!

This example runs BareMinimum.ino:
  void setup() { }
  void loop() { }
```

## How It Works

1. **CompactAST Binary**: The example embeds a pre-compiled AST binary (1.1KB) generated from BareMinimum.ino
2. **SimpleDataProvider**: Provides stub values for sensor readings (not needed for BareMinimum)
3. **Interpreter Creation**: Creates ASTInterpreter with the binary data
4. **Execution**: Calls `start()` to execute the program

## Next Steps

- See AnalogReadExample for real hardware integration
- Learn how to create your own CompactAST binaries (see docs/ESP32_DEPLOYMENT_GUIDE.md)
- Explore advanced features like step-by-step execution

## Troubleshooting

**Compile Error**: Make sure ESP32 board support is installed and correct board is selected.

**Upload Failed**: Check USB cable connection and USB driver installation.

**No Serial Output**: Open Serial Monitor at 115200 baud after uploading.
