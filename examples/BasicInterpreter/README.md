# BasicInterpreter Example

Basic example demonstrating the ArduinoASTInterpreter library on ESP32 with dual-mode operation.

## Description

This example executes pre-compiled Arduino programs from CompactAST binary format with two operating modes:

- **Embedded Mode (default)**: AST binary stored in PROGMEM array
- **Filesystem Mode**: AST files loaded from FFat flash filesystem

Features demonstrated:
- How to include the library
- Dual-mode operation (embedded vs filesystem)
- FFat filesystem integration
- Simple SyncDataProvider implementation
- Interpreter configuration and execution

## Hardware Requirements

- **Arduino Nano ESP32** (FQBN: arduino:esp32:nano_nora)
  - 8MB Flash (with FFat partition ~1.4MB)
  - 8MB PSRAM (for large AST files)
- USB-C cable for programming and serial monitor

Compatible with other ESP32 boards with FFat support (ESP32-S3, ESP32-S2, etc.)

## Setup

### 1. Install ESP32 Board Support

Arduino IDE 2.x:
- File → Preferences → Additional Board Manager URLs
- Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
- Tools → Board → Boards Manager → Search "ESP32" → Install

### 2. Install ArduinoASTInterpreter Library

- Library Manager → Search "ArduinoASTInterpreter" → Install
- Or manually copy library folder to Arduino/libraries/

### 3. Select Board

- Tools → Board → ESP32 Arduino → Arduino Nano ESP32
- (Or ESP32S3 Dev Module, ESP32 Dev Module, etc.)

### 4. Open Example

- File → Examples → ArduinoASTInterpreter → BasicInterpreter

## Operating Modes

### Embedded Mode (Default)

The simplest mode - AST binary is compiled into the sketch as a PROGMEM array.

**Advantages:**
- No filesystem setup required
- Works immediately after upload
- Smaller flash usage (no filesystem overhead)

**Limitations:**
- Fixed program at compile time
- Requires sketch recompilation to change program

**Usage:**
```cpp
#define USE_FILESYSTEM false  // Default setting
```

Just upload and run!

### Filesystem Mode

Loads AST files from FFat flash filesystem - allows changing programs without recompiling.

**Advantages:**
- Change programs without recompiling sketch
- Multiple AST files can be stored
- Easy program updates via filesystem upload

**Limitations:**
- Requires filesystem setup and data upload
- Slightly higher flash usage (filesystem overhead)

**Setup:**

1. **Install ESP32 Filesystem Uploader Plugin:**
   - Download from: https://github.com/me-no-dev/arduino-esp32fs-plugin
   - Follow installation instructions for Arduino IDE 2.x

2. **Configure Sketch:**
   ```cpp
   #define USE_FILESYSTEM true
   #define DEFAULT_AST_FILE "/ffat/bareMinimum.ast"  // Or blink.ast, digitalReadSerial.ast
   ```

3. **Upload Data Files:**
   - Tools → ESP32 Sketch Data Upload
   - Wait for upload to complete
   - (Files from data/ folder will be uploaded to FFat)

4. **Upload Sketch:**
   - Upload as normal
   - Sketch will load AST from filesystem

## Available AST Files

The data/ folder includes three pre-compiled Arduino examples:

| File | Size | Description |
|------|------|-------------|
| bareMinimum.ast | 1,132 bytes | Empty setup() and loop() functions |
| blink.ast | 1,389 bytes | Classic LED blink (LED_BUILTIN) |
| digitalReadSerial.ast | 1,494 bytes | Read digital input, print to Serial |

To use different programs, change `DEFAULT_AST_FILE` in the sketch:
```cpp
#define DEFAULT_AST_FILE "/ffat/blink.ast"
```

## Expected Output

### Embedded Mode
```
=== Arduino AST Interpreter 21.2.1 ===
Platform: ESP32
Mode: Embedded
AST Binary Size: 1132 bytes

Creating interpreter...
Starting interpreter...
✓ Program started successfully!

Running embedded BareMinimum.ino:
  void setup() { }
  void loop() { }

To use filesystem mode:
  1. Upload data files: Tools > ESP32 Sketch Data Upload
  2. Set USE_FILESYSTEM=true in sketch
  3. Re-upload sketch
```

