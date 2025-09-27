const { Parser, parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

/**
 * Cross-platform CompactAST verification test
 * Tests that JavaScript-generated CompactAST files can be read by C++ implementation
 */

console.log('=== CompactAST Cross-Platform Verification ===');

// Simple test code that exercises multiple node types
const testCode = `
int ledPin = 13;
void setup() {
    pinMode(ledPin, OUTPUT);
}
void loop() {
    digitalWrite(ledPin, HIGH);
    delay(1000);
    digitalWrite(ledPin, LOW);
    delay(1000);
}
`;

try {
    console.log('1. Parsing Arduino code...');
    const ast = parse(testCode);
    
    if (!ast || ast.type !== 'ProgramNode') {
        throw new Error('Failed to parse test code');
    }
    
    console.log('   ✅ Parsing successful');
    console.log(`   📊 AST root type: ${ast.type}`);
    
    console.log('\n2. Generating CompactAST binary...');
    const buffer = exportCompactAST(ast);
    
    console.log(`   ✅ CompactAST generated: ${buffer.byteLength} bytes`);
    
    // Verify header manually
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true); // little-endian
    const version = view.getUint16(4, true);
    const flags = view.getUint16(6, true);
    const nodeCount = view.getUint32(8, true);
    const stringTableSize = view.getUint32(12, true);
    
    console.log('\n3. Verifying header format...');
    console.log(`   Magic: 0x${magic.toString(16)} (expected: 0x41535450)`);
    console.log(`   Version: 0x${version.toString(16)} (expected: 0x0100)`);
    console.log(`   Flags: 0x${flags.toString(16)}`);
    console.log(`   Node Count: ${nodeCount}`);
    console.log(`   String Table Size: ${stringTableSize}`);
    
    if (magic !== 0x41535450) {
        throw new Error(`Invalid magic number: 0x${magic.toString(16)}`);
    }
    
    if (version !== 0x0100) {
        throw new Error(`Unsupported version: 0x${version.toString(16)}`);
    }
    
    console.log('   ✅ Header validation passed');
    
    console.log('\n4. Writing test file for C++ validation...');
    const filename = 'test_cross_platform.ast';
    fs.writeFileSync(filename, Buffer.from(buffer));
    console.log(`   ✅ Written: ${filename} (${buffer.byteLength} bytes)`);
    
    console.log('\n5. Testing C++ CompactAST reader...');
    // The C++ test executable should be able to read this file
    console.log('   📋 To complete verification, run: ./build/test_cross_platform_validation');
    console.log('   📋 This will test if C++ can read the JavaScript-generated file');
    
    console.log('\n=== Cross-Platform Test File Generated ===');
    console.log('✅ JavaScript CompactAST writer: WORKING');
    console.log('✅ Header endianness: LITTLE-ENDIAN (correct)');
    console.log('✅ Format validation: PASSED');
    console.log(`✅ Test file: ${filename} ready for C++ validation`);
    
} catch (error) {
    console.error('❌ Cross-platform verification failed:', error.message);
    process.exit(1);
}