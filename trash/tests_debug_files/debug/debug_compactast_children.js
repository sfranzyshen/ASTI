const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

// Simple test case
const code = `int x = condition ? 10 : 20;`;
console.log('🔍 Debugging CompactAST child export for ternary expressions...');

// Parse and get the AST
const ast = parse(code);

// Find the ternary expression in the AST
function findTernaryExpression(node, path = '') {
    if (node && typeof node === 'object') {
        if (node.type === 'TernaryExpression') {
            console.log(`\n🎯 Found TernaryExpression at ${path}`);
            console.log('   Type:', node.type);
            console.log('   Condition:', node.condition ? node.condition.type : 'MISSING');
            console.log('   Consequent:', node.consequent ? node.consequent.type : 'MISSING');
            console.log('   Alternate:', node.alternate ? node.alternate.type : 'MISSING');
            
            // Test the CompactAST getNamedChildren function
            console.log('\n📋 Testing getNamedChildren for TernaryExpression...');
            
            // Create a temporary exporter to access the getNamedChildren method
            class TestExporter {
                getNamedChildren(node) {
                    const childrenMap = {
                        'TernaryExpression': ['condition', 'consequent', 'alternate'],
                        // ... other mappings would be here
                    };
                    
                    return childrenMap[node.type] || [];
                }
            }
            
            const testExporter = new TestExporter();
            const namedChildren = testExporter.getNamedChildren(node);
            console.log('   Named children list:', namedChildren);
            
            // Check if each named child exists
            for (const childName of namedChildren) {
                if (node[childName]) {
                    console.log(`   ✅ ${childName}: ${node[childName].type || 'object'}`);
                } else {
                    console.log(`   ❌ ${childName}: MISSING!`);
                }
            }
            
            return node;
        }
        
        // Recursively search
        for (const [key, value] of Object.entries(node)) {
            const result = findTernaryExpression(value, path + '.' + key);
            if (result) return result;
        }
    }
    return null;
}

const ternaryNode = findTernaryExpression(ast);

if (ternaryNode) {
    console.log('\n📦 Now testing full CompactAST export...');
    try {
        const compactAST = exportCompactAST(ast);
        console.log(`✅ Export successful: ${compactAST.byteLength} bytes`);
    } catch (error) {
        console.error('❌ Export failed:', error.message);
    }
} else {
    console.log('❌ No TernaryExpression found in AST!');
}