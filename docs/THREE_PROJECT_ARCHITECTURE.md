# Three-Project Architecture - Arduino AST Interpreter System

**Version**: Post-Reorganization (September 7, 2025)  
**Status**: Production Ready  
**Architecture**: Modular Three-Project Structure  

## Overview

The Arduino AST Interpreter system has been reorganized from a monolithic structure into **three independent but integrated projects**:

1. **CompactAST** - Cross-platform AST binary serialization  
2. **ArduinoParser** - Arduino/C++ parsing with integrated preprocessing  
3. **ASTInterpreter** - Arduino code execution and hardware simulation  

This structure enables independent development, testing, and future extraction into separate repositories/submodules while maintaining seamless integration.

## Project Structure

### Current Filesystem Layout

```
ASTInterpreter_Arduino/                    # Main project root
├── libs/                                  # Independent library modules (future submodules)
│   ├── CompactAST/                       # Project 1: Cross-platform AST serialization
│   │   ├── src/
│   │   │   ├── CompactAST.js             # JavaScript implementation (v1.1.0)
│   │   │   ├── CompactAST.hpp            # C++ header
│   │   │   └── CompactAST.cpp            # C++ implementation
│   │   ├── docs/                         # CompactAST-specific documentation
│   │   ├── tests/                        # CompactAST-specific tests
│   │   ├── package.json                  # Future npm package definition
│   │   └── README.md                     # CompactAST documentation
│   │
│   └── ArduinoParser/                    # Project 2: Arduino C++ parsing library
│       ├── src/
│       │   └── ArduinoParser.js          # Complete parser with preprocessing (v5.3.0)
│       ├── tests/                        # Parser-specific tests
│       ├── examples/                     # Parser examples
│       ├── package.json                  # Future npm package definition
│       └── README.md                     # Parser documentation
│
├── src/                                  # Project 3: Main ASTInterpreter
│   ├── javascript/
│   │   ├── ASTInterpreter.js            # Main interpreter (v7.2.0)
│   │   ├── ArduinoParser.js             # Node.js compatibility wrapper
│   │   ├── command_stream_validator.js   # Semantic validation framework
│   │   └── generate_test_data.js         # Test data generation tool
│   └── cpp/                             # C++ interpreter implementation
│       ├── ASTInterpreter.hpp/cpp
│       ├── CommandProtocol.hpp/cpp
│       ├── ArduinoDataTypes.hpp/cpp
│       └── ...other C++ files...
│
├── tests/                               # Cross-project integration tests
├── docs/                                # System-wide documentation
├── tools/                               # Development utilities
├── playgrounds/                         # Interactive testing environments
├── examples.js, old_test.js, neopixel.js # Test data
├── README.md, CLAUDE.md                 # Root documentation
└── CMakeLists.txt                       # Build system
```

## Project Definitions

### 1. CompactAST (v1.1.0)

**Purpose**: Cross-platform AST binary serialization for embedded deployment  
**Location**: `libs/CompactAST/`  
**Languages**: JavaScript + C++  

**Responsibilities**:
- Binary AST serialization with 12.5x compression over JSON
- Cross-platform compatibility (JavaScript ↔ C++)
- Type-safe number encoding with INT8/INT16 optimization
- String deduplication with UTF-8 support
- Complete Arduino AST node type support (0x01-0x59)

**Key Files**:
- `src/CompactAST.js` - JavaScript implementation with universal module pattern
- `src/CompactAST.hpp/cpp` - C++ implementation for embedded targets
- `docs/CompactAST_Format_Specification.md` - Binary format specification

**Exports** (JavaScript):
```javascript
// Node.js
const { exportCompactAST, CompactASTExporter } = require('./libs/CompactAST/src/CompactAST.js');

// Browser (namespace to avoid conflicts)
window.CompactAST.exportCompactAST
window.CompactAST.CompactASTExporter
```

### 2. ArduinoParser (v5.3.0)  

**Purpose**: Complete Arduino/C++ parsing with integrated preprocessing and platform emulation  
**Location**: `libs/ArduinoParser/`  
**Language**: JavaScript  

**Responsibilities**:
- Arduino/C++ lexical analysis and parsing
- Complete C++ preprocessor (`#define`, `#include`, `#ifdef`, etc.)
- Platform emulation (ESP32 Nano, Arduino Uno) with platform-specific defines
- Library auto-activation from `#include` directives
- Clean AST generation (no preprocessor pollution)
- CompactAST integration for binary export

**Key Features**:
- **Integrated Architecture**: Previously separate platform_emulation.js and preprocessor.js
- **Universal Compatibility**: Works in Node.js and browser environments
- **CompactAST Integration**: Automatically loads and integrates CompactAST functionality

**Exports** (JavaScript):
```javascript
// Node.js
const { 
  Parser, parse, prettyPrintAST, exportCompactAST,
  PlatformEmulation, ArduinoPreprocessor,
  ESP32_NANO_PLATFORM, ARDUINO_UNO_PLATFORM 
} = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Browser
window.Parser, window.parse, window.prettyPrintAST
window.exportCompactAST  // From integrated CompactAST
window.PlatformEmulation, window.ArduinoPreprocessor
window.ESP32_NANO_PLATFORM, window.ARDUINO_UNO_PLATFORM
```

**CompactAST Integration**:
- ArduinoParser automatically loads CompactAST as a dependency
- Provides `exportCompactAST` function for binary AST generation
- Handles path resolution: `../../CompactAST/src/CompactAST.js`

