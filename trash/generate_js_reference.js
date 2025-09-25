const fs = require('fs');
const path = require('path');

// Load examples first to check structure
const examples = require('./examples.js');
console.log('Examples structure:', typeof examples, Array.isArray(examples));

// Load the ArduinoParser and ASTInterpreter
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

/**
 * Generate JavaScript reference command streams for cross-platform comparison
 */

async function generateReference() {
    console.log('=== Generating JavaScript Reference Command Streams ===');
    
    // Ensure test_data directory exists
    if (!fs.existsSync('test_data')) {
        fs.mkdirSync('test_data');
    }
    
    // Focus on BareMinimum.ino first
    const examplesArray = Array.isArray(examples) ? examples : examples.examplesFiles || [];
    console.log('Using examples array:', examplesArray.length, 'items');
    
    const bareMinimum = examplesArray.find(ex => ex.name === 'BareMinimum.ino');
    
    if (!bareMinimum) {
        console.error('Error: BareMinimum.ino not found in examples');
        return;
    }
    
    console.log('\n=== Processing BareMinimum.ino ===');
    console.log('Code:');
    console.log(bareMinimum.content);
    
    try {
        // Parse the Arduino code
        const ast = parse(bareMinimum.content);
        console.log('\nParsing successful');
        
        // Create interpreter with consistent settings
        const interpreter = new ASTInterpreter(ast, {
            verbose: false,
            stepDelay: 0,
            maxLoopIterations: 3
        });
        
        let commandStream = '';
        let executionCompleted = false;
        let executionError = null;
        let commandCount = 0;
        
        // Capture all commands
        interpreter.onCommand = (command) => {
            commandCount++;
            commandStream += JSON.stringify(command) + '\n';
            
            // Handle request-response pattern for external data functions
            switch (command.type) {
                case 'ANALOG_READ_REQUEST':
                    const analogValue = Math.floor(Math.random() * 1024);
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, analogValue);
                    }, 1);
                    break;
                    
                case 'DIGITAL_READ_REQUEST':  
                    const digitalState = Math.random() > 0.5 ? 1 : 0;
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, digitalState);
                    }, 1);
                    break;
                    
                case 'MILLIS_REQUEST':
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, Date.now());
                    }, 1);
                    break;
                    
                case 'MICROS_REQUEST':
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, Date.now() * 1000);
                    }, 1);
                    break;
                    
                case 'LIBRARY_METHOD_REQUEST':
                    let responseValue = 0;
                    switch (command.method) {
                        case 'numPixels': responseValue = 60; break;
                        default: responseValue = 0;
                    }
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, responseValue);
                    }, 1);
                    break;
            }
        };
        
        // Handle completion
        interpreter.onComplete = () => {
            executionCompleted = true;
        };
        
        interpreter.onError = (error) => {
            executionError = error;
            executionCompleted = true;
        };
        
        // Start execution
        console.log('Starting interpreter...');
        interpreter.start();
        console.log('Interpreter started, waiting for completion...');
        
        // Wait for completion with timeout
        const timeout = 3000; // 3 second timeout for simple examples
        const startTime = Date.now();
        
        const result = await new Promise((resolve) => {
            const checkCompletion = () => {
                if (executionCompleted) {
                    console.log('Execution completed normally');
                    resolve({
                        success: !executionError,
                        error: executionError,
                        commandStream: commandStream,
                        commandCount: commandCount
                    });
                } else if (Date.now() - startTime > timeout) {
                    console.log('Execution timeout - stopping interpreter');
                    interpreter.stop(); // Stop the interpreter
                    resolve({
                        success: commandCount > 0, // Consider success if we got some commands
                        error: 'Execution timeout (but captured ' + commandCount + ' commands)',
                        commandStream: commandStream,
                        commandCount: commandCount
                    });
                } else {
                    setTimeout(checkCompletion, 10);
                }
            };
            checkCompletion();
        });
        
        if (result.success) {
            console.log('\n=== JavaScript Command Stream ===');
            console.log('Commands generated: ' + result.commandStream.split('\n').filter(line => line.trim()).length);
            console.log('\nCommand stream:');
            console.log(result.commandStream);
            
            // Save to reference file
            const refFile = 'test_data/example_001_js_commands.txt';
            fs.writeFileSync(refFile, result.commandStream);
            console.log('\nSaved JavaScript reference to: ' + refFile);
            
            // Also generate a summary
            const commands = result.commandStream.split('\n').filter(line => line.trim());
            const commandTypes = {};
            
            for (const cmd of commands) {
                const type = cmd.split(/[\s:]/)[0];
                commandTypes[type] = (commandTypes[type] || 0) + 1;
            }
            
            console.log('\n=== Command Type Summary ===');
            console.log('Total commands:', commands.length);
            for (const [type, count] of Object.entries(commandTypes)) {
                console.log(`  ${type}: ${count}`);
            }
            
        } else {
            console.error('Execution failed:', result.error);
            console.error('Stack trace:', result.stackTrace);
        }
        
    } catch (error) {
        console.error('Error processing BareMinimum.ino:', error);
        console.error('Stack trace:', error.stack);
    }
}

if (require.main === module) {
    generateReference().catch(console.error);
}

module.exports = { generateReference };