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

function findVarDeclWithTernary(node, depth = 0) {
    const indent = '  '.repeat(depth);
    
    if (node.nodeType === 'VAR_DECL') {
        console.log(`${indent}📝 VarDeclNode found:`);
        console.log(`${indent}  Children: ${node.children ? node.children.length : 0}`);
        console.log(`${indent}  Declarations: ${node.declarations ? node.declarations.length : 0}`);
        
        if (node.declarations) {
            for (let i = 0; i < node.declarations.length; i++) {
                const decl = node.declarations[i];
                console.log(`${indent}    Declaration ${i}:`);
                console.log(`${indent}      Declarator: ${decl.declarator || 'none'}`);
                console.log(`${indent}      Initializer: ${decl.initializer ? decl.initializer.nodeType || 'object' : 'none'}`);
                
                if (decl.initializer && typeof decl.initializer === 'object') {
                    console.log(`${indent}      Initializer details:`);
                    console.log(`${indent}        NodeType: ${decl.initializer.nodeType}`);
                    console.log(`${indent}        Children: ${decl.initializer.children ? decl.initializer.children.length : 0}`);
                    console.log(`${indent}        Condition: ${decl.initializer.condition ? decl.initializer.condition.nodeType : 'none'}`);
                    console.log(`${indent}        Consequent: ${decl.initializer.consequent ? decl.initializer.consequent.nodeType : 'none'}`);
                    console.log(`${indent}        Alternate: ${decl.initializer.alternate ? decl.initializer.alternate.nodeType : 'none'}`);
                }
            }
        }
    }
    
    if (node.children) {
        for (const child of node.children) {
            findVarDeclWithTernary(child, depth + 1);
        }
    }
}

console.log('🔍 Examining VarDeclNode structure...');
findVarDeclWithTernary(ast);