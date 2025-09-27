#!/usr/bin/env node

const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

// Simple test case with a break statement - fixed condition
const testCode = `
void setup() {
    for(int i = 0; i < 5; i++) {
        Serial.println(i);
        if(i == 2) {
            break;
        }
    }
    Serial.println("After loop");
}

void loop() {
}
`;

console.log('Testing break statement handling...');

try {
    // Parse the code
    const ast = parse(testCode);
    console.log('✓ Parsing successful');
    
    // Create interpreter
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false,
        debug: false,
        stepDelay: 0,
        maxLoopIterations: 10
    });
    
    let commands = [];
    let breakCommandFound = false;
    
    // Set up command handler to capture break statement
    interpreter.onCommand = (command) => {
        commands.push(command);
        console.log(`Command: ${command.type}`, command);
        
        if (command.type === 'BREAK_STATEMENT') {
            breakCommandFound = true;
            console.log('✓ Break statement command detected');
        }
        
        // Check for undefined values in command
        if (command.hasOwnProperty('undefined') || command.data === undefined) {
            console.log('❌ FOUND UNDEFINED VALUE IN COMMAND:', command);
        }
    };
    
    // Mock response handler for any external functions
    interpreter.responseHandler = (request) => {
        setTimeout(() => {
            let mockValue = 0;
            interpreter.handleResponse(request.id, mockValue);
        }, 1);
    };
    
    // Start execution
    if (interpreter.start()) {
        console.log('✓ Interpreter started');
        
        // Wait for completion
        setTimeout(() => {
            console.log(`\nTotal commands: ${commands.length}`);
            console.log(`Break command found: ${breakCommandFound}`);
            
            // Check for any undefined issues
            const problemCommands = commands.filter(cmd => 
                cmd.hasOwnProperty('undefined') || 
                cmd.data === undefined ||
                JSON.stringify(cmd).includes('undefined')
            );
            
            if (problemCommands.length > 0) {
                console.log('\n❌ UNDEFINED ISSUES FOUND:');
                problemCommands.forEach((cmd, i) => {
                    console.log(`${i+1}:`, cmd);
                });
            } else {
                console.log('\n✓ No undefined issues detected');
            }
        }, 2000);
    } else {
        console.log('❌ Failed to start interpreter');
    }
    
} catch (error) {
    console.log('❌ Error:', error.message);
}