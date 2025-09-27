const {parse, exportCompactAST} = require('../../src/javascript/ArduinoParser.js');
const {examplesFiles} = require('../../examples.js');

// Find a failing example
const failingExample = examplesFiles.find(ex => ex.name === 'AnalogReadSerial.ino');
if (!failingExample) {
    console.log('Could not find AnalogReadSerial.ino');
    process.exit(1);
}

console.log('Testing failing example:', failingExample.name);
console.log('Code preview:', failingExample.content.substring(0, 200) + '...');

const ast = parse(failingExample.content);
if (ast.parseError) {
    console.log('Parse error:', ast.parseError);
} else {
    console.log('Parse successful, AST root type:', ast.type);
    
    try {
        const binary = exportCompactAST(ast);
        console.log('CompactAST export successful! Size:', binary.byteLength);
    } catch (error) {
        console.log('CompactAST export error:', error.message);
        console.log('Stack trace:', error.stack);
    }
}