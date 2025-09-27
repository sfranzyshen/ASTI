#!/usr/bin/env node

/**
 * Test the fix for state machine functions stopping execution
 */

const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

console.log('🔧 TESTING STATE MACHINE EXECUTION FIX');
console.log('=====================================');

async function testStateMachineFix(functionName, testCode) {
    console.log(`\n📋 Testing ${functionName} execution fix:`);
    console.log('---------------------------------------');
    
    const ast = parse(testCode);
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false,
        maxLoopIterations: 2
    });
    
    let commands = [];
    let requests = 0;
    let responses = 0;
    let executionCompleted = false;
    
    interpreter.onCommand = (command) => {
        commands.push(command.type);
        console.log(`📡 ${command.type}${command.requestId ? ' (' + command.requestId + ')' : ''}`);
        
        if (command.type.endsWith('_REQUEST')) {
            requests++;
            
            // Mock response based on function type with playground-style delay
            let mockValue;
            if (command.type === 'DIGITAL_READ_REQUEST') mockValue = 1;
            else if (command.type === 'ANALOG_READ_REQUEST') mockValue = 512;
            else if (command.type === 'MILLIS_REQUEST') mockValue = 1000;
            else if (command.type === 'MICROS_REQUEST') mockValue = 1000000;
            else mockValue = 0;
            
            setTimeout(() => {
                responses++;
                console.log(`   📤 Sending response: ${mockValue}`);
                interpreter.resumeWithValue(command.requestId, mockValue);
            }, 1); // Same 1ms delay as playground
        }
        
        if (command.type === 'PROGRAM_END') {
            executionCompleted = true;
        }
    };
    
    console.log('Starting execution...');
    await interpreter.start();
    
    // Wait for execution to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Execution completed: ${executionCompleted}`);
    console.log(`✅ Requests sent: ${requests}`);
    console.log(`✅ Responses given: ${responses}`);
    console.log(`✅ Total commands: ${commands.length}`);
    
    // Check if execution continued after external function calls
    const hasVarSet = commands.includes('VAR_SET');
    const hasSerial = commands.includes('FUNCTION_CALL');
    const continuedExecution = hasVarSet && hasSerial && executionCompleted;
    
    console.log(`✅ Continued execution after ${functionName}: ${continuedExecution ? '✅' : '❌'}`);
    
    return { continuedExecution, requests, responses, executionCompleted };
}

async function runAllTests() {
    const tests = [
        {
            name: 'digitalRead',
            code: `void setup() {} void loop() { int val = digitalRead(2); Serial.println(val); }`
        },
        {
            name: 'analogRead',
            code: `void setup() {} void loop() { int val = analogRead(A0); Serial.println(val); }`
        },
        {
            name: 'millis',
            code: `void setup() {} void loop() { unsigned long val = millis(); Serial.println(val); }`
        },
        {
            name: 'micros',
            code: `void setup() {} void loop() { unsigned long val = micros(); Serial.println(val); }`
        }
    ];
    
    let results = {};
    for (const test of tests) {
        results[test.name] = await testStateMachineFix(test.name, test.code);
    }
    
    console.log('\n🎯 EXECUTION FIX SUMMARY:');
    console.log('=========================');
    
    for (const [name, result] of Object.entries(results)) {
        const working = result.continuedExecution && result.requests > 0 && result.responses === result.requests;
        console.log(`${name}: ${working ? '✅ EXECUTION CONTINUES' : '❌ EXECUTION STOPS'} (${result.requests} req, ${result.responses} resp)`);
    }
    
    return results;
}

runAllTests().then(results => {
    const allWorking = Object.values(results).every(r => 
        r.continuedExecution && r.requests > 0 && r.responses === r.requests
    );
    
    console.log(`\n🏆 Overall: ${allWorking ? '✅ ALL FUNCTIONS FIXED' : '❌ SOME FUNCTIONS STILL BROKEN'}`);
    
    if (allWorking) {
        console.log('\n🎉 SUCCESS! All external data functions now continue execution!');
        console.log('   - digitalRead: No longer stops execution dead ✅');
        console.log('   - millis: No longer stops execution dead ✅');
        console.log('   - micros: No longer stops execution dead ✅');
        console.log('   - analogRead: Still working as before ✅');
    }
    
    process.exit(allWorking ? 0 : 1);
}).catch(error => {
    console.error('💥 Test error:', error);
    process.exit(1);
});