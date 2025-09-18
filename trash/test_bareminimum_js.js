const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');

const code = `// 01.Basics BareMinimum.ino

void setup() {
  // put your setup code here, to run once:
}

void loop() {
  // put your main code here, to run repeatedly:
}`;

console.log('Testing BareMinimum with JavaScript 7.3.0...');

// Parse code first, then get compact AST

const ast = parse(code);
console.log('AST parsed successfully');

const { compactAST } = exportCompactAST(ast, {
    maxLoopIterations: 1,
    generateCommands: true,
    debugMode: false
});

console.log('AST parsed, creating interpreter...');

// Create interpreter with same settings as C++
const interpreter = new ASTInterpreter(ast, {
    maxLoopIterations: 1,
    timeout: 5000,
    verbose: false
});

// Capture commands
const commands = [];
interpreter.onCommand = (command) => {
    commands.push(command);
};

// Mock response handler
interpreter.responseHandler = (request) => {
    setTimeout(() => {
        let mockValue;
        switch (request.type) {
            case 'analogRead': mockValue = Math.floor(Math.random() * 1024); break;
            case 'digitalRead': mockValue = Math.random() > 0.5 ? 1 : 0; break;
            case 'millis': mockValue = Date.now() % 100000; break;
            case 'micros': mockValue = Date.now() * 1000 % 1000000; break;
        }
        interpreter.handleResponse(request.id, mockValue);
    }, Math.random() * 10);
};

// Execute and capture results
interpreter.start();

// Give it time to complete, then show results
setTimeout(() => {
    console.log(`\nJavaScript Command Stream (${commands.length} commands):`);
    console.log(JSON.stringify(commands, null, 2));
    process.exit(0);
}, 2000);