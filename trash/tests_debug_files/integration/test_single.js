#!/usr/bin/env node

const { parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');

// Test first available test from old_test.js
const { oldTestFiles } = require('../../old_test.js');
const test = oldTestFiles[0]; // Use first test
if (!test) throw new Error('No tests found in old_test.js');
const testCode = test.content;

console.log('Testing single case...');

try {
  const ast = parse(testCode);
  
  const interpreter = new ASTInterpreter(ast, { 
    verbose: true, debug: true, stepDelay: 0, maxLoopIterations: 3 
  });
  
  let error = null;
  let completed = false;
  let commandCount = 0;
  
  interpreter.onError = (err) => { 
    error = err;
    completed = true;
    console.log('Error occurred:', err);
  };
  
  interpreter.onCommand = (cmd) => {
    commandCount++;
    
    // Handle request-response pattern for external data functions
    switch (cmd.type) {
        case 'ANALOG_READ_REQUEST':
            const analogValue = Math.floor(Math.random() * 1024);
            setTimeout(() => {
                interpreter.handleResponse(cmd.requestId, analogValue);
            }, 1);
            break;
            
        case 'DIGITAL_READ_REQUEST':  
            const digitalState = Math.random() > 0.5 ? 1 : 0;
            setTimeout(() => {
                interpreter.handleResponse(cmd.requestId, digitalState);
            }, 1);
            break;
            
        case 'MILLIS_REQUEST':
            setTimeout(() => {
                interpreter.handleResponse(cmd.requestId, Date.now());
            }, 1);
            break;
            
        case 'MICROS_REQUEST':
            setTimeout(() => {
                interpreter.handleResponse(cmd.requestId, Date.now() * 1000);
            }, 1);
            break;
            
        case 'LIBRARY_METHOD_REQUEST':
            let responseValue = 0;
            switch (cmd.method) {
                case 'numPixels': responseValue = 60; break;
                case 'getBrightness': responseValue = 255; break;
                case 'getPixelColor': responseValue = 0; break;
                case 'canShow': responseValue = true; break;
                default: responseValue = 0; break;
            }
            setTimeout(() => {
                interpreter.handleResponse(cmd.requestId, responseValue);
            }, 1);
            break;
    }
    
    if (cmd.type === 'PROGRAM_END' || cmd.type === 'ERROR' || cmd.type === 'LOOP_LIMIT_REACHED') {
      completed = true;
    }
  };
  
  const originalConsoleLog = console.log;
  console.log = () => {}; // Suppress debug output
  
  const result = interpreter.start();
  
  console.log = originalConsoleLog; // Restore console
  
  // Wait briefly to see if it completes
  setTimeout(() => {
    if (error) {
      console.log('❌ FAILED:', typeof error === 'string' ? error : error.message || String(error));
    } else {
      console.log('✅ PASSED (' + commandCount + ' commands)');
    }
    process.exit(0);
  }, 500);
  
} catch (err) {
  console.log('❌ Parse/execution error:', err.message);
  process.exit(1);
}