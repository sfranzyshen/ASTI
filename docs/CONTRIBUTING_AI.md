# AI Contributor's Guide

**CRITICAL: This document contains essential knowledge for any AI working on this project. This knowledge WILL BE LOST between sessions, so this guide must be comprehensive and precise.**

## 🚨 CRITICAL SAFETY RULES & BEST PRACTICES

Adherence to these rules is not optional. They prevent common failures like infinite loops, token waste, and test interference.

### **❌ Actions to NEVER Perform**

1.  **NEVER** create interpreter tests without setting `maxLoopIterations: 3`.
2.  **NEVER** run interpreter tests without a 5-10 second timeout mechanism.
3.  **NEVER** forget to suppress console output during testing to prevent debug spam.
4.  **NEVER** pass raw code to the interpreter. Always parse first: `const ast = parse(code, ...)`.
5.  **NEVER** invent new testing patterns. Use the proven templates provided in this guide.
6.  **NEVER** run tests in parallel. All test harnesses must execute sequentially.
7.  **NEVER** use `rm` commands. Move unnecessary files to the `trash/` directory instead.
8.  **NEVER** modify JavaScript async patterns without understanding Promise-based execution and parent app response protocol (`handleResponse()`).
9.  **NEVER** modify C++ SyncDataProvider without understanding the synchronous blocking contract.
10. **NEVER** break the step/resume workflow in JavaScript - always preserve `previousExecutionState` tracking.

### **✅ ALWAYS Follow These Procedures**

1.  **ALWAYS** use the exact testing templates provided in this guide.
2.  **ALWAYS** set interpreter options to `{ verbose: false, debug: false, stepDelay: 0, maxLoopIterations: 3 }`.
3.  **ALWAYS** wrap test execution with console suppression and restore it afterward.
4.  **ALWAYS** use the integrated preprocessor for any code containing `#define` or `#include` by passing the `{ platform: '...' }` option to the `parse()` function.
5.  **ALWAYS** move unwanted files to the `trash/` directory.
6.  **ALWAYS** use setTimeout 1ms delays for browser playground response handlers to prevent race conditions.
7.  **ALWAYS** include proper request-response handlers in interpreter tests to prevent timeout errors.

## 📁 Project Structure

The project contains two main JavaScript modules supported by C++ counterparts and a suite of testing files.

-   **Core Engine**:
    -   `ArduinoParser.js`: All-in-one Parser, Preprocessor, and Platform Emulator.
    -   `ASTInterpreter.js`: AST execution engine and hardware simulator.
    -   `ASTInterpreter.cpp` / `.hpp`: C++ version of the interpreter.
    -   `CompactAST.cpp` / `.hpp`: C++ logic for reading the binary AST format.
-   **Test Data**:
    -   `examples.js`: 79 Arduino example sketches.
    -   `old_test.js`: 54 comprehensive language feature tests.
    -   `neopixel.js`: 2 tests for the NeoPixel library.
-   **Test Harnesses**:
    -   `test_interpreter_*.js`: Full execution simulation tests.
    -   `test_parser_*.js`: Fast validation of the parser only.
    -   `test_semantic_accuracy_*.js`: Behavioral validation using the command stream.
-   **Interactive Tools**:
    -   `interpreter_playground.html`: Interactive UI for running the interpreter.
    -   `parser_playground.html`: Interactive UI for viewing AST output.

## 🧪 Testing & Validation

### **Running Tests**

```bash
# Interpreter Tests (full execution simulation)
node test_interpreter_examples.js
node test_interpreter_old_test.js
node test_interpreter_neopixel.js

# Parser Tests (fast parsing validation)
node test_parser_examples.js
node test_parser_old_test.js

# Semantic Accuracy Tests (behavior validation)
node test_semantic_accuracy_examples.js
node test_semantic_accuracy.js
```

### **Expected Results**

| Test Suite | Tests | Expected Success Rate |
| :--- | :--- | :--- |
| Arduino Examples | 79 | **100%** |
| Comprehensive | 54 | **100%** |
| NeoPixel | 2 | **100%** |

