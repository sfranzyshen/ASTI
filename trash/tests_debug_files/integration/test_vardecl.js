#!/usr/bin/env node

/**
 * Test variable declarations and assignments
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

console.log('🔍 Variable Declaration Test\n');

// Test program with variable declarations
const testCode = `
void setup() {
    int x = 42;
    float y = 3.14;
    bool enabled = true;
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
    const filename = 'vardecl_test.ast';
    fs.writeFileSync(filename, buffer);
    console.log(`   Saved as: ${filename} (${buffer.length} bytes)`);
    
    console.log('\n🎯 Now test with C++: ./test_simple_ast vardecl_test.ast');
    console.log('   Expected: Should parse variable declarations without errors');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}