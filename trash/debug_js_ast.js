const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Simple test case with operator
const code = `
void setup() {
    int x = 5;
    x = -x;  // unary minus
    x = x + 1;  // binary plus
}
`;

console.log('=== PARSING SIMPLE OPERATOR TEST ===');
const ast = parse(code);

// Find operator nodes
function findOperatorNodes(node, path = '') {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'UnaryOpNode' || node.type === 'BinaryOpNode') {
        console.log(`\n${node.type} found at ${path}:`);
        console.log('  operator field:', node.operator);
        console.log('  op field:', node.op);
        console.log('  value field:', node.value);
        console.log('  All fields:', Object.keys(node));
        console.log('  Full node:', JSON.stringify(node, null, 2));
    }
    
    // Recursively search
    if (Array.isArray(node)) {
        node.forEach((item, i) => findOperatorNodes(item, `${path}[${i}]`));
    } else if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            findOperatorNodes(node[key], path ? `${path}.${key}` : key);
        });
    }
}

findOperatorNodes(ast);