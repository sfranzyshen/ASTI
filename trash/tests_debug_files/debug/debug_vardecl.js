#!/usr/bin/env node

/**
 * VarDeclNode Structure Debug Script
 * 
 * This script analyzes how "int x = 5;" is represented in:
 * 1. JavaScript AST structure (detailed VarDeclNode analysis)
 * 2. CompactAST binary format serialization
 * 3. Expected C++ reading behavior
 * 
 * Purpose: Debug why C++ CompactAST reader finds 0 declarations when there should be 1
 */

const { parse, prettyPrintAST, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

function analyzeVarDeclNode() {
    console.log('='.repeat(80));
    console.log('VARDECLNODE STRUCTURE ANALYSIS - DEBUG SCRIPT');
    console.log('='.repeat(80));
    
    // Test code: simple variable declaration with initializer
    const testCode = 'int x = 5;';
    
    console.log(`\n🔍 ANALYZING CODE: "${testCode}"`);
    console.log('-'.repeat(50));
    
    // Parse the code
    const ast = parse(testCode);
    
    // Find the VarDeclNode in the AST
    const varDeclNode = findVarDeclNode(ast);
    if (!varDeclNode) {
        console.log('❌ ERROR: No VarDeclNode found in AST!');
        return;
    }
    
    console.log('\n📋 1. JAVASCRIPT AST STRUCTURE ANALYSIS');
    console.log('-'.repeat(50));
    
    analyzeJavaScriptAST(varDeclNode);
    
    console.log('\n📦 2. COMPACTAST BINARY FORMAT ANALYSIS');
    console.log('-'.repeat(50));
    
    analyzeCompactASTFormat(ast);
    
    console.log('\n🔧 3. C++ READER EXPECTATIONS');
    console.log('-'.repeat(50));
    
    analyzeCppReaderExpectations(varDeclNode);
    
    console.log('\n' + '='.repeat(80));
}

function findVarDeclNode(node) {
    if (!node) return null;
    
    if (node.type === 'VarDeclNode') {
        return node;
    }
    
    // Search in children array
    if (node.children) {
        for (const child of node.children) {
            const found = findVarDeclNode(child);
            if (found) return found;
        }
    }
    
    // Search in named properties
    const namedChildren = ['varType', 'declarations', 'body', 'condition', 'consequent', 'alternate', 'left', 'right'];
    for (const prop of namedChildren) {
        if (node[prop]) {
            if (Array.isArray(node[prop])) {
                for (const child of node[prop]) {
                    const found = findVarDeclNode(child);
                    if (found) return found;
                }
            } else {
                const found = findVarDeclNode(node[prop]);
                if (found) return found;
            }
        }
    }
    
    return null;
}

function analyzeJavaScriptAST(varDeclNode) {
    console.log('🎯 VarDeclNode Structure:');
    console.log(`   Type: ${varDeclNode.type}`);
    console.log(`   Node Object Keys: [${Object.keys(varDeclNode).join(', ')}]`);
    
    // Analyze varType
    if (varDeclNode.varType) {
        console.log('\n📝 Variable Type (varType):');
        console.log(`   Type: ${varDeclNode.varType.type}`);
        console.log(`   Value: ${JSON.stringify(varDeclNode.varType.value)}`);
        if (varDeclNode.varType.templateArgs) {
            console.log(`   Template Args: ${JSON.stringify(varDeclNode.varType.templateArgs)}`);
        }
    } else {
        console.log('\n❌ No varType property found!');
    }
    
    // Analyze declarations array - THIS IS THE CRITICAL PART
    if (varDeclNode.declarations) {
        console.log(`\n📋 Declarations Array:`);
        console.log(`   Array Length: ${varDeclNode.declarations.length}`);
        console.log(`   Is Array: ${Array.isArray(varDeclNode.declarations)}`);
        
        varDeclNode.declarations.forEach((decl, index) => {
            console.log(`\n   Declaration [${index}]:`);
            console.log(`     Type: ${decl.type || 'No type property'}`);
            console.log(`     Object Keys: [${Object.keys(decl).join(', ')}]`);
            
            // Analyze declarator
            if (decl.declarator) {
                console.log(`     📛 Declarator:`);
                console.log(`       Type: ${decl.declarator.type}`);
                console.log(`       Value: ${JSON.stringify(decl.declarator.value)}`);
                if (decl.declarator.isPointer) {
                    console.log(`       Is Pointer: ${decl.declarator.isPointer}`);
                    console.log(`       Pointer Level: ${decl.declarator.pointerLevel}`);
                }
                if (decl.declarator.isArray) {
                    console.log(`       Is Array: ${decl.declarator.isArray}`);
                    console.log(`       Array Size: ${JSON.stringify(decl.declarator.arraySize)}`);
                }
            } else {
                console.log(`     ❌ No declarator property!`);
            }
            
            // Analyze initializer - THIS IS WHERE "= 5" IS STORED
            if (decl.initializer) {
                console.log(`     🎯 Initializer:`);
                console.log(`       Type: ${decl.initializer.type}`);
                console.log(`       Value: ${JSON.stringify(decl.initializer.value)}`);
                console.log(`       Object Keys: [${Object.keys(decl.initializer).join(', ')}]`);
                
                // Show full initializer structure
                console.log(`       Full Structure: ${JSON.stringify(decl.initializer, null, 8)}`);
            } else {
                console.log(`     ❌ No initializer property! (This would be the "= 5" part)`);
            }
        });
    } else {
        console.log('\n❌ CRITICAL: No declarations property found!');
        console.log('   This means the VarDeclNode structure is different than expected.');
    }
    
    // Show full node structure for debugging
    console.log('\n🔍 FULL VARDECLNODE STRUCTURE:');
    console.log(JSON.stringify(varDeclNode, null, 2));
    
    // Show pretty-printed AST
    console.log('\n🌳 PRETTY-PRINTED AST VIEW:');
    console.log(prettyPrintAST(varDeclNode));
}

function analyzeCompactASTFormat(ast) {
    try {
        // Export to CompactAST binary format
        const binaryData = exportCompactAST(ast);
        const view = new DataView(binaryData);
        
        console.log('📦 Binary AST Export Results:');
        console.log(`   Total Size: ${binaryData.byteLength} bytes`);
        
        // Parse header
        const magic = view.getUint32(0, true);
        const version = view.getUint16(4, true);
        const flags = view.getUint16(6, true);
        const nodeCount = view.getUint32(8, true);
        const stringTableSize = view.getUint32(12, true);
        
        console.log(`   Magic: 0x${magic.toString(16)} (${String.fromCharCode((magic >> 24) & 0xFF, (magic >> 16) & 0xFF, (magic >> 8) & 0xFF, magic & 0xFF)})`);
        console.log(`   Version: ${version}`);
        console.log(`   Flags: 0x${flags.toString(16)}`);
        console.log(`   Node Count: ${nodeCount}`);
        console.log(`   String Table Size: ${stringTableSize} bytes`);
        
        // Find VarDeclNode in binary format
        let offset = 16 + stringTableSize; // Skip header and string table
        console.log(`\n🔍 Searching for VarDeclNode (0x20) in binary data...`);
        console.log(`   Starting at offset: ${offset}`);
        
        for (let i = 0; i < nodeCount; i++) {
            const nodeType = view.getUint8(offset);
            const flags = view.getUint8(offset + 1);
            const dataSize = view.getUint16(offset + 2, true);
            
            console.log(`\n   Node ${i}: Type=0x${nodeType.toString(16)}, Flags=0x${flags.toString(16)}, DataSize=${dataSize}`);
            
            if (nodeType === 0x20) { // VarDeclNode
                console.log(`   🎯 FOUND VARDECLNODE!`);
                console.log(`     Offset: ${offset}`);
                console.log(`     Flags: 0x${flags.toString(16)}`);
                console.log(`       HAS_CHILDREN: ${(flags & 0x01) ? 'Yes' : 'No'}`);
                console.log(`       HAS_VALUE: ${(flags & 0x02) ? 'Yes' : 'No'}`);
                console.log(`     Data Size: ${dataSize} bytes`);
                
                // Analyze the data section
                let dataOffset = offset + 4;
                const dataEnd = dataOffset + dataSize;
                console.log(`     Data Section (${dataEnd - dataOffset} bytes):`);
                
                // Show raw data bytes
                const dataBytes = [];
                for (let j = dataOffset; j < dataEnd; j++) {
                    dataBytes.push('0x' + view.getUint8(j).toString(16).padStart(2, '0'));
                }
                console.log(`       Raw Bytes: [${dataBytes.join(', ')}]`);
                
                // Try to parse the data section
                let currentOffset = dataOffset;
                
                // Check for value
                if (flags & 0x02) {
                    console.log(`     📝 Value Data:`);
                    const valueType = view.getUint8(currentOffset);
                    console.log(`       Value Type: 0x${valueType.toString(16)}`);
                    currentOffset++;
                    
                    switch (valueType) {
                        case 0x0C: // STRING_VAL
                            const stringIndex = view.getUint16(currentOffset, true);
                            console.log(`       String Index: ${stringIndex}`);
                            currentOffset += 2;
                            break;
                        default:
                            console.log(`       Unknown value type: 0x${valueType.toString(16)}`);
                    }
                }
                
                // Show child indices
                const remainingBytes = dataEnd - currentOffset;
                const childCount = remainingBytes / 2; // Each child index is 2 bytes
                console.log(`     👶 Child Indices (${childCount} children):`);
                
                for (let k = 0; k < childCount; k++) {
                    const childIndex = view.getUint16(currentOffset, true);
                    console.log(`       Child ${k}: Node Index ${childIndex}`);
                    currentOffset += 2;
                }
                
                break;
            }
            
            offset += 4 + dataSize; // Move to next node
        }
    } catch (error) {
        console.log(`❌ Error analyzing CompactAST: ${error.message}`);
        console.log(error.stack);
    }
}

function analyzeCppReaderExpectations(varDeclNode) {
    console.log('🔧 C++ CompactAST Reader Analysis:');
    
    // Based on the JavaScript structure, explain what C++ should expect
    console.log('\n📋 Expected C++ Behavior:');
    console.log('   1. VarDeclNode (0x20) should be found in binary data');
    console.log('   2. It should have HAS_CHILDREN flag set (0x01)');
    console.log('   3. Child nodes should include:');
    console.log('      - TypeNode for "int" (varType)');
    console.log('      - DeclaratorNode for "x" (from declarations[0].declarator)');
    console.log('      - NumberNode for "5" (from declarations[0].initializer)');
    
    console.log('\n🚨 Common Issues that could cause 0 declarations:');
    console.log('   1. C++ reader not finding child nodes correctly');
    console.log('   2. Child index parsing wrong (endianness?)');
    console.log('   3. Declaration array structure misunderstanding');
    console.log('   4. CompactAST serialization skipping declaration wrappers');
    
    // Show the actual structure that C++ should expect
    if (varDeclNode.declarations && varDeclNode.declarations.length > 0) {
        console.log('\n📊 Expected Declaration Structure:');
        varDeclNode.declarations.forEach((decl, index) => {
            console.log(`   Declaration ${index}:`);
            console.log(`     - Has declarator: ${!!decl.declarator}`);
            console.log(`     - Has initializer: ${!!decl.initializer}`);
            
            if (decl.declarator) {
                console.log(`     - Declarator name: "${decl.declarator.value}"`);
            }
            
            if (decl.initializer) {
                console.log(`     - Initializer type: ${decl.initializer.type}`);
                console.log(`     - Initializer value: ${decl.initializer.value}`);
            }
        });
    }
    
    console.log('\n💡 DEBUG RECOMMENDATIONS:');
    console.log('   1. Check if C++ is reading child indices correctly');
    console.log('   2. Verify declaration wrapper objects are being processed');
    console.log('   3. Ensure JavaScript CompactAST export includes all declaration children');
    console.log('   4. Add logging to C++ reader to show child node parsing');
}

// Run the analysis
analyzeVarDeclNode();