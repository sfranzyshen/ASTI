const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

const code = `int x = condition ? 10 : 20;`;

console.log('🔍 Debugging JavaScript CompactAST export...');

// Parse the code
const ast = parse(code);
console.log('\n📋 JavaScript AST:');
console.log(JSON.stringify(ast, null, 2));

// Check if ternary expression exists in AST
function findTernaryInAST(node, path = '') {
    if (node && typeof node === 'object') {
        if (node.type === 'TernaryExpression') {
            console.log(`\n🎯 Found TernaryExpression at ${path}:`);
            console.log(`   Type: ${node.type}`);
            console.log(`   Condition: ${node.condition ? node.condition.type : 'MISSING'}`);
            console.log(`   Consequent: ${node.consequent ? node.consequent.type : 'MISSING'}`);
            console.log(`   Alternate: ${node.alternate ? node.alternate.type : 'MISSING'}`);
            return true;
        }
        
        for (const [key, value] of Object.entries(node)) {
            if (findTernaryInAST(value, path + '.' + key)) {
                return true;
            }
        }
    }
    return false;
}

const foundTernary = findTernaryInAST(ast);
if (!foundTernary) {
    console.log('\n❌ No TernaryExpression found in AST!');
}

// Export to CompactAST and check byte details
try {
    console.log('\n📦 Exporting to CompactAST...');
    const compactAST = exportCompactAST(ast);
    console.log(`✅ Export successful: ${compactAST.byteLength} bytes`);
    
    // Show first 50 bytes in hex for analysis
    const view = new Uint8Array(compactAST);
    const hexBytes = Array.from(view.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`📊 First 50 bytes: ${hexBytes}`);
    
} catch (error) {
    console.error('❌ CompactAST export failed:', error.message);
}