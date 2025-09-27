#!/usr/bin/env node

/**
 * Test external function handling (analogRead, digitalRead, etc)
 * to verify state machine suspension and resumption works correctly
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

console.log('🔍 External Function Test\n');

// Test program with analogRead - should suspend and wait for response
const testCode = `
void setup() {
    Serial.begin(9600);
}

void loop() {
    int value = analogRead(A0);
    Serial.print("Sensor: ");
    Serial.println(value);
    delay(1000);
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
    const filename = 'external_test.ast';
    fs.writeFileSync(filename, buffer);
    console.log(`   Saved as: ${filename} (${buffer.length} bytes)`);
    
    console.log('\n🎯 Now test with C++: ./test_cpp_direct external_test.ast');
    console.log('   Expected: Should suspend on analogRead and wait for response');
    console.log('   Current issue: Return values not properly handled after resumption');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}