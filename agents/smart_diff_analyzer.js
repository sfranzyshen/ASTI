#!/usr/bin/env node

/**
 * Smart Diff Analyzer Agent
 *
 * Intelligently compares C++ and JavaScript test outputs, focusing on
 * execution logic differences while ignoring harmless mock data variations.
 *
 * Usage: node smart_diff_analyzer.js <test_number>
 * Example: node smart_diff_analyzer.js 21
 */

const fs = require('fs');
const path = require('path');

class SmartDiffAnalyzer {
    constructor() {
        this.buildDir = path.join(__dirname, '..', 'build');

        // Patterns to normalize/ignore when comparing outputs
        this.normalizationPatterns = [
            // Timestamp normalization
            {
                pattern: /"timestamp":\s*\d+/g,
                replacement: '"timestamp": 0',
                description: 'Normalize timestamps to 0'
            },
            // Pin number normalization (A0 can be 14 or 36)
            {
                pattern: /"pin":\s*(?:14|36)/g,
                replacement: '"pin": 0',
                description: 'Normalize A0 pin differences'
            },
            // Request ID normalization
            {
                pattern: /"requestId":\s*"[^"]+"/g,
                replacement: '"requestId": "normalized"',
                description: 'Normalize request IDs'
            },
            // Mock value normalization for common variables
            {
                pattern: /"variable":\s*"sensorValue",\s*"value":\s*\d+/g,
                replacement: '"variable": "sensorValue", "value": 0',
                description: 'Normalize sensor mock values'
            },
            {
                pattern: /"variable":\s*"inputPin",\s*"value":\s*\d+/g,
                replacement: '"variable": "inputPin", "value": 0',
                description: 'Normalize input pin mock values'
            },
            // Decimal format normalization (5.0000000000 → 5)
            {
                pattern: /(\d+)\.0+(?!\d)/g,
                replacement: '$1',
                description: 'Normalize decimal zeros'
            },
            // Whitespace normalization around colons and commas
            {
                pattern: /\s*:\s*/g,
                replacement: ': ',
                description: 'Normalize whitespace around colons'
            },
            {
                pattern: /\s*,\s*/g,
                replacement: ', ',
                description: 'Normalize whitespace around commas'
            }
        ];

