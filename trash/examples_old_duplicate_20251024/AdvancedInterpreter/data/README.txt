Advanced Interpreter - LittleFS Data Files
==========================================

This folder contains pre-compiled Arduino AST files for the AdvancedInterpreter example.

Files:
------
blink.ast - Classic Blink example (LED_BUILTIN blinks at 1Hz)
  Program: pinMode(LED_BUILTIN, OUTPUT);
           loop() { digitalWrite(LED_BUILTIN, HIGH); delay(1000); digitalWrite(LED_BUILTIN, LOW); delay(1000); }
  Size: 1389 bytes

How to Upload to LittleFS:
---------------------------

OPTION 1: ESP32 Sketch Data Upload Plugin (Arduino IDE)

1. Install the LittleFS upload plugin:
   - Download from: https://github.com/earlephilhower/arduino-littlefs-upload
   - Extract to Arduino/tools/ folder
   - Restart Arduino IDE

2. Place your .ast files in this data/ folder

3. Upload to ESP32:
   - Arduino IDE: Tools > ESP32 Sketch Data Upload
   - Wait for "LittleFS Image Uploaded" message

4. Verify upload:
   - Set USE_FILESYSTEM=true in AdvancedInterpreter.ino
   - Upload and run sketch
   - Check Serial Monitor for "✓ LittleFS mounted successfully"

OPTION 2: PlatformIO (Recommended for advanced users)

1. Install PlatformIO
2. Use "Upload Filesystem Image" task
3. Files automatically uploaded to LittleFS partition

Troubleshooting:
----------------

Problem: "LittleFS mount failed"
Solution:
  1. Ensure plugin is installed correctly
  2. Verify data/ folder contains .ast files
  3. Check ESP32 board has LittleFS partition (8MB flash boards work best)
  4. Try setting LITTLEFS_FORMAT_ON_FAIL=true (formats partition on first use)

Problem: "Failed to open file"
Solution:
  1. Verify file was uploaded (check filesystem listing in serial output)
  2. Check filename matches DEFAULT_AST_FILE in sketch
  3. Ensure file path starts with "/" (e.g., "/blink.ast")

For more information:
---------------------
See main project documentation: docs/ESP32_DEPLOYMENT_GUIDE.md

