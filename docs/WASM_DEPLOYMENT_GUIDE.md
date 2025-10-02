# WebAssembly Deployment Guide

Complete guide for deploying the C++ ASTInterpreter as WebAssembly for browser and Node.js environments.

## Overview

The WASM build enables the C++ ASTInterpreter to run in web browsers at near-native speed (2-5x faster than JavaScript interpreter) while maintaining 100% cross-platform compatibility.

**Key Benefits:**
- **Performance**: 2-5x faster than JavaScript interpreter
- **Compatibility**: Identical command stream output
- **Size**: ~500KB-1MB WASM (150-300KB gzipped)
- **Memory**: 16-64MB configurable heap

---

## Prerequisites

### Install Emscripten SDK

```bash
# Download Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate latest version
./emsdk install latest
./emsdk activate latest

# Add to PATH (run in each terminal session)
source ./emsdk_env.sh

# Verify installation
emcc --version
```

**Supported Platforms**: Linux, macOS, Windows (WSL)

---

## Building WASM

### Quick Start

```bash
# Build WASM binary
./build_wasm.sh

# Validate size
./scripts/validate_wasm_size.sh

# Test in browser
open playgrounds/wasm_interpreter_playground.html
```

### Build Output

```
build/wasm/
├── arduino_interpreter.js    # WASM loader (Emscripten-generated)
└── arduino_interpreter.wasm  # WebAssembly binary
```

---

## Browser Integration

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>WASM Interpreter Demo</title>
</head>
<body>
    <!-- Load WASM module -->
    <script src="build/wasm/arduino_interpreter.js"></script>

    <!-- Load dependencies -->
    <script src="libs/ArduinoParser/src/ArduinoParser.js"></script>

    <script>
        async function runInterpreter() {
            // Initialize WASM module
            const module = await createWasmModule();

            // Parse Arduino code to AST
            const code = `
                void setup() {
                    pinMode(LED_BUILTIN, OUTPUT);
                }

                void loop() {
                    digitalWrite(LED_BUILTIN, HIGH);
                    delay(1000);
                    digitalWrite(LED_BUILTIN, LOW);
                    delay(1000);
                }
            `;

            const ast = parse(code);
            const astBinary = exportCompactAST(ast);

            // Create interpreter
            const astSize = astBinary.length;
            const astPtr = module._malloc(astSize);
            module.HEAPU8.set(astBinary, astPtr);

            const interpreterPtr = module._createInterpreter(
                astPtr,
                astSize,
                true  // verbose
            );

            module._free(astPtr);

            // Execute
            const success = module._startInterpreter(interpreterPtr);

            if (success) {
                // Get command stream
                const jsonPtr = module._getCommandStream(interpreterPtr);
                const jsonStr = module.UTF8ToString(jsonPtr);
                const commands = JSON.parse(jsonStr);

                console.log('Commands:', commands);

                // Cleanup
                module._freeString(jsonPtr);
            }

            module._destroyInterpreter(interpreterPtr);
        }

        // Run on page load
        window.addEventListener('load', runInterpreter);
    </script>
</body>
</html>
```

### Using JavaScript Wrapper

Alternatively, use the high-level JavaScript wrapper for cleaner code:

```javascript
import { WasmASTInterpreter } from './src/javascript/WasmASTInterpreter.js';

const interpreter = new WasmASTInterpreter();
await interpreter.init();

const commands = interpreter.execute(compactASTBinary, {
    verbose: true
});

console.log('Commands:', commands);
```

---

## Node.js Integration

### Installation

```bash
npm install  # No additional dependencies needed
```

### Usage

```javascript
const { WasmASTInterpreter } = require('./src/javascript/WasmASTInterpreter.js');
const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');

async function runInterpreter() {
    const interpreter = new WasmASTInterpreter();
    await interpreter.init();

    const code = `
        void setup() {
            Serial.begin(9600);
            Serial.println("Hello WASM!");
        }
    `;

    const ast = parse(code);
    const astBinary = exportCompactAST(ast);

    const commands = interpreter.execute(astBinary, { verbose: false });

    console.log('Generated', commands.length, 'commands');
}

