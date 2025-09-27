const { parse } = require('../../src/javascript/ArduinoParser.js');

const code = `int x = condition ? 10 : 20;`;

console.log('🔍 Parsing simple ternary expression...');

try {
    const ast = parse(code);
    console.log('✅ Parse successful');
    console.log('AST structure:');
    console.log(JSON.stringify(ast, null, 2));
} catch (error) {
    console.error('❌ Parse failed:', error.message);
}