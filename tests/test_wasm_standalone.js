/**
 * test_wasm_standalone.js - Standalone Node.js WASM Interpreter Test
 *
 * Tests the WASM interpreter outside of the browser playground environment
 * to verify basic blink example execution works correctly.
 *
 * Usage:
 *   cd /mnt/d/Devel/ASTInterpreter
 *   node tests/test_wasm_standalone.js
 */

const path = require('path');

// Load ArduinoParser (includes CompactAST integration)
const { parse, exportCompactAST } = require('../libs/ArduinoParser/src/ArduinoParser.js');

// Basic blink example
const blinkCode = `
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

console.log('🚀 WASM Interpreter Standalone Test\n');
console.log('=' .repeat(60));

// Step 1: Parse Arduino code
console.log('\n📝 Step 1: Parsing Arduino code...');
try {
    const ast = parse(blinkCode);
    console.log('✅ AST parsed successfully');
    console.log(`   Root node type: ${ast.type}`);
    console.log(`   Children: ${ast.children ? ast.children.length : 0}`);
} catch (error) {
    console.error('❌ Parse failed:', error.message);
    process.exit(1);
}

// Step 2: Export to CompactAST binary
console.log('\n📦 Step 2: Exporting to CompactAST binary...');
try {
    const ast = parse(blinkCode);
    const astBuffer = exportCompactAST(ast);
    const astBinary = new Uint8Array(astBuffer);
    console.log('✅ Binary export successful');
    console.log(`   Binary size: ${astBinary.length} bytes`);
    console.log(`   First 16 bytes: ${Array.from(astBinary.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
} catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
}

// Step 3: Load WASM module (Node.js environment)
console.log('\n⚡ Step 3: Loading WASM module...');

// Create a promise that resolves when WASM is ready
const wasmLoadPromise = new Promise((resolve, reject) => {
    try {
        // In Node.js, we need to load the WASM module differently than in browser
        // The Emscripten-generated JS file creates a Module object

        const wasmModulePath = path.join(__dirname, '../build_wasm/arduino_interpreter.js');
        console.log(`   Module path: ${wasmModulePath}`);

        // Check if WASM build exists
        const fs = require('fs');
        if (!fs.existsSync(wasmModulePath)) {
            reject(new Error('WASM module not found! Run: source /home/user/emsdk/emsdk_env.sh && ./scripts/build_wasm.sh'));
            return;
        }

        // Note: The WASM module in Node.js requires special handling
        // Emscripten modules expect a global Module object
        global.Module = {
            onRuntimeInitialized: function() {
                console.log('✅ WASM runtime initialized');
                resolve(this);
            }
        };

        // Set a timeout in case module never loads
        setTimeout(() => {
            reject(new Error('WASM module loading timeout (30s)'));
        }, 30000);

        // Load the Emscripten-generated module
        require(wasmModulePath);

    } catch (error) {
        reject(error);
    }
});

// Wait for WASM to load and then test execution
wasmLoadPromise
    .then(wasmModule => {
        testWasmExecution(wasmModule);
    })
    .catch(error => {
        console.error('❌ WASM load failed:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    });

// Step 4: Execute with WASM interpreter
function testWasmExecution(wasmModule) {
    console.log('\n🔥 Step 4: Executing with WASM interpreter...');

    try {
        // Get version
        const versionPtr = wasmModule._getInterpreterVersion();
        const version = wasmModule.UTF8ToString(versionPtr);
        console.log(`✅ WASM interpreter loaded: v${version}`);

        // Parse and export AST
        const ast = parse(blinkCode);
        const astBuffer = exportCompactAST(ast);
        const astBinary = new Uint8Array(astBuffer);

        // Allocate memory for AST binary
        const astSize = astBinary.length;
        const astPtr = wasmModule._malloc(astSize);
        wasmModule.HEAPU8.set(astBinary, astPtr);

        console.log(`   AST binary allocated at: 0x${astPtr.toString(16)}`);

        // Create interpreter instance
        const interpreterPtr = wasmModule._createInterpreter(astPtr, astSize, false);
        wasmModule._free(astPtr);

        if (!interpreterPtr) {
            throw new Error('Failed to create interpreter instance');
        }

        console.log(`   Interpreter instance created at: 0x${interpreterPtr.toString(16)}`);

        // Start execution
        const success = wasmModule._startInterpreter(interpreterPtr);

        if (!success) {
            throw new Error('Interpreter execution failed');
        }

        console.log('✅ Interpreter executed successfully');

        // Get command stream
        const jsonPtr = wasmModule._getCommandStream(interpreterPtr);
        const jsonStr = wasmModule.UTF8ToString(jsonPtr);
        wasmModule._freeString(jsonPtr);
        wasmModule._destroyInterpreter(interpreterPtr);

        // Parse and display commands
        const commands = JSON.parse(jsonStr);

        console.log('\n📊 Command Stream Output:');
        console.log('=' .repeat(60));

        commands.forEach((cmd, index) => {
            console.log(`${(index + 1).toString().padStart(3, ' ')}. ${JSON.stringify(cmd)}`);
        });

        console.log('\n✅ WASM Standalone Test PASSED');
        console.log(`   Total commands: ${commands.length}`);

        // Expected commands for blink example:
        // 1. VERSION_INFO
        // 2. PIN_MODE (LED_BUILTIN, OUTPUT)
        // 3. DIGITAL_WRITE (LED_BUILTIN, HIGH)
        // 4. DELAY (1000)
        // 5. DIGITAL_WRITE (LED_BUILTIN, LOW)
        // 6. DELAY (1000)

        if (commands.length >= 6) {
            console.log('   ✅ Expected command count met');
        } else {
            console.log(`   ⚠️  Expected at least 6 commands, got ${commands.length}`);
        }

    } catch (error) {
        console.error('❌ WASM execution failed:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}
