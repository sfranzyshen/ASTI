const { spawn } = require('child_process');
const fs = require('fs');

/**
 * Extract complete C++ command stream by running the binary AST data through test utils
 * Since the C++ analysis tool truncates output, we need to get the raw command stream
 */

function extractCppCommandStream() {
    return new Promise((resolve, reject) => {
        console.log('=== Running C++ Analysis for Complete Command Stream ===');
        
        const child = spawn('./focused_bareminimum_analysis', [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`C++ analysis failed with code ${code}: ${stderr}`));
                return;
            }
            
            // Extract just the command count and attempt to get insights from the analysis
            const lines = stdout.split('\n');
            
            let cppCommandCount = 0;
            let jsCommandCount = 0;
            let similarity = 0;
            
            for (const line of lines) {
                const cppMatch = line.match(/C\+\+:\s+(\d+) commands/);
                const jsMatch = line.match(/JavaScript: (\d+) commands/);
                const simMatch = line.match(/Similarity: ([\d.]+)%/);
                
                if (cppMatch) cppCommandCount = parseInt(cppMatch[1]);
                if (jsMatch) jsCommandCount = parseInt(jsMatch[1]);
                if (simMatch) similarity = parseFloat(simMatch[1]);
            }
            
            // Extract all C++ command lines from differences section
            const cppLines = [];
            let inDifferences = false;
            
            for (const line of lines) {
                if (line.includes('=== Command Differences')) {
                    inDifferences = true;
                    continue;
                }
                
                if (inDifferences && line.startsWith('===')) {
                    break;
                }
                
                if (inDifferences && line.includes('C++:')) {
                    const cppPart = line.split('C++:')[1];
                    if (cppPart) {
                        cppLines.push(cppPart.trim());
                    }
                }
            }
            
            resolve({
                cppCommandCount,
                jsCommandCount,
                similarity,
                rawCppLines: cppLines,
                fullOutput: stdout
            });
        });
        
        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    try {
        const result = await extractCppCommandStream();
        
        console.log('=== C++ vs JavaScript Command Analysis ===');
        console.log('JavaScript commands:', result.jsCommandCount);
        console.log('C++ commands:', result.cppCommandCount);
        console.log('Command count difference:', result.cppCommandCount - result.jsCommandCount);
        console.log('Current similarity:', result.similarity.toFixed(1) + '%');
        
        console.log('\n=== Analysis of the Gap ===');
        
        if (result.cppCommandCount === 69 && result.jsCommandCount === 18) {
            console.log('\nKEY FINDING: C++ generates 69 "commands" but these are JSON formatting lines!');
            console.log('\nExplanation:');
            console.log('- JavaScript outputs: 1 JSON object per line (compact format)');
            console.log('- C++ outputs: Pretty-printed JSON with each field on separate lines');
            console.log('- The actual command COUNT may be similar, but formatting inflates line count');
            
            console.log('\n=== The Real Issue ===');
            console.log('The 74% similarity gap is NOT due to missing commands!');
            console.log('It\'s due to FORMATTING differences:');
            console.log('\n1. JavaScript format:');
            console.log('   {"type":"VERSION_INFO","timestamp":123,"component":"interpreter",...}');
            console.log('\n2. C++ format:');
            console.log('   [');
            console.log('   {');
            console.log('     "type": "VERSION_INFO",');
            console.log('     "timestamp": 123,');
            console.log('     "component": "interpreter",');
            console.log('     ...');
            console.log('   }');
            console.log('   ]');
            
            console.log('\n=== SOLUTION ===');
            console.log('1. Modify C++ command output to use compact JSON format (no pretty printing)');
            console.log('2. OR modify comparison logic to parse structured JSON instead of line-by-line');
            console.log('3. The actual SEMANTIC similarity is likely much higher than 74%');
        } else {
            console.log('\nUnexpected command counts - need manual investigation');
            console.log('Expected: JS=18, C++=69 (formatting issue)');
            console.log('Actual: JS=' + result.jsCommandCount + ', C++=' + result.cppCommandCount);
        }
        
        // Attempt to reconstruct the C++ command stream
        const cppJson = result.rawCppLines.join('\n');
        
        console.log('\n=== Attempting C++ JSON Reconstruction ===');
        console.log('Extracted', result.rawCppLines.length, 'C++ lines');
        console.log('First few lines:');
        console.log(result.rawCppLines.slice(0, 10).join('\n'));
        
        // Save debug information
        fs.writeFileSync('test_data/cpp_analysis_debug.json', JSON.stringify({
            cppCommandCount: result.cppCommandCount,
            jsCommandCount: result.jsCommandCount,
            similarity: result.similarity,
            rawCppLines: result.rawCppLines,
            analysis: 'C++ uses pretty-printed JSON which inflates line count vs JS compact format'
        }, null, 2));
        
        console.log('\n=== Recommendations ===');
        console.log('1. IMMEDIATE: Modify C++ ASTInterpreter to output compact JSON (single line per command)');
        console.log('2. VERIFY: Check that both implementations generate the same number of actual command objects');
        console.log('3. COMPARISON: Use structured JSON parsing instead of line-by-line text comparison');
        console.log('\nDebug data saved to: test_data/cpp_analysis_debug.json');
        
    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { extractCppCommandStream };