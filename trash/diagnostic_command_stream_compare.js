#!/usr/bin/env node

/**
 * Command Stream Diagnostic Tool
 * Compares JavaScript and C++ command streams for specific test cases
 * Focus: Identify exact differences between JS and C++ interpreter outputs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import required components
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');

class CommandStreamDiagnostic {
    constructor() {
        this.testDataDir = './test_data';
        this.cppExecutable = './test_interpreter_integration';
    }

    /**
     * Load test case by example number or name
     */
    loadTestCase(identifier) {
        let testFile;
        
        if (typeof identifier === 'number') {
            testFile = `example_${identifier.toString().padStart(3, '0')}`;
        } else if (identifier.includes('.ino')) {
            // Search by name in meta files
            const files = fs.readdirSync(this.testDataDir).filter(f => f.endsWith('.meta'));
            for (const file of files) {
                const metaPath = path.join(this.testDataDir, file);
                const meta = fs.readFileSync(metaPath, 'utf8');
                if (meta.includes(`name=${identifier}`)) {
                    testFile = file.replace('.meta', '');
                    break;
                }
            }
        } else {
            testFile = identifier;
        }

        if (!testFile) {
            throw new Error(`Test case not found: ${identifier}`);
        }

        const metaPath = path.join(this.testDataDir, `${testFile}.meta`);
        const astPath = path.join(this.testDataDir, `${testFile}.ast`);
        const commandsPath = path.join(this.testDataDir, `${testFile}.commands`);

        if (!fs.existsSync(metaPath) || !fs.existsSync(astPath)) {
            throw new Error(`Test files not found for: ${testFile}`);
        }

        const meta = this.parseMeta(fs.readFileSync(metaPath, 'utf8'));
        const astData = fs.readFileSync(astPath);
        const existingCommands = fs.existsSync(commandsPath) 
            ? JSON.parse(fs.readFileSync(commandsPath, 'utf8'))
            : null;

        return {
            testFile,
            meta,
            astData,
            existingCommands,
            arduinoCode: meta.content
        };
    }

    parseMeta(metaContent) {
        const meta = {};
        const lines = metaContent.split('\n');
        
        for (const line of lines) {
            if (line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                meta[key] = valueParts.join('=');
            }
        }
        
        return meta;
    }

    /**
     * Run JavaScript interpreter on test case
     */
    async runJavaScriptInterpreter(testCase) {
        console.log(`\n=== Running JavaScript Interpreter on ${testCase.meta.name} ===`);
        
        try {
            // Parse the Arduino code fresh to ensure clean AST
            const ast = parse(testCase.arduinoCode);
            
            // Create interpreter with same settings as C++
            const interpreter = new ASTInterpreter(ast, {
                maxLoopIterations: 1,  // Match C++ setting
                timeout: 5000,
                enableDebug: false
            });
            
            // Set up command capture
            const commands = [];
            interpreter.onCommand = (command) => {
                commands.push(command);
            };
            
            // Execute and capture commands
            const startTime = Date.now();
            await interpreter.start();
            const executionTime = Date.now() - startTime;
            
            // commands already captured via onCommand callback
            
            console.log(`JavaScript execution completed in ${executionTime}ms`);
            console.log(`Generated ${commands.length} commands`);
            
            return {
                success: true,
                commands,
                executionTime,
                commandCount: commands.length
            };
            
        } catch (error) {
            console.error('JavaScript interpreter error:', error.message);
            return {
                success: false,
                error: error.message,
                commands: [],
                executionTime: 0,
                commandCount: 0
            };
        }
    }

    /**
     * Run C++ interpreter on test case
     */
    runCppInterpreter(testCase) {
        console.log(`\n=== Running C++ Interpreter on ${testCase.meta.name} ===`);
        
        try {
            // Save AST to temporary file
            const tempAstFile = path.join(this.testDataDir, 'temp_diagnostic.ast');
            fs.writeFileSync(tempAstFile, testCase.astData);
            
            // Execute C++ interpreter
            const startTime = Date.now();
            const output = execSync(`${this.cppExecutable} "${tempAstFile}"`, {
                encoding: 'utf8',
                timeout: 10000,
                maxBuffer: 1024 * 1024
            });
            const executionTime = Date.now() - startTime;
            
            // Clean up temp file
            fs.unlinkSync(tempAstFile);
            
            // Parse C++ output - it should be JSON command stream
            let commands;
            try {
                commands = JSON.parse(output.trim());
                if (!Array.isArray(commands)) {
                    throw new Error('Expected array of commands');
                }
            } catch (parseError) {
                console.error('Failed to parse C++ output as JSON:', parseError.message);
                console.log('Raw C++ output:', output.substring(0, 500) + '...');
                return {
                    success: false,
                    error: 'Failed to parse C++ output',
                    commands: [],
                    executionTime,
                    commandCount: 0,
                    rawOutput: output
                };
            }
            
            console.log(`C++ execution completed in ${executionTime}ms`);
            console.log(`Generated ${commands.length} commands`);
            
            return {
                success: true,
                commands,
                executionTime,
                commandCount: commands.length
            };
            
        } catch (error) {
            console.error('C++ interpreter error:', error.message);
            return {
                success: false,
                error: error.message,
                commands: [],
                executionTime: 0,
                commandCount: 0
            };
        }
    }

    /**
     * Compare command streams in detail
     */
    compareCommandStreams(jsResult, cppResult) {
        console.log('\n=== Detailed Command Stream Comparison ===');
        
        const jsCommands = jsResult.commands || [];
        const cppCommands = cppResult.commands || [];
        
        console.log(`JavaScript commands: ${jsCommands.length}`);
        console.log(`C++ commands: ${cppCommands.length}`);
        
        // Basic similarity metrics
        const lengthDiff = Math.abs(jsCommands.length - cppCommands.length);
        const maxLength = Math.max(jsCommands.length, cppCommands.length);
        const lengthSimilarity = maxLength > 0 ? ((maxLength - lengthDiff) / maxLength) * 100 : 100;
        
        console.log(`Length similarity: ${lengthSimilarity.toFixed(1)}%`);
        
        const differences = {
            lengthDifference: lengthDiff,
            jsOnlyCommands: [],
            cppOnlyCommands: [],
            mismatchedCommands: [],
            commonCommands: 0
        };
        
        // Compare command by command
        const minLength = Math.min(jsCommands.length, cppCommands.length);
        
        for (let i = 0; i < minLength; i++) {
            const jsCmd = jsCommands[i];
            const cppCmd = cppCommands[i];
            
            if (this.commandsEqual(jsCmd, cppCmd)) {
                differences.commonCommands++;
            } else {
                differences.mismatchedCommands.push({
                    index: i,
                    javascript: jsCmd,
                    cpp: cppCmd,
                    reason: this.findCommandDifference(jsCmd, cppCmd)
                });
            }
        }
        
        // Extra commands in JavaScript
        if (jsCommands.length > cppCommands.length) {
            for (let i = minLength; i < jsCommands.length; i++) {
                differences.jsOnlyCommands.push({
                    index: i,
                    command: jsCommands[i]
                });
            }
        }
        
        // Extra commands in C++
        if (cppCommands.length > jsCommands.length) {
            for (let i = minLength; i < cppCommands.length; i++) {
                differences.cppOnlyCommands.push({
                    index: i,
                    command: cppCommands[i]
                });
            }
        }
        
        return differences;
    }

    /**
     * Check if two commands are equal (ignoring timestamps)
     */
    commandsEqual(cmd1, cmd2) {
        if (!cmd1 || !cmd2) return false;
        
        // Create copies without timestamps for comparison
        const clean1 = { ...cmd1 };
        const clean2 = { ...cmd2 };
        delete clean1.timestamp;
        delete clean2.timestamp;
        
        return JSON.stringify(clean1) === JSON.stringify(clean2);
    }

    /**
     * Find specific differences between two commands
     */
    findCommandDifference(cmd1, cmd2) {
        const reasons = [];
        
        if (cmd1.type !== cmd2.type) {
            reasons.push(`type: '${cmd1.type}' vs '${cmd2.type}'`);
        }
        
        if (cmd1.message !== cmd2.message) {
            reasons.push(`message: '${cmd1.message}' vs '${cmd2.message}'`);
        }
        
        // Check other significant fields
        const significantFields = ['function', 'iteration', 'iterations', 'completed', 'limitReached'];
        for (const field of significantFields) {
            if (cmd1[field] !== cmd2[field]) {
                reasons.push(`${field}: '${cmd1[field]}' vs '${cmd2[field]}'`);
            }
        }
        
        return reasons.length > 0 ? reasons.join(', ') : 'unknown difference';
    }

    /**
     * Print detailed comparison report
     */
    printComparisonReport(testCase, jsResult, cppResult, differences) {
        console.log('\n' + '='.repeat(80));
        console.log(`DIAGNOSTIC REPORT: ${testCase.meta.name}`);
        console.log('='.repeat(80));
        
        console.log('\n📊 EXECUTION SUMMARY:');
        console.log(`JavaScript: ${jsResult.success ? '✅ SUCCESS' : '❌ FAILED'} (${jsResult.executionTime}ms, ${jsResult.commandCount} commands)`);
        console.log(`C++:        ${cppResult.success ? '✅ SUCCESS' : '❌ FAILED'} (${cppResult.executionTime}ms, ${cppResult.commandCount} commands)`);
        
        if (!jsResult.success || !cppResult.success) {
            console.log('\n❌ EXECUTION ERRORS:');
            if (!jsResult.success) console.log(`JavaScript: ${jsResult.error}`);
            if (!cppResult.success) console.log(`C++: ${cppResult.error}`);
            return;
        }
        
        console.log('\n🔍 COMMAND STREAM ANALYSIS:');
        console.log(`Command count difference: ${differences.lengthDifference}`);
        console.log(`Common commands: ${differences.commonCommands}`);
        console.log(`Mismatched commands: ${differences.mismatchedCommands.length}`);
        console.log(`JavaScript-only commands: ${differences.jsOnlyCommands.length}`);
        console.log(`C++-only commands: ${differences.cppOnlyCommands.length}`);
        
        if (differences.mismatchedCommands.length > 0) {
            console.log('\n⚠️ MISMATCHED COMMANDS:');
            differences.mismatchedCommands.forEach((mismatch, idx) => {
                if (idx < 5) { // Limit output
                    console.log(`\n[${mismatch.index}] ${mismatch.reason}`);
                    console.log(`  JS:  ${JSON.stringify(mismatch.javascript, null, 2).substring(0, 200)}`);
                    console.log(`  C++: ${JSON.stringify(mismatch.cpp, null, 2).substring(0, 200)}`);
                }
            });
            if (differences.mismatchedCommands.length > 5) {
                console.log(`... and ${differences.mismatchedCommands.length - 5} more mismatches`);
            }
        }
        
        if (differences.jsOnlyCommands.length > 0) {
            console.log('\n📎 JAVASCRIPT-ONLY COMMANDS:');
            differences.jsOnlyCommands.forEach((cmd, idx) => {
                if (idx < 3) {
                    console.log(`[${cmd.index}] ${JSON.stringify(cmd.command, null, 2).substring(0, 150)}`);
                }
            });
        }
        
        if (differences.cppOnlyCommands.length > 0) {
            console.log('\n📎 C++-ONLY COMMANDS:');
            differences.cppOnlyCommands.forEach((cmd, idx) => {
                if (idx < 3) {
                    console.log(`[${cmd.index}] ${JSON.stringify(cmd.command, null, 2).substring(0, 150)}`);
                }
            });
        }
        
        // Calculate overall similarity
        const totalCommands = Math.max(jsResult.commandCount, cppResult.commandCount);
        const similarityScore = totalCommands > 0 
            ? ((differences.commonCommands / totalCommands) * 100).toFixed(1)
            : '100.0';
            
        console.log('\n🎯 OVERALL SIMILARITY:');
        console.log(`Command stream similarity: ${similarityScore}%`);
        
        // Actionable insights
        console.log('\n💡 ACTIONABLE INSIGHTS:');
        if (differences.lengthDifference === 0 && differences.mismatchedCommands.length === 0) {
            console.log('✅ Perfect match! Both interpreters generate identical command streams.');
        } else {
            if (differences.lengthDifference > 0) {
                console.log(`📏 Address command count difference: ${differences.lengthDifference} commands`);
            }
            if (differences.mismatchedCommands.length > 0) {
                const commonTypes = {};
                differences.mismatchedCommands.forEach(m => {
                    const reason = m.reason.split(',')[0]; // First reason
                    commonTypes[reason] = (commonTypes[reason] || 0) + 1;
                });
                console.log('🔧 Focus areas:', Object.entries(commonTypes)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([reason, count]) => `${reason} (${count}x)`)
                    .join(', '));
            }
        }
    }

    /**
     * Save detailed comparison to file
     */
    saveComparisonData(testCase, jsResult, cppResult, differences) {
        const outputFile = path.join(this.testDataDir, `${testCase.testFile}_diagnostic.json`);
        
        const data = {
            testCase: testCase.meta.name,
            timestamp: new Date().toISOString(),
            javascript: {
                success: jsResult.success,
                commandCount: jsResult.commandCount,
                executionTime: jsResult.executionTime,
                commands: jsResult.commands
            },
            cpp: {
                success: cppResult.success,
                commandCount: cppResult.commandCount,
                executionTime: cppResult.executionTime,
                commands: cppResult.commands
            },
            analysis: differences
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
        console.log(`\n💾 Detailed comparison saved to: ${outputFile}`);
    }

    /**
     * Main diagnostic function
     */
    async diagnose(testIdentifier) {
        try {
            console.log(`🔍 Starting diagnostic for: ${testIdentifier}`);
            
            // Load test case
            const testCase = this.loadTestCase(testIdentifier);
            console.log(`Loaded test case: ${testCase.meta.name}`);
            console.log(`Arduino code length: ${testCase.arduinoCode.length} characters`);
            
            // Run both interpreters
            const jsResult = await this.runJavaScriptInterpreter(testCase);
            const cppResult = this.runCppInterpreter(testCase);
            
            // Compare results
            const differences = this.compareCommandStreams(jsResult, cppResult);
            
            // Print detailed report
            this.printComparisonReport(testCase, jsResult, cppResult, differences);
            
            // Save detailed data
            this.saveComparisonData(testCase, jsResult, cppResult, differences);
            
            return {
                testCase,
                jsResult,
                cppResult,
                differences
            };
            
        } catch (error) {
            console.error('Diagnostic failed:', error.message);
            throw error;
        }
    }
}

// Main execution
if (require.main === module) {
    const diagnostic = new CommandStreamDiagnostic();
    
    // Parse command line arguments
    const testIdentifier = process.argv[2] || 'BareMinimum.ino';
    
    console.log('Command Stream Diagnostic Tool');
    console.log('==============================');
    
    diagnostic.diagnose(testIdentifier)
        .then(result => {
            console.log('\n🎉 Diagnostic completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Diagnostic failed:', error.message);
            process.exit(1);
        });
}

module.exports = { CommandStreamDiagnostic };