### 3. ASTInterpreter (v7.2.0)

**Purpose**: Arduino code execution, hardware simulation, and command stream generation  
**Location**: `src/javascript/` (main) + `src/cpp/` (C++ implementation)  
**Languages**: JavaScript + C++  

**Responsibilities**:
- AST traversal and execution
- Arduino hardware function simulation (pinMode, digitalWrite, analogRead, etc.)
- Variable and scope management
- setup()/loop() execution flow control
- Command stream generation for parent applications
- External data request handling (async hardware functions)
- Library interface simulation (Servo, NeoPixel, etc.)

**Dependencies**:
- Requires parsed AST from ArduinoParser (not raw source code)
- Uses compatibility wrapper for import path stability

**Usage Pattern**:
```javascript
// Step 1: Parse code using ArduinoParser
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const ast = parse(sourceCode);

// Step 2: Execute with ASTInterpreter  
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const interpreter = new ASTInterpreter(ast);
interpreter.onCommand = (command) => console.log(command);
interpreter.start();
```

## Integration Patterns

### Node.js Usage (Recommended)

**For Parser + CompactAST**:
```javascript
// Load ArduinoParser (includes CompactAST integration)
const { parse, exportCompactAST, PlatformEmulation } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Use compatibility wrapper for stability
const parser = require('./tests/ArduinoParser_wrapper.js'); // Loads from libs automatically
```

**For Full System**:
```javascript
// Step 1: Parse Arduino code
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const ast = parse('int x = 5; void setup() { Serial.begin(9600); }');

// Step 2: Execute with interpreter
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const interpreter = new ASTInterpreter(ast);
```

### Browser Usage

**HTML Loading Pattern**:
```html
<!-- Load ArduinoParser (includes CompactAST functionality) -->
<script src="libs/ArduinoParser/src/ArduinoParser.js"></script>
<!-- Load ASTInterpreter -->
<script src="src/javascript/ASTInterpreter.js"></script>
```

**JavaScript Usage**:
```javascript
// Functions available globally
const ast = parse(sourceCode);
const compactBinary = exportCompactAST(ast);
const interpreter = new ASTInterpreter(ast);
```

### Test Harness Pattern

```javascript
// Correct import paths after reorganization
const { parse, PlatformEmulation } = require('../../libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');
```

## Dependency Relationships

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CompactAST    │────│ ArduinoParser   │────│ ASTInterpreter  │
│   (v1.1.0)     │    │   (v5.3.0)     │    │   (v7.2.0)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    Binary AST              Clean AST              Command Stream
   Serialization           Generation              & Execution
```

**Dependency Flow**:
1. **CompactAST ← ArduinoParser**: Parser integrates CompactAST for binary export
2. **ArduinoParser ← ASTInterpreter**: Interpreter consumes parsed ASTs
3. **Independent Operation**: Each project can function independently within its scope

## Critical Lessons Learned

### Import Path Management

**Problem**: After extraction, all import paths broke because of incorrect relative paths.

**Solutions Applied**:
- ArduinoParser → CompactAST: `../../CompactAST/src/CompactAST.js`
- Tools → ArduinoParser: `../../libs/ArduinoParser/src/ArduinoParser.js`  
- Test Harnesses → Libraries: Updated to use libs/ paths

**Golden Rule**: Always verify relative paths after any filesystem restructuring.

### Browser Loading Conflicts

**Problem**: Loading both CompactAST and ArduinoParser in browser caused duplicate `exportCompactAST` declaration.

**Solution**: Load only ArduinoParser in browser (it includes CompactAST integration).

**Pattern**:
```html
<!-- WRONG: Causes conflicts -->
<script src="libs/CompactAST/src/CompactAST.js"></script>
<script src="libs/ArduinoParser/src/ArduinoParser.js"></script>

<!-- CORRECT: ArduinoParser includes CompactAST -->
<script src="libs/ArduinoParser/src/ArduinoParser.js"></script>
```

### Version Management

**Post-Reorganization Versions**:
- CompactAST: v1.0.0 → v1.1.0 (reorganization compatibility)
- ArduinoParser: v5.2.0 → v5.3.0 (filesystem reorganization)
- ASTInterpreter: v7.1.0 → v7.2.0 (compatibility updates)

## Future Submodule Strategy

### Target Structure (Future)
```
ASTInterpreter_Arduino/
├── libs/
│   ├── CompactAST/          # Git submodule → separate repo
│   └── ArduinoParser/       # Git submodule → separate repo
└── src/                     # Main ASTInterpreter repo
```

### Migration Path
1. **Phase 1** (Current): Modular structure within single repository
2. **Phase 2**: Extract CompactAST to separate repository
3. **Phase 3**: Extract ArduinoParser to separate repository  
4. **Phase 4**: Convert libs/ entries to Git submodules

### Submodule Benefits
- Independent versioning and releases
- Separate issue tracking and development
- Reusable across multiple projects
- Clear ownership and responsibility boundaries

## Production Status

**✅ ALL PROJECTS PRODUCTION READY**:
- **CompactAST v1.1.0**: Binary serialization working, cross-platform validated
- **ArduinoParser v5.3.0**: 100% test success rate (79 examples + 54 comprehensive + 2 NeoPixel)
- **ASTInterpreter v7.2.0**: Complete Arduino simulation, 100% semantic accuracy
- **Integration**: All playgrounds, test harnesses, and tools working correctly

The three-project architecture provides a solid foundation for independent development while maintaining seamless integration across the Arduino AST interpreter ecosystem.