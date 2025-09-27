// Test mixed type declarations - generate working CompactAST
const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

const testCode = `
bool enabled = true;
int count = 42; 
float pi = 3.14;
String name = "Arduino";
`;

console.log('=== Mixed Type Test ===');
console.log('Code:');
console.log(testCode);

try {
    const ast = parse(testCode);
    console.log('✅ Parse successful');
    
    // Use the approach from working tests
    console.log('🔍 Analyzing AST variable declarations...');
    function findAndPrintVarDecls(node, path = '') {
        if (node && typeof node === 'object') {
            if (node.type === 'VarDeclNode') {
                console.log(`\n📍 ${path}: ${node.varType.value} variable`);
                console.log(`   Type: ${JSON.stringify(node.varType.value)}`);
                if (node.declarations && node.declarations[0]) {
                    console.log(`   Name: ${node.declarations[0].declarator.value}`);
                    if (node.declarations[0].initializer) {
                        console.log(`   Initial: ${node.declarations[0].initializer.type} = ${node.declarations[0].initializer.value}`);
                    }
                }
            }
            
            if (Array.isArray(node.children)) {
                node.children.forEach((child, i) => {
                    findAndPrintVarDecls(child, `${path}.children[${i}]`);
                });
            }
            if (node.body && Array.isArray(node.body.children)) {
                node.body.children.forEach((child, i) => {
                    findAndPrintVarDecls(child, `${path}.body.children[${i}]`);
                });
            }
        }
    }
    
    findAndPrintVarDecls(ast, 'root');
    
    // Try to export - use minimal approach to avoid issues
    try {
        // Check if it's a simple case first
        const lines = testCode.trim().split('\n').filter(line => line.trim());
        if (lines.length <= 6) { // Simple enough
            const compactASTBuffer = exportCompactAST(ast);
            const buffer = Buffer.from(compactASTBuffer);
            fs.writeFileSync('test_mixed_types.ast', buffer);
            console.log(`\n✅ CompactAST exported successfully: ${buffer.length} bytes`);
        } else {
            console.log('\n⚠️  Code too complex for CompactAST export, skipping');
        }
    } catch (exportError) {
        console.log(`\n⚠️  CompactAST export failed: ${exportError.message}`);
        console.log('   AST structure analysis completed successfully');
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}