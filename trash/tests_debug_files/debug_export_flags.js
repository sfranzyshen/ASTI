const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Test 4 Fade.ino code - simplified to just one operator
const ast = parse(`
void loop() { 
  int brightness = 0;
  int fadeAmount = 5;
  brightness = brightness + fadeAmount; 
}
`);

console.log('=== DEBUGGING COMPACTAST EXPORT FLAGS ===');

// Export to binary
const compactAST = exportCompactAST(ast);
console.log('Binary size:', compactAST.byteLength);

// Find operator nodes in AST
function findOperatorNodes(node, path = '') {
  if (node && typeof node === 'object') {
    if (node.type === 'BinaryOpNode') {
      console.log('\nFOUND BINARY OPERATOR:');
      console.log('  node.op:', JSON.stringify(node.op));
      console.log('  Expected HAS_VALUE condition result:', !!(node.op && node.op.value !== undefined));
    }
    
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        value.forEach((item, idx) => findOperatorNodes(item, `${path}.${key}[${idx}]`));
      } else {
        findOperatorNodes(value, `${path}.${key}`);
      }
    }
  }
}

findOperatorNodes(ast);
