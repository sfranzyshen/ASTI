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

function findTernaryExpression(node, path = '') {
    // Check all possible ternary expression patterns
    if (node.nodeType && (
        node.nodeType === 'TERNARY_EXPR' || 
        node.nodeType === 'TernaryExpression' ||
        node.nodeType === 'TERNARY_EXPRESSION' ||
        String(node.nodeType).includes('ternary') ||
        String(node.nodeType).includes('Ternary')
    )) {
        console.log(`🎯 FOUND: ${path}`);
        console.log(`   NodeType: "${node.nodeType}"`);
        console.log(`   Children: ${node.children ? node.children.length : 0}`);
        console.log(`   Has condition property: ${node.condition ? 'YES' : 'NO'}`);
        console.log(`   Has consequent property: ${node.consequent ? 'YES' : 'NO'}`);
        console.log(`   Has alternate property: ${node.alternate ? 'YES' : 'NO'}`);
        return;
    }
    
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            findTernaryExpression(node.children[i], path + `[${i}]`);
        }
    }
    
    // Also check object properties for nested nodes
    for (const [key, value] of Object.entries(node)) {
        if (value && typeof value === 'object' && value.nodeType) {
            findTernaryExpression(value, path + `.${key}`);
        }
    }
}

console.log('🔍 Searching for ternary expression with any nodeType...');
findTernaryExpression(ast);