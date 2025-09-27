const { Parser, parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

/**
 * Create the most minimal possible CompactAST to isolate the issue
 */

console.log('=== Minimal CompactAST Test ===');

// Even simpler code - just a variable declaration with no initializer
const testCode = `int x;`;

try {
    const ast = parse(testCode);
    console.log('AST structure:');
    console.log(JSON.stringify(ast, null, 2));
    
    const buffer = exportCompactAST(ast);
    
    console.log(`\\nBuffer size: ${buffer.byteLength} bytes`);
    
    // Write file for C++ test
    fs.writeFileSync('minimal_test.ast', Buffer.from(buffer));
    
    // Raw byte analysis focused on the problematic area
    const view = new DataView(buffer);
    
    console.log('\\nFull byte dump:');
    for (let i = 0; i < buffer.byteLength; i++) {
        const byte = view.getUint8(i);
        console.log(`${i}: 0x${byte.toString(16).padStart(2, '0')} (${byte})`);
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
}