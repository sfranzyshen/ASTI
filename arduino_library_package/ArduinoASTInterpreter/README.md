# ArduinoASTInterpreter Library

**Version**: 21.2.1
**Platform**: ESP32-S3 (Arduino Framework)
**License**: Dual-licensed (sfranzyshen.com Source-Available License 1.0 / GNU AGPLv3)

## Installation for Arduino IDE 2

### Method 1: Manual Installation (Recommended)

1. **Locate your Arduino libraries folder:**
   - **Windows**: `Documents\Arduino\libraries\`
   - **macOS**: `~/Documents/Arduino/libraries/`
   - **Linux**: `~/Arduino/libraries/`

2. **Copy the entire `ArduinoASTInterpreter` folder into the libraries directory**

3. **Restart Arduino IDE 2**

4. **Verify installation:**
   - Go to `File > Examples > ArduinoASTInterpreter`
   - You should see `BasicInterpreter` and `AnalogReadExample`

### Method 2: ZIP Installation

1. **Compress the `ArduinoASTInterpreter` folder to ZIP**

2. **In Arduino IDE 2:**
   - Go to `Sketch > Include Library > Add .ZIP Library...`
   - Select the ZIP file
   - Restart Arduino IDE

## Supported Boards

### Arduino Nano ESP32
- **FQBN**: `esp32:esp32:nano_nora`
- **Flash**: 8MB
- **PSRAM**: 8MB
- **Firmware Size**: ~900KB (28% flash usage)
- **Upload**: Use Arduino IDE 2's built-in upload (handles DFU automatically)

### Generic ESP32-S3 Dev Module
- **FQBN**: `esp32:esp32:esp32s3`
- **Flash**: 8MB (configurable)
- **PSRAM**: 8MB PSRAM (configurable)
- **Firmware Size**: ~856KB-900KB depending on configuration

## Configuration

### RTTI Modes

The library supports two build modes:

**RTTI-free (default - smaller binary):**
- File: `examples/BasicInterpreter/build_opt.h`
- Contents: `-DAST_NO_RTTI -fno-rtti`
- Binary size: ~868KB
- **No action required** - Just compile and upload

**RTTI mode (opt-in - runtime safety):**
- Rename or delete `build_opt.h`
- Or copy `build_opt_rtti.h.example` to `build_opt.h`
- Binary size: ~896KB (+28KB)

## Quick Start

### 1. Open Example Sketch

```
File > Examples > ArduinoASTInterpreter > BasicInterpreter
```

### 2. Select Your Board

**For Arduino Nano ESP32:**
```
Tools > Board > esp32 > Arduino Nano ESP32
```

**For Generic ESP32-S3:**
```
Tools > Board > esp32 > ESP32S3 Dev Module
```

### 3. Configure Board Settings (Generic ESP32-S3 only)

```
Tools > USB Mode > Hardware CDC and JTAG
Tools > USB CDC On Boot > Enabled
Tools > PSRAM > OPI PSRAM
Tools > Partition Scheme > Default 4MB with spiffs
```

### 4. Compile and Upload

```
Sketch > Upload
```

Arduino IDE 2 will automatically handle:
- Compilation
- Board detection
- Upload (including DFU mode for Nano ESP32)
- Serial monitor

## Examples Included

### BasicInterpreter
Simple demonstration showing how to:
- Load a CompactAST binary program
- Execute Arduino code from AST
- Use synchronous data provider for hardware simulation

### AnalogReadExample
Advanced example demonstrating:
- Analog sensor reading
- Real-time data processing
- Hardware integration

## Library Structure

```
ArduinoASTInterpreter/
├── library.properties          # Library metadata
├── keywords.txt                # Syntax highlighting
├── src/
│   ├── ArduinoASTInterpreter.h # Main include file
│   ├── CompactAST.cpp          # Binary AST library
│   ├── CompactAST.hpp
│   └── cpp/                    # C++ implementation files
│       ├── ASTInterpreter.cpp
│       ├── ASTInterpreter.hpp
│       ├── ASTNodes.cpp
│       ├── ASTNodes.hpp
│       └── ... (other implementation files)
└── examples/
    ├── BasicInterpreter/
    └── AnalogReadExample/
```

## Usage in Your Sketch

```cpp
#include <ArduinoASTInterpreter.h>

// Your CompactAST binary program
const uint8_t PROGMEM astBinary[] = { /* ... */ };

class MyDataProvider : public SyncDataProvider {
    int32_t getAnalogReadValue(int32_t pin) override {
        return analogRead(pin == 14 ? 36 : pin);
    }
    // Implement other methods...
};

MyDataProvider provider;

void setup() {
    Serial.begin(115200);

    InterpreterOptions opts;
    opts.syncMode = true;

    auto* interpreter = new ASTInterpreter(
        astBinary,
        sizeof(astBinary),
        opts
    );

    interpreter->setSyncDataProvider(&provider);
    interpreter->start();
}

void loop() {
    // Your code here
}
```

## Troubleshooting

### Compilation Errors

**Error: "CompactAST.hpp: No such file or directory"**
- **Solution**: Make sure all files from `src/` folder are present
- **Verify**: Check that `CompactAST.cpp` and `CompactAST.hpp` exist in `src/`

**Error: "undefined reference to CompactASTReader"**
- **Solution**: This means CompactAST.cpp wasn't compiled
- **Fix**: Restart Arduino IDE and clean build (`Sketch > Verify/Compile`)

### Upload Issues (Arduino Nano ESP32)

**DFU mode not working:**
- Arduino IDE 2 handles DFU automatically - just click Upload
- If manual bootloader needed: Double-tap RESET button before upload
- Board LED should show steady or pulsing pattern when in bootloader mode

**Port not found:**
- Check USB cable connection
- Try a different USB port
- Ensure ESP32 board support is installed (`Tools > Board > Boards Manager > esp32`)

### Serial Monitor

**No output appearing:**
- Verify baud rate is set to `115200`
- Check that `Serial.begin(115200)` is in your sketch
- Press RESET button on board after upload

## Memory Usage

**Flash (Program Storage):**
- Basic interpreter: ~900KB
- Available for code: ~7.1MB (8MB total)

**RAM (Dynamic Memory):**
- Basic usage: ~26KB
- Available: ~302KB (328KB total)
- PSRAM available: 8MB for large data structures

## Requirements

- **Arduino IDE**: Version 2.0.0 or later
- **ESP32 Board Support**: Version 3.0.0 or later
  - Install via: `Tools > Board > Boards Manager > esp32`
  - URL: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`

## Documentation

- **Full Documentation**: See main repository README.md
- **ESP32 Deployment Guide**: `docs/ESP32_DEPLOYMENT_GUIDE.md`
- **API Reference**: `src/ArduinoASTInterpreter.h`

## Support

- **GitHub**: https://github.com/sfranzyshen/ASTInterpreter
- **Issues**: https://github.com/sfranzyshen/ASTInterpreter/issues
- **License**: See LICENSE file in repository

## Version History

**v21.2.1** (October 14, 2025)
- WASM playground production ready
- Memory optimization (256MB heap)
- Bulk memory transfer optimization
- Browser deployment tested

**v21.2.0** (October 14, 2025)
- ESP32 RTTI-free default for embedded deployment
- Platform-specific defaults optimization
- Three RTTI opt-in paths documented

**v21.0.0** (October 13, 2025)
- Complete RTTI removal for ESP32 Arduino support
- 113 dynamic_cast → static_cast replacements
- Perfect cross-platform parity (135/135 tests)
