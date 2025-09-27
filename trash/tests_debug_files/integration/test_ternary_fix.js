#!/usr/bin/env node

/**
 * Test Ternary Expression Fix
 * 
 * Generates a simple test case to verify ternary expressions work correctly
 * in the C++ interpreter after the fix.
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

console.log('🔧 Generating ternary expression test...');

const testCode = `
void setup() {
    int condition = 1;
    int x = condition ? 10 : 20;
    Serial.begin(9600);
    Serial.print("x = ");
    Serial.println(x);
}

void loop() {
}
`;

console.log('📝 Test code:');
console.log(testCode);

try {
    // Parse the code
    console.log('🔍 Parsing code to AST...');
    const ast = parse(testCode);
    
    if (!ast) {
        console.error('❌ Failed to parse code');
        process.exit(1);
    }
    
    console.log('✅ AST generated successfully');
    
    // Export to CompactAST
    console.log('📦 Exporting CompactAST binary...');
    const compactASTBuffer = exportCompactAST(ast);
    
    if (!compactASTBuffer) {
        console.error('❌ Failed to export CompactAST');
        process.exit(1);
    }
    
    console.log(`✅ CompactAST generated: ${compactASTBuffer.byteLength} bytes`);
    
    // Write to file
    const fs = require('fs');
    const buffer = Buffer.from(compactASTBuffer);
    fs.writeFileSync('test_ternary.ast', buffer);
    
    console.log('💾 test_ternary.ast created successfully');
    console.log(`📁 File: test_ternary.ast`);
    console.log(`📦 Size: ${buffer.length} bytes`);
    console.log('🎯 Ready for C++ ternary expression testing');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}