#!/usr/bin/env node

const { parse, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');

// Test case to examine AST structure
const testCode = `
void setup() {
    for(int i = 0; i < 5; i++) {
        Serial.println(i);
        if(i == 2) {
            break;
        }
    }
    Serial.println("After loop");
}
`;

console.log('Analyzing AST structure for break statement...');

try {
    const ast = parse(testCode);
    console.log('✓ Parsing successful\n');
    
    // Find the for statement and examine its structure
    const setupFunc = ast.children[0];  // FuncDefNode for setup
    const compoundStmt = setupFunc.body; // CompoundStmtNode 
    const forStmt = compoundStmt.children[0]; // ForStatement
    
    console.log('FOR STATEMENT BODY TYPE:', forStmt.body.type);
    console.log('FOR STATEMENT BODY:', JSON.stringify(forStmt.body, null, 2));
    
} catch (error) {
    console.log('❌ Error:', error.message);
}
