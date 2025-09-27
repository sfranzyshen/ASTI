#!/usr/bin/env node

const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

// Ultra simple test case
const testCode = `
void setup() {
    Serial.println("Start");
    break;
    Serial.println("After break");
}

void loop() {
}
`;

console.log('Testing simple break statement...');

try {
    const ast = parse(testCode);
    console.log('✓ Parsing successful');
    
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false,
        debug: false,
        stepDelay: 0,
        maxLoopIterations: 3
    });
    
    // Track break statement results
    interpreter.onCommand = (command) => {
        console.log(`Command: ${command.type}`, command);
    };
    
    interpreter.responseHandler = (request) => {
        setTimeout(() => {
            interpreter.handleResponse(request.id, 0);
        }, 1);
    };
    
    if (interpreter.start()) {
        setTimeout(() => {
            console.log('Test completed');
        }, 1000);
    }
    
} catch (error) {
    console.log('❌ Error:', error.message);
}