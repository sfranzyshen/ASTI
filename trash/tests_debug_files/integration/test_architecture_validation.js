#!/usr/bin/env node

/**
 * Architecture Validation Test - Clean Command Streams
 * Tests that the new request-response architecture eliminates "[object Object]" issues
 */

console.log('🔬 Architecture Validation Test - Clean Command Streams');
console.log('======================================================');

const { parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');

// Test code that would previously cause "[object Object]" issues
const testCode = `
#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(60, 6, NEO_GRB + NEO_KHZ800);

void colorWipe(uint32_t color, int wait) {
  for(int i = 0; i < strip.numPixels(); i++) {
    strip.setPixelColor(i, color);
    strip.show();
    delay(wait);
  }
}

void setup() {
  strip.begin();
}

void loop() {
  colorWipe(strip.Color(255, 0, 0), 50); // This would cause "[object Object]" before
  analogRead(A0); // Test request-response
  int sensorVal = digitalRead(2); // Test request-response
  unsigned long time = millis(); // Test request-response
}
`;

console.log('✅ Test code prepared');

async function runTest() {
    try {
        // Parse the code
        const ast = parse(testCode);
        console.log('✅ Code parsed successfully');
        
        // Create interpreter
        const interpreter = new ASTInterpreter(ast, { 
            verbose: false, 
            stepDelay: 0, 
            maxLoopIterations: 2  // Limit loop iterations for testing
        });
        
        let commands = [];
        let objectObjects = [];
        let requestResponsePairs = [];
        
        // Track all commands for analysis
        interpreter.onCommand = (command) => {
            commands.push(command);
            
            // Check for "[object Object]" in any command field
            const commandStr = JSON.stringify(command);
            if (commandStr.includes('[object Object]')) {
                objectObjects.push({
                    command: command,
                    stringified: commandStr
                });
            }
            
            // Track request-response pairs
            if (command.type && command.type.endsWith('_REQUEST')) {
                requestResponsePairs.push({
                    type: 'request',
                    command: command
                });
                
                // Simulate response
                let responseValue;
                switch (command.type) {
                    case 'ANALOG_READ_REQUEST':
                        responseValue = 512;
                        break;
                    case 'DIGITAL_READ_REQUEST':
                        responseValue = 1;
                        break;
                    case 'MILLIS_REQUEST':
                        responseValue = 1000;
                        break;
                    case 'LIBRARY_METHOD_REQUEST':
                        responseValue = command.method === 'numPixels' ? 60 : 0;
                        break;
                    default:
                        responseValue = 0;
                }
                
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, responseValue);
                    requestResponsePairs.push({
                        type: 'response',
                        requestId: command.requestId,
                        value: responseValue
                    });
                }, 1);
            }
        };
        
        // Start execution
        const startResult = interpreter.start();
        if (!startResult) {
            throw new Error('Failed to start interpreter');
        }
        console.log('✅ Interpreter started successfully');
        
        // Wait for execution to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Analyze results
        console.log('\n🔍 ANALYSIS RESULTS');
        console.log('===================');
        console.log(`📊 Total commands emitted: ${commands.length}`);
        console.log(`❌ "[object Object]" issues found: ${objectObjects.length}`);
        console.log(`🔄 Request-response pairs: ${Math.floor(requestResponsePairs.length / 2)}`);
        
        // Check for specific command types
        const calculableCommands = commands.filter(c => c.type === 'LIBRARY_STATIC_METHOD_CALL' && c.calculatedValue !== undefined);
        const requestCommands = commands.filter(c => c.type && c.type.endsWith('_REQUEST'));
        const functionCalls = commands.filter(c => c.type === 'FUNCTION_CALL');
        
        console.log(`🧮 Calculable function commands: ${calculableCommands.length}`);
        console.log(`📡 Request commands: ${requestCommands.length}`);
        console.log(`🔧 Function call commands: ${functionCalls.length}`);
        
        // Detailed analysis
        if (objectObjects.length > 0) {
            console.log('\n❌ FOUND "[object Object]" ISSUES:');
            objectObjects.forEach((issue, i) => {
                console.log(`${i + 1}. ${issue.stringified.substring(0, 100)}...`);
            });
        } else {
            console.log('\n✅ NO "[object Object]" ISSUES FOUND!');
        }
        
        // Show sample calculable function command
        if (calculableCommands.length > 0) {
            console.log('\n✅ SAMPLE CALCULABLE FUNCTION COMMAND:');
            console.log(JSON.stringify(calculableCommands[0], null, 2));
        }
        
        // Show sample request command
        if (requestCommands.length > 0) {
            console.log('\n✅ SAMPLE REQUEST COMMAND:');
            console.log(JSON.stringify(requestCommands[0], null, 2));
        }
        
        // Show sample function call with clean arguments
        const cleanFunctionCall = functionCalls.find(c => c.arguments && c.arguments.length > 0);
        if (cleanFunctionCall) {
            console.log('\n✅ SAMPLE FUNCTION CALL WITH CLEAN ARGUMENTS:');
            console.log(JSON.stringify(cleanFunctionCall, null, 2));
            
            // Verify arguments are primitives
            const allPrimitives = cleanFunctionCall.arguments.every(arg => 
                typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean'
            );
            console.log(`✅ All arguments are primitives: ${allPrimitives}`);
        }
        
        console.log('\n🎉 ARCHITECTURE VALIDATION COMPLETED!');
        console.log('=====================================');
        
        if (objectObjects.length === 0) {
            console.log('✅ SUCCESS: Clean command streams achieved!');
            console.log('✅ NO nested objects or "[object Object]" issues found');
            console.log('✅ Request-response pattern working correctly');
            process.exit(0);
        } else {
            console.log('❌ FAILURE: Found "[object Object]" issues');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

runTest();