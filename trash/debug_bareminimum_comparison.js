const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Focused BareMinimum.ino Command Stream Debugging Tool
 * Compares JavaScript vs C++ command generation with proper JSON parsing
 */

// Load examples
const examples = require('./examples.js');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

function parseCommandStream(rawStream, label) {
    console.log(`\n=== Parsing ${label} Command Stream ===`);
    console.log('Raw stream length:', rawStream.length);
    console.log('First 200 chars:', rawStream.substring(0, 200));
    
    let commands = [];
    
    try {
        // Try parsing as JSON array first (C++ format)
        if (rawStream.trim().startsWith('[')) {
            console.log('Detected C++ JSON array format');
            const parsed = JSON.parse(rawStream);
            if (Array.isArray(parsed)) {
                commands = parsed;
            }
        } else {
            // Parse as line-by-line JSON objects (JavaScript format)
            console.log('Detected JavaScript line-by-line format');
            const lines = rawStream.split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const cmd = JSON.parse(line);
                    commands.push(cmd);
                } catch (e) {
                    console.log('Skipping non-JSON line:', line);
                }
            }
        }
    } catch (e) {
        console.error(`Error parsing ${label} stream:`, e.message);
        return [];
    }
    
    console.log(`Successfully parsed ${commands.length} commands`);
    return commands;
}

function analyzeCommandTypes(commands, label) {
    console.log(`\n=== ${label} Command Analysis ===`);
    console.log('Total commands:', commands.length);
    
    const commandTypes = {};
    const commandsByType = {};
    
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const type = cmd.type || 'UNKNOWN';
        
        commandTypes[type] = (commandTypes[type] || 0) + 1;
        
        if (!commandsByType[type]) {
            commandsByType[type] = [];
        }
        commandsByType[type].push({ index: i, command: cmd });
    }
    
    console.log('\nCommand types:');
    for (const [type, count] of Object.entries(commandTypes).sort()) {
        console.log(`  ${type}: ${count}`);
    }
    
    return { commandTypes, commandsByType };
}

function compareCommands(jsCommands, cppCommands) {
    console.log('\n=== Detailed Command Comparison ===');
    
    const jsTypes = {};
    const cppTypes = {};
    
    // Count by type
    jsCommands.forEach(cmd => {
        const type = cmd.type || 'UNKNOWN';
        jsTypes[type] = (jsTypes[type] || 0) + 1;
    });
    
    cppCommands.forEach(cmd => {
        const type = cmd.type || 'UNKNOWN';
        cppTypes[type] = (cppTypes[type] || 0) + 1;
    });
    
    // Find differences in command types
    const allTypes = new Set([...Object.keys(jsTypes), ...Object.keys(cppTypes)]);
    
    console.log('\nCommand type comparison:');
    for (const type of Array.from(allTypes).sort()) {
        const jsCount = jsTypes[type] || 0;
        const cppCount = cppTypes[type] || 0;
        const status = jsCount === cppCount ? 'MATCH' : 'DIFF';
        console.log(`  ${type}: JS=${jsCount}, C++=${cppCount} [${status}]`);
    }
    
    // Show first few commands of each type
    console.log('\nFirst command of each type:');
    for (const type of Array.from(allTypes).sort()) {
        const jsCmd = jsCommands.find(cmd => cmd.type === type);
        const cppCmd = cppCommands.find(cmd => cmd.type === type);
        
        console.log(`\n--- ${type} ---`);
        if (jsCmd) {
            console.log('JS :', JSON.stringify(jsCmd));
        } else {
            console.log('JS : [MISSING]');
        }
        
        if (cppCmd) {
            console.log('C++:', JSON.stringify(cppCmd));
        } else {
            console.log('C++: [MISSING]');
        }
    }
}

function calculateSimilarity(jsCommands, cppCommands) {
    // Compare normalized command types and counts
    const jsTypes = {};
    const cppTypes = {};
    
    jsCommands.forEach(cmd => {
        const type = cmd.type || 'UNKNOWN';
        jsTypes[type] = (jsTypes[type] || 0) + 1;
    });
    
    cppCommands.forEach(cmd => {
        const type = cmd.type || 'UNKNOWN';
        cppTypes[type] = (cppTypes[type] || 0) + 1;
    });
    
    const allTypes = new Set([...Object.keys(jsTypes), ...Object.keys(cppTypes)]);
    let matching = 0;
    let total = 0;
    
    for (const type of allTypes) {
        const jsCount = jsTypes[type] || 0;
        const cppCount = cppTypes[type] || 0;
        
        matching += Math.min(jsCount, cppCount);
        total += Math.max(jsCount, cppCount);
    }
    
    const similarity = total > 0 ? (matching / total) * 100 : 0;
    
    console.log('\n=== Similarity Analysis ===');
    console.log('Total command types:', allTypes.size);
    console.log('Matching commands:', matching);
    console.log('Total commands (max):', total);
    console.log('Similarity score:', similarity.toFixed(1) + '%');
    
    return similarity;
}

