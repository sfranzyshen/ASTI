#!/usr/bin/env node

/**
 * Category-Specific Test Runner Agent
 *
 * Runs validation tests focused on specific problem categories to enable
 * targeted fixing and progress tracking.
 *
 * Usage:
 *   node category_test_runner.js --category serial_library
 *   node category_test_runner.js --category pin_mapping --fix-mode
 *   node category_test_runner.js --list-categories
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class CategoryTestRunner {
    constructor() {
        this.buildDir = path.join(__dirname, '..', 'build');
        this.agentsDir = path.join(__dirname);

        // Known test categories and their typical test ranges
        this.categories = {
            'serial_library': {
                description: 'Tests with Serial library issues',
                knownTests: [21, 22, 50], // Known tests with Serial issues
                patterns: [/Serial.*undefined|Serial.*missing/i],
                priority: 'HIGH'
            },
            'pin_mapping': {
                description: 'Tests with A0 pin mapping differences',
                knownTests: [15, 16, 18],
                patterns: [/"pin":\s*(?:14|36)/, /A0.*(?:14|36)/],
                priority: 'HIGH'
            },
            'function_params': {
                description: 'Tests with function parameter issues',
                knownTests: [24],
                patterns: [/Undefined variable.*cmd|pitch|velocity/, /Unknown function.*noteOn/],
                priority: 'CRITICAL'
            },
            'array_handling': {
                description: 'Tests with array initialization/access issues',
                knownTests: [12, 20],
                patterns: [/Invalid array access/, /array.*null/, /melody.*notes/],
                priority: 'HIGH'
            },
            'loop_structure': {
                description: 'Tests with loop command differences',
                knownTests: [17, 19],
                patterns: [/FOR_LOOP.*LOOP_START/, /LOOP_LIMIT_REACHED/],
                priority: 'HIGH'
            },
            'variable_init': {
                description: 'Tests with variable initialization differences',
                knownTests: [30, 85],
                patterns: [/null initialization/, /"value":\s*null/],
                priority: 'MEDIUM'
            },
            'string_handling': {
                description: 'Tests with String object method issues',
                knownTests: [50],
                patterns: [/stringOne\.equals/, /stringOne\.toInt/, /stringOne\.compareTo/],
                priority: 'MEDIUM'
            },
            'error_handling': {
                description: 'Tests with runtime error differences',
                knownTests: [8, 11],
                patterns: [/runtime error.*not present/, /error causes.*execution/],
                priority: 'MEDIUM'
            },
            'control_flow': {
                description: 'Tests with IF statement execution differences',
                knownTests: [8],
                patterns: [/IF_STATEMENT.*different/, /different.*IF_STATEMENT/],
                priority: 'HIGH'
            }
        };
    }

    /**
     * List all available categories
     */
    listCategories() {
        console.log('📋 Available Test Categories:\n');

        const sortedCategories = Object.entries(this.categories)
            .sort((a, b) => {
                const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
                return priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
            });

        sortedCategories.forEach(([name, category]) => {
            const statusIcon = this.getCategoryStatusIcon(category.priority);
            console.log(`${statusIcon} **${name}** (${category.priority} priority)`);
            console.log(`   ${category.description}`);
            console.log(`   Known affected tests: ${category.knownTests.join(', ')}`);
            console.log('');
        });

        console.log('Usage Examples:');
        console.log('  node category_test_runner.js --category serial_library');
        console.log('  node category_test_runner.js --category pin_mapping --fix-mode');
        console.log('  node category_test_runner.js --category function_params --analyze\n');
    }

    /**
     * Get status icon for category priority
     */
    getCategoryStatusIcon(priority) {
        switch (priority) {
            case 'CRITICAL': return '🚨';
            case 'HIGH': return '🔴';
            case 'MEDIUM': return '🟡';
            case 'LOW': return '🔵';
            default: return '⚪';
        }
    }

    /**
     * Run tests for specific category
     */
    async runCategoryTests(categoryName, options = {}) {
        if (!this.categories[categoryName]) {
            console.error(`❌ Unknown category: ${categoryName}`);
            console.log('Run with --list-categories to see available options');
            return false;
        }

        const category = this.categories[categoryName];
        console.log(`🎯 Running tests for category: ${categoryName.toUpperCase()}`);
        console.log(`📝 Description: ${category.description}`);
        console.log(`⚡ Priority: ${category.priority}\n`);

        // Step 1: Discover affected tests if needed
        const affectedTests = await this.discoverCategoryTests(categoryName, category);

        if (affectedTests.length === 0) {
            console.log('✅ No tests found for this category - may already be fixed!');
            return true;
        }

        console.log(`📊 Found ${affectedTests.length} tests in this category:`);
        console.log(`   ${affectedTests.slice(0, 10).join(', ')}${affectedTests.length > 10 ? '...' : ''}\n`);

        // Step 2: Run validation on category tests
        const results = await this.runCategoryValidation(affectedTests, options);

        // Step 3: Analyze results
        await this.analyzeCategoryResults(categoryName, affectedTests, results, options);

        return results.successRate > 50; // Consider success if >50% pass
    }

    /**
     * Discover tests affected by specific category
     */
    async discoverCategoryTests(categoryName, category) {
        console.log('🔍 Discovering affected tests...');

        const affectedTests = new Set(category.knownTests);

        // Scan debug files for pattern matches
        try {
            const files = fs.readdirSync(this.buildDir);
            const debugFiles = files.filter(f => f.match(/test\d+_(cpp|js)_debug\.json$/));

            for (const file of debugFiles) {
                const testMatch = file.match(/test(\d+)_/);
                if (!testMatch) continue;

                const testNum = parseInt(testMatch[1]);
                if (affectedTests.has(testNum)) continue; // Already known

                try {
                    const content = fs.readFileSync(path.join(this.buildDir, file), 'utf8');

                    // Check if any category patterns match
                    for (const pattern of category.patterns) {
                        if (pattern.test(content)) {
                            affectedTests.add(testNum);
                            break;
                        }
                    }
                } catch (error) {
                    // Skip files that can't be read
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not scan debug files, using known tests only');
        }

        return Array.from(affectedTests).sort((a, b) => a - b);
    }

    /**
     * Run validation on specific test numbers
     */
    async runCategoryValidation(testNumbers, options = {}) {
        console.log('🚀 Running targeted validation...\n');

        const results = {
            tested: testNumbers.length,
            passed: 0,
            failed: 0,
            passedTests: [],
            failedTests: [],
            successRate: 0
        };

        // Run tests in small batches to get detailed results
        for (const testNum of testNumbers) {
            const testResult = await this.runSingleTest(testNum, options);

            if (testResult.passed) {
                results.passed++;
                results.passedTests.push(testNum);
                console.log(`✅ Test ${testNum}: PASS`);
            } else {
                results.failed++;
                results.failedTests.push(testNum);
                console.log(`❌ Test ${testNum}: FAIL`);

                // If in fix mode, analyze this failure immediately
                if (options.fixMode) {
                    await this.analyzeFailedTest(testNum);
                }
            }
        }

        results.successRate = ((results.passed / results.tested) * 100).toFixed(2);

        console.log(`\n📊 Category Validation Results:`);
        console.log(`   Total tested: ${results.tested}`);
        console.log(`   Passed: ${results.passed}`);
        console.log(`   Failed: ${results.failed}`);
        console.log(`   Success rate: ${results.successRate}%\n`);

        return results;
    }

    /**
     * Run validation on single test
     */
    async runSingleTest(testNum, options = {}) {
        return new Promise((resolve) => {
            const validator = spawn('./validate_cross_platform', [testNum.toString(), testNum.toString()], {
                cwd: this.buildDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            validator.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            validator.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            validator.on('close', (code) => {
                // Parse output to determine if test passed
                const passed = stdout.includes('EXACT MATCH') ||
                             stdout.includes('Success rate: 100');

                resolve({
                    passed,
                    output: stdout,
                    error: stderr
                });
            });

            validator.on('error', (error) => {
                resolve({
                    passed: false,
                    output: '',
                    error: error.message
                });
            });
        });
    }

    /**
     * Analyze failed test using smart diff analyzer
     */
    async analyzeFailedTest(testNum) {
        console.log(`🔍 Analyzing failed test ${testNum}...`);

        try {
            const SmartDiffAnalyzer = require('./smart_diff_analyzer');
            const analyzer = new SmartDiffAnalyzer();
            await analyzer.analyzeTest(testNum);
        } catch (error) {
            console.warn(`⚠️  Could not run detailed analysis: ${error.message}`);
        }
    }

    /**
     * Analyze category results and provide recommendations
     */
    async analyzeCategoryResults(categoryName, affectedTests, results, options) {
        console.log(`📋 Analysis for ${categoryName.toUpperCase()} category:\n`);

        if (results.passed === results.tested) {
            console.log('🎉 **CATEGORY COMPLETE!**');
            console.log('   All tests in this category are now passing');
            console.log('   Consider moving to next priority category\n');
            return;
        }

        if (results.passed === 0) {
            console.log('🚨 **CATEGORY NEEDS WORK**');
            console.log('   No tests passing - core implementation missing');
            console.log('   Focus on fundamental fixes for this category\n');
        } else {
            console.log(`⚡ **PARTIAL PROGRESS** (${results.successRate}%)`);
            console.log('   Some tests passing - implementation partially working');
            console.log('   Focus on remaining edge cases\n');
        }

        // Provide specific recommendations
        await this.generateCategoryRecommendations(categoryName, results);

        // Save category analysis
        await this.saveCategoryAnalysis(categoryName, affectedTests, results);
    }

    /**
     * Generate specific recommendations for category
     */
    async generateCategoryRecommendations(categoryName, results) {
        console.log('💡 **RECOMMENDATIONS**:\n');

        switch (categoryName) {
            case 'serial_library':
                console.log('🔧 **Serial Library Fixes:**');
                console.log('1. Add Serial object to C++ interpreter global scope');
                console.log('2. Implement Serial.begin(), Serial.print(), Serial.println() methods');
                console.log('3. Add Serial.write() for byte output');
                console.log('4. Test with: int main() { Serial.begin(9600); Serial.println("test"); }');
                break;

            case 'pin_mapping':
                console.log('🔧 **Pin Mapping Fixes:**');
                console.log('1. Standardize A0 pin number (choose 14 or 36 consistently)');
                console.log('2. Update pin mapping tables in both JS and C++');
                console.log('3. Add pin number normalization to validation tools');
                console.log('4. Test with: analogRead(A0) on both platforms');
                break;

            case 'function_params':
                console.log('🔧 **Function Parameter Fixes:**');
                console.log('1. Fix CompactAST parameter loading in C++ interpreter');
                console.log('2. Verify FuncDefNode parameter collection');
                console.log('3. Fix parameter scope binding during function calls');
                console.log('4. Test with: void testFunc(int a, int b) { /* use a, b */ }');
                break;

            case 'array_handling':
                console.log('🔧 **Array Handling Fixes:**');
                console.log('1. Fix array initialization in C++ interpreter');
                console.log('2. Implement proper array bounds checking');
                console.log('3. Fix array element assignment and access');
                console.log('4. Test with: int arr[5] = {1,2,3,4,5}; arr[2] = 10;');
                break;

            default:
                console.log(`🔧 **${categoryName.toUpperCase()} Fixes:**`);
                console.log('1. Analyze failing tests to identify patterns');
                console.log('2. Focus on most common failure modes first');
                console.log('3. Implement targeted fixes');
                console.log('4. Test incrementally with validation tools');
        }

        console.log('\n📋 **NEXT STEPS**:');
        console.log('1. Focus on failed tests: ' + results.failedTests.slice(0, 5).join(', '));
        console.log('2. Use smart_diff_analyzer.js for detailed analysis');
        console.log('3. Implement fixes incrementally');
        console.log('4. Re-run category tests after each fix');
        console.log('5. Run regression_detector.js to catch any new issues\n');
    }

    /**
     * Save category analysis results
     */
    async saveCategoryAnalysis(categoryName, affectedTests, results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const analysisFile = path.join(this.buildDir, `category_${categoryName}_${timestamp}.json`);

        const analysis = {
            timestamp: new Date().toISOString(),
            category: categoryName,
            affectedTests,
            results,
            recommendations: `See category_test_runner.js output for specific recommendations`
        };

        fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
        console.log(`📄 Category analysis saved to: ${analysisFile}`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    const runner = new CategoryTestRunner();

    if (args.includes('--list-categories')) {
        runner.listCategories();
        return;
    }

    const categoryIndex = args.indexOf('--category');
    if (categoryIndex === -1 || categoryIndex === args.length - 1) {
        console.error('Usage:');
        console.error('  node category_test_runner.js --list-categories');
        console.error('  node category_test_runner.js --category <name> [options]');
        console.error('');
        console.error('Options:');
        console.error('  --fix-mode     Analyze failures immediately');
        console.error('  --analyze      Run detailed analysis on all failures');
        process.exit(1);
    }

    const categoryName = args[categoryIndex + 1];
    const options = {
        fixMode: args.includes('--fix-mode'),
        analyze: args.includes('--analyze')
    };

    const success = await runner.runCategoryTests(categoryName, options);
    process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = CategoryTestRunner;