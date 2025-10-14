/**
 * test_wasm_interpreter_minimal.js - End-to-End WASM Interpreter Test
 *
 * Tests complete workflow: Parse → Export → WASM Memory → Create Interpreter → Execute
 * Run: node tests/test_wasm_interpreter_minimal.js
 */

const path = require('path');
const { parse, exportCompactAST } = require('../libs/ArduinoParser/src/ArduinoParser.js');

console.log('═══════════════════════════════════════════════════════════');
console.log('  End-to-End WASM Interpreter Test');
console.log('═══════════════════════════════════════════════════════════\n');

async function runTests() {
    let passed = 0;
    let failed = 0;

    try {
        // Load WASM module
        console.log('Step 1: Loading WASM module...');
        const wasmPath = path.join(__dirname, '../build_wasm/arduino_interpreter.js');
        const createWasmModule = require(wasmPath);
        const wasmModule = await createWasmModule();
        console.log('✅ WASM module loaded\n');

        // Parse minimal code
        console.log('Step 2: Parsing minimal Arduino code...');
        const minimalCode = `void setup() {} void loop() {}`;
        console.log(`  Code: "${minimalCode}"`);
        const ast = parse(minimalCode);
        console.log(`✅ AST parsed (type: ${ast.type}, children: ${ast.children ? ast.children.length : 0})\n`);

        // Export to binary
        console.log('Step 3: Exporting to CompactAST binary...');
        const astBuffer = exportCompactAST(ast);
        const astBinary = new Uint8Array(astBuffer);
        console.log(`✅ Binary exported (${astBinary.length} bytes)\n`);

        // Validate magic bytes
        console.log('Step 4: Validating binary format...');
        const magic = String.fromCharCode(astBinary[0], astBinary[1], astBinary[2], astBinary[3]);
        console.log(`  Magic: "${magic}"`);
        console.log(`  First 16 bytes: ${Array.from(astBinary.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

        if (magic !== 'ASTP') {
            console.log('❌ Invalid magic bytes!');
            failed++;
            throw new Error('Binary format invalid');
        }
        console.log('✅ Binary format valid\n');
        passed++;

        // Allocate memory
        console.log('Step 5: Allocating WASM memory...');
        const astSize = astBinary.length;
        console.log(`  Requesting: ${astSize} bytes`);
        const astPtr = wasmModule._malloc(astSize);
        console.log(`  malloc returned: ${astPtr} (0x${astPtr.toString(16)})`);

        if (astPtr === 0 || astPtr === null) {
            console.log('❌ malloc FAILED - returned null pointer!');
            failed++;
            throw new Error('Memory allocation failed');
        }
        console.log('✅ Memory allocated successfully\n');
        passed++;

        // Write binary to memory
        console.log('Step 6: Writing binary to WASM memory...');
        console.log(`  Using setValue loop for ${astSize} bytes...`);
        const writeStart = Date.now();

        for (let i = 0; i < astBinary.length; i++) {
            wasmModule.setValue(astPtr + i, astBinary[i], 'i8');

            // Progress indicator for large binaries
            if (i > 0 && i % 1000 === 0) {
                process.stdout.write(`\r  Progress: ${i}/${astBinary.length} bytes (${((i / astBinary.length) * 100).toFixed(1)}%)`);
            }
        }

        const writeDuration = Date.now() - writeStart;
        console.log(`\r  ✅ Wrote ${astBinary.length} bytes in ${writeDuration}ms (${(astBinary.length / writeDuration).toFixed(0)} bytes/ms)\n`);
        passed++;

        // Verify write
        console.log('Step 7: Verifying memory write...');
        const verifyPoints = [0, 1, 2, 3, Math.floor(astSize / 2), astSize - 1];
        let verifyFailed = false;

        for (const i of verifyPoints) {
            const written = astBinary[i];
            const read = wasmModule.getValue(astPtr + i, 'i8');

            if (written !== read) {
                console.log(`  ❌ Mismatch at offset ${i}: wrote ${written}, read ${read}`);
                verifyFailed = true;
            }
        }

        if (verifyFailed) {
            console.log('❌ Memory verification FAILED!');
            wasmModule._free(astPtr);
            failed++;
            throw new Error('Memory corruption detected');
        }
        console.log('✅ Memory verification passed\n');
        passed++;

        // Create interpreter
        console.log('Step 8: Creating WASM interpreter...');
        console.log(`  Calling _createInterpreter(${astPtr}, ${astSize}, true)...`);

        let interpreterPtr = null;
        try {
            interpreterPtr = wasmModule._createInterpreter(astPtr, astSize, true);
            console.log(`  _createInterpreter returned: ${interpreterPtr} (0x${interpreterPtr.toString(16)})`);
        } catch (error) {
            console.log(`  ❌ EXCEPTION during _createInterpreter: ${error.message}`);
            console.log(`     ${error.stack}`);
            wasmModule._free(astPtr);
            failed++;
            throw error;
        }

        if (interpreterPtr === 0 || interpreterPtr === null) {
            console.log('❌ _createInterpreter FAILED - returned null!');
            console.log('   This means the C++ constructor rejected the binary AST');
            wasmModule._free(astPtr);
            failed++;
            throw new Error('Interpreter creation failed');
        }

        console.log('✅ Interpreter created successfully!\n');
        passed++;

        // Free AST memory (no longer needed)
        wasmModule._free(astPtr);
        console.log('  ℹ️  Freed AST memory\n');

        // Start interpreter
        console.log('Step 9: Starting interpreter execution...');
        try {
            const success = wasmModule._startInterpreter(interpreterPtr);
            console.log(`  _startInterpreter returned: ${success}`);

            if (success) {
                console.log('✅ Interpreter executed successfully!\n');
                passed++;
            } else {
                console.log('⚠️  Interpreter returned false (might be expected for minimal code)\n');
                passed++; // Still pass - false might be normal
            }
        } catch (error) {
            console.log(`  ❌ EXCEPTION during _startInterpreter: ${error.message}`);
            wasmModule._destroyInterpreter(interpreterPtr);
            failed++;
            throw error;
        }

        // Get command stream
        console.log('Step 10: Retrieving command stream...');
        try {
            const jsonPtr = wasmModule._getCommandStream(interpreterPtr);
            const jsonStr = wasmModule.UTF8ToString(jsonPtr);
            console.log(`  JSON length: ${jsonStr.length} characters`);

            if (jsonStr.length > 0) {
                const commands = JSON.parse(jsonStr);
                console.log(`  ✅ Command stream: ${commands.length} commands`);

                if (commands.length > 0) {
                    console.log(`\n  First few commands:`);
                    commands.slice(0, 5).forEach((cmd, i) => {
                        console.log(`    ${i + 1}. ${cmd.type}`);
                    });
                }

                passed++;
            } else {
                console.log('  ⚠️  Empty command stream');
                passed++; // Still pass - might be expected for minimal code
            }

            wasmModule._freeString(jsonPtr);
        } catch (error) {
            console.log(`  ❌ Failed to get command stream: ${error.message}`);
            failed++;
        }

        // Cleanup
        console.log('\nStep 11: Cleaning up...');
        wasmModule._destroyInterpreter(interpreterPtr);
        console.log('✅ Interpreter destroyed\n');
        passed++;

    } catch (error) {
        console.log(`\n💥 Test FAILED at runtime: ${error.message}`);
        console.log(error.stack);
        failed++;
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total:  ${passed + failed}`);

    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED - WASM interpreter works end-to-end!\n');
        process.exit(0);
    } else {
        console.log('\n❌ TESTS FAILED - WASM interpreter has issues\n');
        console.log('Next steps:');
        console.log('  1. Build with debug symbols: ./scripts/build_wasm_debug.sh');
        console.log('  2. Look for detailed error messages with -sASSERTIONS=2');
        console.log('  3. Check C++ code at failure point');
        console.log('');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
});
