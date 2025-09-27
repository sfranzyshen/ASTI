#!/usr/bin/env node

/**
 * Quick test to verify CompactAST string collection fix
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

console.log('🧪 Testing CompactAST String Collection Fix');

// Test 1: Simple variable declarations with different names
const code1 = `
void setup() {
    int x = 1;
}
void loop() {}
`;

const code2 = `
void setup() {
    int y = 2;
}
void loop() {}
`;

console.log('\n🔍 Testing different variable declarations...');

try {
    const ast1 = parse(code1);
    const ast2 = parse(code2);
    
    const compact1 = exportCompactAST(ast1);
    const compact2 = exportCompactAST(ast2);
    
    console.log(`AST1 CompactAST size: ${compact1.byteLength} bytes`);
    console.log(`AST2 CompactAST size: ${compact2.byteLength} bytes`);
    
    // Convert to hex for comparison
    const hex1 = Array.from(new Uint8Array(compact1)).map(b => b.toString(16).padStart(2, '0')).join('');
    const hex2 = Array.from(new Uint8Array(compact2)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (hex1 === hex2) {
        console.log('❌ FAILED: Different ASTs still produce identical CompactAST binaries');
        console.log('❌ String collection bug NOT fixed');
    } else {
        console.log('✅ SUCCESS: Different ASTs produce different CompactAST binaries');
        console.log('✅ String collection bug FIXED!');
        
        // Show the differences
        let diffCount = 0;
        for (let i = 0; i < Math.min(hex1.length, hex2.length); i += 2) {
            if (hex1.substr(i, 2) !== hex2.substr(i, 2)) {
                diffCount++;
            }
        }
        console.log(`📊 Binary differences: ${diffCount} bytes differ`);
    }
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}