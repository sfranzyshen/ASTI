const { parse, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');

const code = `
void setup() {
    int condition = 1;
    int x = condition ? 10 : 20;
    Serial.begin(9600);
    Serial.print("x = ");
    Serial.println(x);
}

void loop() {
}
`;

console.log('🔍 Analyzing ternary expression AST structure...');
const ast = parse(code);
console.log('\n📋 Full AST Structure:');
console.log(prettyPrintAST(ast));

console.log('\n🎯 Searching for ternary expression placement...');
function findTernaryExpression(node, depth = 0) {
    const indent = '  '.repeat(depth);
    
    if (node.nodeType === 'VAR_DECL') {
        console.log(`${indent}📝 VarDeclNode found:`);
        console.log(`${indent}  Children: ${node.children ? node.children.length : 0}`);
        
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                console.log(`${indent}  Child ${i}: ${child.nodeType} ${child.value ? `(${child.value})` : ''}`);
                
                if (child.nodeType === 'DECLARATOR_NODE') {
                    console.log(`${indent}    📄 DeclaratorNode details:`);
                    console.log(`${indent}      Children: ${child.children ? child.children.length : 0}`);
                    
                    if (child.children) {
                        for (let j = 0; j < child.children.length; j++) {
                            const grandchild = child.children[j];
                            console.log(`${indent}      Child ${j}: ${grandchild.nodeType} ${grandchild.value ? `(${grandchild.value})` : ''}`);
                            
                            if (grandchild.nodeType === 'TERNARY_EXPR') {
                                console.log(`${indent}        🎯 FOUND TERNARY EXPRESSION!`);
                                console.log(`${indent}        Condition: ${grandchild.children[0] ? grandchild.children[0].nodeType : 'none'}`);
                                console.log(`${indent}        True expr: ${grandchild.children[1] ? grandchild.children[1].nodeType : 'none'}`);
                                console.log(`${indent}        False expr: ${grandchild.children[2] ? grandchild.children[2].nodeType : 'none'}`);
                            }
                        }
                    }
                }
            }
        }
    }
    
    if (node.children) {
        for (const child of node.children) {
            findTernaryExpression(child, depth + 1);
        }
    }
}

findTernaryExpression(ast);