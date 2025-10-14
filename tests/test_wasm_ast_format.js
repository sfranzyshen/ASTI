/**
 * test_wasm_ast_format.js - CompactAST Binary Format Validation
 *
 * Validates that CompactAST binary export produces correct format
 * Run: node tests/test_wasm_ast_format.js
 */

const path = require('path');
const { parse, exportCompactAST } = require('../libs/ArduinoParser/src/ArduinoParser.js');

console.log('═══════════════════════════════════════════════════════════');
console.log('  CompactAST Binary Format Validation');
console.log('═══════════════════════════════════════════════════════════\n');

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Test 1: Parse minimal Arduino code
    console.log('Test 1: Parsing minimal Arduino code...');
    try {
        const minimalCode = `void setup() {} void loop() {}`;
        console.log(`  Code: "${minimalCode}"`);

        const ast = parse(minimalCode);
        if (!ast) {
            console.log('  ❌ Parser returned null AST');
            failed++;
        } else {
            console.log('  ✅ AST parsed successfully');
            console.log(`     AST type: ${ast.type}`);
            console.log(`     AST children: ${ast.children ? ast.children.length : 0}`);
            passed++;
        }
    } catch (error) {
        console.log(`  ❌ Parse failed: ${error.message}`);
        failed++;
    }

    // Test 2: Export to CompactAST binary
    console.log('\nTest 2: Exporting to CompactAST binary...');
    let astBinary = null;
    try {
        const minimalCode = `void setup() {} void loop() {}`;
        const ast = parse(minimalCode);
        const astBuffer = exportCompactAST(ast);

        if (!astBuffer) {
            console.log('  ❌ exportCompactAST returned null');
            failed++;
        } else {
            astBinary = new Uint8Array(astBuffer);
            console.log(`  ✅ Binary exported successfully`);
            console.log(`     Binary size: ${astBinary.length} bytes`);
            passed++;
        }
    } catch (error) {
        console.log(`  ❌ Export failed: ${error.message}`);
        failed++;
    }

    if (!astBinary) {
        console.log('\n❌ Cannot continue - binary export failed');
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`  Passed: ${passed}, Failed: ${failed}`);
        console.log('═══════════════════════════════════════════════════════════\n');
        process.exit(1);
    }

    // Test 3: Validate magic bytes ("ASTP")
    console.log('\nTest 3: Validating magic bytes...');
    try {
        const magic = String.fromCharCode(astBinary[0], astBinary[1], astBinary[2], astBinary[3]);
        console.log(`  Magic bytes: "${magic}" (0x${astBinary[0].toString(16)} 0x${astBinary[1].toString(16)} 0x${astBinary[2].toString(16)} 0x${astBinary[3].toString(16)})`);

        if (magic === 'ASTP') {
            console.log('  ✅ Magic bytes correct ("ASTP")');
            passed++;
        } else {
            console.log(`  ❌ Magic bytes incorrect (expected "ASTP", got "${magic}")`);
            failed++;
        }
    } catch (error) {
        console.log(`  ❌ Validation failed: ${error.message}`);
        failed++;
    }

    // Test 4: Validate header structure
    console.log('\nTest 4: Validating header structure...');
    try {
        // CompactAST header format:
        // Bytes 0-3: Magic "ASTP"
        // Bytes 4-5: Version (uint16, little-endian)
        // Bytes 6-9: Node count (uint32, little-endian)

        const version = astBinary[4] | (astBinary[5] << 8);
        const nodeCount = astBinary[6] | (astBinary[7] << 8) | (astBinary[8] << 16) | (astBinary[9] << 24);

        console.log(`  Version: ${version}`);
        console.log(`  Node count: ${nodeCount}`);

        if (version > 0 && nodeCount > 0) {
            console.log('  ✅ Header structure valid');
            passed++;
        } else {
            console.log('  ❌ Header values suspicious (version or nodeCount is 0)');
            failed++;
        }
    } catch (error) {
        console.log(`  ❌ Validation failed: ${error.message}`);
        failed++;
    }

    // Test 5: Dump binary as hex (first 256 bytes)
    console.log('\nTest 5: Binary hex dump (first 256 bytes)...');
    try {
        const dumpSize = Math.min(256, astBinary.length);
        console.log(`  Dumping first ${dumpSize} bytes:\n`);

        for (let offset = 0; offset < dumpSize; offset += 16) {
            const hexPart = [];
            const asciiPart = [];

            for (let i = 0; i < 16 && (offset + i) < dumpSize; i++) {
                const byte = astBinary[offset + i];
                hexPart.push(byte.toString(16).padStart(2, '0'));
                asciiPart.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
            }

            const offsetStr = offset.toString(16).padStart(4, '0');
            const hexStr = hexPart.join(' ').padEnd(47, ' ');
            const asciiStr = asciiPart.join('');

            console.log(`  ${offsetStr}  ${hexStr}  |${asciiStr}|`);
        }

        console.log('\n  ✅ Hex dump complete');
        passed++;
    } catch (error) {
        console.log(`  ❌ Dump failed: ${error.message}`);
        failed++;
    }

    // Test 6: Size reasonableness check
    console.log('\nTest 6: Size reasonableness check...');
    try {
        // Minimal code should produce small binary
        // Typical range: 500-5000 bytes for simple programs
        const size = astBinary.length;

        console.log(`  Binary size: ${size} bytes`);

        if (size < 100) {
            console.log('  ⚠️  Size seems too small (< 100 bytes)');
            console.log('     This might indicate incomplete serialization');
            failed++;
        } else if (size > 50000) {
            console.log('  ⚠️  Size seems too large (> 50KB)');
            console.log('     This might indicate bloated serialization');
            failed++;
        } else {
            console.log('  ✅ Size is reasonable for minimal code');
            passed++;
        }
    } catch (error) {
        console.log(`  ❌ Check failed: ${error.message}`);
        failed++;
    }

    // Test 7: Blink example (more complex code)
    console.log('\nTest 7: Testing with Blink example...');
    try {
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

        const ast = parse(blinkCode);
        const astBuffer = exportCompactAST(ast);
        const blinkBinary = new Uint8Array(astBuffer);

        console.log(`  Blink code size: ${blinkCode.length} bytes`);
        console.log(`  Blink AST binary: ${blinkBinary.length} bytes`);
        console.log(`  Compression ratio: ${(blinkCode.length / blinkBinary.length).toFixed(2)}x`);

        // Validate magic bytes
        const magic = String.fromCharCode(blinkBinary[0], blinkBinary[1], blinkBinary[2], blinkBinary[3]);
        if (magic === 'ASTP') {
            console.log('  ✅ Blink example binary valid');
            passed++;
        } else {
            console.log('  ❌ Blink example binary invalid');
            failed++;
        }
    } catch (error) {
        console.log(`  ❌ Test failed: ${error.message}`);
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
        console.log('\n✅ ALL TESTS PASSED - CompactAST binary format is valid!\n');
        process.exit(0);
    } else {
        console.log('\n❌ SOME TESTS FAILED - Binary format issues detected\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n💥 Unhandled error:', error);
    console.log(error.stack);
    process.exit(1);
});
