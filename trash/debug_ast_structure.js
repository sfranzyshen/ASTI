const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const fs = require('fs');

// Simple test case
const code = `
void setup() {
    int x = 5;
    x = -x;  // unary minus
}
`;

console.log('=== ANALYZING AST STRUCTURE ===');
const ast = parse(code);

// Pretty print the AST structure
console.log('Full AST:');
console.log(JSON.stringify(ast, null, 2));

console.log('\n=== LOOKING FOR UNARY OP NODE ===');
function findUnaryNodes(node, path = '') {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'UnaryOpNode') {
        console.log(`Found UnaryOpNode at: ${path}`);
        console.log('Node details:', JSON.stringify(node, null, 2));
    }
    
    // Recursively search
    if (Array.isArray(node)) {
        node.forEach((item, i) => findUnaryNodes(item, `${path}[${i}]`));
    } else if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            findUnaryNodes(node[key], path ? `${path}.${key}` : key);
        });
    }
}

findUnaryNodes(ast);