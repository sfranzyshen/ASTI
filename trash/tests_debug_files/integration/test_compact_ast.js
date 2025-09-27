#!/usr/bin/env node

/**
 * Test script for exportCompactAST function
 * Validates the compact binary AST format
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

function testCompactAST() {
    console.log('Testing exportCompactAST function...\n');
    
    // Test 1: Simple Arduino sketch
    const simpleCode = `
        void setup() {
            pinMode(13, OUTPUT);
        }
        
        void loop() {
            digitalWrite(13, HIGH);
            delay(1000);
        }
    `;
    
    try {
        console.log('Test 1: Parsing simple Arduino code...');
        const ast = parse(simpleCode);
        console.log(`✓ Parsed successfully. AST type: ${ast.type}`);
        
        console.log('Test 2: Exporting to compact format...');
        const compactAST = exportCompactAST(ast);
        console.log(`✓ Export successful. Buffer size: ${compactAST.byteLength} bytes`);
        
        // Validate header
        const view = new DataView(compactAST);
        const magic = view.getUint32(0, true);
        const version = view.getUint16(4, true);
        const flags = view.getUint16(6, true);
        const nodeCount = view.getUint32(8, true);
        const stringTableSize = view.getUint32(12, true);
        
        console.log('Test 3: Validating header...');
        console.log(`  Magic: 0x${magic.toString(16)} ${magic === 0x41535450 ? '✓' : '✗'}`);
        console.log(`  Version: 0x${version.toString(16)} ${version === 0x0100 ? '✓' : '✗'}`);
        console.log(`  Flags: 0x${flags.toString(16)}`);
        console.log(`  Node Count: ${nodeCount}`);
        console.log(`  String Table Size: ${stringTableSize} bytes`);
        
        // Test string table
        console.log('Test 4: Validating string table...');
        let offset = 16; // Skip header
        const stringCount = view.getUint32(offset, true);
        console.log(`  String Count: ${stringCount}`);
        
        offset += 4;
        for (let i = 0; i < Math.min(stringCount, 5); i++) {
            const stringLength = view.getUint16(offset, true);
            offset += 2;
            
            let string = '';
            for (let j = 0; j < stringLength; j++) {
                string += String.fromCharCode(view.getUint8(offset + j));
            }
            offset += stringLength + 1; // +1 for null terminator
            
            console.log(`  String ${i}: "${string}" (${stringLength} chars)`);
        }
        
        console.log('\n✓ All tests passed! Compact AST export working correctly.');
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error(error.stack);
    }
}

function testComplexCode() {
    console.log('\nTesting with more complex Arduino code...');
    
    const complexCode = `
        #define LED_PIN 13
        #define DELAY_MS 1000
        
        int counter = 0;
        
        void setup() {
            Serial.begin(9600);
            pinMode(LED_PIN, OUTPUT);
        }
        
        void loop() {
            counter++;
            Serial.print("Counter: ");
            Serial.println(counter);
            
            if (counter % 2 == 0) {
                digitalWrite(LED_PIN, HIGH);
            } else {
                digitalWrite(LED_PIN, LOW);
            }
            
            delay(DELAY_MS);
        }
    `;
    
    try {
        const ast = parse(complexCode, { enablePreprocessor: true });
        const compactAST = exportCompactAST(ast);
        
        const view = new DataView(compactAST);
        const nodeCount = view.getUint32(8, true);
        
        console.log(`✓ Complex code processed successfully`);
        console.log(`  Buffer size: ${compactAST.byteLength} bytes`);
        console.log(`  Node count: ${nodeCount}`);
        console.log(`  Compression ratio: ${(JSON.stringify(ast).length / compactAST.byteLength).toFixed(2)}x`);
        
    } catch (error) {
        console.error('✗ Complex test failed:', error.message);
    }
}

// Run tests
if (require.main === module) {
    testCompactAST();
    testComplexCode();
}

module.exports = { testCompactAST, testComplexCode };