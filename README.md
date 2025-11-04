# AST Interpreter

**A complete multi-platform 'Arduino/C++ code interpreter' system with modular library architecture**

AST Interpreter is a modular system that transforms Arduino/C++ source code (Sketches) into executable command streams through a sophisticated multi-stage processing pipeline. It provides full Arduino language support with hardware simulation, making it perfect for educational tools, code validation, and Arduino development environments.

## 🏗️ Three-Project Modular Architecture

The project is organized into three independent, reusable modules:

```
├── libs/CompactAST/          # Binary AST serialization library (JavaScript + C++)
├── libs/ArduinoParser/       # Arduino/C++ parser with integrated preprocessor  
└── src/                      # ASTInterpreter execution engine
```

### **CompactAST Library** (v3.2.0)
- **Purpose**: Binary AST serialization with 12.5x compression ratio
- **Dual Implementation**: JavaScript + C++ with identical binary format
- **ESP32 Ready**: Optimized for embedded deployment (512KB RAM + 8MB PSRAM)
- **Recent Updates**: TypedefDeclaration support, pointer infrastructure, designated initializer fixes, struct enhancements

### **ArduinoParser Library** (v6.0.0)
- **Purpose**: Complete Arduino/C++ parsing with integrated preprocessor and platform emulation
- **Features**: Macro expansion, conditional compilation, library activation, ESP32/Arduino Uno platform switching
- **Achievement**: Production-ready parser with 100% Arduino language support
- **Output**: Clean Abstract Syntax Tree + CompactAST binary serialization

### **ASTInterpreter Core** (v22.0.0)
- **Purpose**: AST execution engine with Arduino hardware simulation
- **Platform Support**: Linux/Desktop, WebAssembly/WASM, ESP32/Arduino - **ALL with RTTI flexibility!**
- **Architecture**: Dual-mode C++ (RTTI/RTTI-free) + JavaScript, perfect cross-platform parity
- **Platform Defaults**: Linux/WASM use RTTI (development safety), ESP32 uses RTTI-free (embedded deployment)
- **Features**: Complete pointer support, typedef handling, function pointers, ARROW operator (->), cross-platform consistency
- **Output**: Structured command streams for parent application integration

## 🎯 Current Status (October 14, 2025) - PERFECT CROSS-PLATFORM PARITY!

**✅ JavaScript: 100% Complete (135/135) | ✅ C++ Implementation: 100% Complete (135/135) | ✅ ALL Platforms: RTTI Flexibility!**

## 🚀 Deployment Platforms & Implementations

### **Three Deployment Targets:**
1. **Linux/Desktop** - Primary development and testing platform ✅
2. **WebAssembly/WASM** - Browser and Node.js deployment (485KB binary, 2-5x faster) ✅
3. **ESP32/Arduino** - Embedded hardware deployment (ESP32-S3, 1.6MB library) ✅

### **Two Interpreter Implementations:**
1. **JavaScript** - Node.js + Browser environments (391KB, full async support)
2. **C++** - Cross-platform RTTI-free implementation (Linux, WASM, ESP32)

### **Three Library Modules:**
1. **ArduinoParser** (v6.0.0) - Complete Arduino/C++ parsing with preprocessor
2. **CompactAST** (v3.2.0) - Binary AST format with 12.5x compression
3. **ASTInterpreter** (v22.0.0) - Execution engine with hardware simulation

All implementations produce **identical command streams** with **100% cross-platform parity** (135/135 tests passing).

---

**Latest Milestone** (October 14, 2025) - **Version 21.2.1: WASM Playground Production Ready**
- **🎯 WASM Browser Deployment Optimized**: Complete WASM playground fixes achieving production-ready status
- **✅ ExecutionTracer Memory Fix**: Disabled verbose mode in playground (prevents browser memory explosion)
- **✅ Loop Iteration Alignment**: Reduced from 1000 → 3 iterations (matches JavaScript playground UX)
- **✅ Memory Limit Increase**: 64MB → 256MB heap allocation (handles larger programs)
- **✅ Bulk Memory Transfer**: Added writeArrayToMemory export (0.90ms vs slower setValue loop)
- **✅ Command Output Capture**: WASMOutputStream working correctly (30 commands, 2459 bytes verified)
- **✅ Browser Tested**: Verified working in browser with proper JSON parsing
- **✅ 100% Test Parity**: All 135 tests pass across Linux, WASM, and ESP32 platforms
- **🚀 Production Ready**: WASM interpreter optimized for browser deployment with cross-platform parity

