# ESP32-S3 Deployment Guide

Complete guide for deploying ArduinoASTInterpreter on ESP32-S3 hardware.

## ✅ ESP32 SUPPORT STATUS - v21.2.0

**STATUS**: ESP32/Arduino builds **FULLY SUPPORTED** with **RTTI-FREE DEFAULT** (October 14, 2025)

**What's New in v21.2.0**:
- ESP32 defaults to RTTI-free mode (868KB) for practical embedded deployment
- Linux and WASM maintain RTTI default (safety-first for development)
- Comprehensive build tool documentation (Arduino IDE, arduino-cli, PlatformIO)
- PlatformIO recommended for RTTI opt-in (no system file edits required)

**Platform Defaults**:
- ✅ **Linux**: RTTI default (runtime safety for development)
- ✅ **WASM**: RTTI default (embind requirement + browser safety)
- ✅ **ESP32**: RTTI-free default (practical embedded deployment)

**Binary Sizes**:
- **RTTI-free mode (default)**: 868KB flash
- **RTTI mode (opt-in)**: 896KB flash (+28KB overhead)

---

## Build Tool Comparison

| Feature | Arduino IDE | arduino-cli | PlatformIO |
|---------|-------------|-------------|------------|
| **Default Mode** | RTTI-free (868KB) | RTTI-free (868KB) | RTTI-free (868KB) |
| **build_opt.h Support** | ✅ Works | ❌ Causes errors | N/A (uses platformio.ini) |
| **RTTI Opt-In Method** | Copy build_opt_rtti.h.example | platform.txt + flags | Add `build_flags = -frtti` |
| **Setup Complexity** | Easy | Advanced | Easy |
| **System File Edits** | Optional (platform.txt) | Required (platform.txt) | None |
| **Maintenance** | Reapply after updates | Reapply after updates | None |
| **Best For** | Beginners | CLI automation | Professional dev |
| **Recommendation** | ✅ Good default | ⚠️ Use PlatformIO instead | ✅✅ **RECOMMENDED** |

**Key Finding**: arduino-cli cannot parse build_opt.h files and will cause compilation errors. arduino-cli users should either use RTTI-free default (no configuration) or switch to PlatformIO for RTTI mode.

---

## Hardware Requirements

- **Board**: ESP32-S3 DevKit-C (or compatible)
- **Flash**: 8 MB (library uses 868KB-896KB depending on mode)
- **RAM**: 512 KB SRAM + 8 MB PSRAM
- **USB**: USB-C cable for programming

## Memory Budget

| Component | RTTI-Free | RTTI Mode |
|-----------|-----------|-----------|
| Library binary | 868 KB | 896 KB |
| Available for sketches | 7.13 MB | 7.10 MB |
| % of 8MB flash | 10.8% | 11.2% |

---

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

### arduino-cli

```bash
# Install ESP32 core
arduino-cli core install esp32:esp32

# Compile and upload
arduino-cli compile --fqbn esp32:esp32:esp32s3 examples/BasicInterpreter
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32s3 examples/BasicInterpreter
```

---

## Default Build (RTTI-Free Mode)

All build tools use RTTI-free mode by default (868KB binary). This is the recommended configuration for embedded deployment.

### Arduino IDE

1. Open `examples/BasicInterpreter/BasicInterpreter.ino`
2. Verify/Upload
3. Binary: ~868KB
4. **No configuration needed** - committed `build_opt.h` has RTTI-free defaults

### arduino-cli

```bash
arduino-cli compile --fqbn esp32:esp32:esp32s3 \
  --output-dir ./build_esp32 \
  examples/BasicInterpreter
```

Binary: ~868KB in `build_esp32/BasicInterpreter.ino.bin`

### PlatformIO

```bash
pio run -e esp32-s3
```

Binary: ~868KB in `.pio/build/esp32-s3/firmware.bin`

---

## Enabling RTTI Mode (Opt-In)

RTTI mode provides runtime type safety via `dynamic_cast` at the cost of +28KB binary size (896KB total).

### Option 1: PlatformIO (RECOMMENDED)

**Why Recommended**:
- ✅ No system file editing required
- ✅ Project-specific configuration
- ✅ Automatic framework recompilation with RTTI
- ✅ Version control friendly
- ✅ Zero maintenance burden

**Setup**:

Create or modify `platformio.ini`:
```ini
[env:esp32-s3-rtti]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
lib_deps =
    https://github.com/sfranzyshen/ASTInterpreter.git

# Enable RTTI (applies to both your code and Arduino framework)
build_flags = -frtti
```

**Build**:
```bash
pio run -e esp32-s3-rtti -t upload
```

**Verification**:
Binary should be ~896KB in `.pio/build/esp32-s3-rtti/firmware.bin`

