#!/usr/bin/env node

/**
 * NumberNode Value Debugging Script
 * 
 * This script debugs why C++ NumberNode reads value 0.000000 instead of 5
 * by examining the complete flow from JavaScript parsing through CompactAST export.
 * 
 * Steps:
 * 1. Parse simple code "int x = 5;" with ArduinoParser.js
 * 2. Find and examine the NumberNode in the AST
 * 3. Export to CompactAST binary format 
 * 4. Show raw bytes where NumberNode value is stored
 * 5. Verify the binary data matches expected format
 */

const fs = require('fs');
const { parse, exportCompactAST, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');

console.log('='.repeat(80));
console.log('NumberNode Value Debugging Script');
console.log('='.repeat(80));

// Step 1: Parse simple code with NumberNode
console.log('\n1. PARSING CODE: "int x = 5;"');
console.log('-'.repeat(40));

const testCode = 'int x = 5;';
console.log(`Input code: ${testCode}`);

let ast;
try {
    ast = parse(testCode);
    console.log('✅ Parsing successful');
} catch (error) {
    console.error('❌ Parsing failed:', error.message);
    process.exit(1);
}

// Step 2: Find NumberNode in AST and examine its value
console.log('\n2. EXAMINING AST STRUCTURE');
console.log('-'.repeat(40));

console.log('Full AST:');
console.log(prettyPrintAST(ast, { showTypes: true }));

// Function to recursively find NumberNodes
function findNumberNodes(node, path = []) {
    const numberNodes = [];
    
    if (node && typeof node === 'object') {
        if (node.type === 'NumberNode') {
            numberNodes.push({
                node: node,
                path: path.join(' -> '),
                value: node.value,
                valueType: typeof node.value,
                valueString: String(node.value)
            });
        }
        
        // Recursively search all properties
        for (const [key, value] of Object.entries(node)) {
            if (key !== 'type' && (Array.isArray(value) || (value && typeof value === 'object'))) {
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        numberNodes.push(...findNumberNodes(item, [...path, `${key}[${index}]`]));
                    });
                } else {
                    numberNodes.push(...findNumberNodes(value, [...path, key]));
                }
            }
        }
    }
    
    return numberNodes;
}

const numberNodes = findNumberNodes(ast, ['root']);
console.log(`\nFound ${numberNodes.length} NumberNode(s):`);

if (numberNodes.length === 0) {
    console.error('❌ No NumberNodes found in AST! This indicates a parsing issue.');
    process.exit(1);
}

numberNodes.forEach((item, index) => {
    console.log(`\nNumberNode ${index + 1}:`);
    console.log(`  Path: ${item.path}`);
    console.log(`  Value: ${item.value}`);
    console.log(`  Value type: ${item.valueType}`);
    console.log(`  Value as string: "${item.valueString}"`);
    console.log(`  Raw node:`, JSON.stringify(item.node, null, 2));
});

// Step 3: Export to CompactAST binary format
console.log('\n3. EXPORTING TO COMPACT AST');
console.log('-'.repeat(40));

let compactASTBuffer;
try {
    compactASTBuffer = exportCompactAST(ast);
    console.log(`✅ CompactAST export successful`);
    console.log(`   Buffer size: ${compactASTBuffer.byteLength} bytes`);
} catch (error) {
    console.error('❌ CompactAST export failed:', error.message);
    process.exit(1);
}

// Step 4: Examine raw bytes 
console.log('\n4. RAW BINARY DATA ANALYSIS');
console.log('-'.repeat(40));

const view = new DataView(compactASTBuffer);
const uint8Array = new Uint8Array(compactASTBuffer);

console.log('Complete binary data (hex):');
let hexOutput = '';
for (let i = 0; i < Math.min(uint8Array.length, 200); i++) {
    if (i % 16 === 0) hexOutput += '\n' + i.toString(16).padStart(4, '0') + ': ';
    hexOutput += uint8Array[i].toString(16).padStart(2, '0') + ' ';
}
console.log(hexOutput);

console.log('\nComplete binary data (decimal):');
let decOutput = '';
for (let i = 0; i < Math.min(uint8Array.length, 200); i++) {
    if (i % 16 === 0) decOutput += '\n' + i.toString(16).padStart(4, '0') + ': ';
    decOutput += uint8Array[i].toString().padStart(3, ' ') + ' ';
}
console.log(decOutput);

// Step 5: Search for NumberNode (type 0x40) and analyze its value encoding
console.log('\n5. SEARCHING FOR NUMBERNODE (0x40) AND VALUE');
console.log('-'.repeat(40));

let numberNodePositions = [];
for (let i = 0; i < uint8Array.length - 1; i++) {
    if (uint8Array[i] === 0x40) { // NumberNode type
        numberNodePositions.push(i);
    }
}