async function generateJavaScriptReference() {
    console.log('=== Generating JavaScript Reference ===');
    
    const examplesArray = Array.isArray(examples) ? examples : examples.examplesFiles || [];
    const bareMinimum = examplesArray.find(ex => ex.name === 'BareMinimum.ino');
    
    if (!bareMinimum) {
        throw new Error('BareMinimum.ino not found in examples');
    }
    
    console.log('\nBareMinimum.ino code:');
    console.log(bareMinimum.content);
    
    // Parse the Arduino code
    const ast = parse(bareMinimum.content);
    console.log('\nParsing successful');
    
    // Create interpreter with consistent settings
    const interpreter = new ASTInterpreter(ast, {
        verbose: false,
        stepDelay: 0,
        maxLoopIterations: 3
    });
    
    let commands = [];
    let executionCompleted = false;
    let executionError = null;
    
    // Capture all commands
    interpreter.onCommand = (command) => {
        commands.push(command);
        
        // Handle request-response pattern for external data functions
        switch (command.type) {
            case 'ANALOG_READ_REQUEST':
            case 'DIGITAL_READ_REQUEST':
            case 'MILLIS_REQUEST':
            case 'MICROS_REQUEST':
            case 'LIBRARY_METHOD_REQUEST':
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, 0);
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
    console.log('Starting JavaScript interpreter...');
    interpreter.start();
    
    // Wait for completion with timeout
    const timeout = 5000;
    const startTime = Date.now();
    
    const result = await new Promise((resolve) => {
        const checkCompletion = () => {
            if (executionCompleted) {
                resolve({
                    success: !executionError,
                    error: executionError,
                    commands: commands
                });
            } else if (Date.now() - startTime > timeout) {
                interpreter.stop();
                resolve({
                    success: commands.length > 0,
                    error: 'Execution timeout (captured ' + commands.length + ' commands)',
                    commands: commands
                });
            } else {
                setTimeout(checkCompletion, 10);
            }
        };
        checkCompletion();
    });
    
    if (result.success) {
        console.log('JavaScript execution successful:', result.commands.length, 'commands');
    } else {
        console.log('JavaScript execution completed with timeout:', result.error);
    }
    
    return result.commands;
}

function runCppAnalysis() {
    return new Promise((resolve, reject) => {
        console.log('\n=== Running C++ Analysis ===');
        
        const child = spawn('./focused_bareminimum_analysis', [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (code !== 0) {
                console.error('C++ analysis failed:', stderr);
                reject(new Error(`C++ analysis failed with code ${code}: ${stderr}`));
            } else {
                console.log('C++ analysis completed successfully');
                resolve(stdout);
            }
        });
        
        child.on('error', (error) => {
            console.error('Failed to start C++ analysis:', error);
            reject(error);
        });
    });
}

function extractCppCommandStreamFromOutput(output) {
    // Parse the differences to reconstruct the C++ JSON command stream
    const lines = output.split('\n');
    const cppLines = [];
    let inDifferences = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('=== Command Differences')) {
            inDifferences = true;
            continue;
        }
        
        if (inDifferences && line.startsWith('===')) {
            break; // End of differences section
        }
        
        if (inDifferences && line.includes('C++:')) {
            const cppPart = line.split('C++:')[1];
            if (cppPart) {
                cppLines.push(cppPart.trim());
            }
        }
    }
    
    // Join all C++ lines to reconstruct the JSON
    const reconstructedJson = cppLines.join('\n');
    console.log('Reconstructed C++ JSON (first 200 chars):', reconstructedJson.substring(0, 200));
    
    return reconstructedJson;
}

