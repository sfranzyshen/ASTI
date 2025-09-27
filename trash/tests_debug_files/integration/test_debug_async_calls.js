const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

const testCode = `
void setup() {
  Serial.begin(9600);
}

void loop() {
  int val1 = analogRead(A0);
  Serial.println(val1);

  int val2 = digitalRead(2);
  Serial.println(val2);

  long time1 = millis();
  Serial.println(time1);

  long time2 = micros();
  Serial.println(time2);

  delay(100); // Small delay to allow commands to process
}
`;

async function runDebugTest() {
    console.log('🚀 Starting Debug Async Calls Test');
    
    const ast = parse(testCode, { platform: 'ARDUINO_UNO' });
    
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false, // Keep verbose off for now, we'll add specific logs
        debug: false,   // Keep debug off for now
        stepDelay: 0,
        maxLoopIterations: 5 // Limit loops for quick test
    });

    let executionCompleted = false;
    let executionError = null;
    let commandCount = 0;

    // CRITICAL: Set up response handlers for external data functions
    interpreter.onCommand = (command) => {
        // console.log('COMMAND:', command.type, command.requestId); // Temporarily enable for debugging
        commandCount++;
        
        switch (command.type) {
            case 'ANALOG_READ_REQUEST':
                setTimeout(() => {
                    interpreter.resumeWithValue(command.requestId, Math.floor(Math.random() * 1024));
                }, 1);
                break;
            case 'DIGITAL_READ_REQUEST':
                setTimeout(() => {
                    interpreter.resumeWithValue(command.requestId, Math.random() > 0.5 ? 1 : 0);
                }, 1);
                break;
            case 'MILLIS_REQUEST':
                setTimeout(() => {
                    interpreter.resumeWithValue(command.requestId, Date.now());
                }, 1);
                break;
            case 'MICROS_REQUEST':
                setTimeout(() => {
                    interpreter.resumeWithValue(command.requestId, Date.now() * 1000);
                }, 1);
                break;
            case 'PROGRAM_END':
            case 'ERROR':
            case 'LOOP_LIMIT_REACHED':
                executionCompleted = true;
                if (command.type === 'ERROR') {
                    executionError = command.message;
                }
                break;
        }
    };

    interpreter.onError = (error) => {
        executionError = error;
        executionCompleted = true;
    };

    // Suppress console output during execution
    const originalConsoleLog = console.log;
    console.log = () => {}; 

    try {
        interpreter.start();

        // Wait with timeout and periodic checking
        const timeoutDuration = 10000; // 10 seconds
        const timeout = setTimeout(() => {
            if (!executionCompleted) {
                executionError = "Timeout";
                executionCompleted = true;
                interpreter.stop();
            }
        }, timeoutDuration);

        while (!executionCompleted) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
        }
        clearTimeout(timeout);

        if (executionError) {
            originalConsoleLog(`❌ TEST FAILED: ${executionError}`);
        } else {
            originalConsoleLog(`✅ TEST PASSED: Completed with ${commandCount} commands.`);
        }

    } catch (error) {
        originalConsoleLog(`❌ CRITICAL TEST ERROR: ${error.message}`);
    } finally {
        // Always restore console
        console.log = originalConsoleLog;
    }
}

runDebugTest();
