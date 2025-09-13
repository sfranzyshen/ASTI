// Create a temporary modified version of CompactAST with debug output
const fs = require('fs');

// Read the original CompactAST
let compactASTCode = fs.readFileSync('./libs/CompactAST/src/CompactAST.js', 'utf8');

// Add debug output around the flag calculation
const originalLogic = `        // Calculate flags
        let flags = 0;
        if (this.getChildCount(node) > 0) flags |= 0x01; // HAS_CHILDREN
        if (node.value !== undefined || node.operator !== undefined || (node.op && node.op.value !== undefined)) flags |= 0x02; // HAS_VALUE`;

const debugLogic = `        // Calculate flags
        let flags = 0;
        if (this.getChildCount(node) > 0) flags |= 0x01; // HAS_CHILDREN
        
        // DEBUG: Check flag calculation for operator nodes
        if (node.type === 'UnaryOpNode' || node.type === 'BinaryOpNode') {
            console.log('DEBUG EXPORT: Processing', node.type);
            console.log('  node.value:', node.value);
            console.log('  node.operator:', node.operator);
            console.log('  node.op:', node.op);
            console.log('  node.op?.value:', node.op?.value);
            console.log('  Condition check:', (node.value !== undefined || node.operator !== undefined || (node.op && node.op.value !== undefined)));
        }
        
        if (node.value !== undefined || node.operator !== undefined || (node.op && node.op.value !== undefined)) flags |= 0x02; // HAS_VALUE
        
        // DEBUG: Show final flags for operator nodes
        if (node.type === 'UnaryOpNode' || node.type === 'BinaryOpNode') {
            console.log('  Final flags:', flags, '(HAS_VALUE:', (flags & 0x02) ? 'YES' : 'NO', ')');
        }`;

// Replace the logic
const modifiedCode = compactASTCode.replace(originalLogic, debugLogic);

// Write to temporary file
fs.writeFileSync('./debug_CompactAST.js', modifiedCode);

console.log('Created debug_CompactAST.js with debug output for flag calculation');