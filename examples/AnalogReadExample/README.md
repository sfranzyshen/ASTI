# AnalogReadExample

Demonstrates real ESP32-S3 hardware integration with the ArduinoASTInterpreter library.

## Hardware Setup

- Connect analog sensor (potentiometer) to GPIO36 (A0)
- Or connect GPIO36 to 3.3V through 10K resistor for testing

## Description

This example shows how to create a HardwareDataProvider that connects the interpreter to real ESP32 pins. The data provider maps Arduino pin numbers to ESP32 GPIO pins and reads actual sensor values.

## Key Concept

The `HardwareDataProvider` class implements `SyncDataProvider` interface to provide real hardware readings to the interpreter, enabling true hardware integration while running interpreted Arduino code.

See BasicInterpreter for complete interpreter integration example.
