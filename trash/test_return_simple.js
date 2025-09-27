const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { exportCompactAST, importCompactAST } = require('./libs/CompactAST/src/CompactAST.js');

// Simple test case with return statement
const code = `
int add(int a, int b) {
  return a + b;
}

void setup() {
  int result = add(5, 3);
}

void loop() {}
`;

console.log("Parsing code...");
const ast = parse(code);

// Find the ReturnStatement in the AST
function findReturnStatements(node, path = '') {
  if (!node) return;

  if (node.type === 'ReturnStatement') {
    console.log(`Found ReturnStatement at ${path}:`);
    console.log(JSON.stringify(node, null, 2));
  }

  // Recursively search all properties
  for (const key in node) {
    if (key === 'type') continue;
    const value = node[key];
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item && typeof item === 'object') {
            findReturnStatements(item, `${path}.${key}[${index}]`);
          }
        });
      } else {
        findReturnStatements(value, `${path}.${key}`);
      }
    }
  }
}

console.log("\nSearching for ReturnStatements in AST:");
findReturnStatements(ast);

console.log("\nExporting to CompactAST...");
try {
  const binary = exportCompactAST(ast);
  console.log("Export successful, binary size:", binary.length);

  console.log("\nImporting from CompactAST...");
  const imported = importCompactAST(binary);

  console.log("\nSearching for ReturnStatements in imported AST:");
  findReturnStatements(imported);
} catch (error) {
  console.error("Error during export/import:", error);
  console.error("Stack trace:", error.stack);
}