#!/usr/bin/env node

/**
 * Regression Detector Agent
 *
 * Tracks test success/failure changes over time to detect when fixes
 * accidentally break previously working tests.
 *
 * Usage:
 *   node regression_detector.js --baseline    # Establish baseline
 *   node regression_detector.js --check       # Check for regressions
 *   node regression_detector.js --compare <file1> <file2>  # Compare two results
 */

const fs = require('fs');
const path = require('path');

class RegressionDetector {
    constructor() {
        this.buildDir = path.join(__dirname, '..', 'build');
        this.baselineFile = path.join(this.buildDir, 'regression_baseline.json');
        this.historyDir = path.join(this.buildDir, 'regression_history');

        // Ensure history directory exists
        if (!fs.existsSync(this.historyDir)) {
            fs.mkdirSync(this.historyDir, { recursive: true });
        }
    }

    /**
     * Establish baseline by running validation and recording results
     */
    async establishBaseline() {
        console.log('🎯 Establishing regression baseline...\n');

        const results = await this.runValidation();
        if (!results) {
            console.error('❌ Failed to run validation for baseline');
            return false;
        }

        const baseline = {
            timestamp: new Date().toISOString(),
            version: 'baseline',
            totalTests: results.totalTests,
            passingTests: results.passingTests.length,
            failingTests: results.failingTests.length,
            successRate: results.successRate,
            passingTestsList: results.passingTests,
            failingTestsList: results.failingTests,
            details: results.details || {}
        };

        fs.writeFileSync(this.baselineFile, JSON.stringify(baseline, null, 2));
        console.log(`✅ Baseline established with ${baseline.successRate}% success rate`);
        console.log(`   Passing: ${baseline.passingTests}/${baseline.totalTests} tests`);
        console.log(`   Baseline saved to: ${this.baselineFile}\n`);

        return true;
    }

