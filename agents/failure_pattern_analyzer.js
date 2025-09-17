#!/usr/bin/env node

/**
 * Failure Pattern Analyzer Agent
 *
 * Automatically analyzes failing test outputs and categorizes them into
 * systematic problem patterns for targeted fixing.
 *
 * Usage: node failure_pattern_analyzer.js [test_range_start] [test_range_end]
 * Example: node failure_pattern_analyzer.js 0 20
 */

const fs = require('fs');
const path = require('path');

class FailurePatternAnalyzer {
    constructor() {
        this.buildDir = path.join(__dirname, '..', 'build');
        this.categories = {
            'serial_library': {
                patterns: [
                    /Undefined variable: Serial/,
                    /Unknown function: Serial\./,
                    /Serial not found/
                ],
                description: 'Serial library not available in C++',
                priority: 'HIGH',
                affected: []
            },
            'pin_mapping': {
                patterns: [
                    /"pin":\s*(?:14|36)/,
                    /A0.*(?:14|36)/,
                    /pin.*(?:14|36)/
                ],
                description: 'A0 pin mapping differences (14 vs 36)',
                priority: 'HIGH',
                affected: []
            },
            'loop_structure': {
                patterns: [
                    /FOR_LOOP.*LOOP_START/,
                    /LOOP_LIMIT_REACHED/,
                    /different.*loop.*termination/i
                ],
                description: 'Loop command structure differences',
                priority: 'HIGH',
                affected: []
            },
            'array_handling': {
                patterns: [
                    /Invalid array access/,
                    /array.*null/,
                    /melody.*notes/,
                    /\[null,null,null\]/
                ],
                description: 'Array initialization and access issues',
                priority: 'HIGH',
                affected: []
            },
            'variable_init': {
                patterns: [
                    /null initialization/,
                    /"value":\s*null/,
                    /shows null.*JS shows initialized/
                ],
                description: 'Variable initialization pattern differences',
                priority: 'MEDIUM',
                affected: []
            },
            'function_params': {
                patterns: [
                    /Undefined variable.*cmd|pitch|velocity/,
                    /Unknown function.*noteOn/,
                    /has 0 parameters/,
                    /function.*parameter.*mismatch/i
                ],
                description: 'Function parameter handling issues',
                priority: 'CRITICAL',
                affected: []
            },
            'string_handling': {
                patterns: [
                    /stringOne\.equals/,
                    /stringOne\.toInt/,
                    /stringOne\.compareTo/,
                    /String.*object.*primitive/i
                ],
                description: 'String object method and representation issues',
                priority: 'MEDIUM',
                affected: []
            },
            'error_handling': {
                patterns: [
                    /runtime error.*not present/i,
                    /error causes.*execution flow/i,
                    /throws.*error.*JS.*normal/i
                ],
                description: 'Runtime error handling differences',
                priority: 'MEDIUM',
                affected: []
            },
            'field_ordering': {
                patterns: [
                    /field.*order/i,
                    /timestamp.*isConst/,
                    /isConst.*timestamp/
                ],
                description: 'JSON field ordering differences',
                priority: 'LOW',
                affected: []
            },
            'mock_data': {
                patterns: [
                    /mock.*value/i,
                    /millis.*\d+.*vs.*\d+/,
                    /sensor.*\d+.*vs.*\d+/,
                    /analogRead.*\d+.*vs.*\d+/
                ],
                description: 'Mock data synchronization issues (ignore)',
                priority: 'IGNORE',
                affected: []
            }
        };
        this.results = {
            totalTests: 0,
            analyzedTests: 0,
            categorized: 0,
            uncategorized: []
        };
    }

    /**
     * Analyze test failures in specified range
     */
    async analyzeRange(startTest = 0, endTest = 134) {
        console.log(`\n=== Failure Pattern Analysis ===`);
        console.log(`Analyzing tests ${startTest} to ${endTest}`);
        console.log(`Build directory: ${this.buildDir}\n`);

        this.results.totalTests = endTest - startTest + 1;

        for (let testNum = startTest; testNum <= endTest; testNum++) {
            await this.analyzeTest(testNum);
        }

        this.generateReport();
    }

