const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');

// Test 4 Fade.ino code
const ast = parse(`
int led = 9;
int brightness = 0; 
int fadeAmount = 5;
void setup() { 
  pinMode(led, 1); 
} 
void loop() { 
  analogWrite(led, brightness); 
  brightness = brightness + fadeAmount; 
  if (brightness <= 0 || brightness >= 255) { 
    fadeAmount = -fadeAmount; 
  } 
  delay(30); 
}
`);

function findOperatorNodes(node, path = '') {
  if (node && typeof node === 'object') {
    if (node.type === 'BinaryOpNode' || node.type === 'UnaryOpNode') {
      console.log('OPERATOR NODE - Type:', node.type);
      console.log('  node.op:', JSON.stringify(node.op));
      console.log('  Has op.value?:', !!(node.op && node.op.value !== undefined));
      console.log('  Operator string:', node.op ? node.op.value : 'NONE');
      console.log('---');
    }
    
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        value.forEach((item, idx) => findOperatorNodes(item, `${path}.${key}[${idx}]`));
      } else {
        findOperatorNodes(value, `${path}.${key}`);
      }
    }
  }
}

console.log('=== ANALYZING TEST 4 OPERATOR NODES ===');
findOperatorNodes(ast);