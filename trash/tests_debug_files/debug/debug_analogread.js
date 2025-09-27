const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

const code = `
void setup() {
  Serial.begin(9600);
}
void loop() {
  int val = analogRead(A0);
  Serial.println(val);
}
`;

console.log('=== DEBUGGING ANALOGREAD EXECUTION ===');
console.log('Parsing code...');
const ast = parse(code);

console.log('Creating interpreter...');
const interpreter = new ASTInterpreter(ast, { 
    verbose: false,
    stepDelay: 0,
    maxLoopIterations: 1
});

let commandCount = 0;
let done = false;
let requestCount = 0;

interpreter.onCommand = (cmd) => {
    commandCount++;
    console.log(`Command ${commandCount}: ${cmd.type}`);
    if (cmd.type === 'PROGRAM_END' || cmd.type === 'LOOP_LIMIT_REACHED' || cmd.type === 'ERROR') {
        done = true;
        console.log('✅ Execution completed!');
    }
};

// CORRECT PATTERN: Listen for request commands and respond via handleResponse
interpreter.onCommand = (cmd) => {
    commandCount++;
    console.log(`Command ${commandCount}: ${cmd.type}`);
    
    // Handle external data requests
    if (cmd.type === 'ANALOG_READ_REQUEST') {
        requestCount++;
        console.log(`📨 External request ${requestCount}: analogRead (${cmd.requestId})`);
        setTimeout(() => {
            console.log(`📤 Providing response: 512`);
            interpreter.handleResponse(cmd.requestId, 512);
        }, 1);
    } else if (cmd.type === 'DIGITAL_READ_REQUEST') {
        requestCount++;
        console.log(`📨 External request ${requestCount}: digitalRead (${cmd.requestId})`);
        setTimeout(() => {
            console.log(`📤 Providing response: 1`);
            interpreter.handleResponse(cmd.requestId, 1);
        }, 1);
    } else if (cmd.type === 'MILLIS_REQUEST') {
        requestCount++;
        console.log(`📨 External request ${requestCount}: millis (${cmd.requestId})`);
        setTimeout(() => {
            console.log(`📤 Providing response: ${Date.now() % 100000}`);
            interpreter.handleResponse(cmd.requestId, Date.now() % 100000);
        }, 1);
    }
    
    if (cmd.type === 'PROGRAM_END' || cmd.type === 'LOOP_LIMIT_REACHED' || cmd.type === 'ERROR') {
        done = true;
        console.log('✅ Execution completed!');
    }
};

console.log('Starting interpreter...');
interpreter.start();

// Wait for completion with detailed logging
let checkCount = 0;
const check = () => {
    checkCount++;
    if (done) {
        console.log('');
        console.log('=== RESULTS ===');
        console.log(`✅ SUCCESS: Total commands: ${commandCount}`);
        console.log(`✅ External requests handled: ${requestCount}`);
        process.exit(0);
    } else if (checkCount > 5000) { // 5 second timeout
        console.log('');
        console.log('=== TIMEOUT ===');
        console.log(`❌ FAILED: Test did not complete after 5 seconds`);
        console.log(`Commands generated so far: ${commandCount}`);
        console.log(`External requests: ${requestCount}`);
        process.exit(1);
    } else {
        setTimeout(check, 1);
    }
};

check();