**Benefits**:
- PlatformIO automatically recompiles all framework libraries (FS, Stream, etc.) with RTTI enabled
- No platform.txt file modifications required
- Project-specific settings don't affect global Arduino installation
- Clean separation between projects with different RTTI requirements

---

### Option 2: Arduino IDE with build_opt.h

**Setup**:
```bash
cd examples/BasicInterpreter
cp build_opt_rtti.h.example build_opt.h
```

**Compile**: Open BasicInterpreter.ino in Arduino IDE and compile

**Restore Default**:
```bash
git checkout examples/BasicInterpreter/build_opt.h
```

**Binary**: ~896KB

**Limitations**:
- ⚠️ Only works with Arduino IDE
- ⚠️ **Does NOT work with arduino-cli** (causes parsing errors)
- ⚠️ For full RTTI support (core libraries + sketch), requires platform.txt modification

---

### Option 3: platform.txt Modification (ADVANCED)

**⚠️ WARNING**: Requires editing ESP32 core installation files. Changes are lost after board package updates and must be reapplied.

**When to use**:
- Arduino IDE users who need full RTTI support in both sketch and core libraries
- arduino-cli users (only method that works with arduino-cli)
- Advanced users comfortable with file editing and maintenance

**Requirements**:
- Administrator/sudo access to edit system files
- Willingness to reapply changes after each ESP32 board package update
- Understanding of the maintenance burden

#### Step 1: Locate platform.txt

The file location depends on your operating system:

**Windows**:
```
C:\Users\<YourUsername>\AppData\Local\Arduino15\packages\esp32\hardware\esp32\<version>\platform.txt
```

**macOS**:
```
~/Library/Arduino15/packages/esp32/hardware/esp32/<version>/platform.txt
```

**Linux**:
```
~/.arduino15/packages/esp32/hardware/esp32/<version>/platform.txt
```

**Finding the version**:
- Arduino IDE: Tools → Board → Boards Manager → Search "ESP32" → Check installed version
- arduino-cli: `arduino-cli core list | grep esp32`
- Typically: `3.3.2` or similar

**Full example path**:
```bash
# Linux/macOS
~/.arduino15/packages/esp32/hardware/esp32/3.3.2/platform.txt

# Windows
C:\Users\YourName\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.2\platform.txt
```

#### Step 2: Backup platform.txt

**CRITICAL**: Always backup before editing!

```bash
# Linux/macOS
cp ~/.arduino15/packages/esp32/hardware/esp32/3.3.2/platform.txt \
   ~/.arduino15/packages/esp32/hardware/esp32/3.3.2/platform.txt.backup

# Windows (PowerShell)
Copy-Item "C:\Users\YourName\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.2\platform.txt" `
          "C:\Users\YourName\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.2\platform.txt.backup"
```

#### Step 3: Edit compiler.cpp.flags

Open `platform.txt` in a text editor and find the line starting with `compiler.cpp.flags=`:

**BEFORE** (original line around line 30-40):
```
compiler.cpp.flags=-c -w -Werror=all -Wno-error=deprecated-declarations ... -std=gnu++17
```

**AFTER** (add `-frtti` at the beginning):
```
compiler.cpp.flags=-frtti -c -w -Werror=all -Wno-error=deprecated-declarations ... -std=gnu++17
```

**Important**:
- Add `-frtti` as the first flag after the equals sign
- Preserve all other flags exactly as they are
- Do not add line breaks within the line

#### Step 4: Restart Arduino IDE

If using Arduino IDE, completely close and reopen it to pick up the changed configuration.

#### Step 5: Build with RTTI

**Arduino IDE**:
1. (Optional) Copy `build_opt_rtti.h.example` to `build_opt.h` for sketch-level RTTI
2. Open BasicInterpreter.ino
3. Compile normally
4. IDE will automatically recompile all core libraries with RTTI enabled
5. Verify binary size: Should be ~896KB

**arduino-cli**:

⚠️ **CRITICAL**: arduino-cli cannot parse `build_opt.h`. You MUST remove it first!

```bash
# Remove build_opt.h (arduino-cli cannot parse it)
rm examples/BasicInterpreter/build_opt.h

# Build with RTTI flag
arduino-cli compile --fqbn esp32:esp32:esp32s3 \
  --build-property "build.extra_flags=-frtti" \
  --output-dir ./build_esp32 \
  examples/BasicInterpreter
```

Binary: ~896KB in `build_esp32/BasicInterpreter.ino.bin`

#### Step 6: Maintenance Requirements

**⚠️ IMPORTANT**: You must reapply this modification after **EVERY** ESP32 board package update!

**When to reapply**:
- After updating ESP32 boards via Board Manager (Arduino IDE)
- After running `arduino-cli core upgrade esp32:esp32`
- When moving to a new computer (installation doesn't migrate)

**Tracking updates**:
```bash
# Check current ESP32 version
arduino-cli core list | grep esp32

