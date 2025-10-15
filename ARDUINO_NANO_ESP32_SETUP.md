# Arduino Nano ESP32 Setup Guide

## Board Detection

Your ESP32-S3 board is: **Arduino Nano ESP32**

```bash
# Detect connected board
arduino-cli board list
# Output: /dev/ttyACM0  Arduino Nano ESP32  esp32:esp32:nano_nora
```

## Correct Board Configuration

**IMPORTANT**: Use the correct FQBN for your specific board:

```bash
# CORRECT (for your Arduino Nano ESP32):
--fqbn esp32:esp32:nano_nora

# WRONG (generic ESP32-S3 - don't use):
--fqbn esp32:esp32:esp32s3
```

## Compile Command

```bash
# Clean build
rm -rf build_esp32/*

# Compile for Arduino Nano ESP32 (RTTI-free mode)
arduino-cli compile \
  --fqbn esp32:esp32:nano_nora \
  --build-property "build.extra_flags=-DAST_NO_RTTI -fno-rtti" \
  --output-dir ./build_esp32 \
  examples/BasicInterpreter
```

**Build Output:**
- Firmware size: ~900KB (28% of 3.1MB flash)
- RAM usage: ~26KB (7% of 320KB)

## Upload Methods

### Method 1: Using Upload Script (Recommended)

```bash
./upload_to_nano_esp32.sh
```

**Steps:**
1. Run the script
2. Put board in bootloader mode (double-tap RESET or BOOT+RESET)
3. Press ENTER in terminal
4. Firmware uploads automatically

### Method 2: Manual esptool Upload

```bash
# Put board in bootloader mode first!
~/.arduino15/packages/esp32/tools/esptool_py/5.1.0/esptool \
  --chip esp32s3 \
  --port /dev/ttyACM0 \
  --baud 921600 \
  --before default-reset \
  --after hard-reset \
  write-flash -z \
  --flash-mode dio \
  --flash-freq 80m \
  --flash-size 16MB \
  0x0 build_esp32/BasicInterpreter.ino.bootloader.bin \
  0x8000 build_esp32/BasicInterpreter.ino.partitions.bin \
  0x10000 build_esp32/BasicInterpreter.ino.bin
```

### Method 3: arduino-cli upload (if bootloader mode works)

```bash
arduino-cli upload \
  --fqbn esp32:esp32:nano_nora \
  --port /dev/ttyACM0 \
  --input-dir ./build_esp32
```

## Entering Bootloader Mode

The Arduino Nano ESP32 requires manual bootloader mode entry:

**Option 1: Double-Tap Reset (Easiest)**
1. Press RESET button twice quickly (like double-clicking a mouse)
2. Board enters bootloader mode
3. Upload within a few seconds

**Option 2: BOOT + RESET Method**
1. Hold down BOOT button
2. While holding BOOT, press and release RESET
3. Release BOOT button
4. Board is in bootloader mode
5. Upload immediately

## Serial Monitor

```bash
# Monitor serial output (115200 baud for BasicInterpreter sketch)
arduino-cli monitor --port /dev/ttyACM0 --config baudrate=115200
```

## Board Specifications

- **Chip**: ESP32-S3-MINI-1-N8 (8MB Flash)
- **RAM**: 512KB SRAM + 8MB PSRAM
- **USB**: Native USB-OTG (TinyUSB)
- **Pin Numbering**: Arduino style (default) or GPIO numbering
- **Bootloader**: DFU-capable (hence the manual bootloader mode requirement)

## Troubleshooting

### Upload fails with "Could not configure port"
- **Solution**: Put board in bootloader mode manually (see above)

### Upload fails with "DFU device access error"
- **Solution**: Use esptool directly instead of arduino-cli upload
- **Why**: DFU requires special USB permissions, esptool works better

### Board not detected
```bash
# Check USB connection
ls -l /dev/ttyACM*

# Check user is in dialout group
groups | grep dialout
```

### Wrong board selected
```bash
# Always verify detected board first:
arduino-cli board list

# Use the exact FQBN shown (esp32:esp32:nano_nora)
```

## Version Information

- **Project**: ASTInterpreter v21.2.1
- **ESP32 Arduino Core**: 3.3.2
- **esptool**: 5.1.0
- **Compilation Date**: October 15, 2025

## WSL USB Passthrough

Your setup uses WSL with USB passthrough, which is why the board appears at `/dev/ttyACM0`. This is working correctly!

**Verification:**
```bash
arduino-cli board list
# Should show: /dev/ttyACM0  Arduino Nano ESP32
```