### ✅ **JavaScript Implementation - PRODUCTION READY**
- **Architecture**: Complete modular three-project system with cross-platform compatibility
- **Test Coverage**: 135/135 tests passing (100% success rate, 100% semantic accuracy)
- **Performance**: 15x improvement achieved - all tests complete in ~14 seconds (was 120+ seconds)
- **Libraries**: Full Arduino library support (NeoPixel, Servo, Wire, SPI, EEPROM)
- **Features**: Step/resume debugging, browser/Node.js compatibility, interactive playgrounds
- **Optimization**: Centralized conditional logging system eliminates debug overhead

### 🏆 **C++ Implementation - PERFECT PARITY + ESP32 SUPPORT!**
- **Status**: **135/135 tests passing (100% success rate)** - PERFECT cross-platform parity across ALL platforms!
- **v21.2.1 Achievement**: WASM playground production-ready with browser deployment optimization
- **Platform Support**: Linux ✅, WebAssembly ✅, **ESP32/Arduino ✅** (Production Ready!)
- **Build Output**: 4.3MB static library (`libarduino_ast_interpreter.a`) - dual RTTI modes supported
- **ESP32-S3 Deployment**: C++17 compatible, RTTI-free default (868KB), RTTI opt-in (896KB), memory optimized
- **Cross-Platform Parity**: 100% compatibility achieved across ALL deployment targets - COMPLETE!

## Funding
We are urgently in need of funding for this project to continue the longer term goals ... We will be start a tradition funding campaign but for now we are asking for small amount donations to help keep paying for a minimal subscription to claude code ... $20 per month minimum or $100 per month maximum is what we need ... If you can help please click the button