# After each update, re-edit platform.txt
```

**Restoration** (return to RTTI-free default):
```bash
# Linux/macOS
cp ~/.arduino15/packages/esp32/hardware/esp32/3.3.2/platform.txt.backup \
   ~/.arduino15/packages/esp32/hardware/esp32/3.3.2/platform.txt

# Windows (PowerShell)
Copy-Item "C:\Users\YourName\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.2\platform.txt.backup" `
          "C:\Users\YourName\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.2\platform.txt"
```

---

## arduino-cli Specific Notes

### Critical Limitation: build_opt.h Incompatibility

arduino-cli **cannot parse** build_opt.h files. Attempting to compile with build_opt.h present will cause this error:

```
xtensa-esp-elf-g++: fatal error: cannot specify '-o' with '-c', '-S' or '-E' with multiple files
compilation terminated.
```

**Why this happens**: arduino-cli and Arduino IDE use different build systems. Arduino IDE can parse the special build_opt.h format, but arduino-cli treats it as a command-line argument file with incompatible syntax.

### Recommended Approach for arduino-cli Users

**For RTTI-Free (Default) - RECOMMENDED**:
```bash
# Works perfectly without any configuration
arduino-cli compile --fqbn esp32:esp32:esp32s3 \
  --output-dir ./build_esp32 \
  examples/BasicInterpreter
```

Binary: 868KB

**For RTTI Mode - Use PlatformIO Instead**:

arduino-cli RTTI mode requires platform.txt modification (see Option 3 above), which creates maintenance burden. **We strongly recommend using PlatformIO instead**:

```bash
# Install PlatformIO
pip install platformio

# Create platformio.ini with RTTI enabled
# (See Option 1 above for configuration)

# Build with RTTI
pio run -e esp32-s3-rtti -t upload
```

Benefits over arduino-cli:
- No platform.txt file editing
- No maintenance after ESP32 updates
- Project-specific configuration
- Better dependency management

### If You Must Use arduino-cli with RTTI

1. **Modify platform.txt** (see Option 3 Step 1-3 above)
2. **Remove build_opt.h**:
   ```bash
   rm examples/BasicInterpreter/build_opt.h
   ```
3. **Build with flags**:
   ```bash
   arduino-cli compile --fqbn esp32:esp32:esp32s3 \
     --build-property "build.extra_flags=-frtti" \
     --output-dir ./build_esp32 \
     examples/BasicInterpreter
   ```
4. **Remember**: Reapply platform.txt changes after every ESP32 package update

---

## Troubleshooting

### Error: "cannot specify '-o' with '-c'"

**Full Error**:
```
xtensa-esp-elf-g++: fatal error: cannot specify '-o' with '-c', '-S' or '-E' with multiple files
compilation terminated.
```

**Cause**: arduino-cli cannot parse build_opt.h file

**Solution**:
```bash
# Remove build_opt.h (Arduino IDE only)
rm examples/BasicInterpreter/build_opt.h

# Use command-line flags instead
arduino-cli compile --fqbn esp32:esp32:esp32s3 \
  --build-property "build.extra_flags=-DAST_NO_RTTI -fno-rtti" \
  examples/BasicInterpreter
```

Or switch to PlatformIO (recommended).

### Error: "undefined reference to _ZTI6Stream"

**Full Error**:
```
undefined reference to `_ZTI6Stream'
undefined reference to `typeinfo for Stream'
```

**Cause**: Your sketch is compiled with RTTI (`-frtti`) but the ESP32 core libraries (FS, Stream, etc.) were compiled without RTTI (`-fno-rtti`). This creates a linking mismatch where your code looks for RTTI symbols that don't exist in the core libraries.

**Solution**: Modify platform.txt to recompile core libraries with RTTI (see Option 3 above). This ensures both your sketch and core libraries use consistent RTTI settings.

**Alternative**: Use PlatformIO, which handles this automatically:
```ini
[env:esp32-s3-rtti]
build_flags = -frtti  # PlatformIO recompiles everything with RTTI
```

### Arduino IDE: RTTI not working despite build_opt.h

**Symptom**: Copied `build_opt_rtti.h.example` to `build_opt.h` but still getting linker errors

**Cause**: build_opt.h only affects your sketch compilation. The ESP32 core libraries (FS, Stream, WiFi, etc.) were still compiled without RTTI, causing linking mismatches.

**Solution**: For full RTTI support in both sketch AND core libraries:
1. Modify platform.txt to add `-frtti` (see Option 3 above)
2. Restart Arduino IDE
3. Compile your sketch

Arduino IDE will automatically recompile all core libraries with RTTI enabled.

**Alternative**: Use PlatformIO which handles this automatically.

### Build succeeds but binary still ~868KB (expected ~896KB)

**Symptom**: Enabled RTTI but binary size didn't increase

