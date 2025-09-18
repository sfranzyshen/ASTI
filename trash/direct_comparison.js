const fs = require('fs');
const { spawn } = require('child_process');

// Load JavaScript dependencies
const examples = require('./examples.js');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');

async function getJavaScriptCommands() {
    console.log('=== JavaScript Execution ===');
    
    const examplesArray = Array.isArray(examples) ? examples : examples.examplesFiles || [];
    const bareMinimum = examplesArray.find(ex => ex.name === 'BareMinimum.ino');
    
    if (!bareMinimum) {
        throw new Error('BareMinimum.ino not found');
    }

    const ast = parse(bareMinimum.content);
    const interpreter = new ASTInterpreter(ast, {
        verbose: false,
        stepDelay: 0,
        maxLoopIterations: 3
    });
    
    let commands = [];
    let executionCompleted = false;
    let executionError = null;
    
    interpreter.onCommand = (command) => {
        commands.push(command);
        
        // Handle async requests
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
    
    interpreter.onComplete = () => { executionCompleted = true; };
    interpreter.onError = (error) => { executionError = error; executionCompleted = true; };
    
    interpreter.start();
    
    // Wait for completion
    const timeout = 5000;
    const startTime = Date.now();
    
    while (!executionCompleted && (Date.now() - startTime < timeout)) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    if (executionError) {
        console.log('JavaScript execution error:', executionError);
    }
    
    console.log('JavaScript generated', commands.length, 'commands');
    return commands;
}

function getCppCommands() {
    return new Promise((resolve, reject) => {
        console.log('\n=== C++ Execution ===');
        
        const child = spawn('./debug_bareminimum_fixed', [], {
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
                console.error('C++ execution failed:', stderr);
                reject(new Error(`C++ failed with code ${code}: ${stderr}`));
            } else {
                console.log('C++ execution completed');
                resolve(stdout);
            }
        });
        
        child.on('error', (error) => {
            console.error('Failed to start C++:', error);
            reject(error);
        });
    });
}

function parseCppOutput(output) {
    console.log('Raw C++ output length:', output.length);
    console.log('First 300 chars:', output.substring(0, 300));
    
    // Find the JSON array in the output
    const streamStart = output.indexOf('[');
    const streamEnd = output.lastIndexOf(']');
    
    if (streamStart === -1 || streamEnd === -1) {
        console.error('Could not find JSON array boundaries');
        return [];
    }
    
    const jsonStr = output.substring(streamStart, streamEnd + 1);
    console.log('Extracted JSON length:', jsonStr.length);
    console.log('JSON preview:', jsonStr.substring(0, 200) + '...');
    
    try {
        const commands = JSON.parse(jsonStr);
        console.log('C++ parsed', commands.length, 'commands');
        return commands;
    } catch (e) {
        console.error('JSON parse error:', e.message);
        console.log('Problematic JSON:', jsonStr);
        return [];
    }
}

function compareCommandStreams(jsCommands, cppCommands) {
    console.log('\n=== SIDE-BY-SIDE COMPARISON ===');
    console.log('JavaScript commands:', jsCommands.length);
    console.log('C++ commands:', cppCommands.length);
    
    const maxLen = Math.max(jsCommands.length, cppCommands.length);
    
    console.log('\n--- Command by Command Comparison ---');
    for (let i = 0; i < maxLen; i++) {
        const jsCmd = jsCommands[i];
        const cppCmd = cppCommands[i];
        
        console.log(`\n[${i}]:`);
        console.log('  JS :', jsCmd ? `${jsCmd.type} - ${jsCmd.message || 'no message'}` : '[MISSING]');
        console.log('  C++:', cppCmd ? `${cppCmd.type} - ${cppCmd.message || 'no message'}` : '[MISSING]');
        
        if (jsCmd && cppCmd) {
            const match = jsCmd.type === cppCmd.type ? 'MATCH' : 'DIFFERENT';
            console.log(`  Status: ${match}`);
        }
    }
    
    console.log('\n--- Missing in C++ ---');
    jsCommands.forEach((cmd, i) => {
        if (!cppCommands[i] || cppCommands[i].type !== cmd.type) {
            console.log(`  [${i}] ${cmd.type} - ${cmd.message || 'no message'}`);
        }
    });
    
    console.log('\n--- Extra in C++ ---');
    cppCommands.forEach((cmd, i) => {
        if (!jsCommands[i] || jsCommands[i].type !== cmd.type) {
            console.log(`  [${i}] ${cmd.type} - ${cmd.message || 'no message'}`);
        }
    });
    
    // Calculate similarity
    let matching = 0;
    for (let i = 0; i < Math.min(jsCommands.length, cppCommands.length); i++) {
        if (jsCommands[i] && cppCommands[i] && jsCommands[i].type === cppCommands[i].type) {
            matching++;
        }
    }
    
    const totalExpected = jsCommands.length;
    const compatibility = totalExpected > 0 ? (matching / totalExpected) * 100 : 0;
    
    console.log('\n--- Summary ---');
    console.log('Expected commands (JS):', jsCommands.length);
    console.log('Actual commands (C++):', cppCommands.length);
    console.log('Matching positions:', matching);
    console.log('Compatibility:', compatibility.toFixed(1) + '%');
    
    return { compatibility, matching, total: totalExpected };
}

async function main() {
    try {
        console.log('=== BareMinimum.ino Direct Command Stream Comparison ===\n');
        
        // Get command streams from both implementations
        const jsCommands = await getJavaScriptCommands();
        const cppOutput = await getCppCommands();
        const cppCommands = parseCppOutput(cppOutput);
        
        // Compare them
        const result = compareCommandStreams(jsCommands, cppCommands);
        
        console.log('\n=== DETAILED COMMAND ANALYSIS ===');
        
        // Save detailed command analysis
        const analysis = {
            javascript: jsCommands.map((cmd, i) => ({ index: i, ...cmd })),
            cpp: cppCommands.map((cmd, i) => ({ index: i, ...cmd })),
            comparison: result
        };
        
        fs.writeFileSync('direct_comparison_analysis.json', JSON.stringify(analysis, null, 2));
        console.log('\nDetailed analysis saved to: direct_comparison_analysis.json');
        
        // Show the gap to close
        const gap = 100 - result.compatibility;
        console.log(`\nGap to close: ${gap.toFixed(1)}%`);
        
        if (gap > 0) {
            console.log('\nNext steps to improve compatibility:');
            console.log('1. Fix C++ command generation to match JavaScript sequence');
            console.log('2. Ensure proper JSON formatting in C++ output');
            console.log('3. Verify loop iteration handling and message generation');
        }
        
    } catch (error) {
        console.error('Comparison failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}