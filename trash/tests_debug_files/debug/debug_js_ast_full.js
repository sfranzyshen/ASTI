const { parse, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');

const code = `
void setup() {
    int condition = 1;
    int x = condition ? 10 : 20;
}

void loop() {
}
`;

console.log('🔍 Full JavaScript AST structure...');

const ast = parse(code);
console.log(prettyPrintAST(ast, 0, 200)); // Show up to 200 levels of nesting