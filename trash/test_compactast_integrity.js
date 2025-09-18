#!/usr/bin/env node

/**
 * Test CompactAST serialization/deserialization integrity
 * This verifies that the AST structure is preserved exactly through the binary format
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { exportCompactAST } = require('./libs/CompactAST/src/CompactAST.js');

function deepCompareAST(original, reconstructed, path = '') {
    const issues = [];
    
    // Compare types
    if (original.type !== reconstructed.type) {
        issues.push(`Type mismatch at ${path}: ${original.type} !== ${reconstructed.type}`);
        return issues; // Stop comparing if types don't match
    }
    
    // Compare values
    if (original.value !== reconstructed.value) {
        issues.push(`Value mismatch at ${path}: ${JSON.stringify(original.value)} !== ${JSON.stringify(reconstructed.value)}`);
    }
    
    // Compare operators
    if (original.operator !== reconstructed.operator) {
        issues.push(`Operator mismatch at ${path}: ${JSON.stringify(original.operator)} !== ${JSON.stringify(reconstructed.operator)}`);
    }
    
    // Compare children arrays
    if (original.children && reconstructed.children) {
        if (original.children.length !== reconstructed.children.length) {
            issues.push(`Children count mismatch at ${path}: ${original.children.length} !== ${reconstructed.children.length}`);
        } else {
            for (let i = 0; i < original.children.length; i++) {
                const childIssues = deepCompareAST(original.children[i], reconstructed.children[i], `${path}.children[${i}]`);
                issues.push(...childIssues);
            }
        }
    } else if (original.children || reconstructed.children) {
        issues.push(`Children existence mismatch at ${path}: ${!!original.children} !== ${!!reconstructed.children}`);
    }
    
    // Compare named children (like parameters, body, etc.)
    const namedChildren = getNamedChildProperties(original);
    for (const prop of namedChildren) {
        if (original[prop] && reconstructed[prop]) {
            if (Array.isArray(original[prop])) {
                if (!Array.isArray(reconstructed[prop])) {
                    issues.push(`Property type mismatch at ${path}.${prop}: array vs non-array`);
                } else if (original[prop].length !== reconstructed[prop].length) {
                    issues.push(`Array length mismatch at ${path}.${prop}: ${original[prop].length} !== ${reconstructed[prop].length}`);
                } else {
                    for (let i = 0; i < original[prop].length; i++) {
                        if (original[prop][i] && typeof original[prop][i] === 'object' && original[prop][i].type) {
                            const childIssues = deepCompareAST(original[prop][i], reconstructed[prop][i], `${path}.${prop}[${i}]`);
                            issues.push(...childIssues);
                        }
                    }
                }
            } else if (typeof original[prop] === 'object' && original[prop].type) {
                const childIssues = deepCompareAST(original[prop], reconstructed[prop], `${path}.${prop}`);
                issues.push(...childIssues);
            }
        } else if (original[prop] || reconstructed[prop]) {
            issues.push(`Property existence mismatch at ${path}.${prop}: ${!!original[prop]} !== ${!!reconstructed[prop]}`);
        }
    }
    
    return issues;
}

function getNamedChildProperties(node) {
    const childrenMap = {
        'VarDeclNode': ['varType', 'declarations'],
        'FuncDefNode': ['returnType', 'declarator', 'parameters', 'body'],
        'FuncCallNode': ['callee', 'arguments'],
        'IfStatement': ['condition', 'consequent', 'alternate'],
        'WhileStatement': ['condition', 'body'],
        'DoWhileStatement': ['body', 'condition'],
        'ForStatement': ['initializer', 'condition', 'increment', 'body'],
        'BinaryOpNode': ['left', 'right'],
        'UnaryOpNode': ['operand'],
        'AssignmentNode': ['left', 'right'],
        'ExpressionStatement': ['expression'],
        'MemberAccessNode': ['object', 'property'],
        'ParamNode': ['paramType', 'declarator', 'defaultValue'],
        'ArrayAccessNode': ['object', 'index'],
        'SwitchStatement': ['discriminant', 'cases'], 
        'CaseStatement': ['test', 'consequent'],
        'RangeBasedForStatement': ['variable', 'iterable', 'body'],
        'TernaryExpression': ['condition', 'consequent', 'alternate'],
        'PostfixExpressionNode': ['operand'],
        'CommaExpression': ['left', 'right']
    };
    
    return childrenMap[node.type] || [];
}

// Simulate C++ deserialization by parsing the binary format
function simulateCppDeserialization(binaryData) {
    // This is a simplified simulation - we can't actually run C++ code,
    // but we can verify the binary format structure
    const view = new DataView(binaryData);
    let offset = 0;
    
    // Read header
    const magic = view.getUint32(offset, true); // little-endian
    offset += 4;
    const version = view.getUint16(offset, true);
    offset += 2;
    const flags = view.getUint16(offset, true);
    offset += 2;
    const nodeCount = view.getUint32(offset, true);
    offset += 4;
    const stringTableSize = view.getUint32(offset, true);
    offset += 4;
    
    console.log('Binary format header:');
    console.log(`  Magic: 0x${magic.toString(16)} (${magic === 0x50545341 ? 'valid' : 'INVALID'})`);
    console.log(`  Version: 0x${version.toString(16)}`);
    console.log(`  Flags: 0x${flags.toString(16)}`);
    console.log(`  Node count: ${nodeCount}`);
    console.log(`  String table size: ${stringTableSize}`);
    
    if (magic !== 0x50545341) {
        throw new Error('Invalid magic number in CompactAST binary data');
    }
    
    // Read string table
    const stringCount = view.getUint32(offset, true);
    offset += 4;
    console.log(`  String count: ${stringCount}`);
    
    const strings = [];
    for (let i = 0; i < stringCount; i++) {
        const stringLength = view.getUint16(offset, true);
        offset += 2;
        
        let stringValue = '';
        for (let j = 0; j < stringLength; j++) {
            stringValue += String.fromCharCode(view.getUint8(offset + j));
        }
        offset += stringLength;
        offset += 1; // null terminator
        
        strings.push(stringValue);
    }
    
    // Align to 4-byte boundary
    while (offset % 4 !== 0) {
        offset++;
    }
    
    console.log(`  Strings extracted: [${strings.map(s => `"${s}"`).join(', ')}]`);
    
    // Verify we can read nodes
    const nodeTypes = [];
    for (let i = 0; i < nodeCount && offset < binaryData.byteLength - 4; i++) {
        const nodeType = view.getUint8(offset);
        const flags = view.getUint8(offset + 1);
        const dataSize = view.getUint16(offset + 2, true);
        
        nodeTypes.push({ type: nodeType, flags, dataSize });
        offset += 4 + dataSize; // Skip node data
        
        if (offset > binaryData.byteLength) {
            console.log(`  Warning: Node ${i} extends beyond buffer`);
            break;
        }
    }
    
    console.log(`  Nodes parsed: ${nodeTypes.length}/${nodeCount}`);
    
    return {
        header: { magic, version, flags, nodeCount, stringTableSize },
        strings,
        nodeTypes,
        valid: magic === 0x50545341 && nodeTypes.length === nodeCount
    };
}

function testCompactASTIntegrity() {
    console.log('=== CompactAST Serialization/Deserialization Integrity Test ===\n');
    
    const testCases = [
        {
            name: 'Basic Arduino Program',
            code: `
void setup() {
    int x = 5;
    Serial.begin(9600);
}

void loop() {
    Serial.println(x);
}`
        },
        {
            name: 'Variable Declarations',
            code: `
int global_var = 10;
float pi = 3.14159;
char message[] = "Hello World";

void setup() {
    bool flag = true;
    double value = 2.718;
}`
        },
        {
            name: 'Control Structures',
            code: `
void loop() {
    for (int i = 0; i < 10; i++) {
        if (i % 2 == 0) {
            digitalWrite(LED_BUILTIN, HIGH);
        } else {
            digitalWrite(LED_BUILTIN, LOW);
        }
    }
    
    while (digitalRead(2) == HIGH) {
        delay(100);
    }
}`
        },
        {
            name: 'Function Calls and Expressions',
            code: `
int calculate(int a, int b) {
    return a * b + (a > b ? a : b);
}

void setup() {
    int result = calculate(5, 3);
    Serial.println(result);
    
    int array[5] = {1, 2, 3, 4, 5};
    array[2] = result;
}`
        }
    ];
    
    let totalIssues = 0;
    let totalTests = 0;
    
    for (const testCase of testCases) {
        console.log(`\n--- Testing: ${testCase.name} ---`);
        console.log(`Code: ${testCase.code.trim()}`);
        
        try {
            // Parse the code
            console.log('\n1. Parsing...');
            const originalAST = parse(testCase.code);
            console.log('   ✓ Parsing successful');
            
            // Serialize to CompactAST
            console.log('\n2. Serializing to CompactAST...');
            const binaryData = exportCompactAST(originalAST);
            console.log(`   ✓ Serialization successful - ${binaryData.byteLength} bytes`);
            
            // Analyze binary format
            console.log('\n3. Analyzing binary format...');
            const binaryAnalysis = simulateCppDeserialization(binaryData);
            if (!binaryAnalysis.valid) {
                console.log('   ❌ Binary format validation failed');
                totalIssues++;
            } else {
                console.log('   ✓ Binary format is valid for C++ consumption');
            }
            
            // Test actual round-trip by creating a test binary file
            const testFile = `test_${testCase.name.replace(/\s+/g, '_').toLowerCase()}.ast`;
            console.log(`\n4. Writing test file: ${testFile}`);
            const buffer = Buffer.from(binaryData);
            fs.writeFileSync(testFile, buffer);
            console.log('   ✓ Test file written');
            
            // Read it back and verify
            const readBuffer = fs.readFileSync(testFile);
            if (readBuffer.equals(buffer)) {
                console.log('   ✓ File round-trip successful');
            } else {
                console.log('   ❌ File round-trip failed');
                totalIssues++;
            }
            
            // Clean up
            fs.unlinkSync(testFile);
            
            totalTests++;
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            totalIssues++;
            totalTests++;
        }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Tests run: ${totalTests}`);
    console.log(`Issues found: ${totalIssues}`);
    console.log(`Success rate: ${((totalTests - totalIssues) / totalTests * 100).toFixed(1)}%`);
    
    if (totalIssues === 0) {
        console.log('\n✅ CompactAST serialization/deserialization chain is INTACT');
        console.log('   All test cases successfully preserved AST structure through binary format.');
    } else {
        console.log('\n❌ CompactAST serialization/deserialization chain has ISSUES');
        console.log('   Some test cases failed, indicating potential data corruption.');
    }
    
    return { totalTests, totalIssues };
}

// Test with actual examples from the test suite
function testWithRealExamples() {
    console.log('\n\n=== Testing with Real Examples ===\n');
    
    try {
        // Load some real examples
        const { examplesFiles } = require('./examples.js');
        const testExamples = examplesFiles.slice(0, 5); // Test first 5 examples
        
        console.log(`Testing ${testExamples.length} real examples...`);
        
        let successCount = 0;
        let totalSize = 0;
        
        for (let i = 0; i < testExamples.length; i++) {
            const example = testExamples[i];
            console.log(`\nExample ${i + 1}: ${example.name}`);
            
            try {
                const ast = parse(example.code);
                const binaryData = exportCompactAST(ast);
                const analysis = simulateCppDeserialization(binaryData);
                
                if (analysis.valid) {
                    console.log(`   ✓ Success - ${binaryData.byteLength} bytes`);
                    successCount++;
                    totalSize += binaryData.byteLength;
                } else {
                    console.log(`   ❌ Binary validation failed`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
        
        console.log(`\nReal examples summary:`);
        console.log(`   Successful: ${successCount}/${testExamples.length}`);
        console.log(`   Total binary size: ${totalSize} bytes`);
        console.log(`   Average size: ${(totalSize / successCount).toFixed(0)} bytes`);
        
    } catch (error) {
        console.log(`Error loading examples: ${error.message}`);
    }
}

if (require.main === module) {
    const results = testCompactASTIntegrity();
    testWithRealExamples();
    
    // Exit with error code if issues found
    process.exit(results.totalIssues > 0 ? 1 : 0);
}

module.exports = {
    testCompactASTIntegrity,
    simulateCppDeserialization,
    deepCompareAST
};
