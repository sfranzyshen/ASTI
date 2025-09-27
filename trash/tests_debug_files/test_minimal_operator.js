const fs = require('fs');
const path = require('path');

// Manually include CompactAST since require() fails
const compactASTCode = fs.readFileSync(path.join(__dirname, 'libs', 'CompactAST', 'src', 'CompactAST.js'), 'utf8');
eval(compactASTCode);

// Manually include ArduinoParser  
const parserCode = fs.readFileSync(path.join(__dirname, 'libs', 'ArduinoParser', 'src', 'ArduinoParser.js'), 'utf8');
eval(parserCode);

// Test minimal operator
const ast = parse('void setup() { int x = 5 + 3; }');

function findOperators(node) {
  if (node && typeof node === 'object') {
    if (node.type === 'BinaryOpNode') {
      console.log('FOUND BINARY OP:');
      console.log('  node.op:', JSON.stringify(node.op));
      console.log('  Condition check:', !!(node.op && node.op.value !== undefined));
      
      // Test export 
      const binary = exportCompactAST(ast);
      console.log('  Binary exported, size:', binary.byteLength);
      return true;
    }
    
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        value.forEach((item) => findOperators(item));
      } else {
        findOperators(value);
      }
    }
  }
}

findOperators(ast);
