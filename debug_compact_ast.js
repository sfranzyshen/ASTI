const fs = require('fs');
const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Get the source code and parse it
const meta = fs.readFileSync('test_data/example_096.meta', 'utf8');
const sourceCode = meta.split('content=')[1];
const ast = parse(sourceCode);

console.log('=== CONVERTING TO COMPACT AST ===');

// Export to CompactAST binary format
const binaryData = exportCompactAST(ast);

console.log('Binary data type:', typeof binaryData);
console.log('Binary data constructor:', binaryData ? binaryData.constructor.name : 'null');
console.log('Binary data length:', binaryData ? binaryData.byteLength || binaryData.length : 'undefined');

if (binaryData) {
    // Convert to Buffer if needed
    const binaryBuffer = Buffer.from(binaryData);
    console.log('Binary buffer length:', binaryBuffer.length);
    console.log('First 20 bytes:', Array.from(binaryBuffer.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Check if this matches the existing test data
    const existingBinary = fs.readFileSync('test_data/example_096.ast');
    console.log('\nExisting test data length:', existingBinary.length);

    const matches = Buffer.compare(binaryBuffer, existingBinary) === 0;
    console.log('Binary data matches existing:', matches);

    if (!matches) {
        console.log('\n🚨 BINARY DATA MISMATCH!');
        console.log('Current JavaScript AST exports different binary than stored!');
        console.log('This means test data needs regeneration or CompactAST export bug exists.');

        // Write the new binary to compare
        fs.writeFileSync('debug_new_binary.ast', binaryBuffer);
        console.log('New binary saved as debug_new_binary.ast for comparison');
    } else {
        console.log('\n✅ Binary data matches - the issue is in C++ deserialization');
    }
} else {
    console.log('\n🚨 EXPORT FAILED! CompactAST export returned null/undefined');
}