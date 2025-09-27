#!/usr/bin/env node

/**
 * Test Clean AST Generation (No Preprocessor AST Nodes)
 * 
 * This test verifies that the new architecture generates clean ASTs
 * with no PreprocessorDirective nodes after preprocessing.
 */

const { parse } = require('./parser.js');
const { PlatformEmulation } = require('./platform_emulation.js');

console.log('🧪 Testing Clean AST Generation (No Preprocessor Nodes)');
console.log('======================================================');

const platform = new PlatformEmulation('ESP32_NANO');

// Test code with lots of preprocessor directives
const testCode = `
#include <WiFi.h>
#define LED_PIN 13
#define BLINK_DELAY 1000

void setup() {
    Serial.begin(9600);
    
    #ifdef ESP32
        Serial.println("ESP32 platform");
        pinMode(LED_PIN, OUTPUT);
    #endif
    
    #ifndef DEBUG
        Serial.println("Release mode");
    #endif
}

#if BLINK_DELAY > 500
void fastBlink() {
    digitalWrite(LED_PIN, HIGH);
    delay(BLINK_DELAY / 2);
    digitalWrite(LED_PIN, LOW);
}
#endif

void loop() {
    #ifdef ESP32
        fastBlink();
        delay(BLINK_DELAY);
    #endif
}
`;

console.log('📝 Test Code with Many Preprocessor Directives:');
console.log(testCode);

console.log('\n🔍 Parsing with Platform Context...');

try {
    const ast = parse(testCode, { 
        enablePreprocessor: true, 
        verbose: true,
        platformContext: platform
    });
    
    console.log('\n📊 AST Analysis - Checking for Preprocessor Nodes:');
    
    let preprocessorNodeCount = 0;
    let totalNodeCount = 0;
    let nodeTypeCounts = {};
    
    function analyzeAST(node, depth = 0) {
        totalNodeCount++;
        const nodeType = node.type;
        nodeTypeCounts[nodeType] = (nodeTypeCounts[nodeType] || 0) + 1;
        
        if (nodeType === 'PreprocessorDirective') {
            preprocessorNodeCount++;
            console.log(`🚨 FOUND PREPROCESSOR NODE at depth ${depth}:`);
            console.log(`   Type: ${node.directiveType}`);
            console.log(`   Content: ${node.content}`);
        }
        
        // Traverse child nodes
        if (node.children) {
            node.children.forEach(child => analyzeAST(child, depth + 1));
        }
        if (node.body && typeof node.body === 'object') {
            analyzeAST(node.body, depth + 1);
        }
        if (node.statements) {
            node.statements.forEach(stmt => analyzeAST(stmt, depth + 1));
        }
    }
    
    analyzeAST(ast);
    
    console.log('🔍 AST Analysis Results:');
    console.log(`   📝 Total AST Nodes: ${totalNodeCount}`);
    console.log(`   🚨 Preprocessor Nodes: ${preprocessorNodeCount}`);
    
    if (preprocessorNodeCount === 0) {
        console.log('   ✅ PERFECT! No PreprocessorDirective nodes found');
    } else {
        console.log(`   ❌ PROBLEM! Found ${preprocessorNodeCount} PreprocessorDirective nodes`);
    }
    
    console.log('\n📊 Node Type Distribution:');
    Object.entries(nodeTypeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([type, count]) => {
            const icon = type === 'PreprocessorDirective' ? '🚨' : '📄';
            console.log(`   ${icon} ${type}: ${count}`);
        });
    
    console.log('\n📋 Preprocessor Info Attached to AST:');
    if (ast.preprocessorInfo) {
        console.log(`   ✅ Has preprocessorInfo metadata`);
        console.log(`   📊 Macros: ${Object.keys(ast.preprocessorInfo.macros).length}`);
        console.log(`   📚 Active Libraries: ${ast.preprocessorInfo.activeLibraries.length}`);
        console.log(`   🔧 Library Constants: ${Object.keys(ast.preprocessorInfo.libraryConstants).length}`);
        
        // Show some key macros
        console.log('\n   🔑 Key Macros Defined:');
        ['ESP32', 'LED_PIN', 'BLINK_DELAY', 'WIFI_SUPPORT'].forEach(macro => {
            const value = ast.preprocessorInfo.macros[macro];
            if (value !== undefined) {
                console.log(`      ${macro}: ${value}`);
            }
        });
    } else {
        console.log('   ❌ No preprocessorInfo metadata found');
    }
    
    console.log('\n🎯 ARCHITECTURE VERIFICATION:');
    if (preprocessorNodeCount === 0 && ast.preprocessorInfo) {
        console.log('✅ PERFECT CLEAN ARCHITECTURE!');
        console.log('   ✅ Preprocessor directives were processed (not in AST)');
        console.log('   ✅ Preprocessor metadata attached for interpreter use');
        console.log('   ✅ AST contains only executable code structures');
    } else if (preprocessorNodeCount > 0) {
        console.log('❌ ARCHITECTURE ISSUE: Preprocessor nodes still in AST');
    } else if (!ast.preprocessorInfo) {
        console.log('❌ ARCHITECTURE ISSUE: Missing preprocessor metadata');
    }
    
} catch (error) {
    console.error('❌ Error during clean AST test:', error.message);
    console.error(error.stack);
}