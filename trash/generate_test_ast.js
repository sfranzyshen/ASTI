#!/usr/bin/env node

/**
 * Generate a simple test AST file for C++ cross-platform testing
 */

const fs = require('fs');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { exportCompactAST } = require('./libs/CompactAST/src/CompactAST.js');

const simpleCode = `
void setup() {
    int x = 42;
    Serial.begin(9600);
}

void loop() {
    Serial.println(x);
}`;

console.log('Generating test AST file...');
console.log('Code:', simpleCode.trim());

try {
    const ast = parse(simpleCode);
    console.log('✓ Parsing successful');
    
    const binaryData = exportCompactAST(ast);
    console.log(`✓ Serialization successful - ${binaryData.byteLength} bytes`);
    
    const buffer = Buffer.from(binaryData);
    fs.writeFileSync('test_simple.ast', buffer);
    console.log('✓ Written to test_simple.ast');
    
} catch (error) {
    console.log('✗ Error:', error.message);
    process.exit(1);
}
