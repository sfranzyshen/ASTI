#!/usr/bin/env node

/**
 * Minimal test to isolate CompactAST format compatibility issue
 * between JavaScript export and C++ import
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

console.log('🔍 CompactAST Format Compatibility Test\n');

// Minimal test program - just an empty setup function
const testCode = `
void setup() {
}

void loop() {
}
`;

console.log('Test code:');
console.log(testCode);
console.log();

try {
    // Parse the code
    console.log('1. Parsing code...');
    const ast = parse(testCode);
    
    if (!ast || ast.type === 'ErrorNode') {
        throw new Error('Parse failed');
    }
    
    console.log('   ✅ Parse successful');
    console.log(`   AST type: ${ast.type}`);
    console.log(`   Children: ${ast.children ? ast.children.length : 0}`);
    
    // Export to CompactAST
    console.log('\n2. Exporting to CompactAST...');
    const compactData = exportCompactAST(ast);
    
    console.log(`   Export returned: ${typeof compactData}, constructor: ${compactData?.constructor?.name}`);
    
    if (!compactData) {
        throw new Error('CompactAST export failed - returned null');
    }
    
    // Convert ArrayBuffer to Buffer if needed
    let buffer;
    if (compactData instanceof ArrayBuffer) {
        buffer = Buffer.from(compactData);
        console.log('   Converted ArrayBuffer to Buffer');
    } else if (Buffer.isBuffer(compactData)) {
        buffer = compactData;
        console.log('   Already a Buffer');
    } else {
        throw new Error(`Unexpected export type: ${typeof compactData}`);
    }
    
    console.log('   ✅ Export successful');
    console.log(`   Binary size: ${buffer.length} bytes`);
    
    // Show first few bytes
    const hexView = Array.from(buffer.slice(0, 20))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
    console.log(`   First bytes: ${hexView}...`);
    
    // Write to file for C++ testing
    const filename = 'simple_test.ast';
    fs.writeFileSync(filename, buffer);
    console.log(`   Saved as: ${filename}`);
    
    // Try to parse the header manually to see what we got
    console.log('\n3. Manual header analysis:');
    const magic = buffer.readUInt32LE(0);
    const version = buffer.readUInt16LE(4); 
    const flags = buffer.readUInt16LE(6);  // This should be flags, not nodeCount
    const nodeCount = buffer.readUInt32LE(8);  // This should be nodeCount
    const stringTableSize = buffer.readUInt32LE(12);
    
    console.log(`   Magic: 0x${magic.toString(16)} (should be 0x41535450 = 'ASTP')`);
    console.log(`   Version: 0x${version.toString(16)}`);
    console.log(`   Flags: 0x${flags.toString(16)}`);
    console.log(`   Node count: ${nodeCount}`);
    console.log(`   String table size: ${stringTableSize}`);
    
    // Check if first node type is readable
    const stringTableOffset = 16; // After header
    const nodesOffset = stringTableOffset + stringTableSize;
    
    if (buffer.length > nodesOffset) {
        const firstNodeType = buffer[nodesOffset];
        console.log(`   First node type: 0x${firstNodeType.toString(16)} (${firstNodeType})`);
    }
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}

console.log('\n🎯 Now test with C++: ./build/basic_interpreter_example simple_test.ast');