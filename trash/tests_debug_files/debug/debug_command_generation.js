#!/usr/bin/env node

/**
 * Debug command generation to identify why the generator fails
 */

const { parse } = require('../../src/javascript/ArduinoParser.js');
const { ASTInterpreter } = require('../../src/javascript/ASTInterpreter.js');

// Simple test case
const simpleCode = `
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

console.log('=== DEBUGGING COMMAND GENERATION ===');
console.log('Testing simple Blink example');
console.log('');

try {
  // Step 1: Parse
  console.log('Step 1: Parsing...');
  const ast = parse(simpleCode);
  console.log('✓ Parsing successful');
  
  // Step 2: Create interpreter
  console.log('Step 2: Creating interpreter...');
  const interpreter = new ASTInterpreter(ast, {
    verbose: false,
    debug: false,
    stepDelay: 0,
    maxLoopIterations: 3
  });
  console.log('✓ Interpreter created');
  
  // Step 3: Set up command capture
  const commands = [];
  let done = false;
  let error = null;
  
  interpreter.onCommand = (cmd) => {
    console.log('Command received:', cmd.type);
    commands.push(cmd);
    if (cmd.type === 'PROGRAM_END' || cmd.type === 'ERROR' || cmd.type === 'LOOP_LIMIT_REACHED') {
      done = true;
    }
  };
  
  interpreter.onError = (err) => {
    console.log('Interpreter error:', err);
    error = err;
    done = true;
  };
  
  // Step 4: Set up response handler
  interpreter.responseHandler = (req) => {
    console.log('Request received:', req.type, req.id);
    setImmediate(() => {
      interpreter.handleResponse(req.id, 512);
    });
  };
  
  // Step 5: Start execution
  console.log('Step 3: Starting execution...');
  const startResult = interpreter.start();
  
  if (!startResult) {
    console.error('❌ Failed to start interpreter');
    process.exit(1);
  }
  
  console.log('✓ Interpreter started');
  
  // Step 6: Wait for completion
  const startTime = Date.now();
  const checkCompletion = () => {
    const elapsed = Date.now() - startTime;
    
    if (done) {
      console.log('');
      console.log('=== EXECUTION COMPLETE ===');
      console.log(`Time: ${elapsed}ms`);
      console.log(`Commands generated: ${commands.length}`);
      console.log(`Error: ${error || 'None'}`);
      console.log('');
      console.log('Commands:');
      commands.forEach((cmd, i) => {
        console.log(`${i + 1}. ${cmd.type}`);
      });
      console.log('');
      console.log('Full command data:');
      console.log(JSON.stringify(commands, null, 2));
      
    } else if (elapsed > 5000) {
      console.log('');
      console.log('❌ TIMEOUT after 5 seconds');
      console.log(`Commands so far: ${commands.length}`);
      commands.forEach((cmd, i) => {
        console.log(`${i + 1}. ${cmd.type}`);
      });
      interpreter.stop();
      
    } else {
      setImmediate(checkCompletion);
    }
  };
  
  checkCompletion();
  
} catch (error) {
  console.error('❌ FATAL ERROR:', error.message);
  console.error(error.stack);
}