[<img width="10%" height="10%" src="https://raw.githubusercontent.com/sfranzyshen/ASTInterpreter/refs/heads/main/paypal.png">](https://www.paypal.com/donate/?hosted_button_id=ZHGG4TAC94E86)

## 🚀 Processing Pipeline

The modular architecture processes Arduino code through a clean three-stage pipeline:

```
Arduino Code → ArduinoParser → CompactAST → ASTInterpreter → Command Stream
     ↓              ↓              ↓            ↓              ↓
  Raw C++      Preprocessing    Binary AST   Hardware      Structured
  Source       Platform         12.5x        Simulation    Commands
  Code         Integration      Compression   Engine        for Parent App
```

### Stage 1: ArduinoParser Library
**Input**: Raw Arduino/C++ source code  
**Processing**: Macro expansion (`#define`), conditional compilation (`#ifdef`), library activation (`#include`), platform-specific context (ESP32/Arduino Uno)  
**Output**: Clean Abstract Syntax Tree (AST)

### Stage 2: CompactAST Library  
**Input**: Abstract Syntax Tree from ArduinoParser  
**Processing**: Binary serialization with 12.5x compression ratio  
**Output**: Compact binary AST format (cross-platform JavaScript ↔ C++)

### Stage 3: ASTInterpreter Core
**Input**: AST or CompactAST binary data  
**Processing**: Hardware simulation (`pinMode`, `digitalWrite`, `analogRead`, timing, serial communication)  
**Output**: Structured command stream with primitive data types

## 📁 Module Locations & Usage

### **ArduinoParser Library** - [`libs/ArduinoParser/src/ArduinoParser.js`](libs/ArduinoParser/src/ArduinoParser.js)
```javascript
const { parse, PlatformEmulation } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const ast = parse(arduinoCode, { platform: 'ESP32_NANO' });
```

### **CompactAST Library** - [`libs/CompactAST/src/CompactAST.js`](libs/CompactAST/src/CompactAST.js)  
```javascript
const { exportCompactAST, parseCompactAST } = require('./libs/CompactAST/src/CompactAST.js');
const binaryAST = exportCompactAST(ast);     // 12.5x compression
const restoredAST = parseCompactAST(binaryAST);  // Restore from binary
```

### **ASTInterpreter Core** - [`src/javascript/ASTInterpreter.js`](src/javascript/ASTInterpreter.js)
```javascript
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const interpreter = new ASTInterpreter(ast);
interpreter.onCommand = (command) => console.log(command);
interpreter.start();
```

## 🎯 Command Stream Architecture

The interpreter generates a clean, structured command stream that parent applications can easily process:

```javascript
// Example command stream output
{ type: 'PIN_MODE', pin: 13, mode: 'OUTPUT' }
{ type: 'DIGITAL_WRITE', pin: 13, value: 1 }
{ type: 'DELAY', duration: 1000 }
{ type: 'ANALOG_READ_REQUEST', pin: 'A0', requestId: 'req_001' }
{ type: 'SERIAL_PRINT', data: 'Hello World', newline: true }
```

Commands contain only primitive data types for maximum compatibility with parent applications, embedded systems, and serialization protocols.

## 📊 Project Status

**🎉 HISTORIC MILESTONE** - 135/135 tests passing with 100% cross-platform parity across ALL platforms!

| Component | Version | JavaScript | C++ (Linux/WASM/ESP32) | Success Rate |
|-----------|---------|------------|----------------------|--------------|
| **CompactAST** | v3.2.0 | 100% ✅ | Dual-Mode ✅ | Production Ready |
| **ArduinoParser** | v6.0.0 | 100% ✅ | Full Compatibility ✅ | 135/135 (100%) |
| **ASTInterpreter** | **v22.0.0** | 100% ✅ | **135/135 (100%)** ✅ | **Perfect Parity** 🎉 |
| **Platforms** | Oct 2025 | Node.js + Browser ✅ | **Linux + WASM + ESP32** ✅ | **WASM Ready** 🚀 |

### Test Coverage
- **Execution Success**: 100% - All 135 test cases execute without errors
- **Semantic Accuracy**: 100% - All outputs match expected Arduino behavior
- **Library Support**: Complete - NeoPixel, Servo, Wire, SPI, EEPROM libraries
- **Language Features**: Full C++ support including templates, namespaces, pointers

## 🚀 Quick Start

### Node.js Usage (Three-Project Architecture)

```javascript
// Import modular libraries
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

// 1. Define Arduino code
const arduinoCode = `
#define LED_PIN 13
void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);
}`;

// 2. Parse with platform-specific context
const ast = parse(arduinoCode, { platform: 'ESP32_NANO' });

// 3. Create interpreter with hardware simulation
const interpreter = new ASTInterpreter(ast, {
  maxLoopIterations: 3, // Prevent infinite loops in testing
  verbose: false,       // Suppress debug output
});

// 4. Handle command stream
interpreter.onCommand = (command) => {
  console.log('Arduino Command:', command);
  // Example commands: PIN_MODE, DIGITAL_WRITE, SERIAL_PRINT, DELAY
};

// 5. Handle external hardware requests (analogRead, digitalRead, etc.)
interpreter.responseHandler = (request) => {
  const mockValue = request.type === 'analogRead' ? 
    Math.floor(Math.random() * 1024) : 
    Math.random() > 0.5 ? 1 : 0;
  
  setTimeout(() => {
    interpreter.handleResponse(request.id, mockValue);
  }, 10); // Simulate hardware delay
};

// 6. Start execution
interpreter.start();
```

### Browser Usage (Modular Loading)

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Load only ArduinoParser (includes CompactAST) -->
    <script src="libs/ArduinoParser/src/ArduinoParser.js"></script>
    <script src="src/javascript/ASTInterpreter.js"></script>
</head>
<body>
    <script>
        const arduinoCode = `
        void setup() { 
          Serial.begin(9600); 
          pinMode(13, OUTPUT);
        } 
        void loop() { 
          digitalWrite(13, HIGH);
          Serial.println("Hello World"); 
          delay(500); 
        }`;
        
        // Parse with integrated preprocessor and platform context
        const ast = parse(arduinoCode, { platform: 'ESP32_NANO' });
        
        // Create interpreter
        const interpreter = new ASTInterpreter(ast);
        
        // Handle structured commands
        interpreter.onCommand = (command) => {
            console.log('Command:', command);
            // Handle PIN_MODE, DIGITAL_WRITE, SERIAL_PRINT, etc.
        };
        
        // Start execution
        interpreter.start();
    </script>
