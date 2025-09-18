#!/usr/bin/env node
/**
 * Proper State Machine Test - Handle request-response pattern correctly
 */

const parser = require('./src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

async function testWithProperStateHandling() {
    console.log("🔧 PROPER STATE MACHINE TEST");
    console.log("============================\n");
    
    const bareMinimumCode = `
void setup() {
    // put your setup code here, to run once:
}

void loop() {
    // put your main code here, to run repeatedly:
}
`;

    const ast = parser.parse(bareMinimumCode);
    const interpreter = new ASTInterpreter(ast, {
        maxLoopIterations: 1,
        verbose: false
    });
    
    const jsCommands = [];
    
    interpreter.onCommand = (command) => {
        const cmdJson = JSON.stringify(command);
        jsCommands.push(command);
        console.log(`[${jsCommands.length-1}] ${cmdJson}`);
        
        // CRITICAL: Handle request-response state machine properly
        switch (command.type) {
            case 'ANALOG_READ_REQUEST':
                console.log(`   → Responding to ${command.requestId} with analog value`);
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, Math.floor(Math.random() * 1024));
                }, 1);
                break;
                
            case 'DIGITAL_READ_REQUEST':
                console.log(`   → Responding to ${command.requestId} with digital value`);
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, Math.random() > 0.5 ? 1 : 0);
                }, 1);
                break;
                
            case 'MILLIS_REQUEST':
                console.log(`   → Responding to ${command.requestId} with millis value`);
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, Date.now() % 100000);
                }, 1);
                break;
                
            case 'MICROS_REQUEST':
                console.log(`   → Responding to ${command.requestId} with micros value`);
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, Date.now() * 1000 % 1000000);
                }, 1);
                break;
                
            case 'LIBRARY_METHOD_REQUEST':
                console.log(`   → Responding to ${command.requestId} with library method value`);
                let responseValue = 0;
                switch (command.method) {
                    case 'numPixels': responseValue = 60; break;
                    case 'getBrightness': responseValue = 255; break;
                    case 'getPixelColor': responseValue = 0; break;
                    case 'canShow': responseValue = true; break;
                    default: responseValue = 0; break;
                }
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, responseValue);
                }, 1);
                break;
        }
    };
    
    interpreter.onError = (error) => {
        console.log(`❌ Interpreter error: ${error}`);
    };
    
    interpreter.onStateChange = (newState, oldState) => {
        console.log(`🔄 State: ${oldState} → ${newState}`);
    };
    
    console.log("🚀 Starting interpreter with proper state machine handling...");
    interpreter.start();
    
    // Wait for async state machine to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`\n📊 Final Results:`);
    console.log(`Commands: ${jsCommands.length}`);
    console.log(`Total JSON length: ${jsCommands.map(c => JSON.stringify(c)).join('\\n').length}`);
    
    return jsCommands;
}

testWithProperStateHandling().catch(console.error);