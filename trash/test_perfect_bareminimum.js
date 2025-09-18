const fs = require('fs');

// Load both command streams
const jsCommands = JSON.parse(fs.readFileSync('test_data/example_001.commands', 'utf8'));
const { execSync } = require('child_process');

// Generate C++ output
try {
    const cppOutput = execSync('./debug_command_comparison', { timeout: 10000, encoding: 'utf8' });
    const cppSection = cppOutput.split('=== C++ OUTPUT ===')[1].split('=== JavaScript OUTPUT ===')[0].trim();
    const cppCommands = JSON.parse(cppSection);

    console.log("=== PERFECT SIMILARITY TEST: BareMinimum.ino ===");
    console.log(`JavaScript commands: ${jsCommands.length}`);
    console.log(`C++ commands: ${cppCommands.length}`);
    
    // Check if command counts match
    if (jsCommands.length !== cppCommands.length) {
        console.log(`❌ Command count mismatch: JS=${jsCommands.length}, C++=${cppCommands.length}`);
        process.exit(1);
    }
    
    let perfectMatch = true;
    let differences = [];
    
    for (let i = 0; i < jsCommands.length; i++) {
        const jsCmd = jsCommands[i];
        const cppCmd = cppCommands[i];
        
        // Normalize for comparison (remove timestamps, compare structure)
        const jsNorm = {...jsCmd};
        const cppNorm = {...cppCmd};
        delete jsNorm.timestamp;
        delete cppNorm.timestamp;
        
        // Compare normalized commands
        const jsStr = JSON.stringify(jsNorm, Object.keys(jsNorm).sort());
        const cppStr = JSON.stringify(cppNorm, Object.keys(cppNorm).sort());
        
        if (jsStr !== cppStr) {
            perfectMatch = false;
            differences.push({
                index: i,
                js: jsNorm,
                cpp: cppNorm
            });
        }
    }
    
    if (perfectMatch) {
        console.log("🎉 PERFECT MATCH! 100% structural similarity achieved!");
        console.log("C++ and JavaScript generate identical command structures (ignoring timestamps)");
    } else {
        console.log(`❌ ${differences.length} structural differences found:`);
        differences.slice(0, 3).forEach(diff => {
            console.log(`\n[${diff.index}] JavaScript:`, JSON.stringify(diff.js, null, 2));
            console.log(`[${diff.index}] C++:`, JSON.stringify(diff.cpp, null, 2));
        });
    }
    
} catch (error) {
    console.error("Error running comparison:", error.message);
    process.exit(1);
}