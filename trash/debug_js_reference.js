const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const fs = require('fs');

// Same test case as in debug_compact_export.js
const code = `
void setup() {
    int x = 5;
    x = -x;  // unary minus
}
`;

console.log('=== GENERATING JAVASCRIPT REFERENCE ===');
const ast = parse(code);
const interpreter = new ASTInterpreter(ast, { 
    verbose: false,
    debug: false,
    stepDelay: 0,
    maxLoopIterations: 3
});

const commands = [];
let done = false;

interpreter.onCommand = (cmd) => {
    commands.push(cmd);
    if (cmd.type === 'PROGRAM_END') {
        done = true;
    }
};

interpreter.onDone = () => {
    done = true;
};

interpreter.start();

// Wait for completion (simple sync approach)
const startTime = Date.now();
while (!done && (Date.now() - startTime < 5000)) {
    // Wait
}

if (!done) {
    console.error('Timeout waiting for execution');
    process.exit(1);
}

// Save output for comparison
const output = JSON.stringify(commands, null, 2);
fs.writeFileSync('src/javascript/test_data/debug_simple.commands', output);
console.log('JavaScript reference saved to src/javascript/test_data/debug_simple.commands');
console.log('Commands generated:', commands.length);