        // Patterns that indicate real execution differences (not just formatting)
        this.executionDifferencePatterns = [
            {
                pattern: /VAR_SET.*missing|missing.*VAR_SET/i,
                category: 'execution_flow',
                severity: 'HIGH',
                description: 'Missing variable assignment commands'
            },
            {
                pattern: /Unknown function|Undefined variable/i,
                category: 'library_missing',
                severity: 'CRITICAL',
                description: 'Missing library functions or variables'
            },
            {
                pattern: /Invalid array access|array.*error/i,
                category: 'array_handling',
                severity: 'HIGH',
                description: 'Array access or initialization errors'
            },
            {
                pattern: /IF_STATEMENT.*different|different.*IF_STATEMENT/i,
                category: 'control_flow',
                severity: 'HIGH',
                description: 'Control flow execution differences'
            },
            {
                pattern: /FOR_LOOP.*LOOP_START|LOOP_START.*FOR_LOOP/i,
                category: 'loop_structure',
                severity: 'MEDIUM',
                description: 'Loop command structure differences'
            },
            {
                pattern: /Serial.*undefined|Serial.*missing/i,
                category: 'serial_library',
                severity: 'HIGH',
                description: 'Serial library availability issues'
            },
            {
                pattern: /runtime error.*not present|error causes.*execution/i,
                category: 'error_handling',
                severity: 'MEDIUM',
                description: 'Runtime error handling differences'
            }
        ];
    }

    /**
     * Analyze specific test for execution differences
     */
    async analyzeTest(testNum) {
        console.log(`\n=== Smart Diff Analysis: Test ${testNum} ===`);

        const cppFile = path.join(this.buildDir, `test${testNum}_cpp_debug.json`);
        const jsFile = path.join(this.buildDir, `test${testNum}_js_debug.json`);

        // Check if files exist
        if (!fs.existsSync(cppFile)) {
            console.error(`❌ C++ debug file not found: ${cppFile}`);
            return null;
        }
        if (!fs.existsSync(jsFile)) {
            console.error(`❌ JS debug file not found: ${jsFile}`);
            return null;
        }

        try {
            const cppContent = fs.readFileSync(cppFile, 'utf8');
            const jsContent = fs.readFileSync(jsFile, 'utf8');

            return this.performSmartDiff(cppContent, jsContent, testNum);
        } catch (error) {
            console.error(`❌ Error reading files: ${error.message}`);
            return null;
        }
    }

    /**
     * Perform intelligent diff analysis
     */
    performSmartDiff(cppContent, jsContent, testNum) {
        console.log('📊 Normalizing outputs for comparison...\n');

        // Normalize both outputs
        const normalizedCpp = this.normalizeOutput(cppContent);
        const normalizedJs = this.normalizeOutput(jsContent);

        // Check if they match after normalization
        const exactMatch = normalizedCpp === normalizedJs;

        const analysis = {
            testNum,
            exactMatch,
            differences: [],
            executionIssues: [],
            harmlessVariations: [],
            severity: 'NONE'
        };

        if (exactMatch) {
            console.log('✅ **EXACT MATCH** after normalization');
            console.log('   This test passes - no execution differences found.\n');
            return analysis;
        }

        console.log('🔍 Found differences, analyzing...\n');

        // Analyze the specific differences
        this.analyzeDifferences(cppContent, jsContent, analysis);

        // Generate detailed report
        this.generateDiffReport(analysis);

        return analysis;
    }

    /**
     * Normalize output by applying all normalization patterns
     */
    normalizeOutput(content) {
        let normalized = content;

        for (const norm of this.normalizationPatterns) {
            const before = normalized;
            normalized = normalized.replace(norm.pattern, norm.replacement);

            if (before !== normalized) {
                // Track which normalizations were applied
                // console.log(`  Applied: ${norm.description}`);
            }
        }

        return normalized;
    }

    /**
     * Analyze specific differences between outputs
     */
    analyzeDifferences(cppContent, jsContent, analysis) {
        const combinedContent = `CPP: ${cppContent}\nJS: ${jsContent}`;

        // Check for execution difference patterns
        for (const pattern of this.executionDifferencePatterns) {
            if (pattern.pattern.test(combinedContent)) {
                analysis.executionIssues.push({
                    category: pattern.category,
                    severity: pattern.severity,
                    description: pattern.description,
                    pattern: pattern.pattern.toString()
                });

                // Update overall severity
                if (pattern.severity === 'CRITICAL' ||
                    (pattern.severity === 'HIGH' && analysis.severity !== 'CRITICAL')) {
                    analysis.severity = pattern.severity;
                } else if (pattern.severity === 'MEDIUM' && analysis.severity === 'NONE') {
                    analysis.severity = pattern.severity;
                }
            }
        }

        // Perform line-by-line diff for detailed analysis
        this.performLineDiff(cppContent, jsContent, analysis);
    }

    /**
     * Perform line-by-line difference analysis
     */
    performLineDiff(cppContent, jsContent, analysis) {
        const cppLines = cppContent.split('\n').filter(line => line.trim());
        const jsLines = jsContent.split('\n').filter(line => line.trim());

        // Simple line comparison (could be enhanced with proper diff algorithm)
        const maxLines = Math.max(cppLines.length, jsLines.length);

        for (let i = 0; i < maxLines; i++) {
            const cppLine = cppLines[i] || '';
            const jsLine = jsLines[i] || '';

            if (cppLine !== jsLine) {
                // Check if this difference is harmless after normalization
                const normalizedCppLine = this.normalizeOutput(cppLine);
                const normalizedJsLine = this.normalizeOutput(jsLine);

                if (normalizedCppLine === normalizedJsLine) {
                    analysis.harmlessVariations.push({
                        lineNum: i + 1,
                        type: 'formatting',
                        cppLine: cppLine.substring(0, 100),
                        jsLine: jsLine.substring(0, 100)
                    });
                } else {
                    analysis.differences.push({
                        lineNum: i + 1,
                        type: 'functional',
                        cppLine: cppLine.substring(0, 100),
                        jsLine: jsLine.substring(0, 100)
                    });
                }
            }
        }
    }

    /**
     * Generate detailed diff report
     */
    generateDiffReport(analysis) {
        console.log('📋 **ANALYSIS RESULTS**\n');

        // Overall status
        if (analysis.severity === 'NONE') {
            console.log('✅ **STATUS**: Minor differences only (likely formatting)');
        } else {
            console.log(`❌ **STATUS**: ${analysis.severity} execution differences found`);
        }

        console.log(`   Functional differences: ${analysis.differences.length}`);
        console.log(`   Harmless variations: ${analysis.harmlessVariations.length}`);
        console.log(`   Execution issues: ${analysis.executionIssues.length}\n`);

        // Execution issues (most important)
        if (analysis.executionIssues.length > 0) {
            console.log('🚨 **EXECUTION ISSUES** (Fix Required):\n');
            analysis.executionIssues.forEach((issue, index) => {
                console.log(`${index + 1}. **${issue.category}** (${issue.severity})`);
                console.log(`   ${issue.description}\n`);
            });
        }

        // Key functional differences
        if (analysis.differences.length > 0) {
            console.log('🔍 **KEY FUNCTIONAL DIFFERENCES**:\n');
            analysis.differences.slice(0, 5).forEach((diff, index) => {
                console.log(`${index + 1}. Line ${diff.lineNum}:`);
                console.log(`   C++: ${diff.cppLine}${diff.cppLine.length >= 100 ? '...' : ''}`);
                console.log(`   JS:  ${diff.jsLine}${diff.jsLine.length >= 100 ? '...' : ''}\n`);
            });

            if (analysis.differences.length > 5) {
                console.log(`   (${analysis.differences.length - 5} more differences...)\n`);
            }
        }

        // Recommendations
        this.generateRecommendations(analysis);
    }

    /**
     * Generate fix recommendations based on analysis
     */
    generateRecommendations(analysis) {
        console.log('💡 **RECOMMENDATIONS**:\n');

        if (analysis.executionIssues.length === 0 && analysis.differences.length === 0) {
            console.log('✅ This test is functioning correctly.');
            console.log('   Only harmless formatting differences detected.\n');
            return;
        }

        // Group issues by category for targeted recommendations
        const issuesByCategory = analysis.executionIssues.reduce((acc, issue) => {
            if (!acc[issue.category]) acc[issue.category] = [];
            acc[issue.category].push(issue);
            return acc;
        }, {});

        Object.entries(issuesByCategory).forEach(([category, issues]) => {
            console.log(`🎯 **${category.toUpperCase()}**:`);

            switch (category) {
                case 'serial_library':
                    console.log('   → Add Serial object initialization in C++ interpreter');
                    console.log('   → Implement Serial.begin(), Serial.print(), Serial.println() methods');
                    break;
                case 'library_missing':
                    console.log('   → Check function/variable definitions in C++ interpreter');
                    console.log('   → Verify Arduino library integration');
                    break;
                case 'array_handling':
                    console.log('   → Fix array initialization in C++ interpreter');
                    console.log('   → Implement proper array access bounds checking');
                    break;
                case 'control_flow':
                    console.log('   → Review IF statement execution logic');
                    console.log('   → Check conditional evaluation in C++ interpreter');
                    break;
                case 'loop_structure':
                    console.log('   → Standardize loop command generation between platforms');
                    console.log('   → Align FOR_LOOP vs LOOP_START/LOOP_END patterns');
                    break;
                default:
                    console.log(`   → Manual analysis required for ${category} issues`);
            }
            console.log('');
        });

        console.log('📁 **NEXT STEPS**:');
        console.log('1. Focus on CRITICAL and HIGH severity issues first');
        console.log('2. Test individual fixes with validate_cross_platform tool');
        console.log('3. Run regression tests after each fix\n');
    }

    /**
     * Save analysis results to file
     */
    saveAnalysis(analysis) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const analysisFile = path.join(this.buildDir, `smart_diff_test${analysis.testNum}_${timestamp}.json`);

        fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
        console.log(`📄 Detailed analysis saved to: ${analysisFile}`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const testNum = args[0] ? parseInt(args[0]) : null;

    if (!testNum || isNaN(testNum)) {
        console.error('Usage: node smart_diff_analyzer.js <test_number>');
        console.error('Example: node smart_diff_analyzer.js 21');
        process.exit(1);
    }

    const analyzer = new SmartDiffAnalyzer();
    const analysis = await analyzer.analyzeTest(testNum);

    if (analysis) {
        analyzer.saveAnalysis(analysis);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = SmartDiffAnalyzer;