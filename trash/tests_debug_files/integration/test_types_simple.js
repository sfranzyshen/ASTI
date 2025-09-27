// Simple test to generate AST for basic type declarations
const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

const testCode = `
float pi = 3.14;
String name = "Arduino";
bool isReady = true;
int count = 42;
`;

console.log('=== Testing Type Declarations ===');
console.log('Code:');
console.log(testCode);

try {
    // Parse the code
    const ast = parse(testCode);
    console.log('✅ Parse successful');
    
    // Debug: Print AST structure first 
    console.log('\n=== AST Structure ===');
    
    // Print VarDeclNodes specifically
    function findVarDecls(node, path = '') {
        if (node && typeof node === 'object') {
            if (node.type === 'VarDeclNode') {
                console.log(`\n📍 Found VarDeclNode at ${path}:`);
                console.log(`   varType: ${JSON.stringify(node.varType, null, 2)}`);
                console.log(`   declarations: ${JSON.stringify(node.declarations, null, 2)}`);
            }
            
            // Recursively search children
            if (Array.isArray(node.children)) {
                node.children.forEach((child, i) => {
                    findVarDecls(child, `${path}.children[${i}]`);
                });
            }
            if (node.body && Array.isArray(node.body.children)) {
                node.body.children.forEach((child, i) => {
                    findVarDecls(child, `${path}.body.children[${i}]`);
                });
            }
        }
    }
    
    findVarDecls(ast, 'root');
    
    // Try exporting CompactAST only if AST looks good
    try {
        const compactASTBuffer = exportCompactAST(ast);
        const buffer = Buffer.from(compactASTBuffer);
        fs.writeFileSync('test_types.ast', buffer);
        console.log('\n✅ CompactAST exported to test_types.ast (' + buffer.length + ' bytes)');
    } catch (exportError) {
        console.log('\n⚠️  CompactAST export failed:', exportError.message);
        console.log('   (AST structure analysis still completed)');
    }
    
} catch (error) {
    console.error('❌ Error:', error);
}