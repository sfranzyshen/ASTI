const { parse } = require('../../src/javascript/ArduinoParser.js');

const code = `
void setup() {
    int condition = 1;
    int x = condition ? 10 : 20;
}

void loop() {
}
`;

const ast = parse(code);

function listAllNodeTypes(node, path = '', depth = 0) {
    if (depth > 10) return; // Prevent infinite recursion
    
    if (node && node.nodeType) {
        console.log(`${path}: ${node.nodeType}`);
        
        // Check for initializer property specifically
        if (node.initializer && node.initializer.nodeType) {
            console.log(`${path}.initializer: ${node.initializer.nodeType}`);
        }
    }
    
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            listAllNodeTypes(node.children[i], `${path}[${i}]`, depth + 1);
        }
    }
    
    // Check object properties
    if (typeof node === 'object' && node !== null) {
        for (const [key, value] of Object.entries(node)) {
            if (value && typeof value === 'object' && value.nodeType && key !== 'children') {
                listAllNodeTypes(value, `${path}.${key}`, depth + 1);
            }
        }
    }
}

console.log('🔍 Listing all nodeTypes in JavaScript AST...');
listAllNodeTypes(ast, 'root');