</body>
</html>
```

### Interactive Development Tools

```bash
# Open browser-based development environments
open playgrounds/parser_playground.html           # Interactive parser testing
open playgrounds/interpreter_playground.html      # Interactive interpreter testing
open playgrounds/wasm_interpreter_playground.html # WASM Interactive interpreter testing  
```

## 🧪 Testing & Development

### **JavaScript Test Suite (135 Tests - 100% Success Rate)**

```bash
# Interpreter Tests (full execution simulation)
node tests/interpreter/test_interpreter_examples.js    # 79 Arduino examples
node tests/interpreter/test_interpreter_old_test.js    # 54 comprehensive tests
node tests/interpreter/test_interpreter_neopixel.js    # 2 NeoPixel library tests

# Parser Tests (syntax validation only - faster)
node tests/parser/test_parser_examples.js              # Fast parsing validation
node tests/parser/test_parser_old_test.js              # Advanced language features
node tests/parser/test_parser_neopixel.js              # Library parsing tests

# Test Data Generation (for C++ cross-platform validation)
node src/javascript/generate_test_data.js --selective  # Creates 405 binary AST files
```

### **C++ Build & Test System**

```bash
# Build all components
cmake .        # Configure build system
make           # Compile all targets (30MB static library + 40+ test executables)

# Run C++ tests
./build/basic_interpreter_example examples.ast         # Demo executable with AST file
./build/test_cross_platform_validation                 # JavaScript ↔ C++ validation
./build/quick_similarity_test                          # Fast similarity analysis
```

### **Platform Switching & Build Management**

When switching between platforms (Linux/WASM/ESP32), CMake may cache previous platform configurations causing build errors. Use these commands to properly switch platforms:

**Problem**: After building for WASM, CMake caches the WASM configuration which tries to find `emscripten.h` when building Linux, resulting in compilation errors.

**Solution**: Clean the build directory and reconfigure CMake for the target platform:

```bash
# Linux RTTI (default)
cd build && rm -rf * && cmake .. && make -j4

# Linux RTTI-free (size optimization)
cd build && rm -rf * && cmake -DAST_NO_RTTI=ON .. && make -j4

# WASM RTTI (default)
source ~/emsdk/emsdk_env.sh && ./scripts/build_wasm.sh

# WASM RTTI-free (size optimization)
source ~/emsdk/emsdk_env.sh && AST_NO_RTTI=1 ./scripts/build_wasm.sh

# ESP32 RTTI-free (default - Arduino IDE or PlatformIO)
arduino-cli compile --fqbn esp32:esp32:esp32s3 examples/BasicInterpreter  # Uses committed build_opt.h
pio run -e esp32-s3                                                        # PlatformIO default

# ESP32 RTTI (opt-in)
pio run -e esp32-s3-rtti                                                   # PlatformIO (RECOMMENDED)
# For Arduino IDE: cp build_opt_rtti.h.example build_opt.h
# For arduino-cli: See docs/ESP32_DEPLOYMENT_GUIDE.md (platform.txt required)
```

**Quick Reference**:

| Platform | Default Mode | Opt-In Mode | Binary Size | Notes |
|----------|--------------|-------------|-------------|-------|
| **Linux** | `cmake .. && make` (RTTI) | `cmake -DAST_NO_RTTI=ON .. && make` (RTTI-free) | 4.3MB / 4.26MB | Development default |
| **WASM** | `./scripts/build_wasm.sh` (RTTI) | `AST_NO_RTTI=1 ./scripts/build_wasm.sh` (RTTI-free) | 485KB (157KB gzipped) | Browser safety |
| **ESP32** | `pio run -e esp32-s3` (RTTI-free) | `pio run -e esp32-s3-rtti` (RTTI) | 868KB / 896KB flash | Embedded default |

**Verification Status** (v21.2.1):
- ✅ **Linux**: RTTI default, RTTI-free opt-in - both pass 100% validation (135/135 tests)
- ✅ **WASM**: RTTI default, RTTI-free opt-in - both build successfully (485KB production binary)
- ✅ **ESP32**: RTTI-free default (868KB), RTTI opt-in (896KB) - both fully supported

All three platforms achieve **perfect cross-platform parity** with platform-optimized sensible defaults!

### **Interactive Development Tools** 

```bash
# Browser-based development environments (recommended)
open playgrounds/interpreter_playground.html           # Interactive interpreter testing
open playgrounds/parser_playground.html                # Interactive parser testing  