    /**
     * Analyze individual test failure
     */
    async analyzeTest(testNum) {
        const testId = testNum.toString().padStart(3, '0');
        const cppFile = path.join(this.buildDir, `test${testNum}_cpp_debug.json`);
        const jsFile = path.join(this.buildDir, `test${testNum}_js_debug.json`);

        // Check if debug files exist
        if (!fs.existsSync(cppFile) || !fs.existsSync(jsFile)) {
            return; // Skip tests without debug files
        }

        this.results.analyzedTests++;

        try {
            const cppContent = fs.readFileSync(cppFile, 'utf8');
            const jsContent = fs.readFileSync(jsFile, 'utf8');

            // Combine both outputs for pattern matching
            const combinedContent = `CPP: ${cppContent}\nJS: ${jsContent}`;

            let categorized = false;

            // Check each category pattern
            for (const [categoryName, category] of Object.entries(this.categories)) {
                for (const pattern of category.patterns) {
                    if (pattern.test(combinedContent)) {
                        category.affected.push(testNum);
                        categorized = true;
                        break;
                    }
                }
                if (categorized) break;
            }

            if (!categorized) {
                this.results.uncategorized.push(testNum);
            } else {
                this.results.categorized++;
            }

        } catch (error) {
            console.warn(`Warning: Could not analyze test ${testNum}: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive analysis report
     */
    generateReport() {
        console.log(`\n=== Analysis Results ===`);
        console.log(`Total tests in range: ${this.results.totalTests}`);
        console.log(`Tests analyzed: ${this.results.analyzedTests}`);
        console.log(`Tests categorized: ${this.results.categorized}`);
        console.log(`Uncategorized tests: ${this.results.uncategorized.length}\n`);

        // Sort categories by priority and impact
        const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'IGNORE': 4 };
        const sortedCategories = Object.entries(this.categories)
            .filter(([name, cat]) => cat.affected.length > 0)
            .sort((a, b) => {
                const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
                if (priorityDiff !== 0) return priorityDiff;
                return b[1].affected.length - a[1].affected.length; // More affected = higher priority
            });

        console.log(`=== Problem Categories (${sortedCategories.length} found) ===\n`);

        sortedCategories.forEach(([categoryName, category]) => {
            const impactLevel = this.getImpactLevel(category.affected.length);
            console.log(`🔴 **${categoryName.toUpperCase()}** (${category.priority} priority)`);
            console.log(`   Impact: ${impactLevel} (${category.affected.length} tests)`);
            console.log(`   Description: ${category.description}`);
            console.log(`   Affected tests: ${category.affected.slice(0, 10).join(', ')}${category.affected.length > 10 ? '...' : ''}`);
            console.log('');
        });

        if (this.results.uncategorized.length > 0) {
            console.log(`⚠️  **UNCATEGORIZED FAILURES**`);
            console.log(`   Tests: ${this.results.uncategorized.slice(0, 20).join(', ')}${this.results.uncategorized.length > 20 ? '...' : ''}`);
            console.log(`   These need manual analysis to identify new patterns.\n`);
        }

        this.generateFixRecommendations(sortedCategories);
        this.saveReport(sortedCategories);
    }

    /**
     * Generate fix recommendations based on analysis
     */
    generateFixRecommendations(sortedCategories) {
        console.log(`=== Fix Recommendations ===\n`);

        const highPriority = sortedCategories.filter(([name, cat]) =>
            cat.priority === 'CRITICAL' || cat.priority === 'HIGH'
        );

        console.log(`**Phase 1 - Critical Infrastructure (Immediate):**`);
        highPriority.forEach(([categoryName, category], index) => {
            console.log(`${index + 1}. Fix ${categoryName} (${category.affected.length} tests)`);
            console.log(`   Priority: ${category.priority}`);
            console.log(`   Expected impact: ${this.calculateExpectedImpact(category.affected.length)}% improvement`);
        });

        console.log(`\n**Recommended Implementation Order:**`);
        console.log(`1. function_params (CRITICAL) - blocks user-defined functions`);
        console.log(`2. serial_library (HIGH) - core Arduino functionality`);
        console.log(`3. pin_mapping (HIGH) - hardware compatibility`);
        console.log(`4. loop_structure (HIGH) - control flow consistency`);
        console.log(`5. array_handling (HIGH) - data structure support\n`);

        console.log(`**Estimated Timeline:**`);
        console.log(`- Week 1: Fix categories 1-2 → Target 30-40% success rate`);
        console.log(`- Week 2: Fix categories 3-5 → Target 60-70% success rate`);
        console.log(`- Week 3: Polish and edge cases → Target 85-95% success rate\n`);
    }

    /**
     * Calculate expected improvement impact
     */
    calculateExpectedImpact(affectedTests) {
        return Math.round((affectedTests / 135) * 100);
    }

    /**
     * Get impact level description
     */
    getImpactLevel(affectedTests) {
        if (affectedTests >= 30) return 'CRITICAL';
        if (affectedTests >= 20) return 'HIGH';
        if (affectedTests >= 10) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Save detailed report to file
     */
    saveReport(sortedCategories) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.buildDir, `failure_analysis_${timestamp}.json`);

        const report = {
            timestamp: new Date().toISOString(),
            summary: this.results,
            categories: Object.fromEntries(
                sortedCategories.map(([name, cat]) => [name, {
                    priority: cat.priority,
                    description: cat.description,
                    affected: cat.affected,
                    impact: this.getImpactLevel(cat.affected.length)
                }])
            ),
            uncategorized: this.results.uncategorized,
            recommendations: {
                phase1: sortedCategories.filter(([n, c]) => c.priority === 'CRITICAL' || c.priority === 'HIGH'),
                expectedImpact: sortedCategories.reduce((sum, [n, c]) => sum + c.affected.length, 0)
            }
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportFile}`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const startTest = args[0] ? parseInt(args[0]) : 0;
    const endTest = args[1] ? parseInt(args[1]) : 134;

    if (isNaN(startTest) || isNaN(endTest) || startTest > endTest) {
        console.error('Usage: node failure_pattern_analyzer.js [start_test] [end_test]');
        console.error('Example: node failure_pattern_analyzer.js 0 20');
        process.exit(1);
    }

    const analyzer = new FailurePatternAnalyzer();
    await analyzer.analyzeRange(startTest, endTest);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = FailurePatternAnalyzer;