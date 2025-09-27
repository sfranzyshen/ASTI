#!/usr/bin/env node

/**
 * CompactAST Format Deep Analysis
 * 
 * This script analyzes the complete binary structure to understand
 * how VarDeclNode declarations are actually serialized.
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

function analyzeCompleteFormat() {
    console.log('='.repeat(80));
    console.log('COMPLETE COMPACTAST BINARY FORMAT ANALYSIS');
    console.log('='.repeat(80));
    
    const testCode = 'int x = 5;';
    console.log(`\nAnalyzing: "${testCode}"`);
    
    const ast = parse(testCode);
    const binaryData = exportCompactAST(ast);
    const view = new DataView(binaryData);
    
    console.log(`\nBinary size: ${binaryData.byteLength} bytes`);
    
    // Parse header
    const magic = view.getUint32(0, true);
    const version = view.getUint16(4, true);
    const flags = view.getUint16(6, true);
    const nodeCount = view.getUint32(8, true);
    const stringTableSize = view.getUint32(12, true);
    
    console.log('\n📋 HEADER:');
    console.log(`   Magic: 0x${magic.toString(16)}`);
    console.log(`   Version: ${version}`);
    console.log(`   Flags: 0x${flags.toString(16)}`);
    console.log(`   Node Count: ${nodeCount}`);
    console.log(`   String Table Size: ${stringTableSize} bytes`);
    
    // Parse string table
    console.log('\n📝 STRING TABLE:');
    let stringOffset = 16;
    const stringCount = view.getUint32(stringOffset, true);
    console.log(`   String Count: ${stringCount}`);
    stringOffset += 4;
    
    const strings = [];
    for (let i = 0; i < stringCount; i++) {
        if (stringOffset + 2 > binaryData.byteLength) break;
        
        const length = view.getUint16(stringOffset, true);
        stringOffset += 2;
        
        if (stringOffset + length > binaryData.byteLength) break;
        
        let str = '';
        for (let j = 0; j < length; j++) {
            str += String.fromCharCode(view.getUint8(stringOffset + j));
        }
        strings.push(str);
        console.log(`   String ${i}: "${str}" (length ${length})`);
        stringOffset += length;
    }
    
    // Parse nodes
    console.log('\n🏗️ NODE STRUCTURE:');
    let nodeOffset = 16 + stringTableSize;
    
    const nodeTypeNames = {
        0x01: 'ProgramNode',
        0x20: 'VarDeclNode', 
        0x40: 'NumberNode',
        0x43: 'IdentifierNode',
        0x50: 'TypeNode',
        0x51: 'DeclaratorNode'
    };
    
    for (let i = 0; i < nodeCount; i++) {
        const nodeType = view.getUint8(nodeOffset);
        const nodeFlags = view.getUint8(nodeOffset + 1);
        const dataSize = view.getUint16(nodeOffset + 2, true);
        
        const typeName = nodeTypeNames[nodeType] || `Unknown(0x${nodeType.toString(16)})`;
        
        console.log(`\n   Node ${i}: ${typeName}`);
        console.log(`     Offset: ${nodeOffset}`);
        console.log(`     Type: 0x${nodeType.toString(16)}`);
        console.log(`     Flags: 0x${nodeFlags.toString(16)}`);
        console.log(`       HAS_CHILDREN: ${(nodeFlags & 0x01) ? 'Yes' : 'No'}`);
        console.log(`       HAS_VALUE: ${(nodeFlags & 0x02) ? 'Yes' : 'No'}`);
        console.log(`     Data Size: ${dataSize} bytes`);
        
        // Parse data section
        let dataOffset = nodeOffset + 4;
        const dataEnd = dataOffset + dataSize;
        
        if (dataSize > 0) {
            const dataBytes = [];
            for (let j = dataOffset; j < dataEnd; j++) {
                dataBytes.push('0x' + view.getUint8(j).toString(16).padStart(2, '0'));
            }
            console.log(`     Raw Data: [${dataBytes.join(', ')}]`);
        }
        
        let currentOffset = dataOffset;
        
        // Parse value if present
        if (nodeFlags & 0x02) {
            const valueType = view.getUint8(currentOffset);
            console.log(`     📦 Value Type: 0x${valueType.toString(16)}`);
            currentOffset++;
            
            switch (valueType) {
                case 0x02: // INT8_VAL
                    const int8Val = view.getInt8(currentOffset);
                    console.log(`       INT8 Value: ${int8Val}`);
                    currentOffset += 1;
                    break;
                case 0x03: // UINT8_VAL
                    const uint8Val = view.getUint8(currentOffset);
                    console.log(`       UINT8 Value: ${uint8Val}`);
                    currentOffset += 1;
                    break;
                case 0x04: // INT16_VAL
                    const int16Val = view.getInt16(currentOffset, true);
                    console.log(`       INT16 Value: ${int16Val}`);
                    currentOffset += 2;
                    break;
                case 0x05: // UINT16_VAL
                    const uint16Val = view.getUint16(currentOffset, true);
                    console.log(`       UINT16 Value: ${uint16Val}`);
                    currentOffset += 2;
                    break;
                case 0x0C: // STRING_VAL
                    const stringIndex = view.getUint16(currentOffset, true);
                    console.log(`       String Index: ${stringIndex} ("${strings[stringIndex]}")`);
                    currentOffset += 2;
                    break;
                default:
                    console.log(`       Unknown value type: 0x${valueType.toString(16)}`);
            }
        }
        
        // Parse child indices
        const remainingBytes = dataEnd - currentOffset;
        if (remainingBytes > 0) {
            const childCount = remainingBytes / 2;
            console.log(`     👶 Children (${childCount}):`);
            
            for (let k = 0; k < childCount; k++) {
                const childIndex = view.getUint16(currentOffset, true);
                console.log(`       Child ${k}: Node ${childIndex}`);
                currentOffset += 2;
            }
        }
        
        nodeOffset += 4 + dataSize;
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n📊 FINDINGS:');
    console.log('1. VarDeclNode has only 1 child in binary format');
    console.log('2. The declarations array wrapper objects are NOT serialized as separate nodes');
    console.log('3. Only the actual declarator and initializer nodes are included as direct children');
    console.log('\n🚨 ROOT CAUSE:');
    console.log('The CompactAST serializer has special handling for VarDeclNode declarations array:');
    console.log('- It skips the wrapper objects in the declarations array');  
    console.log('- It only includes declarator and initializer as direct children');
    console.log('- C++ reader expects wrapper objects but they are not in the binary format!');
    
    console.log('\n💡 SOLUTION:');
    console.log('The C++ reader needs to understand this special serialization:');
    console.log('1. VarDeclNode children are: [TypeNode, DeclaratorNode, InitializerNode, ...]');
    console.log('2. For each declaration, declarator comes first, then initializer (if present)');
    console.log('3. No wrapper declaration objects exist in binary format');
}

analyzeCompleteFormat();