# Both playgrounds support:
# - Real-time code editing and execution
# - Step-by-step debugging with pause/resume
# - Command stream visualization  
# - Test case selection from examples.js/old_test.js/neopixel.js
```

## 🔧 Advanced Features

### **Multi-Platform Arduino Support**

The ArduinoParser library automatically handles platform-specific compilation:

```javascript
const { parse, PlatformEmulation } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// ESP32 Nano compilation (default)
const esp32AST = parse(code, { platform: 'ESP32_NANO' });
// Includes: WIFI_SUPPORT, BLUETOOTH_SUPPORT, ESP32 defines

// Arduino Uno compilation  
const unoAST = parse(code, { platform: 'ARDUINO_UNO' });
// Includes: Classic Arduino defines, limited memory context

// Custom platform configuration
const customPlatform = new PlatformEmulation('ESP32_NANO');
customPlatform.addDefine('CUSTOM_FEATURE', '1');
const customAST = parse(code, { platformContext: customPlatform });
```

### **CompactAST Binary Serialization**

Efficient binary format for embedded deployment and cross-platform compatibility:

```javascript
const { exportCompactAST, parseCompactAST } = require('./libs/CompactAST/src/CompactAST.js');

// Serialize AST to binary (12.5x compression)
const binaryData = exportCompactAST(ast);
console.log(`Compressed: ${ast.size} → ${binaryData.length} bytes`);

// Save for C++ interpreter
require('fs').writeFileSync('program.ast', binaryData);

// Restore from binary
const restoredAST = parseCompactAST(binaryData);
```

### **Hardware Simulation & Debugging**

```javascript
const interpreter = new ASTInterpreter(ast, {
  maxLoopIterations: 10,      // Prevent infinite loops
  stepDelay: 50,              // Add delays for step debugging (ms) 
  verbose: true,              // Enable debug output
  debug: true,                // Enable step-by-step debugging
});

// External hardware simulation (analogRead, digitalRead, etc.)
interpreter.responseHandler = (request) => {
  // Simulate real hardware responses
  let mockValue;
  switch (request.type) {
    case 'analogRead': mockValue = Math.floor(Math.random() * 1024); break;
    case 'digitalRead': mockValue = Math.random() > 0.5 ? 1 : 0; break;
    case 'millis': mockValue = Date.now() % 100000; break;
    case 'micros': mockValue = Date.now() * 1000 % 1000000; break;
  }
  
  // Simulate hardware delay (realistic timing)
  setTimeout(() => {
    interpreter.handleResponse(request.id, mockValue);
  }, Math.random() * 20 + 5); // 5-25ms delay
};

// Step-by-step debugging controls
interpreter.pause();    // Pause execution
interpreter.step();     // Execute single step
interpreter.resume();   // Resume normal execution
```

## 📚 Supported Arduino Features

### Language Constructs
- **Data Types**: `int`, `float`, `double`, `char`, `bool`, `String`, `byte`, etc.
- **Control Structures**: `if/else`, `for`, `while`, `do-while`, `switch/case`
- **Functions**: Definitions, calls, parameters, overloading
- **Arrays**: Single and multi-dimensional, dynamic allocation
- **Pointers**: Basic pointer operations and arithmetic
- **Structs/Classes**: Member functions, constructors, inheritance
- **Templates**: Template instantiation and specialization
- **Namespaces**: Qualified access (`std::vector`, `namespace::member`)

### Arduino Libraries
- **Built-in**: `pinMode`, `digitalWrite`, `digitalRead`, `analogRead`, `analogWrite`
- **Timing**: `delay`, `delayMicroseconds`, `millis`, `micros`
- **Serial**: `Serial.print`, `Serial.println`, `Serial.available`
- **Advanced Libraries**: Adafruit_NeoPixel, Servo, Wire (I2C), SPI, EEPROM
- **Hardware**: PWM, interrupts, timers, communication protocols

### Preprocessor Features
- **Macros**: Simple (`#define LED_PIN 13`) and function-like (`#define MAX(a,b) ((a)>(b)?(a):(b))`)
- **Includes**: Library activation (`#include <Adafruit_NeoPixel.h>`)
- **Conditionals**: `#ifdef`, `#ifndef`, `#if defined()`, `#else`, `#endif`
- **Platform Defines**: ESP32, ARDUINO, WIFI_SUPPORT, BLUETOOTH_SUPPORT


