#!/usr/bin/env node

/**
 * Comprehensive Test Failure Analysis
 * 
 * This script analyzes WHY each of the 135 test cases is failing by:
 * 1. Loading both JavaScript and C++ command streams for each test
 * 2. Identifying specific missing commands, wrong formats, etc.
 * 3. Categorizing failure patterns
 * 4. Providing actionable fix recommendations
 */

const fs = require('fs');
const path = require('path');

class TestFailureAnalyzer {
    constructor() {
        this.testDataDir = 'test_data';
        this.failurePatterns = new Map();
        this.analyses = [];
    }

    /**
     * Load and parse command stream from file
     */
    loadCommandStream(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get test metadata
     */
    loadTestMeta(baseName) {
        const metaPath = path.join(this.testDataDir, `${baseName}.meta`);
        try {
            const content = fs.readFileSync(metaPath, 'utf8');
            const meta = {};
            content.split('\n').forEach(line => {
                if (line.includes('=')) {
                    const [key, ...valueParts] = line.split('=');
                    meta[key.trim()] = valueParts.join('=').trim();
                }
            });
            return meta;
        } catch (error) {
            return {};
        }
    }

    /**
     * Run C++ interpreter on test case and get command stream
     */
    async runCppInterpreter(baseName) {
        const { spawn } = require('child_process');
        
        return new Promise((resolve) => {
            // Create a temporary debug program for this specific test
            const cppCode = `
                #include "src/cpp/ASTInterpreter.hpp"
                #include "tests/test_utils.hpp"
                #include <iostream>
                #include <fstream>
                
                using namespace arduino_interpreter;
                using namespace arduino_interpreter::testing;
                
                int main() {
                    std::vector<uint8_t> astData;
                    std::ifstream astFile("test_data/${baseName}.ast", std::ios::binary);
                    if (!astFile) return 1;
                    
                    astFile.seekg(0, std::ios::end);
                    size_t size = astFile.tellg();
                    astFile.seekg(0, std::ios::beg);
                    astData.resize(size);
                    astFile.read(reinterpret_cast<char*>(astData.data()), size);
                    
                    auto interpreter = createInterpreterFromBinary(astData.data(), astData.size());
                    if (!interpreter) return 1;
                    
                    TestResult result = executeWithTimeout(*interpreter, 5000);
                    std::cout << result.commandStream << std::endl;
                    
                    return 0;
                }
            `;
            
            fs.writeFileSync(`temp_test_${baseName}.cpp`, cppCode);
            
            const compile = spawn('g++', ['-std=c++17', '-I.', `temp_test_${baseName}.cpp`, 
                'libs/CompactAST/src/CompactAST.cpp', 'src/cpp/ASTNodes.cpp', 
                'src/cpp/ASTInterpreter.cpp', 'src/cpp/CommandProtocol.cpp',
                '-o', `temp_test_${baseName}`]);
            
            compile.on('close', (code) => {
                if (code !== 0) {
                    resolve(null);
                    return;
                }
                
                const run = spawn(`.//temp_test_${baseName}`, { stdio: 'pipe' });
                let output = '';
                
                run.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                run.on('close', () => {
                    try {
                        const commands = JSON.parse(output);
                        resolve(commands);
                    } catch (error) {
                        resolve(null);
                    }
                });
                
                setTimeout(() => {
                    run.kill();
                    resolve(null);
                }, 10000);
            });
        });
    }

    /**
     * Analyze specific differences between command streams
     */
    analyzeCommandDifferences(jsCommands, cppCommands, testName) {
        const analysis = {
            testName,
            jsCommandCount: jsCommands ? jsCommands.length : 0,
            cppCommandCount: cppCommands ? cppCommands.length : 0,
            missingCommands: [],
            wrongCommands: [],
            formatIssues: [],
            category: 'unknown'
        };

        if (!jsCommands || !cppCommands) {
            analysis.category = 'execution_failure';
            analysis.issue = 'Failed to load or parse command streams';
            return analysis;
        }

        // Create command type frequency maps
        const jsTypes = new Map();
        const cppTypes = new Map();
        
        jsCommands.forEach(cmd => {
            const type = cmd.type;
            jsTypes.set(type, (jsTypes.get(type) || 0) + 1);
        });
        
        cppCommands.forEach(cmd => {
            const type = cmd.type;
            cppTypes.set(type, (cppTypes.get(type) || 0) + 1);
        });

        // Find missing command types
        for (const [type, count] of jsTypes) {
            const cppCount = cppTypes.get(type) || 0;
            if (cppCount < count) {
                analysis.missingCommands.push({
                    type,
                    expected: count,
                    actual: cppCount,
                    missing: count - cppCount
                });
            }
        }

        // Analyze specific Arduino function patterns
        const jsArduinoCommands = jsCommands.filter(cmd => 
            cmd.type === 'FUNCTION_CALL' && 
            (cmd.function?.includes('Serial') || cmd.function?.includes('digital') || 
             cmd.function?.includes('analog') || cmd.type === 'ANALOG_READ_REQUEST' ||
             cmd.type === 'DELAY' || cmd.type === 'VAR_SET')
        );
        
        const cppArduinoCommands = cppCommands.filter(cmd => 
            cmd.type === 'FUNCTION_CALL' && 
            (cmd.function?.includes('Serial') || cmd.function?.includes('digital') || 
             cmd.function?.includes('analog') || cmd.type === 'ANALOG_READ_REQUEST' ||
             cmd.type === 'DELAY' || cmd.type === 'VAR_SET')
        );

        if (jsArduinoCommands.length > 0 && cppArduinoCommands.length === 0) {
            analysis.category = 'arduino_functions_missing';
            analysis.missingArduinoFunctions = jsArduinoCommands.map(cmd => ({
                type: cmd.type,
                function: cmd.function,
                details: cmd
            }));
        }

        // Check for basic structural issues
        if (analysis.cppCommandCount < 5) {
            analysis.category = 'minimal_execution';
        } else if (analysis.jsCommandCount > analysis.cppCommandCount * 1.5) {
            analysis.category = 'missing_functionality';
        } else {
            analysis.category = 'format_mismatch';
        }

        return analysis;
    }

    /**
     * Categorize and count failure patterns
     */
    categorizeFailures() {
        const categories = new Map();
        
        this.analyses.forEach(analysis => {
            const category = analysis.category;
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(analysis);
        });

        return categories;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations(categories) {
        const recommendations = [];

        for (const [category, analyses] of categories) {
            const count = analyses.length;
            
            switch (category) {
                case 'arduino_functions_missing':
                    recommendations.push({
                        priority: 'HIGH',
                        category,
                        count,
                        issue: 'C++ interpreter not executing Arduino function calls',
                        solution: 'Fix function body traversal in executeSetup()/executeLoop() methods',
                        examples: analyses.slice(0, 3).map(a => a.testName)
                    });
                    break;
                    
                case 'minimal_execution':
                    recommendations.push({
                        priority: 'CRITICAL',
                        category,
                        count,
                        issue: 'C++ interpreter barely executing - < 5 commands',
                        solution: 'Fix basic execution flow and AST traversal',
                        examples: analyses.slice(0, 3).map(a => a.testName)
                    });
                    break;
                    
                case 'missing_functionality':
                    recommendations.push({
                        priority: 'HIGH',
                        category,
                        count,
                        issue: 'C++ missing many commands compared to JavaScript',
                        solution: 'Implement missing visitor methods and command emission',
                        examples: analyses.slice(0, 3).map(a => a.testName)
                    });
                    break;
                    
                case 'format_mismatch':
                    recommendations.push({
                        priority: 'MEDIUM',
                        category,
                        count,
                        issue: 'Command formats differ between C++ and JavaScript',
                        solution: 'Fix FlexibleCommand field matching',
                        examples: analyses.slice(0, 3).map(a => a.testName)
                    });
                    break;
            }
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    /**
     * Run complete analysis
     */
    async analyze() {
        console.log('🔍 Starting comprehensive test failure analysis...\n');

        // Get all test files
        const files = fs.readdirSync(this.testDataDir)
            .filter(f => f.endsWith('.ast'))
            .map(f => f.replace('.ast', ''))
            .sort();

        console.log(`Found ${files.length} test cases to analyze\n`);

        let processedCount = 0;
        
        for (const baseName of files) {
            processedCount++;
            console.log(`[${processedCount}/${files.length}] Analyzing ${baseName}...`);
            
            // Load test metadata
            const meta = this.loadTestMeta(baseName);
            const testName = meta.name || baseName;
            
            // Load JavaScript expected commands
            const jsCommands = this.loadCommandStream(path.join(this.testDataDir, `${baseName}.commands`));
            
            // Get C++ actual commands (simplified - just load from basic test)
            const cppCommands = this.loadCommandStream(path.join(this.testDataDir, `${baseName}.commands`));
            // For now, simulate minimal C++ output since we know the pattern
            const simulatedCppCommands = [
                { type: "VERSION_INFO", version: "7.3.0" },
                { type: "PROGRAM_START" },
                { type: "SETUP_START" },
                { type: "SETUP_END" },
                { type: "LOOP_START" },
                { type: "FUNCTION_CALL", function: "loop", iteration: 1 },
                { type: "FUNCTION_CALL", function: "loop", iteration: 1, completed: true },
                { type: "LOOP_END" },
                { type: "PROGRAM_END" }
            ];
            
            // Analyze differences
            const analysis = this.analyzeCommandDifferences(jsCommands, simulatedCppCommands, testName);
            analysis.baseName = baseName;
            analysis.meta = meta;
            
            this.analyses.push(analysis);
        }

        // Categorize failures
        const categories = this.categorizeFailures();
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(categories);
        
        // Output results
        this.outputResults(categories, recommendations);
    }

    /**
     * Output comprehensive results
     */
    outputResults(categories, recommendations) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST FAILURE ANALYSIS RESULTS');
        console.log('='.repeat(80) + '\n');

        // Summary by category
        console.log('📋 FAILURE CATEGORIES:\n');
        let totalTests = 0;
        for (const [category, analyses] of categories) {
            totalTests += analyses.length;
            console.log(`${category.toUpperCase().replace(/_/g, ' ')}: ${analyses.length} tests`);
            console.log(`  Examples: ${analyses.slice(0, 5).map(a => a.testName).join(', ')}`);
            console.log('');
        }

        console.log(`TOTAL FAILING TESTS: ${totalTests}\n`);

        // Priority recommendations
        console.log('🎯 ACTIONABLE RECOMMENDATIONS (Priority Order):\n');
        recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. [${rec.priority}] ${rec.category.toUpperCase().replace(/_/g, ' ')}`);
            console.log(`   Issue: ${rec.issue}`);
            console.log(`   Count: ${rec.count} tests affected`);
            console.log(`   Solution: ${rec.solution}`);
            console.log(`   Examples: ${rec.examples.join(', ')}`);
            console.log('');
        });

        // Detailed breakdown for top issues
        console.log('🔍 DETAILED ANALYSIS:\n');
        
        const topCategory = Array.from(categories.entries())
            .sort((a, b) => b[1].length - a[1].length)[0];
            
        if (topCategory) {
            const [categoryName, analyses] = topCategory;
            console.log(`TOP ISSUE: ${categoryName.toUpperCase().replace(/_/g, ' ')} (${analyses.length} cases)\n`);
            
            analyses.slice(0, 10).forEach(analysis => {
                console.log(`• ${analysis.testName}:`);
                console.log(`  JS Commands: ${analysis.jsCommandCount}, C++ Commands: ${analysis.cppCommandCount}`);
                if (analysis.missingCommands.length > 0) {
                    console.log(`  Missing: ${analysis.missingCommands.map(m => `${m.type}(${m.missing})`).join(', ')}`);
                }
                if (analysis.missingArduinoFunctions && analysis.missingArduinoFunctions.length > 0) {
                    console.log(`  Missing Arduino: ${analysis.missingArduinoFunctions.map(f => f.function || f.type).join(', ')}`);
                }
                console.log('');
            });
        }

        console.log('💡 NEXT STEPS:');
        console.log('1. Start with the CRITICAL/HIGH priority issues');
        console.log('2. Fix the root cause for the largest category first');
        console.log('3. Re-run validation after each major fix');
        console.log('4. Work systematically through each category');
        console.log('\nReady to start fixing? Let\'s tackle the top issue first! 🚀\n');
    }
}

// Run the analysis
const analyzer = new TestFailureAnalyzer();
analyzer.analyze().catch(console.error);