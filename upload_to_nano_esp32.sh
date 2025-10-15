#!/bin/bash
# Upload script for Arduino Nano ESP32
echo "=== Arduino Nano ESP32 Upload Script ==="
echo "Board: Arduino Nano ESP32 (ESP32-S3)"
echo "Port: /dev/ttyACM0"
echo ""
echo "Put board in bootloader mode:"
echo "  Option 1: Double-tap RESET button quickly"
echo "  Option 2: Hold BOOT, press RESET, release BOOT"
echo ""
read -p "Press ENTER when board is in bootloader mode..."

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

echo ""
echo "Upload complete! Board should reset automatically."