**Cause**: RTTI flag may not be applied correctly

**Verification**:
```bash
# PlatformIO verbose build
pio run -e esp32-s3-rtti -v | grep "frtti"

# arduino-cli verbose build
arduino-cli compile --fqbn esp32:esp32:esp32s3 --verbose \
  --build-property "build.extra_flags=-frtti" \
  examples/BasicInterpreter | grep "frtti"
```

You should see `-frtti` in multiple compilation commands.

**Solution**: Verify platform.txt was modified correctly (see Option 3 Step 3).

### PlatformIO: Library not found

**Error**:
```
Library Manager: Installing ArduinoASTInterpreter
Error: Unknown package 'ArduinoASTInterpreter'
```

**Cause**: Library not yet published to PlatformIO registry

**Solution**: Use git URL instead:
```ini
lib_deps =
    https://github.com/sfranzyshen/ASTInterpreter.git
```

Or manually copy library to `lib/` folder in project.

---

## Creating CompactAST Binaries

CompactAST is the binary format used to embed Arduino sketches into ESP32 flash.

### Step 1: Write Arduino Sketch

Create your sketch (e.g., `example.ino`):
```cpp
void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
```

### Step 2: Convert to CompactAST

Use JavaScript parser:
```javascript
const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const fs = require('fs');

const source = fs.readFileSync('example.ino', 'utf8');
const ast = parse(source);
const binary = exportCompactAST(ast);
fs.writeFileSync('example.ast', binary);

console.log(`Created CompactAST: ${binary.length} bytes`);
```

### Step 3: Convert to C Array

```bash
./scripts/ast_to_c_array.sh example.ast > example_array.txt
```

Output format:
```cpp
const uint8_t PROGMEM astBinary[] = {
    0x41, 0x53, 0x54, 0x00, // Header
    0x01, 0x00, 0x00, 0x00, // Version
    // ... more bytes
};
```

### Step 4: Embed in ESP32 Sketch

Copy the array from `example_array.txt` and paste into your ESP32 sketch:
```cpp
#include <ArduinoASTInterpreter.h>

// Paste the array here
const uint8_t PROGMEM astBinary[] = {
    0x41, 0x53, 0x54, 0x00,
    // ... rest of array
};

void setup() {
    Serial.begin(115200);

    InterpreterOptions opts;
    opts.syncMode = true;

    auto* interpreter = new ASTInterpreter(astBinary, sizeof(astBinary), opts);
    interpreter->start();
}

void loop() {
    // Empty - interpreter handles execution
}
```

---

## Basic Usage Example

```cpp
#include <ArduinoASTInterpreter.h>

const uint8_t PROGMEM astBinary[] = { /* CompactAST binary */ };

class MyDataProvider : public SyncDataProvider {
    int32_t getAnalogReadValue(int32_t pin) override {
        // Map A0 (14) to GPIO36 on ESP32-S3
        return analogRead(pin == 14 ? 36 : pin);
    }

    int32_t getDigitalReadValue(int32_t pin) override {
        return digitalRead(pin);
    }

    int32_t requestAnalogRead(int32_t pin, int32_t arg) override {
        return getAnalogReadValue(pin);
    }

    int32_t requestDigitalRead(int32_t pin, int32_t arg) override {
        return getDigitalReadValue(pin);
    }
};

MyDataProvider provider;

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("=== Arduino AST Interpreter ===");

    InterpreterOptions opts;
    opts.syncMode = true;

    auto* interpreter = new ASTInterpreter(astBinary, sizeof(astBinary), opts);
    interpreter->setSyncDataProvider(&provider);
    interpreter->start();
}

void loop() {
    // Empty - interpreter handles execution
}
```

---

## Build Optimization

### Release Build (PlatformIO)

```ini
[env:esp32-s3-release]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
build_type = release
build_flags =
    -Os
    -ffunction-sections
    -fdata-sections
    -Wl,--gc-sections
    -D AST_NO_RTTI
    -fno-rtti
```

### Size Comparison

| Configuration | Binary Size | Notes |
|---------------|-------------|-------|
| RTTI-free + -Os (default) | 868 KB | Recommended |
| RTTI + -Os (opt-in) | 896 KB | +28KB for runtime safety |
| RTTI-free + -O2 | 920 KB | Faster execution |
| RTTI + -O2 | 948 KB | Fastest with safety |

---

## Additional Resources

- **Repository**: https://github.com/sfranzyshen/ASTInterpreter
- **Documentation**: See `docs/` folder
- **Examples**: See `examples/BasicInterpreter/` and `examples/AnalogReadExample/`
- **Issue Tracker**: https://github.com/sfranzyshen/ASTInterpreter/issues

---

**🎉 ESP32 Deployment Complete!** The ASTInterpreter is production-ready for embedded hardware deployment with flexible RTTI configuration options.
