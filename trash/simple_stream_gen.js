#!/usr/bin/env node

/**
 * Simple Arduino Command Stream Generator
 * Based on working patterns from existing tools
 */

const fs = require('fs');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

function generateFromCode(code, outputFile = null) {
    console.log('=== Arduino Command Stream Generator ===');
    
    try {
        // Parse code
        console.log('Parsing Arduino code...');
        const ast = parse(code);
        console.log('✅ Parsing successful');
        
        // Generate commands using the working pattern
        const commands = [];
        let isComplete = false;
        
        const interpreter = new ASTInterpreter(ast, {
            maxLoopIterations: 3,
            timeout: 5000,
            enableDebug: false,
            verbose: false
        });
        
        interpreter.onCommand = (cmd) => {
            commands.push(cmd);
        };
        
        // Simple timeout-based completion (like existing tools)
        setTimeout(() => {
            console.log(`✅ Generated ${commands.length} commands`);
            
            const jsonOutput = JSON.stringify(commands, null, 2);
            
            if (outputFile) {
                fs.writeFileSync(outputFile, jsonOutput);
                console.log(`💾 Saved to: ${outputFile}`);
            } else {
                console.log('=== COMMAND STREAM ===');
                console.log(jsonOutput);
            }
        }, 100); // Short timeout to capture initial commands
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Command line usage
if (process.argv.length > 2) {
    const input = process.argv[2];
    const output = process.argv[3] || null;
    
    if (input === '--help') {
        console.log('Usage: node simple_stream_gen.js <sketch.ino> [output.json]');
        console.log('   or: node simple_stream_gen.js --code "Arduino code here"');
        process.exit(0);
    }
    
    if (input === '--code' && process.argv[3]) {
        generateFromCode(process.argv[3], process.argv[4]);
    } else if (fs.existsSync(input)) {
        const code = fs.readFileSync(input, 'utf8');
        generateFromCode(code, output);
    } else {
        console.error('❌ File not found:', input);
    }
} else {
    console.log('Usage: node simple_stream_gen.js <sketch.ino> [output.json]');
}