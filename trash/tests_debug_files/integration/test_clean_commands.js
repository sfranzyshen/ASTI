#!/usr/bin/env node

/**
 * Test Clean Commands - Verify interpreter emits structured data without formatting
 */

console.log('🔬 Testing Clean Command Emission');
console.log('=================================');

const { parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');

// Simple test to capture raw commands
const testCode = `
void setup() {
  Serial.begin(9600);
  if (true) {
    int x = 5;
  }
}
`;

async function testCleanCommands() {
    try {
        const ast = parse(testCode);
        const interpreter = new ASTInterpreter(ast, { 
            verbose: false, 
            stepDelay: 0, 
            maxLoopIterations: 1
        });
        
        const commands = [];
        let versionCommand = null;
        let ifCommand = null;
        
        interpreter.onCommand = (command) => {
            commands.push(command);
            
            if (command.type === 'VERSION_INFO' && command.component === 'interpreter') {
                versionCommand = command;
            }
            if (command.type === 'IF_STATEMENT') {
                ifCommand = command;
            }
        };
        
        interpreter.start();
        
        // Wait a moment for execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`📊 Total commands: ${commands.length}`);
        
        // Test VERSION_INFO command structure
        if (versionCommand) {
            console.log('\n✅ VERSION_INFO Command Structure:');
            console.log('  Raw command:', JSON.stringify(versionCommand, null, 2));
            
            // Verify clean structure
            const hasCleanStructure = (
                versionCommand.component === 'interpreter' &&
                versionCommand.version &&
                versionCommand.status === 'started' &&
                !versionCommand.message?.includes('🤖') // No emojis in raw data
            );
            console.log(`  Clean structure: ${hasCleanStructure ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        // Test IF_STATEMENT command structure  
        if (ifCommand) {
            console.log('\n✅ IF_STATEMENT Command Structure:');
            console.log('  Raw command:', JSON.stringify(ifCommand, null, 2));
            
            // Verify clean structure
            const hasCleanStructure = (
                ifCommand.condition !== undefined &&
                ifCommand.result !== undefined &&
                ifCommand.branch &&
                !ifCommand.message?.includes('✓') // No emoji formatting
            );
            console.log(`  Clean structure: ${hasCleanStructure ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        // Check for any remaining formatted messages
        let hasFormattingIssues = false;
        for (const cmd of commands) {
            const cmdStr = JSON.stringify(cmd);
            if (cmdStr.includes('🤖') || cmdStr.includes('📝') || cmdStr.includes('⚠️') || cmdStr.includes('❌')) {
                console.log(`\n❌ Found formatting in command: ${cmd.type}`);
                console.log(`  Command: ${cmdStr.substring(0, 100)}...`);
                hasFormattingIssues = true;
            }
        }
        
        if (!hasFormattingIssues) {
            console.log('\n✅ NO FORMATTING FOUND IN RAW COMMANDS');
        }
        
        console.log('\n🎯 CLEAN COMMAND TEST COMPLETED');
        console.log('===============================');
        console.log(`✅ Commands emit structured data only: ${!hasFormattingIssues ? 'PASS' : 'FAIL'}`);
        console.log('✅ Parent app can format commands as needed: READY');
        
        process.exit(hasFormattingIssues ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testCleanCommands();