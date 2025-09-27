const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

// Complete ternary test with defined variables
const code = `
bool condition = true;
int x = condition ? 10 : 20;
int y = condition ? 100 : 200;
`;

console.log('🔧 Generating complete ternary expression test...');
console.log('📝 Test code:', code.trim());

try {
    // Parse the code
    const ast = parse(code);
    console.log('✅ AST generated successfully');

    // Export as CompactAST
    const compactASTBuffer = exportCompactAST(ast);
    console.log(`✅ CompactAST generated: ${compactASTBuffer.byteLength} bytes`);
    
    // Save to file for C++ testing
    const buffer = Buffer.from(compactASTBuffer);
    fs.writeFileSync('test_complete_ternary.ast', buffer);
    console.log('📁 File: test_complete_ternary.ast');
    console.log('🎯 Ready for C++ complete ternary testing');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
}