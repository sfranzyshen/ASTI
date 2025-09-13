const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const fs = require('fs');

// Use the debug CompactAST version
const debugCompactAST = require('./debug_CompactAST.js');

// Simple test case
const code = `
void setup() {
    int x = 5;
    x = -x;  // unary minus
}
`;

console.log('=== TESTING WITH DEBUG EXPORT ===');
const ast = parse(code);

// Use the debug CompactAST export function
const writer = new debugCompactAST.CompactASTWriter();
const binaryData = writer.write(ast);

console.log('Export completed, binary size:', binaryData.byteLength);