const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const fs = require('fs');

console.log('=== TESTING JAVASCRIPT INTERPRETER DIRECTLY ===');

const metaContent = fs.readFileSync('test_data/example_037.meta', 'utf8');
const testCode = metaContent.split('content=')[1];

console.log('1. Parsing the code...');
const ast = parse(testCode);

console.log('2. Creating interpreter...');
const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });

console.log('3. Running interpreter...');
try {
  const commands = interpreter.run();
  console.log('Total commands generated:', commands.length);
  
  console.log('4. Checking switch-related commands...');
  const switchCommands = commands.filter(cmd => 
    cmd.type === 'SWITCH_STATEMENT' || cmd.type === 'SWITCH_CASE'
  );
  
  console.log('Switch commands found:', switchCommands.length);
  switchCommands.forEach((cmd, i) => {
    console.log('Command', i+1, ':', cmd.type);
    if (cmd.discriminant !== undefined) console.log('  discriminant:', cmd.discriminant);
    if (cmd.caseValue !== undefined) console.log('  caseValue:', cmd.caseValue);
  });
} catch (error) {
  console.log('ERROR running interpreter:', error.message);
}
