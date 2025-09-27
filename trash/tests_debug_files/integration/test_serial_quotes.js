#!/usr/bin/env node

const { parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');

// Test code with String concatenation (previously had quote issues)
const testCode = `
String stringOne = "Sensor ";
String stringTwo = "value";

void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println(stringOne);
  stringOne += stringTwo;
  Serial.println(stringOne);
  stringOne += " for input ";
  Serial.println(stringOne);
}
`;

console.log('🔍 Testing Serial Quote Fix');
console.log('Code:', testCode);

const ast = parse(testCode);
const interpreter = new ASTInterpreter(ast, { 
    verbose: false, 
    debug: false, 
    stepDelay: 0, 
    maxLoopIterations: 1
});

interpreter.onCommand = (command) => {
    // Handle request-response pattern for external data functions
    switch (command.type) {
        case 'ANALOG_READ_REQUEST':
            const analogValue = Math.floor(Math.random() * 1024);
            setTimeout(() => {
                interpreter.handleResponse(command.requestId, analogValue);
            }, 1);
            break;
            
        case 'DIGITAL_READ_REQUEST':  
            const digitalState = Math.random() > 0.5 ? 1 : 0;
            setTimeout(() => {
                interpreter.handleResponse(command.requestId, digitalState);
            }, 1);
            break;
            
        case 'MILLIS_REQUEST':
            setTimeout(() => {
                interpreter.handleResponse(command.requestId, Date.now());
            }, 1);
            break;
            
        case 'MICROS_REQUEST':
            setTimeout(() => {
                interpreter.handleResponse(command.requestId, Date.now() * 1000);
            }, 1);
            break;
            
        case 'LIBRARY_METHOD_REQUEST':
            let responseValue = 0;
            switch (command.method) {
                case 'numPixels': responseValue = 60; break;
                case 'getBrightness': responseValue = 255; break;
                case 'getPixelColor': responseValue = 0; break;
                case 'canShow': responseValue = true; break;
                default: responseValue = 0; break;
            }
            setTimeout(() => {
                interpreter.handleResponse(command.requestId, responseValue);
            }, 1);
            break;
    }
    
    if (command.message && command.message.includes('Serial.println')) {
        console.log('Serial Command:', command.message);
    }
};

interpreter.start();

setTimeout(() => {
    console.log('✅ Test completed');
}, 100);