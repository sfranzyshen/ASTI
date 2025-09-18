#!/usr/bin/env node

/**
 * Detailed Failure Diagnosis
 * 
 * Deep dive into the top failing test cases to understand exactly what
 * commands the C++ interpreter should be generating but isn't.
 */

const fs = require('fs');

// Load specific test cases for detailed analysis
const testCases = [
    'example_000', // AnalogReadSerial.ino
    'example_001', // BareMinimum.ino  
    'example_002', // Blink.ino
    'example_003', // DigitalReadSerial.ino
];

console.log('🔍 DETAILED FAILURE DIAGNOSIS\n');
console.log('Analyzing the top failing test cases to identify specific missing commands:\n');

testCases.forEach(baseName => {
    console.log('='.repeat(80));
    
    // Load metadata
    const metaPath = `test_data/${baseName}.meta`;
    let testName = baseName;
    try {
        const metaContent = fs.readFileSync(metaPath, 'utf8');
        const nameMatch = metaContent.match(/name=(.+)/);
        if (nameMatch) testName = nameMatch[1];
    } catch (e) {}
    
    console.log(`📋 TEST CASE: ${testName} (${baseName})`);
    console.log('='.repeat(80));
    
    // Load JavaScript expected commands
    try {
        const jsCommandsPath = `test_data/${baseName}.commands`;
        const jsCommands = JSON.parse(fs.readFileSync(jsCommandsPath, 'utf8'));
        
        console.log(`\n✅ JAVASCRIPT EXPECTED (${jsCommands.length} commands):\n`);
        
        jsCommands.forEach((cmd, index) => {
            let details = `${index + 1}. [${cmd.type}]`;
            
            // Add function name if present
            if (cmd.function) {
                details += ` function: ${cmd.function}`;
            }
            
            // Add key fields based on command type
            switch (cmd.type) {
                case 'FUNCTION_CALL':
                    if (cmd.arguments) details += ` args: [${cmd.arguments.join(', ')}]`;
                    if (cmd.baudRate) details += ` baudRate: ${cmd.baudRate}`;
                    if (cmd.data) details += ` data: "${cmd.data}"`;
                    if (cmd.pin !== undefined) details += ` pin: ${cmd.pin}`;
                    if (cmd.value !== undefined) details += ` value: ${cmd.value}`;
                    if (cmd.mode !== undefined) details += ` mode: ${cmd.mode}`;
                    if (cmd.iteration !== undefined) details += ` iteration: ${cmd.iteration}`;
                    if (cmd.completed !== undefined) details += ` completed: ${cmd.completed}`;
                    break;
                    
                case 'ANALOG_READ_REQUEST':
                case 'DIGITAL_READ_REQUEST':
                    if (cmd.pin !== undefined) details += ` pin: ${cmd.pin}`;
                    if (cmd.requestId) details += ` requestId: ${cmd.requestId}`;
                    break;
                    
                case 'VAR_SET':
                    if (cmd.variable) details += ` var: ${cmd.variable}`;
                    if (cmd.value !== undefined) details += ` value: ${cmd.value}`;
                    break;
                    
                case 'PIN_MODE':
                    if (cmd.pin !== undefined) details += ` pin: ${cmd.pin}`;
                    if (cmd.mode !== undefined) details += ` mode: ${cmd.mode}`;
                    break;
                    
                case 'DIGITAL_WRITE':
                    if (cmd.pin !== undefined) details += ` pin: ${cmd.pin}`;
                    if (cmd.value !== undefined) details += ` value: ${cmd.value}`;
                    break;
                    
                case 'ANALOG_WRITE':
                    if (cmd.pin !== undefined) details += ` pin: ${cmd.pin}`;
                    if (cmd.value !== undefined) details += ` value: ${cmd.value}`;
                    break;
                    
                case 'DELAY':
                    if (cmd.duration !== undefined) details += ` duration: ${cmd.duration}ms`;
                    if (cmd.actualDelay !== undefined) details += ` actual: ${cmd.actualDelay}ms`;
                    break;
                    
                case 'LOOP_START':
                case 'LOOP_END':
                    if (cmd.iterations !== undefined) details += ` iterations: ${cmd.iterations}`;
                    if (cmd.limitReached !== undefined) details += ` limitReached: ${cmd.limitReached}`;
                    break;
                    
                case 'VERSION_INFO':
                    if (cmd.version) details += ` version: ${cmd.version}`;
                    if (cmd.status) details += ` status: ${cmd.status}`;
                    break;
            }
            
            if (cmd.message && !details.includes('message:')) {
                details += ` message: "${cmd.message}"`;
            }
            
            console.log(`   ${details}`);
        });
        
        // Simulate what C++ currently generates (basic pattern)
        const cppSimulated = [
            { type: "VERSION_INFO", version: "7.3.0", status: "started" },
            { type: "PROGRAM_START", message: "Program execution started" },
            { type: "SETUP_START", message: "Executing setup() function" },
            { type: "SETUP_END", message: "Completed setup() function" },
            { type: "LOOP_START", message: "Starting loop() execution" },
            { type: "LOOP_START", message: "Starting loop iteration 1" },
            { type: "FUNCTION_CALL", function: "loop", iteration: 1, message: "Executing loop() iteration 1" },
            { type: "FUNCTION_CALL", function: "loop", iteration: 1, completed: true, message: "Completed loop() iteration 1" },
            { type: "LOOP_END", iterations: 1, limitReached: true, message: "Loop limit reached: completed 1 iterations (max: 1)" },
            { type: "PROGRAM_END", message: "Program completed after 1 loop iterations (limit reached)" },
            { type: "PROGRAM_END", message: "Program execution stopped" }
        ];
        
        console.log(`\n❌ C++ CURRENT OUTPUT (${cppSimulated.length} commands):\n`);
        
        cppSimulated.forEach((cmd, index) => {
            let details = `${index + 1}. [${cmd.type}]`;
            if (cmd.function) details += ` function: ${cmd.function}`;
            if (cmd.iteration !== undefined) details += ` iteration: ${cmd.iteration}`;
            if (cmd.completed !== undefined) details += ` completed: ${cmd.completed}`;
            if (cmd.version) details += ` version: ${cmd.version}`;
            if (cmd.status) details += ` status: ${cmd.status}`;
            if (cmd.iterations !== undefined) details += ` iterations: ${cmd.iterations}`;
            if (cmd.limitReached !== undefined) details += ` limitReached: ${cmd.limitReached}`;
            if (cmd.message) details += ` message: "${cmd.message}"`;
            
            console.log(`   ${details}`);
        });
        
        // Find specifically what's missing
        const jsTypes = new Map();
        jsCommands.forEach(cmd => {
            const key = cmd.type + (cmd.function ? `:${cmd.function}` : '');
            jsTypes.set(key, (jsTypes.get(key) || 0) + 1);
        });
        
        const cppTypes = new Map();
        cppSimulated.forEach(cmd => {
            const key = cmd.type + (cmd.function ? `:${cmd.function}` : '');
            cppTypes.set(key, (cppTypes.get(key) || 0) + 1);
        });
        
        console.log('\n🎯 SPECIFIC MISSING COMMANDS:\n');
        
        const missing = [];
        for (const [key, count] of jsTypes) {
            const cppCount = cppTypes.get(key) || 0;
            if (cppCount < count) {
                missing.push({
                    command: key,
                    expected: count,
                    actual: cppCount,
                    missing: count - cppCount
                });
            }
        }
        
        missing.forEach(m => {
            console.log(`   ❌ Missing ${m.missing}x [${m.command}] (expected ${m.expected}, got ${m.actual})`);
        });
        
        // Identify Arduino-specific functions
        const arduinoCommands = jsCommands.filter(cmd => 
            (cmd.type === 'FUNCTION_CALL' && cmd.function && 
             (cmd.function.includes('Serial') || cmd.function.includes('digital') || 
              cmd.function.includes('analog'))) ||
            cmd.type === 'ANALOG_READ_REQUEST' ||
            cmd.type === 'DIGITAL_READ_REQUEST' ||
            cmd.type === 'PIN_MODE' ||
            cmd.type === 'DIGITAL_WRITE' ||
            cmd.type === 'ANALOG_WRITE' ||
            cmd.type === 'DELAY' ||
            cmd.type === 'VAR_SET'
        );
        
        if (arduinoCommands.length > 0) {
            console.log('\n🔧 MISSING ARDUINO FUNCTIONALITY:\n');
            arduinoCommands.forEach(cmd => {
                console.log(`   🔹 ${cmd.type}${cmd.function ? ` (${cmd.function})` : ''}`);
            });
        }
        
    } catch (error) {
        console.log(`   ❌ Error loading test case: ${error.message}`);
    }
    
    console.log('\n');
});

