const { Parser, parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

/**
 * Test each part of the AST step by step to isolate the issue
 */

console.log('=== Step-by-Step AST Test ===');

const testCases = [
    { name: "minimal", code: "int x;" },
    { name: "with_number", code: "int x = 13;" },
    { name: "simple_function", code: "void setup() {}" },
    { name: "function_with_var", code: "void setup() { int x = 13; }" }
];

for (const testCase of testCases) {
    try {
        console.log(`\\n--- Testing: ${testCase.name} ---`);
        console.log(`Code: ${testCase.code}`);
        
        const ast = parse(testCase.code);
        const buffer = exportCompactAST(ast);
        
        const filename = `test_${testCase.name}.ast`;
        fs.writeFileSync(filename, Buffer.from(buffer));
        
        console.log(`✅ Generated ${filename}: ${buffer.byteLength} bytes`);
        
        // Test with C++
        fs.writeFileSync('test_simple.ast', Buffer.from(buffer));
        
        console.log('Testing with C++ reader...');
        
    } catch (error) {
        console.error(`❌ Error in ${testCase.name}:`, error.message);
    }
}