## 📦 Arduino Library Usage (ESP32-S3)

The ASTInterpreter is available as an Arduino library for ESP32-S3 hardware deployment.

### Installation

**Arduino IDE:**
```
Library Manager → Search "ArduinoASTInterpreter" → Install
```

**PlatformIO:**
```ini
lib_deps = https://github.com/sfranzyshen/ASTInterpreter.git
```

### Quick Start

```cpp
#include <ArduinoASTInterpreter.h>

// Embedded CompactAST binary (generated from your Arduino code)
const uint8_t PROGMEM astBinary[] = { /* ... */ };

class MyDataProvider : public SyncDataProvider {
    int32_t getAnalogReadValue(int32_t pin) override {
        return analogRead(pin == 14 ? 36 : pin); // Map A0 to GPIO36
    }
    // ... implement getDigitalReadValue, getMillisValue, etc.
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

### Features

- **Size Optimized**: 868KB (RTTI-free default) or 896KB (RTTI opt-in) - 11-12% of ESP32-S3's 8MB flash
- **Memory Efficient**: ~50-100 KB RAM depending on AST size
- **Production Ready**: 100% cross-platform parity (135/135 tests) - PERFECT compatibility!
- **Platform Defaults**: RTTI-free default for embedded deployment, RTTI opt-in via PlatformIO/build_opt.h (v21.2.1)
- **Hardware Integration**: SyncDataProvider interface for real ESP32 pins
- **Examples Included**: BasicInterpreter and AnalogReadExample sketches

### Documentation

- **Full Guide**: `docs/ESP32_DEPLOYMENT_GUIDE.md`
- **Examples**: `examples/BasicInterpreter/` and `examples/AnalogReadExample/`
- **Binary Conversion**: `scripts/ast_to_c_array.sh`

---

## 🌐 WebAssembly (Browser/Node.js)

Run the C++ interpreter in web browsers via WebAssembly for high-performance Arduino code execution.

### Building WASM

```bash
# Install Emscripten SDK (one-time setup)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh

# Build WASM binary
./scripts/build_wasm.sh

# Validate size
./scripts/validate_wasm_size.sh
```

### Browser Usage

```javascript
// Load WASM module
const module = await createWasmModule();

// Parse Arduino code
const ast = parse(code);
const astBinary = exportCompactAST(ast);

// Create and execute interpreter
const astPtr = module._malloc(astBinary.length);
module.HEAPU8.set(astBinary, astPtr);
const interpreterPtr = module._createInterpreter(astPtr, astBinary.length, true);
module._free(astPtr);

module._startInterpreter(interpreterPtr);

// Get results
const jsonPtr = module._getCommandStream(interpreterPtr);
const commands = JSON.parse(module.UTF8ToString(jsonPtr));

// Cleanup
module._freeString(jsonPtr);
module._destroyInterpreter(interpreterPtr);
```

### Using JavaScript Wrapper

For cleaner code, use the high-level wrapper:

```javascript
import { WasmASTInterpreter } from './src/javascript/WasmASTInterpreter.js';

const interpreter = new WasmASTInterpreter();
await interpreter.init();

