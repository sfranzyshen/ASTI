const fs = require('fs');
const { Parser, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

// Simple test code  
const code = 'int x = 5; void setup() { Serial.println(x); } void loop() { delay(1000); }';

console.log('Parsing Arduino code...');
const parser = new Parser(code);
const ast = parser.parse();

if (ast && !ast.parseError) {
    console.log('Parsing successful, generating binary AST...');
    console.log('Root node type:', ast.type);
    
    const binaryAST = exportCompactAST(ast);
    console.log('Export result type:', typeof binaryAST);
    console.log('Export result length:', binaryAST ? binaryAST.byteLength : 'undefined');
    
    if (binaryAST) {
        // Check the first few bytes to see the magic number and first node type
        const view = new DataView(binaryAST);
        console.log('Magic bytes (should be ASTP):');
        const b0 = view.getUint8(0);
        const b1 = view.getUint8(1);
        const b2 = view.getUint8(2);  
        const b3 = view.getUint8(3);
        console.log(`  Bytes: 0x${b0.toString(16)} 0x${b1.toString(16)} 0x${b2.toString(16)} 0x${b3.toString(16)}`);
        console.log(`  As string: ${String.fromCharCode(b0, b1, b2, b3)}`);
        
        // Find where node data starts (after header + string table)
        const stringTableSize = view.getUint32(12, true); // Little endian
        console.log(`Header size: 16`);
        console.log(`String table raw size: ${stringTableSize}`);
        
        // String table includes 4 bytes for string count plus actual string data
        const actualStringTableStart = 16;
        
        // Let's trace through the string table manually
        let pos = 16;
        const stringCount = view.getUint32(pos, true);
        pos += 4;
        console.log(`String count: ${stringCount}`);
        
        for (let i = 0; i < stringCount; i++) {
            const len = view.getUint16(pos, true);
            pos += 2;
            let str = '';
            for (let j = 0; j < len; j++) {
                str += String.fromCharCode(view.getUint8(pos++));
            }
            pos++; // null terminator
            console.log(`String ${i}: "${str}" (length ${len})`);
        }
        
        // 4-byte alignment
        while (pos % 4 !== 0) pos++;
        
        const nodeDataStart = pos;
        console.log(`String table size: ${stringTableSize}`);
        console.log(`Node data starts at offset: ${nodeDataStart}`);
        
        if (nodeDataStart < binaryAST.byteLength) {
            const firstNodeType = view.getUint8(nodeDataStart);
            console.log(`First node type byte: 0x${firstNodeType.toString(16)} (${firstNodeType})`);
        }
        
        fs.writeFileSync('test_continuation.ast', Buffer.from(binaryAST));
        console.log('Binary AST written to test_continuation.ast');
    } else {
        console.log('ERROR: exportCompactAST returned null/undefined');
    }
} else {
    console.log('Parse error:', ast?.parseError || 'Unknown error');
}