    /**
     * Check for regressions against baseline
     */
    async checkForRegressions() {
        console.log('🔍 Checking for regressions...\n');

        // Load baseline
        if (!fs.existsSync(this.baselineFile)) {
            console.error('❌ No baseline found. Run with --baseline first.');
            return false;
        }

        const baseline = JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));

        // Run current validation
        const current = await this.runValidation();
        if (!current) {
            console.error('❌ Failed to run current validation');
            return false;
        }

        // Compare results
        const comparison = this.compareResults(baseline, current);
        this.generateRegressionReport(comparison);
        this.saveRegressionHistory(comparison);

        return comparison.hasRegressions === false;
    }

    /**
     * Run validation and parse results
     */
    async runValidation() {
        console.log('🚀 Running cross-platform validation...');

        try {
            const { spawn } = require('child_process');

            return new Promise((resolve, reject) => {
                const validator = spawn('./validate_cross_platform', ['0', '134'], {
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
                    try {
                        const results = this.parseValidationOutput(stdout);
                        resolve(results);
                    } catch (error) {
                        console.error('❌ Failed to parse validation output:', error.message);
                        resolve(null);
                    }
                });

                validator.on('error', (error) => {
                    console.error('❌ Failed to run validation:', error.message);
                    resolve(null);
                });
            });

        } catch (error) {
            console.error('❌ Error running validation:', error.message);
            return null;
        }
    }

    /**
     * Parse validation output to extract test results
     */
    parseValidationOutput(output) {
        const lines = output.split('\n');

        let totalTests = 135; // Default
        let passingTests = [];
        let failingTests = [];
        let successRate = 0;

        // Look for summary section
        let inSummary = false;
        for (const line of lines) {
            if (line.includes('=== SUMMARY ===')) {
                inSummary = true;
                continue;
            }

            if (inSummary) {
                // Parse total tests
                const totalMatch = line.match(/Tests processed:\s*(\d+)/);
                if (totalMatch) {
                    totalTests = parseInt(totalMatch[1]);
                }

                // Parse exact matches (passing tests)
                const exactMatch = line.match(/Exact matches:\s*(\d+)/);
                if (exactMatch) {
                    const passingCount = parseInt(exactMatch[1]);
                    // Generate sequential passing test list (0 to passingCount-1)
                    passingTests = Array.from({length: passingCount}, (_, i) => i);
                }

                // Parse success rate
                const rateMatch = line.match(/Success rate:\s*([\d.]+)%/);
                if (rateMatch) {
                    successRate = parseFloat(rateMatch[1]);
                }
            }

            // Look for individual test results
            const testMatch = line.match(/Test (\d+): (EXACT MATCH|FUNCTIONAL DIFFERENCE)/);
            if (testMatch) {
                const testNum = parseInt(testMatch[1]);
                const status = testMatch[2];

                if (status === 'EXACT MATCH') {
                    if (!passingTests.includes(testNum)) {
                        passingTests.push(testNum);
                    }
                } else {
                    if (!failingTests.includes(testNum)) {
                        failingTests.push(testNum);
                    }
                }
            }
        }

        // Calculate failing tests if not explicitly found
        if (failingTests.length === 0 && passingTests.length > 0) {
            const allTests = Array.from({length: totalTests}, (_, i) => i);
            failingTests = allTests.filter(test => !passingTests.includes(test));
        }

        // Recalculate success rate if needed
        if (successRate === 0 && passingTests.length > 0) {
            successRate = (passingTests.length / totalTests) * 100;
        }

        passingTests.sort((a, b) => a - b);
        failingTests.sort((a, b) => a - b);

        return {
            totalTests,
            passingTests,
            failingTests,
            successRate: parseFloat(successRate.toFixed(2)),
            details: {
                rawOutput: output.substring(0, 1000) // Keep first 1000 chars for debugging
            }
        };
    }

    /**
     * Compare current results with baseline
     */
    compareResults(baseline, current) {
        const comparison = {
            timestamp: new Date().toISOString(),
            baseline: baseline,
            current: {
                timestamp: new Date().toISOString(),
                totalTests: current.totalTests,
                passingTests: current.passingTests.length,
                failingTests: current.failingTests.length,
                successRate: current.successRate,
                passingTestsList: current.passingTests,
                failingTestsList: current.failingTests
            },
            changes: {
                successRateChange: current.successRate - baseline.successRate,
                netTestChange: current.passingTests.length - baseline.passingTests,
                newlyPassing: [],
                newlyFailing: [],
                stillPassing: [],
                stillFailing: []
            },
            hasRegressions: false,
            hasImprovements: false
        };

        // Calculate test changes
        const baselinePassing = new Set(baseline.passingTestsList);
        const currentPassing = new Set(current.passingTests);

        for (const test of baseline.passingTestsList) {
            if (currentPassing.has(test)) {
                comparison.changes.stillPassing.push(test);
            } else {
                comparison.changes.newlyFailing.push(test);
                comparison.hasRegressions = true;
            }
        }

        for (const test of current.passingTests) {
            if (!baselinePassing.has(test)) {
                comparison.changes.newlyPassing.push(test);
                comparison.hasImprovements = true;
            }
        }

        // Calculate still failing
        const baselineFailing = new Set(baseline.failingTestsList);
        const currentFailing = new Set(current.failingTests);

        for (const test of baseline.failingTestsList) {
            if (currentFailing.has(test)) {
                comparison.changes.stillFailing.push(test);
            }
        }

        return comparison;
    }

    /**
     * Generate detailed regression report
     */
    generateRegressionReport(comparison) {
        console.log('📊 **REGRESSION ANALYSIS RESULTS**\n');

        // Overall status
        if (comparison.hasRegressions && comparison.hasImprovements) {
            console.log('⚠️  **STATUS**: Mixed results - improvements with regressions');
        } else if (comparison.hasRegressions) {
            console.log('❌ **STATUS**: Regressions detected');
        } else if (comparison.hasImprovements) {
            console.log('✅ **STATUS**: Improvements detected, no regressions');
        } else {
            console.log('➡️  **STATUS**: No changes detected');
        }

        // Success rate comparison
        const rateChange = comparison.changes.successRateChange;
        const rateDirection = rateChange > 0 ? '📈' : rateChange < 0 ? '📉' : '➡️';
        console.log(`${rateDirection} **Success Rate**: ${comparison.baseline.successRate}% → ${comparison.current.successRate}% (${rateChange >= 0 ? '+' : ''}${rateChange.toFixed(2)}%)`);

        // Test count changes
        const testChange = comparison.changes.netTestChange;
        const testDirection = testChange > 0 ? '📈' : testChange < 0 ? '📉' : '➡️';
        console.log(`${testDirection} **Passing Tests**: ${comparison.baseline.passingTests} → ${comparison.current.passingTests} (${testChange >= 0 ? '+' : ''}${testChange})\n`);

        // Detailed changes
        if (comparison.changes.newlyFailing.length > 0) {
            console.log(`💥 **NEWLY FAILING TESTS** (${comparison.changes.newlyFailing.length}):`);
            console.log(`   ${comparison.changes.newlyFailing.slice(0, 20).join(', ')}${comparison.changes.newlyFailing.length > 20 ? '...' : ''}\n`);
        }

        if (comparison.changes.newlyPassing.length > 0) {
            console.log(`🎉 **NEWLY PASSING TESTS** (${comparison.changes.newlyPassing.length}):`);
            console.log(`   ${comparison.changes.newlyPassing.slice(0, 20).join(', ')}${comparison.changes.newlyPassing.length > 20 ? '...' : ''}\n`);
        }

        // Stability metrics
        console.log('📈 **STABILITY METRICS**:');
        console.log(`   Still passing: ${comparison.changes.stillPassing.length} tests`);
        console.log(`   Still failing: ${comparison.changes.stillFailing.length} tests`);
        console.log(`   Total changes: ${comparison.changes.newlyPassing.length + comparison.changes.newlyFailing.length} tests\n`);

        // Recommendations
        this.generateRegessionRecommendations(comparison);
    }

    /**
     * Generate recommendations based on regression analysis
     */
    generateRegessionRecommendations(comparison) {
        console.log('💡 **RECOMMENDATIONS**:\n');

        if (comparison.hasRegressions) {
            console.log('🚨 **IMMEDIATE ACTIONS** (Regressions Found):');
            console.log('1. **DO NOT PROCEED** with current changes until regressions are fixed');
            console.log('2. **Analyze newly failing tests** to identify what broke:');

            if (comparison.changes.newlyFailing.length <= 5) {
                comparison.changes.newlyFailing.forEach(test => {
                    console.log(`   - Run: node agents/smart_diff_analyzer.js ${test}`);
                });
            } else {
                console.log(`   - Focus on first 5 tests: ${comparison.changes.newlyFailing.slice(0, 5).join(', ')}`);
            }

            console.log('3. **Revert or fix** the changes causing regressions');
            console.log('4. **Re-run regression check** after fixes\n');
        }

        if (comparison.hasImprovements) {
            console.log('✅ **POSITIVE CHANGES**:');
            console.log(`   ${comparison.changes.newlyPassing.length} tests now pass that previously failed`);
            console.log('   This indicates successful fixes - good progress!\n');
        }

        if (!comparison.hasRegressions && !comparison.hasImprovements) {
            console.log('➡️  **NO CHANGES DETECTED**:');
            console.log('   Changes may not have affected test outcomes');
            console.log('   Consider running more focused tests or checking implementation\n');
        }

        console.log('📋 **NEXT STEPS**:');
        if (comparison.hasRegressions) {
            console.log('1. Fix regressions before continuing');
            console.log('2. Use git to identify recent changes');
            console.log('3. Consider incremental fixes rather than large changes');
        } else {
            console.log('1. Continue with systematic fixes');
            console.log('2. Update baseline if substantial improvements achieved');
            console.log('3. Run regression check after each major change');
        }
        console.log('');
    }

    /**
     * Save regression history for tracking
     */
    saveRegressionHistory(comparison) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const historyFile = path.join(this.historyDir, `regression_${timestamp}.json`);

        fs.writeFileSync(historyFile, JSON.stringify(comparison, null, 2));
        console.log(`📁 Regression analysis saved to: ${historyFile}`);
    }

    /**
     * Compare two specific result files
     */
    compareFiles(file1Path, file2Path) {
        console.log(`🔄 Comparing ${file1Path} vs ${file2Path}\n`);

        try {
            const results1 = JSON.parse(fs.readFileSync(file1Path, 'utf8'));
            const results2 = JSON.parse(fs.readFileSync(file2Path, 'utf8'));

            const comparison = this.compareResults(results1, results2);
            this.generateRegressionReport(comparison);

            return comparison;
        } catch (error) {
            console.error(`❌ Error comparing files: ${error.message}`);
            return null;
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const detector = new RegressionDetector();

    switch (command) {
        case '--baseline':
            await detector.establishBaseline();
            break;

        case '--check':
            await detector.checkForRegressions();
            break;

        case '--compare':
            if (args.length !== 3) {
                console.error('Usage: node regression_detector.js --compare <file1> <file2>');
                process.exit(1);
            }
            detector.compareFiles(args[1], args[2]);
            break;

        default:
            console.error('Usage:');
            console.error('  node regression_detector.js --baseline     # Establish baseline');
            console.error('  node regression_detector.js --check        # Check for regressions');
            console.error('  node regression_detector.js --compare <f1> <f2>  # Compare files');
            process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = RegressionDetector;