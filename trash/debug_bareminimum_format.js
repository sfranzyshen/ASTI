#!/usr/bin/env node
/**
 * Debug BareMinimum.ino format differences between JS and C++
 * This will show exactly what patterns need to match
 */

// Load the modules
const parser = require('./src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const fs = require('fs');

console.log("🔍 BareMinimum.ino Format Analysis - JavaScript vs C++");
console.log("======================================================\n");

// Get the BareMinimum.ino content
const bareMinimumCode = `
void setup() {
  // put your setup code here, to run once:
}

void loop() {
  // put your main code here, to run repeatedly:
}
`;

// Parse and interpret with JavaScript
console.log("📋 JavaScript Output:");
console.log("====================");

try {
    const ast = parser.parse(bareMinimumCode);
    const interpreter = new ASTInterpreter(ast, {
        maxLoopIterations: 1,
        enableAllOutput: false,  // No debug noise
        enableConsoleLog: false
    });
    
    const jsCommands = [];
    interpreter.onCommand = (command) => {
        jsCommands.push(JSON.stringify(command));
    };
    
    interpreter.start();
    
    jsCommands.forEach((cmd, i) => {
        console.log(`[${i}] ${cmd}`);
    });
    
    console.log(`\nTotal JS commands: ${jsCommands.length}`);
    console.log(`Total JS length: ${jsCommands.join('\\n').length} chars`);
    
} catch (error) {
    console.error("JavaScript execution failed:", error);
}

console.log("\n" + "=".repeat(60) + "\n");

// Now let's see what the C++ version produces
console.log("📋 C++ FlexibleCommand Output (from chess demo):");
console.log("===============================================");

const cppOutput = [
    '{"component":"interpreter","status":"started","timestamp":786662966,"type":"VERSION_INFO","version":"7.3.0"}',
    '{"message":"Program execution started","timestamp":786662966,"type":"PROGRAM_START"}',
    '{"message":"Executing setup() function","timestamp":786662966,"type":"SETUP_START"}',
    '{"message":"Completed setup() function","timestamp":786662966,"type":"SETUP_END"}',
    '{"message":"Starting loop() execution","timestamp":786662966,"type":"LOOP_START"}',
    '{"message":"Starting loop iteration 1","timestamp":786662966,"type":"LOOP_START"}',
    '{"function":"loop","iteration":1,"message":"Executing loop() iteration 1","timestamp":786662966,"type":"FUNCTION_CALL"}',
    '{"completed":true,"function":"loop","iteration":1,"message":"Completed loop() iteration 1","timestamp":786662966,"type":"FUNCTION_CALL"}',
    '{"iterations":1,"limitReached":true,"message":"Loop limit reached: completed 1 iterations (max: 1)","timestamp":786662966,"type":"LOOP_END"}',
    '{"message":"Program completed after 1 loop iterations (limit reached)","timestamp":786662966,"type":"PROGRAM_END"}'
];

cppOutput.forEach((cmd, i) => {
    console.log(`[${i}] ${cmd}`);
});

console.log(`\nTotal C++ commands: ${cppOutput.length}`);
console.log(`Total C++ length: ${cppOutput.join('\\n').length} chars`);

console.log("\n🔍 DIFFERENCE ANALYSIS:");
console.log("======================");
console.log("We need to identify exact field differences, command structure differences,");
console.log("and timestamp handling to make these outputs EXACTLY match.");