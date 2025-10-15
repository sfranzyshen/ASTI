/**
 * test_wasm_memory.js - WASM Memory Write Validation
 *
 * Tests different memory write strategies and sizes to identify corruption issues
 * Run: node tests/test_wasm_memory.js
 */

const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('  WASM Memory Write Validation Test');
console.log('═══════════════════════════════════════════════════════════\n');

async function runTests() {
    let passed = 0;
    let failed = 0;

    try {
        // Load WASM module
        console.log('Loading WASM module...');
        const wasmPath = path.join(__dirname, '../build_wasm/arduino_interpreter.js');
        const createWasmModule = require(wasmPath);
        const wasmModule = await createWasmModule();
        console.log('✅ WASM module loaded\n');

        // Test 1: Small data (10 bytes)
        console.log('Test 1: Writing 10 bytes with setValue loop...');
        try {
            const size1 = 10;
            const ptr1 = wasmModule._malloc(size1);

            if (ptr1 === 0) {
                console.log('  ❌ malloc failed');
                failed++;
            } else {
                // Create test pattern
                const testData = new Uint8Array(size1);
                for (let i = 0; i < size1; i++) {
                    testData[i] = (i * 17) % 256; // Varying pattern
                }

                // Write using setValue
                const start = Date.now();
                for (let i = 0; i < testData.length; i++) {
                    wasmModule.setValue(ptr1 + i, testData[i], 'i8');
                }
                const duration = Date.now() - start;

                // Verify
                let allMatch = true;
                for (let i = 0; i < testData.length; i++) {
                    const value = wasmModule.getValue(ptr1 + i, 'i8');
                    if (value !== testData[i]) {
                        console.log(`  ❌ Mismatch at byte ${i}: wrote ${testData[i]}, read ${value}`);
                        allMatch = false;
                    }
                }

                if (allMatch) {
                    console.log(`  ✅ All 10 bytes verified (${duration}ms)`);
                    passed++;
                } else {
                    console.log('  ❌ Data corruption detected');
                    failed++;
                }

                wasmModule._free(ptr1);
            }
        } catch (error) {
            console.log(`  ❌ Test failed: ${error.message}`);
            failed++;
        }

        // Test 2: Medium data (1KB)
        console.log('\nTest 2: Writing 1KB with setValue loop...');
        try {
            const size2 = 1024;
            const ptr2 = wasmModule._malloc(size2);

            if (ptr2 === 0) {
                console.log('  ❌ malloc failed');
                failed++;
            } else {
                // Create test pattern
                const testData = new Uint8Array(size2);
                for (let i = 0; i < size2; i++) {
                    testData[i] = i % 256;
                }

                // Write using setValue
                const start = Date.now();
                for (let i = 0; i < testData.length; i++) {
                    wasmModule.setValue(ptr2 + i, testData[i], 'i8');
                }
                const duration = Date.now() - start;

                // Spot check verification (checking all 1024 is slow)
                const checkPoints = [0, 255, 512, 767, 1023];
                let allMatch = true;
                for (const i of checkPoints) {
                    const value = wasmModule.getValue(ptr2 + i, 'i8');
                    if (value !== testData[i]) {
                        console.log(`  ❌ Mismatch at byte ${i}: wrote ${testData[i]}, read ${value}`);
                        allMatch = false;
                    }
                }

                if (allMatch) {
                    console.log(`  ✅ 1KB verified at checkpoints (${duration}ms)`);
                    passed++;
                } else {
                    console.log('  ❌ Data corruption detected');
                    failed++;
                }

                wasmModule._free(ptr2);
            }
        } catch (error) {
            console.log(`  ❌ Test failed: ${error.message}`);
            failed++;
        }

        // Test 3: Large data (10KB - simulates typical AST size)
        console.log('\nTest 3: Writing 10KB with setValue loop (simulates real AST)...');
        try {
            const size3 = 10 * 1024; // 10KB
            const ptr3 = wasmModule._malloc(size3);

            if (ptr3 === 0) {
                console.log('  ❌ malloc failed');
                failed++;
            } else {
                // Create test pattern
                const testData = new Uint8Array(size3);
                for (let i = 0; i < size3; i++) {
                    testData[i] = (i * 7) % 256; // Varying pattern
                }

                // Write using setValue
                const start = Date.now();
                for (let i = 0; i < testData.length; i++) {
                    wasmModule.setValue(ptr3 + i, testData[i], 'i8');
                }
                const duration = Date.now() - start;

                // Spot check verification
                const checkPoints = [0, 1000, 2500, 5000, 7500, 10000, 10239];
                let allMatch = true;
                for (const i of checkPoints) {
                    const value = wasmModule.getValue(ptr3 + i, 'i8');
                    if (value !== testData[i]) {
                        console.log(`  ❌ Mismatch at byte ${i}: wrote ${testData[i]}, read ${value}`);
                        allMatch = false;
                    }
                }

                if (allMatch) {
                    console.log(`  ✅ 10KB verified at checkpoints (${duration}ms)`);
                    console.log(`     Performance: ${(size3 / duration).toFixed(0)} bytes/ms`);
                    passed++;
                } else {
                    console.log('  ❌ Data corruption detected');
                    failed++;
                }

                wasmModule._free(ptr3);
            }
        } catch (error) {
            console.log(`  ❌ Test failed: ${error.message}`);
            failed++;
        }

        // Test 4: Boundary test (write at exact buffer boundary)
        console.log('\nTest 4: Boundary test (last byte of allocated buffer)...');
        try {
            const size4 = 256;
            const ptr4 = wasmModule._malloc(size4);

            if (ptr4 === 0) {
                console.log('  ❌ malloc failed');
                failed++;
            } else {
                // Write to first and last byte
                wasmModule.setValue(ptr4, 0xAA, 'i8');
                wasmModule.setValue(ptr4 + size4 - 1, 0xBB, 'i8');

                const firstByte = wasmModule.getValue(ptr4, 'i8');
                const lastByte = wasmModule.getValue(ptr4 + size4 - 1, 'i8');

                if (firstByte === 0xAA && lastByte === 0xBB) {
                    console.log('  ✅ Boundary bytes verified');
                    passed++;
                } else {
                    console.log(`  ❌ Boundary check failed: first=0x${firstByte.toString(16)}, last=0x${lastByte.toString(16)}`);
                    failed++;
                }

                wasmModule._free(ptr4);
            }
        } catch (error) {
            console.log(`  ❌ Test failed: ${error.message}`);
            failed++;
        }

        // Test 5: Pattern test (detect corruption patterns)
        console.log('\nTest 5: Pattern corruption test (repeated sequences)...');
        try {
            const size5 = 1024;
            const ptr5 = wasmModule._malloc(size5);

            if (ptr5 === 0) {
                console.log('  ❌ malloc failed');
                failed++;
            } else {
                // Write repeating ASTP pattern
                const pattern = [0x41, 0x53, 0x54, 0x50]; // "ASTP"
                for (let i = 0; i < size5; i++) {
                    wasmModule.setValue(ptr5 + i, pattern[i % pattern.length], 'i8');
                }

                // Verify pattern integrity at multiple points
                const checkOffsets = [0, 256, 512, 768, 1020];
                let allMatch = true;
                for (const offset of checkOffsets) {
                    const value = wasmModule.getValue(ptr5 + offset, 'i8');
                    const expected = pattern[offset % pattern.length];
                    if (value !== expected) {
                        console.log(`  ❌ Pattern mismatch at offset ${offset}: expected 0x${expected.toString(16)}, got 0x${value.toString(16)}`);
                        allMatch = false;
                    }
                }

                if (allMatch) {
                    console.log('  ✅ Pattern integrity verified');
                    passed++;
                } else {
                    console.log('  ❌ Pattern corruption detected');
                    failed++;
                }

                wasmModule._free(ptr5);
            }
        } catch (error) {
            console.log(`  ❌ Test failed: ${error.message}`);
            failed++;
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
        console.log('\n✅ ALL TESTS PASSED - Memory operations are safe!\n');
        process.exit(0);
    } else {
        console.log('\n❌ SOME TESTS FAILED - Memory corruption detected\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
});