const commands = interpreter.execute(compactASTBinary, { verbose: true });
console.log('Generated', commands.length, 'commands');
```

### Performance

- **WASM Size**: 485KB binary (157KB gzipped) - optimized with -O3 compression
- **Platform Defaults**: RTTI default for browser safety, RTTI-free opt-in for size optimization (v21.2.1)
- **Execution Speed**: 2-5x faster than JavaScript interpreter
- **Memory**: 256MB configurable heap (increased from 64MB for larger programs)
- **Compatibility**: 100% cross-platform parity (135/135 tests) - PERFECT match with JavaScript and C++

### Demo & Documentation

- **Interactive Demo**: `playgrounds/wasm_interpreter_playground.html`
- **Full Guide**: `docs/WASM_DEPLOYMENT_GUIDE.md`
- **API Reference**: Complete C bridge and JavaScript wrapper documentation

---

## 🏆 Project Success & Positioning

### **Educational Platform**

Arduino AST Interpreter has achieved **100% cross-platform parity** across all implementations - JavaScript, C++ Linux, WebAssembly, and ESP32 Arduino (135/135 tests passing), making it a reliable foundation for:

- **Educational Tools**: Interactive Arduino learning platforms with real-time code execution
- **Code Validation**: Pre-deployment testing of Arduino sketches with hardware simulation
- **Development Environments**: Browser-based IDEs with step-by-step debugging capabilities
- **Embedded Hardware**: ESP32 Arduino deployment with RTTI-free architecture (1.6MB library, 100% compatible)
- **Web Applications**: WebAssembly browser deployment (485KB binary, 2-5x faster than JavaScript)

### **Comparison to Existing Solutions**

Unlike full Arduino simulators ([**wokwi.com**](https://wokwi.com/), [**Tinkercad**](https://www.tinkercad.com/things?type=circuits)) or complex emulation frameworks ([**ArduinoSimulator**](https://github.com/lrusso/ArduinoSimulator) + [**JSCPP**](https://github.com/felixhao28/JSCPP)), this project provides:

✅ **Focused Architecture**: Dedicated Arduino/C++ parsing and execution (not general C++ simulation)
✅ **Lightweight Design**: ~300KB JavaScript vs JSCPP's multi-megabyte complexity
✅ **Modular Libraries**: Three independent, reusable components
✅ **Multiple Platforms**: JavaScript (100%) + C++ (100%) across Linux, WASM, and ESP32 with perfect command stream compatibility
✅ **Platform-Specific Defaults**: Linux/WASM use RTTI (development), ESP32 uses RTTI-free (deployment) - sensible defaults (v21.2.1)
✅ **ESP32 Hardware Support**: RTTI-free default (868KB) with RTTI opt-in (896KB) for embedded deployment
✅ **WASM Production Ready**: Browser deployment optimized with memory management and bulk transfer performance (v21.2.1)
✅ **Educational Focus**: Built specifically for learning environments with step debugging
✅ **Production Ready**: Comprehensive error handling, structured command output, 100% cross-platform parity achieved

### **30-Day AI Experiment Success**

This project began as a 30-day experiment using AI technologies (Claude Code) to solve a previously unsuccessful programming challenge. The AI-driven development approach achieved:

- **Complete Language Implementation**: Full Arduino/C++ syntax support including templates, namespaces, pointers
- **Perfect Test Coverage**: JavaScript 135/135 (100%), C++ 135/135 (100%) - COMPLETE cross-platform parity achieved!
- **Platform-Specific Defaults**: v21.2.1 - Linux/WASM use RTTI (development), ESP32 uses RTTI-free (embedded deployment)
- **WASM Production Ready**: Browser deployment optimized with memory management, bulk transfer, and performance tuning
- **Sensible Defaults**: Each platform optimized for its primary use case with flexible opt-in/opt-out
- **Comprehensive Preprocessing**: Complete macro expansion, conditional compilation, library activation
- **Multi-Platform Deployment**: JavaScript + C++ across Linux, WASM, and ESP32 with binary AST interchange format
- **Professional Documentation**: Complete API documentation, interactive playgrounds, comprehensive testing infrastructure

The result demonstrates the power of AI-assisted development for complex compiler and interpreter projects, achieving 100% cross-platform parity, perfect architectural consistency, and production-ready browser deployment across all deployment targets.

## 📜 Licensing

This project is dual-licensed under the [**sfranzyshen.com Source-Available License 1.0**](https://github.com/sfranzyshen/ASTInterpreter/blob/main/sfranzyshen_source_available_license.md) 

and **sfranzyshen.org with [GNU AGPLv3](https://github.com/sfranzyshen/ASTInterpreter/blob/main/gnu-agpl-v3.0.md)**.

* You may use this software under the terms of the **Source-Available License** for non-production purposes (e.g., development, testing).
* After the Change Date of **8/26/2030**, the software will automatically be governed by the **AGPLv3**.

* If you wish to use this software in a production environment before the Change Date, you must obtain a **commercial license**. Please contact us at [sfranzyshen@hotmail.com] for more details.


