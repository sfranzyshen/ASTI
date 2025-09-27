/**
 * Debug JavaScript variable declaration command emission
 */

const fs = require('fs');
const { Parser, parse, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

// Read minimal test case
const testCode = fs.readFileSync('minimal_test.ino', 'utf8');
console.log('=== Debugging JavaScript Variable Declaration ===');
console.log('Test code:', testCode);

try {
    // Parse the code
    const ast = parse(testCode);
    console.log('\nParsing successful');
    
    // Create JavaScript interpreter with detailed logging
    const interpreter = new ASTInterpreter(ast, { 
        verbose: true,  // Enable verbose logging
        debug: true,    // Enable debug logging
        stepDelay: 0,
        maxLoopIterations: 3
    });
    
    // Collect ALL commands
    const allCommands = [];
    let executionCompleted = false;
    
    interpreter.onCommand = (command) => {
        allCommands.push(command);
        console.log(`📦 COMMAND EMITTED: ${command.type} -`, command);
        if (command.type === 'PROGRAM_END' || command.type === 'ERROR' || command.type === 'LOOP_LIMIT_REACHED') {
            executionCompleted = true;
        }
    };
    
    interpreter.onError = (error) => {
        console.log(`❌ ERROR: ${error}`);
        executionCompleted = true;
    };
    
    // Override emitCommand to see if it's being called
    const originalEmitCommand = interpreter.emitCommand;
    interpreter.emitCommand = function(command) {
        console.log(`🔧 INTERNAL emitCommand() called with:`, command);
        return originalEmitCommand.call(this, command);
    };
    
    console.log('\n=== Starting Interpreter ===');
    const startResult = interpreter.start();
    if (!startResult) {
        throw new Error('Failed to start interpreter');
    }
    
    // Wait for completion
    const startTime = Date.now();
    while (!executionCompleted && (Date.now() - startTime) < 5000) {
        // Simple wait
    }
    
    console.log('\n=== Final Results ===');
    console.log(`Total commands emitted: ${allCommands.length}`);
    console.log(`Execution completed: ${executionCompleted}`);
    
    allCommands.forEach((cmd, index) => {
        console.log(`${index + 1}: ${cmd.type} - ${JSON.stringify(cmd, null, 2)}`);
    });
    
    // Check if VAR_SET was emitted
    const varSetCommands = allCommands.filter(cmd => cmd.type === 'VAR_SET');
    console.log(`\nVAR_SET commands found: ${varSetCommands.length}`);
    
} catch (error) {
    console.error('Debug failed:', error);
}