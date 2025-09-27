#!/usr/bin/env node

const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

// Simple break test
const testCode = `
void setup() {
    for(int i = 0; i < 5; i++) {
        Serial.println(i);
        if(i == 1) {
            Serial.println("About to break");
            break;
            Serial.println("After break - should not print");
        }
        Serial.println("End of iteration");
    }
    Serial.println("After loop");
}

void loop() {}
`;

console.log('Testing break flow control...');

try {
    const ast = parse(testCode);
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false,
        debug: false,
        stepDelay: 0,
        maxLoopIterations: 10
    });
    
    let commands = [];
    interpreter.onCommand = (command) => {
        commands.push(command);
        if (command.type === 'FUNCTION_CALL' && command.function === 'Serial.println') {
            console.log(`📝 ${command.data}`);
        }
        if (command.type === 'BREAK_STATEMENT') {
            console.log(`🔴 BREAK: ${command.message}`);
        }
        if (command.type === 'FOR_LOOP') {
            console.log(`🔄 FOR: ${command.message}`);
        }
    };
    
    interpreter.responseHandler = (request) => {
        setTimeout(() => {
            interpreter.handleResponse(request.id, 0);
        }, 1);
    };
    
    if (interpreter.start()) {
        setTimeout(() => {
            console.log('\n✅ Test completed');
        }, 1000);
    }
    
} catch (error) {
    console.log('❌ Error:', error.message);
}