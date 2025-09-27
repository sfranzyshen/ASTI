const {parse, exportCompactAST} = require('../../src/javascript/ArduinoParser.js');

const code = 'String myString("hello");';
console.log('Testing ConstructorCallNode fix...');

const ast = parse(code);
console.log('Parse successful:', !ast.parseError);

if (ast.parseError) {
    console.log('Parse error:', ast.parseError);
} else {
    try {
        const binary = exportCompactAST(ast);
        console.log('CompactAST export successful:', !!binary);
        console.log('Binary size:', binary ? binary.byteLength : 'undefined');
    } catch (error) {
        console.log('CompactAST export error:', error.message);
    }
}