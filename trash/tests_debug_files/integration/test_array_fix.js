const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

// Test 2D array assignment with a simple example
const code = `
int pixels[8][8];
void setup() {
    int x = 5;
    int y = 5;
    pixels[x][y] = 1;
}
void loop() {}
`;

console.log('Testing 2D array assignment fix...');

const ast = parse(code);
if (ast.parseError) {
    console.log('Parse error:', ast.parseError);
} else {
    console.log('Parse successful!');
    
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false,
        debug: false,
        stepDelay: 0,
        maxLoopIterations: 3
    });
    
    // Set up response handlers for external data functions
    interpreter.responseHandler = (request) => {
        setTimeout(() => {
            let mockValue = 0;
            switch (request.type) {
                case 'analogRead': mockValue = Math.floor(Math.random() * 1024); break;
                case 'digitalRead': mockValue = Math.random() > 0.5 ? 1 : 0; break;
                case 'millis': mockValue = Date.now() % 100000; break;
                case 'micros': mockValue = Date.now() * 1000 % 1000000; break;
                default: mockValue = 0;
            }
            interpreter.handleResponse(request.id, mockValue);
        }, Math.random() * 10);
    };
    
    let executionCompleted = false;
    let executionError = null;
    
    interpreter.onCommand = (command) => {
        if (command.type === 'PROGRAM_END' || command.type === 'ERROR' || command.type === 'LOOP_LIMIT_REACHED') {
            executionCompleted = true;
        }
        if (command.type === 'ERROR') {
            executionError = command.message;
        }
    };
    
    interpreter.onError = (error) => {
        executionError = error.message;
        executionCompleted = true;
    };
    
    const startResult = interpreter.start();
    if (!startResult) {
        console.log('Failed to start interpreter');
    } else {
        setTimeout(() => {
            if (executionCompleted) {
                if (executionError) {
                    console.log('Execution error:', executionError);
                } else {
                    console.log('SUCCESS: No errors during execution!');
                    console.log('2D array assignment fix is working.');
                }
            } else {
                console.log('Execution still running after 5 seconds - might be stuck');
            }
        }, 5000);
    }
}