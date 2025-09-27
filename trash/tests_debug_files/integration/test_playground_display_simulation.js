#!/usr/bin/env node

/**
 * Playground Display Simulation Test
 * 
 * This test exactly simulates the browser playground's displayCommand function
 * to identify which commands from strandtest_nodelay produce "undefined" content.
 */

const { Parser, parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');
const { neopixelFiles } = require('../../neopixel.js');

console.log('🔍 Playground Display Simulation Test');
console.log('====================================');

// Find the strandtest_nodelay example
const strandtestNodelay = neopixelFiles.find(file => file.name === 'strandtest_nodelay.ino');
if (!strandtestNodelay) {
    console.error('❌ Could not find strandtest_nodelay.ino example');
    process.exit(1);
}

console.log('✅ Found strandtest_nodelay.ino example');

// Exact simulation of the playground's displayCommand function
function simulatePlaygroundDisplay(command) {
    // Exact same filtering logic as playground
    if (!command || command.type === undefined || command.type === 'LIBRARY_OBJECT_INSTANTIATION') {
        return null; // Skip invalid commands and redundant library instantiation
    }
    
    const time = command.timestamp ? new Date(command.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    let content = `[${time}] `;
    
    switch (command.type) {
        case 'PIN_MODE':
            const modeNames = {0: 'INPUT', 1: 'OUTPUT', 2: 'INPUT_PULLUP'};
            const modeName = modeNames[command.mode] || command.mode;
            content += `pinMode(${command.pin}, ${modeName})`;
            break;
        case 'DIGITAL_WRITE':
            const valueName = command.value === 1 ? 'HIGH' : (command.value === 0 ? 'LOW' : command.value);
            content += `digitalWrite(${command.pin}, ${valueName})`;
            break;
        case 'ANALOG_WRITE':
            content += `analogWrite(${command.pin}, ${command.value})`;
            break;
        case 'DIGITAL_READ':
            content += `digitalRead(${command.pin})`;
            break;
        case 'ANALOG_READ':
            content += `analogRead(${command.pin})`;
            break;
        case 'DELAY':
            content += `delay(${command.duration})`;
            break;
        case 'DELAY_MICROSECONDS':
            content += `delayMicroseconds(${command.duration})`;
            break;
        case 'VERSION_INFO':
            content += `🔢 ${command.component} v${command.version} (${command.status})`;
            break;
        case 'SETUP_START':
        case 'SETUP_END':
        case 'LOOP_START':
        case 'LOOP_END':
        case 'PROGRAM_START':
        case 'PROGRAM_END':
            content += `${command.message || command.type}`;
            break;
        case 'FUNCTION_CALL':
            if (command.function === 'loop') {
                if (command.completed) {
                    content += `✓ ${command.message}`;
                } else {
                    content += `▶ ${command.message}`;
                }
            } else {
                content += `${command.function}(${command.arguments ? command.arguments.join(', ') : ''})`;
            }
            break;
        case 'CONDITION_EVAL':
            content += `🔍 ${command.message}`;
            break;
        case 'VAR_SET':
            // Improve object display formatting
            let displayValue = command.value;
            if (typeof displayValue === 'object' && displayValue !== null) {
                // Handle sanitized ArduinoObjects
                if (displayValue.__type === 'ArduinoObject') {
                    const args = displayValue.constructorArgs.length > 0 ? 
                        `(${displayValue.constructorArgs.join(', ')})` : '()';
                    displayValue = `🔧 ${displayValue.className}${args}`;
                } else if (displayValue.toString && displayValue.toString() !== '[object Object]') {
                    displayValue = displayValue.toString();
                } else if (displayValue.value !== undefined) {
                    displayValue = displayValue.value; // Extract value from ArduinoNumber, etc.
                } else {
                    displayValue = JSON.stringify(displayValue);
                }
            }
            content += `${command.variable} = ${displayValue}`;
            break;
        case 'IF_STATEMENT':
            content += `if (${command.condition}) ${command.result ? '✓' : '✗'} → ${command.branch} branch`;
            break;
        case 'SWITCH_STATEMENT':
            content += `${command.message}`;
            break;
        case 'SWITCH_CASE':
            content += `case ${command.caseValue}: ${command.matched ? '✓ matched' : '✗ skipped'}`;
            break;
        case 'FOR_LOOP':
            content += `${command.message}`;
            break;
        case 'WHILE_LOOP':
            content += `${command.message}`;
            break;
        case 'DO_WHILE_LOOP':
            content += `${command.message}`;
            break;
        case 'BREAK_STATEMENT':
            content += `${command.message}`;
            break;
        case 'CONTINUE_STATEMENT':
            content += `${command.message}`;
            break;
        case 'ERROR':
            content += command.severity === 'error' ? `❌ ERROR: ${command.message}` : `ERROR: ${command.message}`;
            break;
        case 'WARNING':
            content += command.severity === 'warning' ? `⚠️ WARNING: ${command.message}` : `⚠️ WARNING: ${command.message}`;
            break;
        case 'LIBRARY_STATIC_METHOD_CALL':
            const staticDisplayName = command.variableName || command.library;
            if (command.calculatedValue !== undefined) {
                content += `${staticDisplayName}.${command.method}(${command.args.join(', ')}) → ${command.calculatedValue}`;
            } else {
                content += `${staticDisplayName}.${command.method}(${command.args.join(', ')})`;
            }
            break;
        case 'LIBRARY_METHOD_CALL':
            const displayName = command.variableName || command.library;
            content += `${displayName}.${command.method}(${command.args.join(', ')})`;
            break;
        case 'LIBRARY_METHOD_INTERNAL':
            // Handle internal method with calculated result
            const internalDisplayName = command.variableName || command.library;
            content += `${internalDisplayName}.${command.method}(${command.args.join(', ')}) → ${command.result}`;
            break;
        case 'LIBRARY_METHOD_REQUEST':
            content += `⏳ Requesting ${command.library}.${command.method}()...`;
            break;
        case 'ANALOG_READ_REQUEST':
            content += `analogRead(${command.pin})`;
            break;
        case 'DIGITAL_READ_REQUEST':
            content += `digitalRead(${command.pin})`;
            break;
        case 'MILLIS_REQUEST':
            content += `millis()`;
            break;
        case 'MICROS_REQUEST':
            content += `micros()`;
            break;
        case 'AVR_FUNCTION_CALL':
            content += `${command.function}(${command.args.join(', ')})`;
            break;
        default:
            // Handle VERSION_INFO with new clean format
            if (command.type === 'VERSION_INFO') {
                if (command.component === 'interpreter') {
                    content += `🤖 Arduino Interpreter v${command.version} ${command.status}`;
                } else if (command.component === 'parser') {
                    content += `📝 Using Parser v${command.version}`;
                } else {
                    content += `${command.component} v${command.version} ${command.status}`;
                }
            } else if (command.type === 'SWITCH_CASE') {
                content += `case ${command.caseValue}: ${command.matched ? '✓ matched' : '✗ skipped'}`;
            } else if (command.type === 'BREAK_STATEMENT' && command.action) {
                content += `break; ✓ ${command.action.replace('_', ' ')}`;
            } else if (command.type === 'IF_STATEMENT' && command.branch) {
                content += `if (${command.condition}) ${command.result ? '✓' : '✗'} → ${command.branch} branch`;
            } else {
                // Improved fallback handling - avoid JSON pollution
                if (command.message) {
                    content += command.message;
                } else if (command.type) {
                    content += `${command.type}`;
                } else {
                    // Last resort - but filter out truly unhelpful content
                    const jsonStr = JSON.stringify(command);
                    if (jsonStr && jsonStr !== '{}' && jsonStr !== 'null' && jsonStr !== 'undefined') {
                        content += jsonStr;
                    } else {
                        return null; // Skip completely unhelpful commands
                    }
                }
            }
    }
    
    return content;
}

// Run the test
async function runPlaygroundSimulationTest() {
    try {
        console.log('\\n🚀 Parsing strandtest_nodelay.ino...');
        const ast = parse(strandtestNodelay.content);
        
        console.log('✅ Parsed successfully');
        console.log('\\n🧪 Creating interpreter with loop limit 2...');
        
        const interpreter = new ASTInterpreter(ast, { 
            verbose: false,
            stepDelay: 0,
            maxLoopIterations: 2  // Same as user's output
        });
        
        // Capture all commands and analyze their display
        const capturedCommands = [];
        const undefinedCommands = [];
        
        interpreter.onCommand = (command) => {
            capturedCommands.push(command);
            
            // Handle async requests like millis()
            if (command.type === 'MILLIS_REQUEST') {
                setTimeout(() => {
                    interpreter.handleResponse(command.requestId, Date.now());
                }, 1);
            }
            
            // Simulate playground display
            const displayResult = simulatePlaygroundDisplay(command);
            
            if (displayResult === null) {
                // Command was filtered out
                return;
            }
            
            // Check if the display result contains "undefined"
            if (displayResult.includes('undefined')) {
                undefinedCommands.push({
                    command: command,
                    displayResult: displayResult
                });
                console.log(`\\n❌ UNDEFINED DISPLAY DETECTED:`);
                console.log(`   Command Type: ${command.type}`);
                console.log(`   Display Result: "${displayResult}"`);
                console.log(`   Command Details: ${JSON.stringify(command, null, 2)}`);
            }
        };
        
        // Suppress console during execution
        const originalLog = console.log;
        console.log = (...args) => {
            // Allow our debug output
            if (args[0] && (args[0].includes('❌') || args[0].includes('🔍') || args[0].includes('✅'))) {
                originalLog(...args);
            }
        };
        
        console.log('\\n▶ Starting interpreter execution...');
        interpreter.start();
        
        // Restore console
        console.log = originalLog;
        
        // Wait for execution to complete
        setTimeout(() => {
            console.log(`\\n📊 EXECUTION COMPLETE`);
            console.log(`====================`);
            console.log(`Total commands captured: ${capturedCommands.length}`);
            console.log(`Commands causing undefined display: ${undefinedCommands.length}`);
            
            if (undefinedCommands.length > 0) {
                console.log('\\n🚨 UNDEFINED COMMAND SUMMARY:');
                console.log('==============================');
                
                undefinedCommands.forEach((entry, idx) => {
                    console.log(`\\n${idx + 1}. Type: ${entry.command.type}`);
                    console.log(`   Display: "${entry.displayResult}"`);
                    
                    // Identify the specific issue
                    if (entry.command.message === undefined) {
                        console.log(`   Issue: Missing 'message' field`);
                    }
                    if (entry.command.type === undefined) {
                        console.log(`   Issue: Missing 'type' field`);
                    }
                });
                
                console.log('\\n🔧 These are the exact commands that need to be fixed in the interpreter!');
            } else {
                console.log('\\n✅ No undefined commands found - this suggests the issue might be elsewhere');
            }
            
        }, 500);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
runPlaygroundSimulationTest();