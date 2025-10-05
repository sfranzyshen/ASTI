const fs = require('fs');
const { parse } = require('../libs/ArduinoParser/src/ArduinoParser.js');

const source = `
struct Node {
  int data;
  struct Node* next;
};

void setup() {
  Serial.begin(9600);
}

void loop() {
  struct Node n1, n2;
  n1.data = 10;
}
`;

const ast = parse(source);

// Find the loop function
function findLoop(node) {
  if (!node) return null;
  if (node.type === 'FuncDefNode') {
    const name = node.name || '';
    if (name === 'loop') return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const result = findLoop(child);
      if (result) return result;
    }
  }
  return null;
}

const loop = findLoop(ast);
if (loop) {
  const body = loop.body;
  console.log('Loop body children:');
  if (body && body.children) {
    body.children.forEach((child, i) => {
      console.log(`  Child ${i}: type=${child?.type}, varType=${child?.varType?.typeName}`);
    });

    // Look at first child (should be VarDeclNode for struct Node n1, n2)
    const firstChild = body.children[0];
    console.log('\nFirst child details:');
    console.log('  type:', firstChild?.type);
    console.log('  varType:', firstChild?.varType);
    console.log('  declarations count:', firstChild?.declarations?.length || 0);
    if (firstChild?.declarations) {
      firstChild.declarations.forEach((decl, i) => {
        console.log(`    Decl ${i}: type=${decl?.type}, name=${decl?.name}`);
      });
    }
  }
}