async function main() {
    try {
        console.log('=== BareMinimum.ino Cross-Platform Command Stream Analysis ===');
        
        // Ensure test_data directory exists
        if (!fs.existsSync('test_data')) {
            fs.mkdirSync('test_data');
        }
        
        // Step 1: Generate JavaScript reference
        const jsCommands = await generateJavaScriptReference();
        console.log('\nJavaScript commands captured:', jsCommands.length);
        
        // Save JavaScript commands for debugging
        fs.writeFileSync('test_data/debug_js_commands.json', JSON.stringify(jsCommands, null, 2));
        
        // Step 2: Run C++ analysis and extract command stream
        const cppOutput = await runCppAnalysis();
        const cppCommandStream = extractCppCommandStreamFromOutput(cppOutput);
        
        if (!cppCommandStream) {
            console.error('Failed to extract C++ command stream from output');
            console.log('\nFull C++ Output for debugging:');
            console.log(cppOutput.substring(0, 1000) + '...');
            
            // Try alternative: just analyze from the text output statistics  
            console.log('\n=== Falling back to text-based analysis ===');
            
            // Extract command counts from the output
            const jsCountMatch = cppOutput.match(/JavaScript: (\d+) commands/);
            const cppCountMatch = cppOutput.match(/C\+\+:\s+(\d+) commands/);
            const similarityMatch = cppOutput.match(/Similarity: ([\d.]+)%/);
            
            if (jsCountMatch && cppCountMatch) {
                console.log('Command counts from C++ output:');
                console.log('  JavaScript:', jsCountMatch[1], 'commands');
                console.log('  C++:', cppCountMatch[1], 'commands');
                
                if (similarityMatch) {
                    console.log('  Current similarity:', similarityMatch[1] + '%');
                }
                
                const gap = parseInt(cppCountMatch[1]) - parseInt(jsCountMatch[1]);
                console.log('  Command count difference:', gap);
                
                console.log('\n=== Key Issues Identified ===');
                console.log('1. C++ generates', cppCountMatch[1], 'commands vs JS', jsCountMatch[1], 'commands');
                console.log('2. The difference of', gap, 'commands needs investigation');
                console.log('3. Similarity is only', similarityMatch ? similarityMatch[1] + '%' : 'unknown');
                
                if (gap > 0) {
                    console.log('\n=== Likely Issues ===');
                    console.log('- C++ may be generating extra formatting/debug commands');
                    console.log('- JSON pretty-printing is inflating command count');
                    console.log('- Different command grouping/timing between implementations');
                } else if (gap < 0) {
                    console.log('\n=== Likely Issues ===');
                    console.log('- C++ may be missing some command types');
                    console.log('- Different execution flow or missing features');
                }
            }
            
            return;
        }
        
        // Save C++ command stream for debugging
        fs.writeFileSync('test_data/debug_cpp_commands.txt', cppCommandStream);
        
        // Step 3: Parse both command streams
        const parsedJsCommands = parseCommandStream(JSON.stringify(jsCommands), 'JavaScript');
        const parsedCppCommands = parseCommandStream(cppCommandStream, 'C++');
        
        // Step 4: Analyze command types
        analyzeCommandTypes(parsedJsCommands, 'JavaScript');
        analyzeCommandTypes(parsedCppCommands, 'C++');
        
        // Step 5: Compare commands
        compareCommands(parsedJsCommands, parsedCppCommands);
        
        // Step 6: Calculate similarity
        const similarity = calculateSimilarity(parsedJsCommands, parsedCppCommands);
        
        // Also save detailed debug info
        const debugInfo = {
            jsCommands: parsedJsCommands,
            cppCommands: parsedCppCommands,
            similarity: similarity,
            analysis: {
                jsCount: parsedJsCommands.length,
                cppCount: parsedCppCommands.length,
                difference: parsedCppCommands.length - parsedJsCommands.length
            }
        };
        
        fs.writeFileSync('test_data/debug_comparison_detailed.json', JSON.stringify(debugInfo, null, 2));
        
        // Step 7: Identify gaps for improvement
        console.log('\n=== Improvement Recommendations ===');
        
        const jsTypes = new Set(parsedJsCommands.map(cmd => cmd.type));
        const cppTypes = new Set(parsedCppCommands.map(cmd => cmd.type));
        
        const missingInCpp = Array.from(jsTypes).filter(type => !cppTypes.has(type));
        const extraInCpp = Array.from(cppTypes).filter(type => !jsTypes.has(type));
        
        if (missingInCpp.length > 0) {
            console.log('\nMissing in C++ implementation:');
            missingInCpp.forEach(type => console.log(`  - ${type}`));
        }
        
        if (extraInCpp.length > 0) {
            console.log('\nExtra in C++ implementation:');
            extraInCpp.forEach(type => console.log(`  - ${type}`));
        }
        
        console.log('\n=== Summary ===');
        console.log('JavaScript commands:', parsedJsCommands.length);
        console.log('C++ commands:', parsedCppCommands.length);
        console.log('Similarity score:', similarity.toFixed(1) + '%');
        console.log('\nGap to close: ' + (100 - similarity).toFixed(1) + '%');
        console.log('\nDebug files created:');
        console.log('  - test_data/debug_js_commands.json (JavaScript commands)');
        console.log('  - test_data/debug_cpp_commands.txt (C++ command stream)');
        console.log('  - test_data/debug_comparison_detailed.json (Full comparison data)');
        
        if (similarity < 90) {
            console.log('\nPRIORITY ACTIONS NEEDED:');
            if (missingInCpp.length > 0) {
                console.log('1. Add missing command types to C++ interpreter');
            }
            if (extraInCpp.length > 0) {
                console.log('2. Remove or reconcile extra command types in C++');
            }
            console.log('3. Verify command generation timing and sequence');
        }
        
    } catch (error) {
        console.error('Analysis failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, parseCommandStream, analyzeCommandTypes, compareCommands };