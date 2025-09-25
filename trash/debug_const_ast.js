const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Test const variable declaration
const code = `
const int buttonPin = 2;
const int ledPin = 13;
int buttonState = 0;
`;

console.log('=== ANALYZING CONST VARIABLE AST STRUCTURE ===');
const ast = parse(code);

console.log('=== LOOKING FOR VAR_DECL NODES ===');
function findVarDeclNodes(node, path = '') {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'VarDeclNode') {
        console.log(`Found VarDeclNode at: ${path}`);
        console.log('Node details:', JSON.stringify(node, null, 2));
    }
    
    // Recursively search
    if (Array.isArray(node)) {
        node.forEach((item, i) => findVarDeclNodes(item, `${path}[${i}]`));
    } else if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            findVarDeclNodes(node[key], path ? `${path}.${key}` : key);
        });
    }
}

findVarDeclNodes(ast);