runInterpreter();
```

---

## API Reference

### C Bridge Functions (WASM Exports)

#### `createInterpreter(astData, astSize, verbose)`
Create interpreter instance from CompactAST binary.

**Parameters:**
- `astData` (uint8_t*): Pointer to CompactAST binary data
- `astSize` (size_t): Size of binary in bytes
- `verbose` (bool): Enable verbose output

**Returns:** Opaque pointer to interpreter context (or null on failure)

---

#### `startInterpreter(interpreterPtr)`
Start interpreter execution.

**Parameters:**
- `interpreterPtr` (void*): Interpreter context pointer

**Returns:** `true` if successful, `false` otherwise

---

#### `getCommandStream(interpreterPtr)`
Get JSON command stream from execution.

**Parameters:**
- `interpreterPtr` (void*): Interpreter context pointer

**Returns:** Pointer to JSON string (caller must free with `freeString`)

---

#### `destroyInterpreter(interpreterPtr)`
Free interpreter resources.

**Parameters:**
- `interpreterPtr` (void*): Interpreter context pointer

---

#### `setAnalogValue(interpreterPtr, pin, value)`
Set mock analog value (for testing).

**Parameters:**
- `interpreterPtr` (void*): Interpreter context pointer
- `pin` (int): Pin number (0-7)
- `value` (int): Analog value (0-1023)

---

#### `setDigitalValue(interpreterPtr, pin, value)`
Set mock digital value (for testing).

**Parameters:**
- `interpreterPtr` (void*): Interpreter context pointer
- `pin` (int): Pin number
- `value` (int): Digital value (0 or 1)

---

## Performance Considerations

### Benchmarks

Typical performance on modern browsers:

| Metric | JavaScript | WASM | Speedup |
|--------|-----------|------|---------|
| Execution Time | 10ms | 2-4ms | 2.5-5x |
| Memory Usage | 5MB | 16MB* | - |
| Binary Size | 200KB | 500KB-1MB | - |

*Note: WASM requires larger initial heap (16MB) but has better memory management for complex programs.

### Optimization Tips

**For Size**:
- Use `-Os` instead of `-O3` in build_wasm.sh
- Enable dead code elimination: `-ffunction-sections -fdata-sections`
- Minimize exported functions
- Consider code splitting for large libraries

**For Speed**:
- Use `-O3` optimization level
- Enable SIMD if supported: `-msimd128`
- Increase initial memory for large programs
- Profile with browser DevTools

---

## Cross-Platform Validation

Validate WASM output matches JavaScript and C++ implementations:

```bash
# Build WASM
./build_wasm.sh

# Validate cross-platform parity
node tests/wasm_cross_platform_test.js

# Expected: 100% command stream compatibility
```

---

## Troubleshooting

### WASM Module Load Failure

**Error**: "WebAssembly.instantiate(): Compiling function failed"

**Solution**: Ensure Emscripten version matches build requirements. Rebuild with:
```bash
emcc --version  # Check version
./build_wasm.sh  # Rebuild
```

---

### Memory Allocation Failure

**Error**: "Cannot enlarge memory arrays"

**Solution**: Increase INITIAL_MEMORY in build_wasm.sh:
```bash
-s INITIAL_MEMORY=32MB  # Increase from 16MB
```

---

### CORS Errors (Browser)

**Error**: "Cross-Origin Request Blocked"

**Solution**: Serve files with local HTTP server:
```bash
python3 -m http.server 8000
# Open http://localhost:8000/playgrounds/wasm_interpreter_playground.html
```

---

### Size Exceeds Target

**Error**: "Gzipped size exceeds 300KB"

**Solution**: Apply size optimization:
```bash
# In build_wasm.sh, change:
-O3  # To:
-Os

# Rebuild and validate
./build_wasm.sh
./scripts/validate_wasm_size.sh
```

---

## Deployment Checklist

✅ Emscripten SDK installed (v3.1.0+)
✅ Build succeeds: `./build_wasm.sh`
✅ Size validation passes: `./scripts/validate_wasm_size.sh`
✅ Browser demo works: `playgrounds/wasm_interpreter_playground.html`
✅ Cross-platform validation: 100% command stream parity

---

## Production Deployment

### CDN Hosting

Recommended CDN structure:
```
https://cdn.example.com/
├── wasm/
│   ├── arduino_interpreter.wasm
│   └── arduino_interpreter.js
└── libs/
    └── ArduinoParser.js
```

### Caching Strategy

```http
# WASM binary (versioned, cache aggressively)
Cache-Control: public, max-age=31536000, immutable

# JavaScript loader (versioned)
Cache-Control: public, max-age=31536000, immutable
```

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy"
      content="script-src 'self' 'wasm-unsafe-eval'; object-src 'none'">
```

---

## Additional Resources

- **Emscripten Documentation**: https://emscripten.org/docs
- **WebAssembly Specification**: https://webassembly.org
- **Repository**: https://github.com/sfranzyshen/ASTInterpreter
- **Examples**: `playgrounds/wasm_interpreter_playground.html`

---

**🎉 WASM Deployment Complete!** The C++ ASTInterpreter is now production-ready for browser deployment with performance and compatibility guarantees.
