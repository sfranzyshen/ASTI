const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Simple test case with operator
const code = `
void setup() {
    int x = 5;
    x = -x;  // unary minus
}
`;

console.log('=== TESTING COMPACT AST EXPORT ===');
const ast = parse(code);
const binaryData = exportCompactAST(ast);

console.log('Binary data type:', typeof binaryData);
console.log('Binary data constructor:', binaryData.constructor.name);
console.log('Binary data length:', binaryData.byteLength || binaryData.length);

// Convert to Uint8Array for easier handling
const uint8Data = new Uint8Array(binaryData);
console.log('Uint8Array length:', uint8Data.length);
console.log('Binary data (first 100 bytes hex):');
console.log(Array.from(uint8Data.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' '));

// Write to temporary file for analysis
const fs = require('fs');
fs.writeFileSync('debug_simple.ast', uint8Data);
console.log('Written to debug_simple.ast for analysis');