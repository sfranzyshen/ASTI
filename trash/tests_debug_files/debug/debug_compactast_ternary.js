const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

const code = `
void setup() {
    int condition = 1;
    int x = condition ? 10 : 20;
}

void loop() {
}
`;

console.log('🔍 Debugging ternary expression CompactAST structure...');

// Parse and examine JavaScript AST
const ast = parse(code);

function findTernaryExpression(node, depth = 0) {
    const indent = '  '.repeat(depth);
    
    if (node.nodeType === 'TERNARY_EXPR') {
        console.log(`${indent}🎯 FOUND TERNARY EXPRESSION!`);
        console.log(`${indent}  Node type: ${node.nodeType}`);
        console.log(`${indent}  Children: ${node.children ? node.children.length : 0}`);
        
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                console.log(`${indent}    Child ${i}: ${child.nodeType} ${child.value ? `(${child.value})` : ''}`);
            }
        }
        
        // Also check direct properties
        if (node.condition) {
            console.log(`${indent}  Condition property: ${node.condition.nodeType} ${node.condition.value ? `(${node.condition.value})` : ''}`);
        }
        if (node.consequent) {
            console.log(`${indent}  Consequent property: ${node.consequent.nodeType} ${node.consequent.value ? `(${node.consequent.value})` : ''}`);
        }
        if (node.alternate) {
            console.log(`${indent}  Alternate property: ${node.alternate.nodeType} ${node.alternate.value ? `(${node.alternate.value})` : ''}`);
        }
        
        return true;
    }
    
    if (node.children) {
        for (const child of node.children) {
            if (findTernaryExpression(child, depth + 1)) {
                return true; // Found it, stop searching
            }
        }
    }
    
    return false;
}

console.log('📋 Searching JavaScript AST for ternary expression...');
const found = findTernaryExpression(ast);

if (!found) {
    console.log('❌ Ternary expression not found in JavaScript AST!');
}

// Export to CompactAST
console.log('\n📦 Exporting to CompactAST...');
const compactASTBuffer = exportCompactAST(ast);
const buffer = Buffer.from(compactASTBuffer);

fs.writeFileSync('debug_ternary_structure.ast', buffer);
console.log(`✅ CompactAST exported: ${buffer.length} bytes`);
console.log(`📁 File: debug_ternary_structure.ast`);