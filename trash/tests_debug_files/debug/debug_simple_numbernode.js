#!/usr/bin/env node

/**
 * Simple NumberNode Debugging Script
 * Focus only on what gets written for the NumberNode value
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

console.log('='.repeat(60));
console.log('Simple NumberNode Value Debugging');
console.log('='.repeat(60));

// Test 1: Direct NumberNode value analysis
console.log('\n1. AST ANALYSIS');
console.log('-'.repeat(30));

const testCode = 'int x = 5;';
const ast = parse(testCode);

// Find the NumberNode directly
function findNumberNode(node) {
    if (!node || typeof node !== 'object') return null;
    
    if (node.type === 'NumberNode') {
        return node;
    }
    
    for (const [key, value] of Object.entries(node)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                const found = findNumberNode(item);
                if (found) return found;
            }
        } else if (typeof value === 'object') {
            const found = findNumberNode(value);
            if (found) return found;
        }
    }
    
    return null;
}

const numberNode = findNumberNode(ast);
if (!numberNode) {
    console.error('❌ No NumberNode found!');
    process.exit(1);
}

console.log('✅ Found NumberNode:');
console.log(`   Value: ${numberNode.value}`);
console.log(`   Type: ${typeof numberNode.value}`);
console.log(`   Is Integer: ${Number.isInteger(numberNode.value)}`);
console.log(`   Raw JSON: ${JSON.stringify(numberNode)}`);

// Test 2: Manual writeNumber testing
console.log('\n2. MANUAL WRITENUMBER TESTING');
console.log('-'.repeat(30));

// Let's manually test what writeNumber would do with value 5
const testValue = numberNode.value;
console.log(`Testing writeNumber with value: ${testValue}`);

// Create a small buffer to test writeNumber behavior
const testBuffer = new ArrayBuffer(20);
const testView = new DataView(testBuffer);

// Manually implement the writeNumber logic to see what happens
let offset = 0;

if (Number.isInteger(testValue)) {
    console.log(`✅ Value is integer`);
    if (testValue >= 0) {
        console.log(`✅ Value is positive`);
        if (testValue <= 0xFF) {
            console.log(`✅ Value fits in UINT8 (0-255)`);
            console.log(`   Writing type: 0x03 (UINT8_VAL)`);
            console.log(`   Writing value: ${testValue}`);
            
            testView.setUint8(offset, 0x03); // UINT8_VAL
            testView.setUint8(offset + 1, testValue);
            offset += 2;
            
            // Verify what we wrote
            const writtenType = testView.getUint8(0);
            const writtenValue = testView.getUint8(1);
            console.log(`   ✅ Verification - Type: 0x${writtenType.toString(16)}, Value: ${writtenValue}`);
        }
    }
} else {
    console.log(`❌ Value is not integer`);
}

// Test 3: Full CompactAST export analysis
console.log('\n3. COMPACTAST EXPORT ANALYSIS');
console.log('-'.repeat(30));

const compactBuffer = exportCompactAST(ast);
const compactView = new DataView(compactBuffer);
const compactBytes = new Uint8Array(compactBuffer);

console.log(`Export buffer size: ${compactBuffer.byteLength} bytes`);

// Search for NumberNode type (0x40) in the buffer
let numberNodePositions = [];
for (let i = 0; i < compactBytes.length - 1; i++) {
    if (compactBytes[i] === 0x40) { // NumberNode type
        numberNodePositions.push(i);
    }
}

console.log(`Found ${numberNodePositions.length} NumberNode entries at positions:`, numberNodePositions);

numberNodePositions.forEach((pos, index) => {
    console.log(`\nNumberNode ${index + 1} at position ${pos}:`);
    
    // Show surrounding bytes for context
    const contextStart = Math.max(0, pos - 2);
    const contextEnd = Math.min(compactBytes.length, pos + 10);
    const contextBytes = [];
    
    for (let i = contextStart; i < contextEnd; i++) {
        const marker = i === pos ? '🔥' : (i === pos + 1 ? '🎯' : '  ');
        contextBytes.push(`${marker}${i}: 0x${compactBytes[i].toString(16).padStart(2, '0')} (${compactBytes[i]})`);
    }
    
    console.log('   Context:');
    contextBytes.forEach(line => console.log(`     ${line}`));
    
    // Try to decode the value
    if (pos + 2 < compactBytes.length) {
        const nodeType = compactBytes[pos];
        const flags = compactBytes[pos + 1];
        const hasValue = (flags & 0x02) !== 0;
        
        console.log(`   Node type: 0x${nodeType.toString(16)} (should be 0x40)`);
        console.log(`   Flags: 0x${flags.toString(16)} (hasValue: ${hasValue})`);
        
        if (hasValue) {
            // Skip data size bytes and look for value
            let valueOffset = pos + 4; // node type + flags + data size (2 bytes)
            
            if (valueOffset < compactBytes.length) {
                const valueType = compactBytes[valueOffset];
                console.log(`   Value type: 0x${valueType.toString(16)}`);
                
                if (valueType === 0x03 && valueOffset + 1 < compactBytes.length) {
                    const decodedValue = compactBytes[valueOffset + 1];
                    console.log(`   🎯 DECODED VALUE: ${decodedValue} (should be 5)`);
                    
                    if (decodedValue !== 5) {
                        console.log(`   ❌ VALUE MISMATCH! Expected 5, got ${decodedValue}`);
                        console.log(`   🔍 This confirms the issue is in CompactAST export`);
                    } else {
                        console.log(`   ✅ VALUE CORRECT!`);
                    }
                }
            }
        }
    }
});

// Test 4: Hex dump around NumberNode
console.log('\n4. HEX DUMP ANALYSIS');
console.log('-'.repeat(30));

if (numberNodePositions.length > 0) {
    const pos = numberNodePositions[0];
    const dumpStart = Math.max(0, pos - 8);
    const dumpEnd = Math.min(compactBytes.length, pos + 16);
    
    console.log(`Hex dump around NumberNode at position ${pos}:`);
    let hexLine = '';
    let asciiLine = '';
    
    for (let i = dumpStart; i < dumpEnd; i++) {
        const byte = compactBytes[i];
        const hex = byte.toString(16).padStart(2, '0');
        const ascii = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        
        if (i === pos) {
            hexLine += `[${hex}] `;
            asciiLine += `[${ascii}]`;
        } else {
            hexLine += `${hex} `;
            asciiLine += ascii;
        }
    }
    
    console.log(`   Hex:   ${hexLine}`);
    console.log(`   ASCII: ${asciiLine}`);
}

console.log('\n' + '='.repeat(60));