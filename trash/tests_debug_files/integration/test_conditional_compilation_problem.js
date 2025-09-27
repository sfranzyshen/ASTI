#!/usr/bin/env node

/**
 * Test Case: Demonstrates Current Conditional Compilation Problem
 * 
 * This test shows how the current architecture incorrectly processes
 * code that should be excluded by #ifdef conditions.
 */

const { parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');

console.log('🧪 Testing Conditional Compilation Problem');
console.log('==========================================');

// Test code with conditional compilation
const testCode = `
#define DEBUG 1

void setup() {
    Serial.begin(9600);
    
    #ifdef DEBUG
        Serial.println("Debug mode enabled");
        int debugVar = 42;
        Serial.println(debugVar);
    #else
        Serial.println("Release mode");
        int releaseVar = 24;
        Serial.println(releaseVar);
    #endif
    
    Serial.println("Setup complete");
}

void loop() {
    #ifndef PRODUCTION
        Serial.println("Development loop");
        delay(1000);
    #endif
    
    #ifdef PRODUCTION  
        Serial.println("Production loop");
        delay(5000);
    #endif
}
`;

console.log('📝 Test Code:');
console.log(testCode);

console.log('\n🔍 Step 1: Parse with current architecture');
const ast = parse(testCode, { enablePreprocessor: true, verbose: true });

console.log('\n📊 AST Structure Analysis:');
function analyzeAST(node, depth = 0) {
    const indent = '  '.repeat(depth);
    console.log(`${indent}${node.type}`);
    
    if (node.type === 'PreprocessorDirective') {
        console.log(`${indent}  ⚠️  PREPROCESSOR AST NODE FOUND!`);
        console.log(`${indent}  DirectiveType: ${node.directiveType}`);
        console.log(`${indent}  Content: ${node.content}`);
    }
    
    if (node.children) {
        node.children.forEach(child => analyzeAST(child, depth + 1));
    }
    if (node.body && typeof node.body === 'object') {
        analyzeAST(node.body, depth + 1);
    }
}

analyzeAST(ast);

console.log('\n🔍 Step 2: Run interpreter to see what actually executes');
const interpreter = new ASTInterpreter(ast, { 
    verbose: false, 
    debug: false, 
    stepDelay: 0, 
    maxLoopIterations: 2 
});

let commands = [];
interpreter.onCommand = (command) => {
    commands.push(command);
};

// Suppress console output
const originalConsoleLog = console.log;
console.log = () => {};

try {
    interpreter.start();
    
    // Wait for execution to complete
    setTimeout(() => {
        console.log = originalConsoleLog;
        
        console.log('\n📋 Commands Generated:');
        commands.forEach((command, i) => {
            console.log(`${i + 1}. ${command.type}: ${JSON.stringify(command).substring(0, 100)}...`);
        });
        
        console.log('\n🚨 PROBLEM ANALYSIS:');
        console.log('====================');
        
        // Check if excluded code was executed
        const serialCommands = commands.filter(cmd => cmd.type === 'SERIAL_PRINT');
        console.log('📡 Serial print commands found:');
        serialCommands.forEach(cmd => {
            console.log(`   - "${cmd.text}"`);
        });
        
        console.log('\n💥 EXPECTED vs ACTUAL:');
        console.log('EXPECTED (with DEBUG=1):');
        console.log('   - "Debug mode enabled"');
        console.log('   - debugVar = 42');
        console.log('   - "Development loop" (PRODUCTION not defined)');
        console.log('   - Should NOT see "Release mode" or "Production loop"');
        
        console.log('\nACTUAL (current broken behavior):');
        console.log('   - Likely processes ALL code paths regardless of conditions');
        console.log('   - Both DEBUG and ELSE branches may execute');
        console.log('   - Preprocessor directives become AST nodes instead of being evaluated');
        
        console.log('\n✅ This test demonstrates why we need to fix the architecture!');
        
    }, 1000);
    
} catch (error) {
    console.log = originalConsoleLog;
    console.error('❌ Interpreter error:', error.message);
}