### Filesystem Mode
```
=== Arduino AST Interpreter 21.2.1 ===
Platform: ESP32
Mode: Filesystem

Initializing FFat filesystem...
✓ FFat mounted successfully
  Total: 1408 KB
  Used: 5 KB
  Free: 1403 KB

Files in FFat:
  /bareMinimum.ast (1132 bytes)
  /blink.ast (1389 bytes)
  /digitalReadSerial.ast (1494 bytes)
  Total: 3 files

Reading AST file: /ffat/bareMinimum.ast
  File size: 1132 bytes
  Allocating from heap...
✓ File read successfully
AST Size: 1132 bytes

Creating interpreter...
✓ AST buffer freed (interpreter has internal copy)
Starting interpreter...
✓ Program started successfully!
```

## How It Works

### Embedded Mode
1. **CompactAST Binary**: Pre-compiled AST (1.1KB) embedded as PROGMEM array
2. **Direct Execution**: Interpreter reads directly from flash memory
3. **SimpleDataProvider**: Provides stub sensor values
4. **Execution**: Calls `start()` to run the program

### Filesystem Mode
1. **FFat Mount**: Mounts flash FAT filesystem at `/ffat`
2. **File Listing**: Shows available AST files for debugging
3. **File Read**: Loads AST file into RAM (uses PSRAM for files >10KB)
4. **Interpreter Creation**: Creates interpreter with loaded data
5. **Memory Cleanup**: Frees buffer (interpreter makes internal copy)
6. **Execution**: Runs the loaded program

## Graceful Fallback

Filesystem mode includes automatic fallback to embedded mode if:
- FFat mount fails
- AST file not found
- File read errors
- Memory allocation fails

This ensures the sketch always works, even without filesystem setup.

## Memory Management

The example uses smart memory allocation:

- **Files ≤10KB**: Regular heap allocation (`malloc`)
- **Files >10KB**: PSRAM allocation (`ps_malloc`)
- **After Loading**: Buffer freed (interpreter makes internal copy)

This optimizes memory usage for the 8MB PSRAM available on Arduino Nano ESP32.

## Creating Custom AST Files

To create your own AST files from Arduino sketches:

1. Write your Arduino sketch (.ino file)
2. Generate CompactAST binary using test data generator
3. Copy .ast file to data/ folder
4. Upload filesystem data to ESP32
5. Update `DEFAULT_AST_FILE` to point to your file

See `docs/ESP32_DEPLOYMENT_GUIDE.md` for detailed instructions.

## Troubleshooting

### Compile Errors

**Error: "FFat.h: No such file or directory"**
- Solution: Make sure ESP32 board support is installed (FFat is ESP32-specific)

**Error: "PLATFORM_NAME was not declared"**
- Solution: Update to latest ArduinoASTInterpreter library version

### Filesystem Issues

**Error: "FFat mount failed"**
- Solution: Upload data files using Tools → ESP32 Sketch Data Upload
- Alternative: Set `FFAT_FORMAT_ON_FAIL true` to auto-format on first boot

**Error: "Failed to open AST file"**
- Solution: Verify file exists by checking Serial output file listing
- Solution: Check filename matches exactly (case-sensitive)
- Solution: Ensure filesystem data was uploaded successfully

**Error: "Memory allocation failed"**
- Solution: Check available PSRAM (should be 8MB on Nano ESP32)
- Solution: Verify PSRAM is enabled in board configuration

### Runtime Issues

**No Serial Output**
- Solution: Open Serial Monitor at 115200 baud
- Solution: Press reset button on board after opening monitor

**Sketch Crashes/Restarts**
- Solution: Check AST file is not corrupted
- Solution: Verify sufficient heap/PSRAM memory
- Solution: Enable debug output for detailed diagnostics

**Wrong Program Running**
- Solution: Verify `USE_FILESYSTEM` setting matches your intent
- Solution: Check `DEFAULT_AST_FILE` path is correct
- Solution: Confirm correct data was uploaded to filesystem

## Next Steps

- Try filesystem mode with different AST files (blink.ast, digitalReadSerial.ast)
- See **AnalogReadExample** for real hardware integration
- Learn how to create your own CompactAST binaries
- Explore advanced features (step-by-step execution, async operations)

## References

- **ESP32 Deployment Guide**: `docs/ESP32_DEPLOYMENT_GUIDE.md`
- **CompactAST Format**: `libs/CompactAST/README.md`
- **Library API**: `src/cpp/ASTInterpreter.hpp`
- **Filesystem Upload Instructions**: `examples/BasicInterpreter/data/README.txt`

## Version Information

- **ASTInterpreter**: v21.2.1
- **CompactAST**: v3.2.0
- **ArduinoParser**: v6.0.0
- **Target Board**: Arduino Nano ESP32 (8MB Flash, 8MB PSRAM)
