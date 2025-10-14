/**
 * test_wasm_basic.js - Basic WASM Module Validation
 *
 * Tests fundamental WASM module loading and basic operations
 * Run: node tests/test_wasm_basic.js
 */

const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('  WASM Basic Module Test');
console.log('═══════════════════════════════════════════════════════════\n');

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Test 1: Load WASM module
    console.log('Test 1: Loading WASM module...');
    try {
        const wasmPath = path.join(__dirname, '../build_wasm/arduino_interpreter.js');
        const createWasmModule = require(wasmPath);
        console.log('  ✅ WASM module file loaded');

        console.log('  ⏳ Initializing WASM module...');
        const wasmModule = await createWasmModule();
        console.log('  ✅ WASM module initialized');
        passed++;

        // Test 2: Check exported functions
        console.log('\nTest 2: Verifying exported functions...');
        const requiredFunctions = [
            '_createInterpreter',
            '_startInterpreter',
            '_getCommandStream',
            '_freeString',
            '_destroyInterpreter',
            '_getInterpreterVersion',
            '_malloc',
            '_free',
            'setValue',
            'getValue',
            'UTF8ToString'
        ];

        let allExported = true;
        for (const funcName of requiredFunctions) {
            if (typeof wasmModule[funcName] === 'function') {
                console.log(`  ✅ ${funcName} exported`);
            } else {
                console.log(`  ❌ ${funcName} NOT exported`);
                allExported = false;
            }
        }

        if (allExported) {
            passed++;
        } else {
            failed++;
        }

        // Test 3: Get interpreter version
        console.log('\nTest 3: Getting interpreter version...');
        try {
            const versionPtr = wasmModule._getInterpreterVersion();
            const version = wasmModule.UTF8ToString(versionPtr);
            console.log(`  ✅ Version: ${version}`);
            if (version === '21.2.0') {
                console.log('  ✅ Version matches expected (21.2.0)');
                passed++;
            } else {
                console.log(`  ⚠️  Version mismatch (expected 21.2.0, got ${version})`);
                passed++; // Still pass, just different version
            }
        } catch (error) {
            console.log(`  ❌ Failed to get version: ${error.message}`);
            failed++;
        }

        // Test 4: Test malloc/free
        console.log('\nTest 4: Testing memory allocation (malloc/free)...');
        try {
            const testSize = 1024;
            const ptr = wasmModule._malloc(testSize);
            console.log(`  ℹ️  malloc(${testSize}) returned: ${ptr}`);

            if (ptr === 0 || ptr === null) {
                console.log('  ❌ malloc returned null pointer!');
                failed++;
            } else {
                console.log(`  ✅ malloc succeeded (ptr: ${ptr})`);

                // Free the memory
                wasmModule._free(ptr);
                console.log('  ✅ free succeeded');
                passed++;
            }
        } catch (error) {
            console.log(`  ❌ malloc/free failed: ${error.message}`);
            failed++;
        }

        // Test 5: Test setValue/getValue roundtrip
        console.log('\nTest 5: Testing setValue/getValue roundtrip...');
        try {
            const testSize = 16;
            const ptr = wasmModule._malloc(testSize);

            if (ptr === 0) {
                console.log('  ❌ malloc failed');
                failed++;
            } else {
                // Write test pattern
                const testPattern = [0x41, 0x53, 0x54, 0x50, 0x01, 0x02, 0x03, 0x04]; // "ASTP" + version bytes
                for (let i = 0; i < testPattern.length; i++) {
                    wasmModule.setValue(ptr + i, testPattern[i], 'i8');
                }
                console.log(`  ✅ Wrote ${testPattern.length} bytes using setValue`);

                // Read back
                let allMatch = true;
                const readBack = [];
                for (let i = 0; i < testPattern.length; i++) {
                    const value = wasmModule.getValue(ptr + i, 'i8');
                    readBack.push(value);
                    if (value !== testPattern[i]) {
                        allMatch = false;
                    }
                }

                console.log(`  Written: [${testPattern.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
                console.log(`  Read:    [${readBack.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);

                if (allMatch) {
                    console.log('  ✅ All bytes match - roundtrip successful');
                    passed++;
                } else {
                    console.log('  ❌ Byte mismatch detected');
                    failed++;
                }

                wasmModule._free(ptr);
            }
        } catch (error) {
            console.log(`  ❌ setValue/getValue test failed: ${error.message}`);
            failed++;
        }

        // Test 6: Check for writeArrayToMemory
        console.log('\nTest 6: Checking for bulk memory write methods...');
        if (typeof wasmModule.writeArrayToMemory === 'function') {
            console.log('  ✅ writeArrayToMemory is available (preferred method)');
            passed++;
        } else {
            console.log('  ⚠️  writeArrayToMemory NOT available (will need setValue loop)');
            console.log('     This is not a failure, but bulk copy would be faster');
            passed++; // Don't fail, just note it
        }

    } catch (error) {
        console.log(`\n❌ Fatal error: ${error.message}`);
        console.log(error.stack);
        failed++;
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total:  ${passed + failed}`);

    if (failed === 0) {
        console.log('\n✅ ALL TESTS PASSED - WASM module is functional!\n');
        process.exit(0);
    } else {
        console.log('\n❌ SOME TESTS FAILED - WASM module has issues\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
});
