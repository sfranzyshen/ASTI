===============================================================================
ASTInterpreter ESP32 LittleFS Data Files
Arduino Nano ESP32 (FQBN: arduino:esp32:nano_nora)
===============================================================================

This directory contains pre-compiled AST (Abstract Syntax Tree) binary files
for use with the BasicInterpreter sketch in filesystem mode.

FILES INCLUDED
===============================================================================

1. bareMinimum.ast (1,132 bytes)
   - Source: BareMinimum.ino (Arduino Basic Example)
   - Description: Minimal Arduino sketch with empty setup() and loop()
   - Use case: Testing basic interpreter functionality

2. blink.ast (1,389 bytes)
   - Source: Blink.ino (Arduino Basic Example)
   - Description: Classic LED blink example using LED_BUILTIN
   - Use case: Testing GPIO output and delay functions

3. digitalReadSerial.ast (1,494 bytes)
   - Source: DigitalReadSerial.ino (Arduino Basic Example)
   - Description: Reads digital input and prints to Serial
   - Use case: Testing GPIO input, Serial output, and sensor reading

UPLOADING TO ESP32 FLASH
===============================================================================

METHOD 1: Arduino IDE 2.x with ESP32 Filesystem Uploader Plugin
----------------------------------------------------------------
1. Install the plugin from:
   https://github.com/me-no-dev/arduino-esp32fs-plugin

2. Place your .ast files in this data/ folder

3. In Arduino IDE: Tools > ESP32 Sketch Data Upload

4. Wait for upload to complete (LittleFS partition will be formatted automatically)

5. Open Serial Monitor and reset the board to see filesystem contents

METHOD 2: esptool.py Manual Upload (Advanced)
----------------------------------------------------------------
1. Create LittleFS filesystem image:
   mklittlefs -c data/ -s 1441792 littlefs.bin

2. Upload to ESP32:
   esptool.py --chip esp32 --port /dev/ttyACM0 write_flash 0x310000 littlefs.bin

3. Adjust partition address based on your partition table

METHOD 3: PlatformIO (Recommended for Development)
----------------------------------------------------------------
1. Add to platformio.ini:
   board_build.filesystem = littlefs

2. Place .ast files in data/ folder

3. Run: pio run --target uploadfs

USING FILESYSTEM MODE IN SKETCH
===============================================================================

1. Open BasicInterpreter.ino

2. Set the compile-time flag:
   #define USE_FILESYSTEM true

3. (Optional) Change the default AST file:
   #define DEFAULT_AST_FILE "/blink.ast"

4. Upload sketch to ESP32

5. Open Serial Monitor (115200 baud) to see execution

TROUBLESHOOTING
===============================================================================

Error: "LittleFS Mount Failed"
- Ensure filesystem was uploaded using one of the methods above
- Try reformatting by setting LITTLEFS_FORMAT_ON_FAIL to true
- Check Serial output for specific error codes

Error: "Failed to open AST file"
- Verify file exists using the filesystem listing in Serial output
- Check filename matches exactly (case-sensitive)
- Ensure file was uploaded successfully

Error: "AST file too large"
- Check available PSRAM (should be 8MB on Nano ESP32)
- Files larger than 10KB use PSRAM allocation
- Verify PSRAM is enabled in board configuration

Sketch crashes or restarts
- Check AST file is not corrupted
- Verify sufficient heap/PSRAM memory
- Enable debug output in sketch for detailed diagnostics

FALLBACK TO EMBEDDED MODE
===============================================================================

The sketch automatically falls back to embedded PROGMEM mode if:
- Filesystem fails to mount
- AST file cannot be opened
- File read errors occur

Set USE_FILESYSTEM=false to permanently use embedded mode.

CREATING NEW AST FILES
===============================================================================

1. Write Arduino sketch (.ino file)

2. Generate test data:
   cd /mnt/d/Devel/ASTInterpreter
   node tests/generate_test_data.js

3. Copy generated .ast file from test_data/ to this data/ folder

4. Upload to ESP32 using methods above

FILE FORMAT
===============================================================================

AST files use CompactAST binary format (v3.2.0):
- Binary serialized Abstract Syntax Tree
- 12.5x compression ratio vs JSON
- Platform-independent format
- Includes: program structure, variables, functions, expressions

For format details, see: libs/CompactAST/README.md

VERSION INFORMATION
===============================================================================

ASTInterpreter: v22.0.0
CompactAST: v3.2.0
ArduinoParser: v6.0.0

Compatible with Arduino Nano ESP32:
- Flash: 8MB (LittleFS partition available)
- PSRAM: 8MB (for large AST files)
- Default partition: "Default (includes LittleFS)"

===============================================================================
