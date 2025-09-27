const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
const fs = require('fs');

const code = `int x = condition ? 10 : 20;`;

console.log('🔧 Generating simple ternary expression test...');
console.log('📝 Test code:', code);

const ast = parse(code);
console.log('✅ AST generated successfully');

const compactASTBuffer = exportCompactAST(ast);
const buffer = Buffer.from(compactASTBuffer);

fs.writeFileSync('test_simple_ternary.ast', buffer);
console.log(`✅ CompactAST generated: ${buffer.length} bytes`);
console.log(`📁 File: test_simple_ternary.ast`);
console.log(`🎯 Ready for C++ simple ternary testing`);