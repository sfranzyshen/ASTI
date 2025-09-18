#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import the ArduinoParser and ASTInterpreter
const parser = require('./src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

// Simple BareMinimum test case
const simpleCode = `
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

console.log("=== JAVASCRIPT COMMAND GENERATION DEBUG ===");
console.log("Testing code:");
console.log(simpleCode);

try {
    // Parse the code
    const ast = parser.parse(simpleCode);
    console.log("✅ Parsing successful");
    
    // Create interpreter with limited iterations
    const interpreter = new ASTInterpreter(ast, {
        maxLoopIterations: 1,
        stepDelay: 0
    });
    
    // Capture commands with request-response handling
    const commands = [];
    let done = false;
    
    interpreter.onCommand = (cmd) => {
        commands.push(cmd);
        
        // Handle request-response pattern for external functions
        if (cmd.type === 'DELAY' || cmd.type === 'DIGITAL_WRITE' || cmd.type === 'PIN_MODE') {
            // Simulate immediate response for hardware operations
            setTimeout(() => {
                if (cmd.requestId) {
                    interpreter.handleResponse(cmd.requestId, 0);
                }
            }, 1);
        }
        
        // Check if program completed
        if (cmd.type === 'PROGRAM_END') {
            done = true;
        }
    };
    
    // Execute and capture commands
    console.log("\n=== EXECUTING ===");
    interpreter.executeControlledProgram();
    
    // Wait for completion with timeout
    const startTime = Date.now();
    function checkCompletion() {
        if (done || Date.now() - startTime > 2000) {
            console.log("Execution completed or timed out");
            return;
        }
        setTimeout(checkCompletion, 10);
    }
    checkCompletion();
    
    console.log(`\n=== GENERATED ${commands.length} COMMANDS ===`);
    
    commands.forEach((cmd, i) => {
        console.log(`[${i+1}] ${cmd.type} - ${JSON.stringify(cmd, null, 0)}`);
    });
    
    // Save to file for comparison
    fs.writeFileSync('debug_js_commands.json', JSON.stringify(commands, null, 2));
    console.log("\n✅ Commands saved to debug_js_commands.json");
    
} catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
}