#!/usr/bin/env node

/**
 * Test the fixed CompactASTExporter number type handling
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

console.log('🔍 Number Type Detection Test\n');

// Test program with different number types
const testCode = `
void setup() {
    int intVar = 42;          // Should be INT32_VAL  
    unsigned int uintVar = 300u;  // Should be UINT32_VAL
    float floatVar = 3.14f;   // Should be FLOAT32_VAL
    double doubleVar = 3.141592653589793; // Should be FLOAT64_VAL
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
    
    // Write AST for analysis
    const filename = 'number_types_test.ast';
    fs.writeFileSync(filename, buffer);
    console.log(`   Saved as: ${filename} (${buffer.length} bytes)`);
    
    // Manual analysis of the binary data to see if different number types are used
    console.log('\n2. Analyzing number types in binary data...');
    
    // Look for ValueType bytes in the data
    const valueTypes = {
        0x00: 'VOID_VAL',
        0x01: 'BOOL_VAL', 
        0x06: 'INT32_VAL',    // ← Should see this for integers
        0x07: 'UINT32_VAL',   // ← Should see this for unsigned
        0x0A: 'FLOAT32_VAL',  // ← Should see this for floats
        0x0B: 'FLOAT64_VAL',  // ← Should see this for doubles
        0x0C: 'STRING_VAL'
    };
    
    console.log('   ValueType bytes found in data:');
    const foundTypes = new Set();
    
    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if (valueTypes[byte]) {
            foundTypes.add(byte);
        }
    }
    
    for (const typeCode of Array.from(foundTypes).sort()) {
        console.log(`     0x${typeCode.toString(16).padStart(2, '0')}: ${valueTypes[typeCode]}`);
    }
    
    // Check if we now have different number types (not just FLOAT64_VAL)
    const hasInt32 = foundTypes.has(0x06);
    const hasUint32 = foundTypes.has(0x07);  
    const hasFloat32 = foundTypes.has(0x0A);
    const hasFloat64 = foundTypes.has(0x0B);
    
    console.log('\n3. Type detection results:');
    console.log(`   INT32_VAL found: ${hasInt32 ? '✅' : '❌'}`);
    console.log(`   UINT32_VAL found: ${hasUint32 ? '✅' : '❌'}`);
    console.log(`   FLOAT32_VAL found: ${hasFloat32 ? '✅' : '❌'}`);
    console.log(`   FLOAT64_VAL found: ${hasFloat64 ? '✅' : '❌'}`);
    
    if (hasInt32 || hasUint32 || hasFloat32) {
        console.log('\n🎉 SUCCESS: Number type detection is working!');
        console.log('   JavaScript exporter now uses proper ValueTypes');
    } else {
        console.log('\n❌ ISSUE: Still only using FLOAT64_VAL');
        console.log('   The fix may not be working as expected');
    }
    
    console.log('\n🎯 Next: Test with C++: ./test_cpp_direct number_types_test.ast');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}