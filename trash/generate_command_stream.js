#!/usr/bin/env node

/**
 * Command Stream Generator
 * Takes Arduino sketch code and generates JavaScript interpreter command stream
 * Usage: node generate_command_stream.js <input.ino> [output.commands]
 */

const fs = require('fs');
const path = require('path');

// Load the ArduinoParser and ASTInterpreter
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

function showUsage() {
    console.log('Usage:');
    console.log('  node generate_command_stream.js <input.ino> [output.commands]');
    console.log('  node generate_command_stream.js --code "void setup(){} void loop(){}"');
    console.log('');
    console.log('Examples:');
    console.log('  node generate_command_stream.js sketch.ino commands.json');
    console.log('  node generate_command_stream.js --code "int x=5; void setup(){Serial.begin(9600);} void loop(){Serial.println(x);}"');
}

async function generateCommandStream(arduinoCode, outputFile = null) {
    return new Promise((resolve, reject) => {
        try {
            console.log('=== Arduino Command Stream Generator ===');
            console.log('Parsing Arduino code...');
            
            // Parse Arduino code to AST
            const ast = parse(arduinoCode);
            console.log('✅ Parsing successful');
            
            // Create interpreter with reasonable settings (matching working tools)
            const interpreter = new ASTInterpreter(ast, {
                maxLoopIterations: 3,
                timeout: 10000,
                enableDebug: false,
                verbose: false
            });
            
            console.log('Executing interpreter...');
            
            // Execute and capture command stream
            const commandStream = [];
            interpreter.onCommand = (command) => {
                commandStream.push(command);
            };
            
            const startTime = Date.now();
            
            // Handle completion
            interpreter.onComplete = () => {
                const executionTime = Date.now() - startTime;
                
                console.log(`✅ Execution completed in ${executionTime}ms`);
                console.log(`📊 Generated ${commandStream.length} commands`);
                
                // Format as pretty JSON
                const jsonOutput = JSON.stringify(commandStream, null, 2);
                
                if (outputFile) {
                    fs.writeFileSync(outputFile, jsonOutput);
                    console.log(`💾 Command stream saved to: ${outputFile}`);
                } else {
                    console.log('=== COMMAND STREAM ===');
                    console.log(jsonOutput);
                }
                
                resolve(commandStream);
            };
            
            // Handle errors
            interpreter.onError = (error) => {
                console.error('❌ Interpreter error:', error.message);
                reject(error);
            };
            
            // Start interpreter (pattern from working tools)
            interpreter.start();
            
        } catch (error) {
            console.error('❌ Error generating command stream:', error.message);
            reject(error);
        }
    });
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        showUsage();
        return;
    }
    
    let arduinoCode;
    let outputFile;
    
    if (args[0] === '--code') {
        if (args.length < 2) {
            console.error('❌ Error: --code requires Arduino code as argument');
            showUsage();
            return;
        }
        arduinoCode = args[1];
        outputFile = args[2] || null;
    } else {
        const inputFile = args[0];
        outputFile = args[1] || null;
        
        if (!fs.existsSync(inputFile)) {
            console.error(`❌ Error: Input file not found: ${inputFile}`);
            return;
        }
        
        arduinoCode = fs.readFileSync(inputFile, 'utf8');
        console.log(`📄 Loaded Arduino code from: ${inputFile}`);
    }
    
    await generateCommandStream(arduinoCode, outputFile);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateCommandStream };