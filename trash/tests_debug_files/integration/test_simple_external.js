#!/usr/bin/env node

/**
 * Simplified external function test - just analogRead in setup
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

console.log('🔍 Simple External Function Test\n');

// Ultra-simple test - just call analogRead in setup
const testCode = `
void setup() {
    analogRead(A0);
}

void loop() {
}
`;

console.log('Test code:');
console.log(testCode);
console.log();

try {
    // Parse and export
    console.log('1. Parsing and exporting...');
    const ast = parse(testCode);
    
    let buffer;
    const compactData = exportCompactAST(ast);
    if (compactData instanceof ArrayBuffer) {
        buffer = Buffer.from(compactData);
    } else {
        buffer = compactData;
    }
    
    // Write AST for C++ testing
    const filename = 'simple_external_test.ast';
    fs.writeFileSync(filename, buffer);
    console.log(`   Saved as: ${filename} (${buffer.length} bytes)`);
    
    console.log('\n🎯 Now test with C++: ./test_cpp_direct simple_external_test.ast');
    console.log('   Expected: Should emit ANALOG_READ_REQUEST and suspend');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}