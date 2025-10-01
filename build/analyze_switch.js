const fs = require('fs');
const { deserializeCompactAST } = require('../libs/CompactAST/src/CompactAST.js');
const astData = fs.readFileSync('../test_data/example_058.ast');
const ast = deserializeCompactAST(astData);

// Find the switch statement in setup or loop
function findSwitch(node, depth = 0) {
    if (node === null || node === undefined) return;
    const indent = '  '.repeat(depth);
    if (node.type === 'SwitchStatement') {
        console.log(indent + 'FOUND SWITCH STATEMENT:');
        console.log(indent + '  Discriminant:', node.discriminant ? node.discriminant.type : 'none');
        console.log(indent + '  Cases:', node.cases ? node.cases.length : 0);
        if (node.cases) {
            node.cases.forEach((c, i) => {
                console.log(indent + '  Case', i + ':', c.test ? c.test.type + ' = ' + (c.test.value || c.test.name) : 'default');
                console.log(indent + '    Consequent statements:', c.consequent ? c.consequent.length : 0);
                if (c.consequent) {
                    c.consequent.forEach((stmt, j) => {
                        console.log(indent + '      ' + j + ':', stmt.type, stmt.function || stmt.operator || '');
                    });
                }
            });
        }
    }
    // Recursively search children
    for (const key in node) {
        if (Array.isArray(node[key])) {
            node[key].forEach(child => findSwitch(child, depth + 1));
        } else if (typeof node[key] === 'object') {
            findSwitch(node[key], depth + 1);
        }
    }
}

findSwitch(ast);
