#!/usr/bin/env node

/**
 * Targeted regeneration of example 11 to test CompactAST ArrayAccessNode fix
 * This bypasses the full test suite generation that hangs
 */

const fs = require('fs');
const path = require('path');

// Import required modules
const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const MockDataManager = require('./src/javascript/MockDataManager.js');

// Suppress debug output (198 hardcoded debug statements cause timeouts)
global.INTERPRETER_DEBUG_ENABLED = false;

console.log('🔧 Regenerating Example 11 with Fixed CompactAST ArrayAccessNode Export');
console.log('');

async function regenerateExample11() {
    try {
        // Read the source code for example 11
        const metaPath = 'test_data/example_011.meta';
        const metaContent = fs.readFileSync(metaPath, 'utf8');

        // Extract the source code from the meta file
        const contentMatch = metaContent.match(/content=([\s\S]*)/);
        if (!contentMatch) {
            throw new Error('Could not extract content from meta file');
        }

        const sourceCode = contentMatch[1];
        console.log('📄 Source code extracted from meta file:');
        console.log('```arduino');
        console.log(sourceCode);
        console.log('```');
        console.log('');

        // Parse the code to AST
        console.log('🔍 Parsing code to AST...');
        const ast = parse(sourceCode);
        console.log('✅ AST parsed successfully');

        // Export to CompactAST (with fixed ArrayAccessNode mapping)
        console.log('📦 Exporting to CompactAST binary format...');
        const compactAST = exportCompactAST(ast);
        console.log('✅ CompactAST exported successfully');
        console.log(`📊 Binary size: ${compactAST.byteLength} bytes`);

        // Save the new AST file
        const astPath = 'test_data/example_011.ast';
        const buffer = Buffer.from(compactAST);
        fs.writeFileSync(astPath, buffer);
        console.log(`💾 Saved new AST file: ${astPath}`);

        // Generate command stream using JavaScript interpreter
        console.log('⚡ Generating command stream...');

        // Create deterministic mock data manager
        const mockData = new MockDataManager();

        const interpreter = new ASTInterpreter(ast, {
            verbose: false,
            debug: false,
            stepDelay: 0,
            maxLoopIterations: 1,
            mockDataManager: mockData
        });

        const commands = [];
        let executionCompleted = false;
        let executionError = null;

        // Set up external data request handling (proper onCommand pattern)
        interpreter.onCommand = (command) => {
            commands.push(command);

            // Handle external data requests with mock hardware responses
            switch (command.type) {
                case 'ANALOG_READ_REQUEST':
                    const analogValue = Math.floor(Math.random() * 1024); // 0-1023
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, analogValue);
                    }, Math.random() * 10); // 0-10ms random delay
                    break;

                case 'DIGITAL_READ_REQUEST':
                    const digitalValue = Math.random() > 0.5 ? 1 : 0; // HIGH or LOW
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, digitalValue);
                    }, Math.random() * 10);
                    break;

                case 'MILLIS_REQUEST':
                    const millisValue = Date.now() % 100000; // Wrap at 100 seconds
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, millisValue);
                    }, Math.random() * 5);
                    break;

                case 'MICROS_REQUEST':
                    const microsValue = (Date.now() * 1000) % 1000000; // Wrap at 1M microseconds
                    setTimeout(() => {
                        interpreter.handleResponse(command.requestId, microsValue);
                    }, Math.random() * 5);
                    break;
            }

            // Check for completion
            if (command.type === 'PROGRAM_END' || command.type === 'ERROR' || command.type === 'LOOP_LIMIT_REACHED') {
                executionCompleted = true;
                if (command.type === 'ERROR') {
                    executionError = command.message || command.error || 'Unknown error';
                }
            }
        };

        // Suppress output for clean generation
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        console.log = () => {};
        console.error = () => {};

        try {
            // Start interpreter
            interpreter.start();

            // Wait for completion with timeout
            const timeout = setTimeout(() => {
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
                console.log('⏰ Timeout reached, stopping interpreter...');
                executionCompleted = true;
                executionError = 'Timeout';
            }, 5000); // 5 second timeout

            // Wait for completion
            while (!executionCompleted) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            clearTimeout(timeout);

            if (executionError) {
                throw new Error(`Execution error: ${executionError}`);
            }

        } finally {
            // Restore output
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
        }

        if (commands.length === 0) {
            throw new Error('No commands generated - interpreter may have failed');
        }

        console.log(`✅ Generated ${commands.length} commands`);

        // Save command stream
        const commandsPath = 'test_data/example_011.commands';
        const commandsJson = JSON.stringify(commands, null, 2);
        fs.writeFileSync(commandsPath, commandsJson);
        console.log(`💾 Saved command stream: ${commandsPath}`);

        // Show relevant commands for verification
        console.log('');
        console.log('🔍 Key commands for ArrayAccessNode verification:');
        const relevantCommands = commands.filter(cmd =>
            cmd.type === 'FUNCTION_CALL' && cmd.function === 'tone'
        );

        relevantCommands.forEach((cmd, i) => {
            console.log(`${i + 1}. tone(${cmd.arguments.join(', ')}) - ${cmd.message}`);
        });

        console.log('');
        console.log('🎉 Example 11 regeneration completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Test with C++ interpreter: cd build && ./extract_cpp_commands 11');
        console.log('2. Run validation: ./validate_cross_platform 11 11');
        console.log('3. Check if tone function now shows (8, null, 20) in both platforms');

        return true;

    } catch (error) {
        console.error('❌ Error regenerating example 11:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Main execution
if (require.main === module) {
    regenerateExample11()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Fatal error:', error.message);
            process.exit(1);
        });
}

module.exports = { regenerateExample11 };