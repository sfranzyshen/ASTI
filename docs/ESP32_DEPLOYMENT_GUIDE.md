# ESP32-S3 Deployment Guide

Complete guide for deploying ArduinoASTInterpreter on ESP32-S3 hardware.

## ✅ ESP32 SUPPORT ENABLED - v21.1.1

**STATUS**: ESP32/Arduino builds are **FULLY SUPPORTED** with **RTTI FLEXIBILITY** as of v21.1.1 (October 13, 2025).

**What's New in v21.1.1**: Perfect cross-platform parity - ALL platforms (Linux, WASM, ESP32) now offer identical RTTI/RTTI-free choice with universal RTTI default.

**RTTI Flexibility**:
- ✅ **RTTI Mode (default)**: Runtime type safety with `dynamic_cast` - 906KB flash
- ✅ **RTTI-Free Mode (opt-in)**: Size optimization with `static_cast` - 866KB flash (40KB savings)
- ✅ **Universal Default**: RTTI enabled by default on ALL platforms (safety-first philosophy)
- ✅ **Explicit Opt-In**: Size optimization available via explicit configuration choice

**Platform Support** (v21.1.1):
- ✅ **Linux/Desktop**: Full support with RTTI/RTTI-free choice
- ✅ **WebAssembly/WASM**: Full support with RTTI/RTTI-free choice
- ✅ **ESP32/Arduino**: Full support with RTTI/RTTI-free choice

**Configuration Options**:
- **Arduino IDE (RTTI default)**: Open sketch and compile - uses committed `build_opt.h`
- **PlatformIO (RTTI-free)**: `pio run -e esp32-s3-no-rtti` for size optimization

**Migration**: No API changes required. All functionality maintained with identical behavior in both RTTI modes.

## Hardware Requirements

- **Board**: ESP32-S3 DevKit-C (or compatible)
- **Flash**: 8 MB (library uses 1.6MB, leaves 6.4MB for user code)
- **RAM**: 512 KB SRAM + 8 MB PSRAM
- **USB**: USB-C cable for programming

## Memory Budget

| Component | Size | Percentage |
|-----------|------|------------|
| Library (MinSizeRel) | 1.6 MB | 20% of flash |
| Available for sketches | 6.4 MB | 80% of flash |
| Typical sketch overhead | ~100-500 KB | Variable |

## Installation

### Arduino IDE

1. **Install ESP32 Board Support:**
   - File → Preferences → Additional Board Manager URLs
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board → Boards Manager → Search "ESP32" → Install

2. **Install Library:**
   - Sketch → Include Library → Manage Libraries
   - Search "ArduinoASTInterpreter" → Install
   - Or manually: Copy library folder to `Arduino/libraries/`

3. **Select Board:**
   - Tools → Board → ESP32 Arduino → ESP32S3 Dev Module
   - Tools → USB CDC On Boot → Enabled
   - Tools → Port → Select your COM port

### PlatformIO

Add to `platformio.ini`:
```ini
[env:esp32-s3]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
lib_deps =
    https://github.com/sfranzyshen/ASTInterpreter.git
```

Build and upload:
```bash
pio run -e esp32-s3 -t upload
```

## Creating CompactAST Binaries

1. **Write Arduino sketch** (example.ino)
2. **Convert to CompactAST** using JavaScript parser:
   ```javascript
   const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');
   const source = fs.readFileSync('example.ino', 'utf8');
   const ast = parse(source);
   const binary = exportCompactAST(ast);
   fs.writeFileSync('example.ast', binary);
   ```
3. **Convert to C array**:
   ```bash
   ./scripts/ast_to_c_array.sh example.ast > example_array.txt
   ```
4. **Embed in ESP32 sketch** (copy array from example_array.txt)

## Basic Usage

```cpp
#include <ArduinoASTInterpreter.h>

const uint8_t PROGMEM astBinary[] = { /* ... */ };

class MyDataProvider : public SyncDataProvider {
    int32_t getAnalogReadValue(int32_t pin) override {
        return analogRead(pin == 14 ? 36 : pin); // Map A0 to GPIO36
    }
    // ... implement other methods
};

MyDataProvider provider;

void setup() {
    Serial.begin(115200);

    InterpreterOptions opts;
    opts.syncMode = true;

    auto* interpreter = new ASTInterpreter(astBinary, sizeof(astBinary), opts);
    interpreter->setSyncDataProvider(&provider);
    interpreter->start();
}
```

## Examples

- **BasicInterpreter**: Minimal example with no hardware dependencies
- **AnalogReadExample**: Real hardware integration with GPIO36

## Troubleshooting

**Compile errors**: Verify ESP32 board support installed and correct board selected

**Upload failed**: Check USB cable, drivers, and correct COM port selected

**No serial output**: Open Serial Monitor at 115200 baud after upload completes

**Out of memory**: Reduce maxLoopIterations or optimize sketch size

## Build Optimization

For production, use size-optimized build:
```ini
build_flags = -Os -ffunction-sections -fdata-sections
build_unflags = -O2
```

This matches the Phase 5 MinSizeRel configuration (1.6MB library size).

## Additional Resources

- Repository: https://github.com/sfranzyshen/ASTInterpreter
- Documentation: See `docs/` folder
- Examples: See `examples/` folder