console.log(`Found ${numberNodePositions.length} NumberNode entries at positions:`, numberNodePositions);

numberNodePositions.forEach((pos, index) => {
    console.log(`\nNumberNode ${index + 1} at position ${pos} (0x${pos.toString(16)}):`);
    console.log(`  Node type: 0x${uint8Array[pos].toString(16)} (should be 0x40)`);
    
    // The value should follow the node type byte
    // Let's examine the next several bytes to see the value encoding
    console.log(`  Following bytes:`);
    for (let i = 1; i <= Math.min(12, uint8Array.length - pos - 1); i++) {
        const byteValue = uint8Array[pos + i];
        console.log(`    +${i}: 0x${byteValue.toString(16).padStart(2, '0')} (${byteValue})`);
    }
    
    // Try to decode the value based on the encoding format we found in writeNumber()
    const valueTypeOffset = pos + 1;
    if (valueTypeOffset < uint8Array.length) {
        const valueType = uint8Array[valueTypeOffset];
        console.log(`  Value type: 0x${valueType.toString(16)}`);
        
        let decodedValue = 'unknown';
        try {
            switch (valueType) {
                case 0x02: // INT8_VAL
                    decodedValue = view.getInt8(valueTypeOffset + 1);
                    console.log(`  Decoded as INT8: ${decodedValue}`);
                    break;
                case 0x03: // UINT8_VAL
                    decodedValue = view.getUint8(valueTypeOffset + 1);
                    console.log(`  Decoded as UINT8: ${decodedValue}`);
                    break;
                case 0x04: // INT16_VAL
                    decodedValue = view.getInt16(valueTypeOffset + 1, true);
                    console.log(`  Decoded as INT16: ${decodedValue}`);
                    break;
                case 0x05: // UINT16_VAL
                    decodedValue = view.getUint16(valueTypeOffset + 1, true);
                    console.log(`  Decoded as UINT16: ${decodedValue}`);
                    break;
                case 0x06: // INT32_VAL
                    decodedValue = view.getInt32(valueTypeOffset + 1, true);
                    console.log(`  Decoded as INT32: ${decodedValue}`);
                    break;
                case 0x07: // UINT32_VAL
                    decodedValue = view.getUint32(valueTypeOffset + 1, true);
                    console.log(`  Decoded as UINT32: ${decodedValue}`);
                    break;
                case 0x0A: // FLOAT32_VAL
                    decodedValue = view.getFloat32(valueTypeOffset + 1, true);
                    console.log(`  Decoded as FLOAT32: ${decodedValue}`);
                    break;
                case 0x0B: // FLOAT64_VAL
                    decodedValue = view.getFloat64(valueTypeOffset + 1, true);
                    console.log(`  Decoded as FLOAT64: ${decodedValue}`);
                    break;
                default:
                    console.log(`  Unknown value type: 0x${valueType.toString(16)}`);
            }
        } catch (error) {
            console.log(`  Error decoding value: ${error.message}`);
        }
    }
});

// Step 6: Save binary data for C++ analysis
console.log('\n6. SAVING TEST DATA');
console.log('-'.repeat(40));

const outputFile = 'debug_numbernode.ast';
fs.writeFileSync(outputFile, Buffer.from(compactASTBuffer));
console.log(`✅ Binary AST saved to: ${outputFile}`);
console.log(`   File size: ${fs.statSync(outputFile).size} bytes`);

// Step 7: Summary and recommendations
console.log('\n7. DIAGNOSTIC SUMMARY');
console.log('-'.repeat(40));

console.log('Analysis results:');
console.log(`✅ Found ${numberNodes.length} NumberNode(s) in AST`);
console.log(`✅ Found ${numberNodePositions.length} NumberNode(s) in binary data`);

if (numberNodes.length > 0) {
    const firstNode = numberNodes[0];
    console.log(`🔍 Expected value: ${firstNode.value} (type: ${firstNode.valueType})`);
    
    if (firstNode.value === 5) {
        console.log('✅ JavaScript AST has correct NumberNode value (5)');
        console.log('🔍 Issue likely in CompactAST export or C++ import');
    } else {
        console.log('❌ JavaScript AST has incorrect NumberNode value');
        console.log('🔍 Issue in JavaScript parsing stage');
    }
}

console.log('\nNext steps:');
console.log('1. Test this binary file with your C++ CompactAST reader');
console.log('2. Compare the decoded value in C++ with the expected value shown above');
console.log('3. If C++ shows 0, the issue is in C++ CompactAST::parseValue()');
console.log('4. If C++ shows 5, the issue may be elsewhere in the C++ interpreter');

console.log('\nTest command for C++ validation:');
console.log(`   ./your_cpp_program ${outputFile}`);

console.log('\n' + '='.repeat(80));