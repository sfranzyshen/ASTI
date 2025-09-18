const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Simple test case with operators
const code = `
void setup() {
    int x = 5;
    x = -x;  // unary minus
    x = x + 1;  // binary plus
}
`;

console.log('=== TESTING HAS_VALUE FLAG LOGIC ===');
const ast = parse(code);

// Find operator nodes and simulate the flag calculation
function analyzeNodes(node, path = '') {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'UnaryOpNode' || node.type === 'BinaryOpNode') {
        console.log(`\n${node.type} at ${path}:`);
        console.log('  node.value:', node.value);
        console.log('  node.operator:', node.operator);
        console.log('  node.op:', node.op);
        console.log('  node.op?.value:', node.op?.value);
        
        // Simulate the flag calculation from CompactAST.js line 386
        const hasValueFlag = (node.value !== undefined || node.operator !== undefined || (node.op && node.op.value !== undefined));
        console.log('  HAS_VALUE flag would be:', hasValueFlag);
        
        // Check what would be written as value
        if (node.value !== undefined) {
            console.log('  Would write node.value:', node.value);
        } else if (node.operator !== undefined) {
            console.log('  Would write node.operator:', node.operator);
        } else if (node.op && node.op.value !== undefined) {
            console.log('  Would write node.op.value:', node.op.value);
        } else {
            console.log('  Would write: NOTHING (no value)');
        }
    }
    
    // Recursively search
    if (Array.isArray(node)) {
        node.forEach((item, i) => analyzeNodes(item, `${path}[${i}]`));
    } else if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            analyzeNodes(node[key], path ? `${path}.${key}` : key);
        });
    }
}

analyzeNodes(ast);