## 🔧 Proven Code Patterns

### **Standard Interpreter Test Runner**

This is the required pattern for running interpreter tests. It includes all necessary safety measures.

```javascript
const { parse } = require('./ArduinoParser.js');
const { ASTInterpreter } = require('./ASTInterpreter.js');
const { examplesFiles } = require('./examples.js');

async function runTests() {
    for (const test of examplesFiles) {
        const code = test.content || test.code;
        let executionCompleted = false;
        let executionError = null;

        try {
            const ast = parse(code, { platform: 'ARDUINO_UNO' });
            const interpreter = new ASTInterpreter(ast, {
                verbose: false, debug: false, stepDelay: 0, maxLoopIterations: 3
            });

            interpreter.onCommand = (command) => {
                // CRITICAL: Handle request-response pattern to prevent timeouts
                if (command.type === 'ANALOG_READ_REQUEST') {
                    setTimeout(() => {
                        interpreter.resumeWithValue(command.requestId, Math.floor(Math.random() * 1024));
                    }, 1); // 1ms delay prevents browser race conditions
                } else if (command.type === 'DIGITAL_READ_REQUEST') {
                    setTimeout(() => {
                        interpreter.resumeWithValue(command.requestId, Math.random() > 0.5 ? 1 : 0);
                    }, 1);
                } else if (command.type === 'MILLIS_REQUEST') {
                    setTimeout(() => {
                        interpreter.resumeWithValue(command.requestId, Date.now() % 100000);
                    }, 1);
                } else if (command.type === 'MICROS_REQUEST') {
                    setTimeout(() => {
                        interpreter.resumeWithValue(command.requestId, Date.now() * 1000 % 1000000);
                    }, 1);
                } else if (command.type === 'LIBRARY_METHOD_REQUEST') {
                    setTimeout(() => {
                        const mockResponse = command.method === 'numPixels' ? 60 : 0;
                        interpreter.resumeWithValue(command.requestId, mockResponse);
                    }, 1);
                }
                
                if (command.type === 'PROGRAM_END' || command.type === 'ERROR') {
                    executionCompleted = true;
                }
            };
            interpreter.onError = (error) => {
                executionError = error;
                executionCompleted = true;
            };

            const originalConsoleLog = console.log;
            console.log = () => {}; // Suppress console spam
            interpreter.start();
            console.log = originalConsoleLog; // Restore console

            // Timeout logic
            const timeout = setTimeout(() => {
                if (!executionCompleted) {
                    executionError = "Timeout";
                    interpreter.stop();
                }
            }, 5000);

            while (!executionCompleted) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            clearTimeout(timeout);

            if (executionError) {
                console.log(`❌ ${test.name}: FAILED - ${executionError}`);
            } else {
                console.log(`✅ ${test.name}: PASSED`);
            }

        } catch (e) {
            console.log(`❌ ${test.name}: CRITICAL ERROR - ${e.message}`);
        }
    }
}

runTests();
```

### **Testing Preprocessor Features**

To test macros or library includes, simply ensure the `platform` option is passed to `parse()`.

```javascript
const { parse } = require('./ArduinoParser.js');

const codeWithMacros = `
#include <Servo.h>
#define MY_PIN 9

Servo myServo;

void setup() {
  myServo.attach(MY_PIN);
}`;

// The integrated preprocessor is enabled by the platform context
const ast = parse(codeWithMacros, { platform: 'ARDUINO_UNO' });

// Verify macro definition
if (ast.preprocessorInfo.macros.MY_PIN === '9') {
    console.log('✅ Macro correctly defined.');
}

// Verify library activation
if (ast.preprocessorInfo.activeLibraries.includes('Servo')) {
    console.log('✅ Library correctly activated.');
}
```

## 🎮 Interactive Playgrounds

-   **`interpreter_playground.html`**: For visual, interactive testing of the interpreter. Select a test from the dropdown and see the command stream output.
-   **`parser_playground.html`**: For visual, real-time parsing. Enter code to see the generated AST.