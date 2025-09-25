#!/usr/bin/env node

/**
 * Simple Command Stream Comparison Tool
 * Compares JavaScript and C++ command streams for BareMinimum.ino
 * Uses existing debug files and fresh JavaScript execution
 */

const fs = require('fs');
const path = require('path');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');

class SimpleCommandComparison {
    constructor() {
        this.testDataDir = './test_data';
    }

    /**
     * Get BareMinimum.ino Arduino code
     */
    getBareMinimumCode() {
        // BareMinimum.ino content
        return `void setup() {
  // put your setup code here, to run once:
}

void loop() {
  // put your main code here, to run repeatedly:
}`;
    }

    /**
     * Run fresh JavaScript interpreter on BareMinimum
     */
    async runFreshJavaScript() {
        console.log('=== Running Fresh JavaScript Interpreter ===');
        
        try {
            const arduinoCode = this.getBareMinimumCode();
            const ast = parse(arduinoCode);
            
            // Create interpreter with maxLoopIterations = 1 to match C++
            const interpreter = new ASTInterpreter(ast, {
                maxLoopIterations: 1,
                timeout: 5000,
                enableDebug: false,
                verbose: false
            });
            
            // Capture commands
            const commands = [];
            interpreter.onCommand = (command) => {
                commands.push(command);
            };
            
            // Execute
            const startTime = Date.now();
            await interpreter.start();
            const executionTime = Date.now() - startTime;
            
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
     * Load existing command streams from debug files
     */
    loadExistingStreams() {
        console.log('=== Loading Existing Command Streams ===');
        
        const results = {
            javascript: { success: false, commands: [], source: 'none' },
            cpp: { success: false, commands: [], source: 'none' }
        };
        
        // Try to load JavaScript debug commands
        const jsDebugFile = path.join(this.testDataDir, 'debug_js_commands.json');
        if (fs.existsSync(jsDebugFile)) {
            try {
                const jsCommands = JSON.parse(fs.readFileSync(jsDebugFile, 'utf8'));
                results.javascript = {
                    success: true,
                    commands: jsCommands,
                    commandCount: jsCommands.length,
                    source: 'debug_js_commands.json'
                };
                console.log(`Loaded ${jsCommands.length} JavaScript commands from debug file`);
            } catch (error) {
                console.error('Failed to load JavaScript debug commands:', error.message);
            }
        }
        
        // Try to load C++ debug commands  
        const cppDebugFile = path.join(this.testDataDir, 'debug_cpp_commands.txt');
        if (fs.existsSync(cppDebugFile)) {
            try {
                let cppContent = fs.readFileSync(cppDebugFile, 'utf8').trim();
                
                // Check if file is complete JSON
                if (!cppContent.endsWith(']')) {
                    console.log('Warning: C++ debug file appears to be truncated, attempting to fix...');
                    // Try to fix truncated JSON by closing incomplete objects/arrays
                    const lines = cppContent.split('\n');
                    const lastLine = lines[lines.length - 1].trim();
                    
                    if (lastLine.endsWith(',')) {
                        // Remove trailing comma and close
                        lines[lines.length - 1] = lastLine.slice(0, -1);
                    }
                    
                    if (!cppContent.includes(']}')) {
                        lines.push('}');
                    }
                    lines.push(']');
                    
                    cppContent = lines.join('\n');
                }
                
                const cppCommands = JSON.parse(cppContent);
                results.cpp = {
                    success: true,
                    commands: cppCommands,
                    commandCount: cppCommands.length,
                    source: 'debug_cpp_commands.txt'
                };
                console.log(`Loaded ${cppCommands.length} C++ commands from debug file`);
            } catch (error) {
                console.error('Failed to load C++ debug commands:', error.message);
                console.log('Note: C++ debug file may be incomplete. Run cross-platform validation to generate complete output.');
            }
        }
        
        // Try to load BareMinimum commands from example_001
        const bareMinimumCommands = path.join(this.testDataDir, 'example_001.commands');
        if (fs.existsSync(bareMinimumCommands) && !results.javascript.success) {
            try {
                const commands = JSON.parse(fs.readFileSync(bareMinimumCommands, 'utf8'));
                results.javascript = {
                    success: true,
                    commands: commands,
                    commandCount: commands.length,
                    source: 'example_001.commands'
                };
                console.log(`Loaded ${commands.length} commands from BareMinimum example file`);
            } catch (error) {
                console.error('Failed to load BareMinimum example commands:', error.message);
            }
        }
        
        return results;
    }

    /**
     * Compare two command streams in detail
     */
    compareCommandStreams(stream1, stream2, label1 = 'Stream 1', label2 = 'Stream 2') {
        console.log(`\n=== Comparing ${label1} vs ${label2} ===`);
        
        const commands1 = stream1.commands || [];
        const commands2 = stream2.commands || [];
        
        console.log(`${label1}: ${commands1.length} commands`);
        console.log(`${label2}: ${commands2.length} commands`);
        
        const analysis = {
            lengthDifference: Math.abs(commands1.length - commands2.length),
            commonCommands: 0,
            mismatchedCommands: [],
            stream1OnlyCommands: [],
            stream2OnlyCommands: []
        };
        
        const minLength = Math.min(commands1.length, commands2.length);
        
        // Compare command by command
        for (let i = 0; i < minLength; i++) {
            const cmd1 = commands1[i];
            const cmd2 = commands2[i];
            
            if (this.commandsEqual(cmd1, cmd2)) {
                analysis.commonCommands++;
            } else {
                analysis.mismatchedCommands.push({
                    index: i,
                    [label1.toLowerCase()]: cmd1,
                    [label2.toLowerCase()]: cmd2,
                    differences: this.findCommandDifferences(cmd1, cmd2)
                });
            }
        }
        
        // Extra commands in stream1
        if (commands1.length > commands2.length) {
            for (let i = minLength; i < commands1.length; i++) {
                analysis.stream1OnlyCommands.push({
                    index: i,
                    command: commands1[i]
                });
            }
        }
        
        // Extra commands in stream2
        if (commands2.length > commands1.length) {
            for (let i = minLength; i < commands2.length; i++) {
                analysis.stream2OnlyCommands.push({
                    index: i,
                    command: commands2[i]
                });
            }
        }
        
        return analysis;
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
    findCommandDifferences(cmd1, cmd2) {
        const differences = [];
        
        const allKeys = new Set([...Object.keys(cmd1 || {}), ...Object.keys(cmd2 || {})]);
        
        for (const key of allKeys) {
            if (key === 'timestamp') continue; // Ignore timestamps
            
            const val1 = cmd1?.[key];
            const val2 = cmd2?.[key];
            
            if (val1 !== val2) {
                differences.push({
                    field: key,
                    value1: val1,
                    value2: val2
                });
            }
        }
        
        return differences;
    }

    /**
     * Print detailed analysis
     */
    printAnalysis(analysis, label1, label2) {
        console.log(`\n📊 ANALYSIS SUMMARY:`);
        console.log(`Command count difference: ${analysis.lengthDifference}`);
        console.log(`Common commands: ${analysis.commonCommands}`);
        console.log(`Mismatched commands: ${analysis.mismatchedCommands.length}`);
        console.log(`${label1}-only commands: ${analysis.stream1OnlyCommands.length}`);
        console.log(`${label2}-only commands: ${analysis.stream2OnlyCommands.length}`);
        
        if (analysis.mismatchedCommands.length > 0) {
            console.log(`\n⚠️  MISMATCHED COMMANDS (showing first 3):`);
            analysis.mismatchedCommands.slice(0, 3).forEach((mismatch, idx) => {
                console.log(`\n[${mismatch.index}] Command differences:`);
                mismatch.differences.forEach(diff => {
                    console.log(`  ${diff.field}: '${diff.value1}' vs '${diff.value2}'`);
                });
            });
        }
        
        if (analysis.stream1OnlyCommands.length > 0) {
            console.log(`\n📌 ${label1}-ONLY COMMANDS:`);
            analysis.stream1OnlyCommands.slice(0, 3).forEach(extra => {
                console.log(`[${extra.index}] ${extra.command.type}: ${extra.command.message || ''}`);  
            });
        }
        
        if (analysis.stream2OnlyCommands.length > 0) {
            console.log(`\n📌 ${label2}-ONLY COMMANDS:`);
            analysis.stream2OnlyCommands.slice(0, 3).forEach(extra => {
                console.log(`[${extra.index}] ${extra.command.type}: ${extra.command.message || ''}`);  
            });
        }
        
        // Calculate similarity
        const totalCommands = Math.max(
            (analysis.stream1OnlyCommands.length || 0) + analysis.commonCommands + analysis.mismatchedCommands.length,
            (analysis.stream2OnlyCommands.length || 0) + analysis.commonCommands + analysis.mismatchedCommands.length
        );
        
        const similarity = totalCommands > 0 ? ((analysis.commonCommands / totalCommands) * 100).toFixed(1) : '100.0';
        console.log(`\n🎯 SIMILARITY SCORE: ${similarity}%`);
        
        return parseFloat(similarity);
    }

    /**
     * Main comparison function
     */
    async runComparison() {
        console.log('🔍 Command Stream Comparison for BareMinimum.ino');
        console.log('=' .repeat(60));
        
        // Load existing streams
        const existing = this.loadExistingStreams();
        
        // Run fresh JavaScript
        const fresh = await this.runFreshJavaScript();
        
        console.log('\n' + '=' .repeat(60));
        console.log('📋 COMPARISON RESULTS');
        console.log('=' .repeat(60));
        
        const comparisons = [];
        
        // Compare existing JavaScript vs C++
        if (existing.javascript.success && existing.cpp.success) {
            console.log(`\n🔄 EXISTING: JavaScript (${existing.javascript.source}) vs C++ (${existing.cpp.source})`);
            const analysis1 = this.compareCommandStreams(
                existing.javascript, 
                existing.cpp, 
                'JavaScript', 
                'C++'
            );
            const similarity1 = this.printAnalysis(analysis1, 'JavaScript', 'C++');
            comparisons.push({ type: 'Existing JS vs C++', similarity: similarity1 });
        }
        
        // Compare fresh JavaScript vs existing C++
        if (fresh.success && existing.cpp.success) {
            console.log(`\n🆕 FRESH: JavaScript (maxLoopIterations=1) vs C++ (${existing.cpp.source})`);
            const analysis2 = this.compareCommandStreams(
                fresh, 
                existing.cpp, 
                'Fresh JavaScript', 
                'C++'
            );
            const similarity2 = this.printAnalysis(analysis2, 'Fresh JavaScript', 'C++');
            comparisons.push({ type: 'Fresh JS vs C++', similarity: similarity2 });
        }
        
        // Compare fresh vs existing JavaScript
        if (fresh.success && existing.javascript.success) {
            console.log(`\n🔄 JavaScript: Fresh (maxLoopIterations=1) vs Existing (${existing.javascript.source})`);
            const analysis3 = this.compareCommandStreams(
                fresh, 
                existing.javascript, 
                'Fresh JavaScript', 
                'Existing JavaScript'
            );
            const similarity3 = this.printAnalysis(analysis3, 'Fresh', 'Existing');
            comparisons.push({ type: 'Fresh vs Existing JS', similarity: similarity3 });
        }
        
        // Summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 SUMMARY');
        console.log('=' .repeat(60));
        
        comparisons.forEach(comp => {
            console.log(`${comp.type}: ${comp.similarity}% similarity`);
        });
        
        console.log('\n💡 KEY INSIGHTS:');
        if (comparisons.length === 0) {
            console.log('❌ No valid command streams found for comparison');
            console.log('💡 Run cross-platform validation first to generate C++ commands');
        } else {
            const avgSimilarity = comparisons.reduce((sum, comp) => sum + comp.similarity, 0) / comparisons.length;
            console.log(`📈 Average similarity: ${avgSimilarity.toFixed(1)}%`);
            
            if (avgSimilarity > 95) {
                console.log('✅ Excellent compatibility - minimal differences');
            } else if (avgSimilarity > 85) {
                console.log('⚠️  Good compatibility - minor differences to investigate');
            } else {
                console.log('❌ Significant differences - requires investigation');
            }
        }
        
        return comparisons;
    }
}

// Main execution
if (require.main === module) {
    const comparison = new SimpleCommandComparison();
    
    comparison.runComparison()
        .then(results => {
            console.log('\n🎉 Comparison completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Comparison failed:', error.message);
            process.exit(1);
        });
}

module.exports = { SimpleCommandComparison };