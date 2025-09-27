const { parse } = require('../../src/javascript/ArduinoParser.js');

// Test 2D array access
const code = `
int pixels[8][8];
void test() {
    pixels[x][y] = 5;
}
`;

console.log('Parsing 2D array assignment...');
const ast = parse(code);

if (ast.parseError) {
    console.log('Parse error:', ast.parseError);
} else {
    console.log('Parse successful!');
    
    console.log('\n=== Full AST Structure ===');
    console.log(JSON.stringify(ast, null, 2));
}