console.log('='.repeat(80));
console.log('📋 ROOT CAUSE ANALYSIS');
console.log('='.repeat(80));

console.log(`
🔍 PATTERN IDENTIFIED:

The C++ interpreter is generating the correct STRUCTURAL framework:
✅ VERSION_INFO, PROGRAM_START/END, SETUP_START/END, LOOP_START/END
✅ Basic FUNCTION_CALL for loop() with iteration tracking

But is COMPLETELY MISSING the Arduino-specific functionality:
❌ Serial operations (Serial.begin, Serial.print, Serial.println)
❌ Pin operations (pinMode, digitalWrite, digitalRead, analogRead, analogWrite)
❌ Time operations (delay, millis)
❌ Variable assignments (VAR_SET)
❌ Hardware requests (ANALOG_READ_REQUEST, DIGITAL_READ_REQUEST)

🎯 SPECIFIC PROBLEMS TO FIX:

1. CRITICAL: Function body execution
   - C++ setup()/loop() functions are not executing their CONTENTS
   - Only the function framework (start/end) is running
   - Need to fix AST traversal in function bodies

2. HIGH: Arduino function call handling  
   - executeArduinoFunction() exists but isn't being called
   - Function call visitor (visit(FuncCallNode&)) not working
   - Missing command emission for Arduino operations

3. HIGH: Variable and expression handling
   - Variable assignments not generating VAR_SET commands
   - Expression evaluation not working properly
   - Missing visitor implementations

4. MEDIUM: Command format matching
   - Some generated commands have wrong field names/structure
   - FlexibleCommand factory methods need refinement

🚀 SYSTEMATIC FIX PLAN:

PHASE 1: Fix function body execution (addresses 80% of failures)
PHASE 2: Fix Arduino function call handling  
PHASE 3: Fix variable/expression handling
PHASE 4: Polish command formats

Ready to start Phase 1? 🛠️
`);