#!/usr/bin/env node

const { parse, exportCompactAST, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');

// Simple test code with MemberAccessNode
const code = `
void setup() {
    Serial.begin(9600);
}
`;

console.log('=== PARSING TEST CODE ===');
const ast = parse(code);

console.log('\n=== AST STRUCTURE ===');
console.log(prettyPrintAST(ast, 0));

console.log('\n=== COMPACT AST EXPORT ===');
const compactAST = exportCompactAST(ast);
const buffer = Buffer.from(compactAST);

console.log(`CompactAST size: ${buffer.length} bytes`);
console.log('First 100 bytes (hex):');
for (let i = 0; i < Math.min(100, buffer.length); i += 16) {
    const slice = buffer.slice(i, Math.min(i + 16, buffer.length));
    const hex = slice.map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = slice.map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
    console.log(`${i.toString().padStart(4, '0')}: ${hex.padEnd(47, ' ')} | ${ascii}`);
}

// Export for C++ debugging
require('fs').writeFileSync('debug_memberaccess.ast', new Uint8Array(compactAST));
console.log('\nExported to debug_memberaccess.ast');