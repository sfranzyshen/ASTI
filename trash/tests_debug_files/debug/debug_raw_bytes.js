const { Parser, parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

/**
 * Debug raw byte analysis of CompactAST
 */

console.log('=== CompactAST Raw Bytes Debug ===');

const testCode = `int x = 13;`;

try {
    const ast = parse(testCode);
    const buffer = exportCompactAST(ast);
    const view = new DataView(buffer);
    
    console.log(`Total buffer: ${buffer.byteLength} bytes`);
    console.log('');
    
    // Print all bytes with annotations
    let offset = 0;
    
    console.log('--- HEADER (16 bytes) ---');
    for (let i = 0; i < 16; i++) {
        const byte = view.getUint8(offset + i);
        let annotation = '';
        if (i === 0) annotation = ' (Magic byte 0)';
        else if (i === 1) annotation = ' (Magic byte 1)'; 
        else if (i === 2) annotation = ' (Magic byte 2)';
        else if (i === 3) annotation = ' (Magic byte 3)';
        else if (i === 4) annotation = ' (Version low)';
        else if (i === 5) annotation = ' (Version high)';
        else if (i === 6) annotation = ' (Flags low)';
        else if (i === 7) annotation = ' (Flags high)';
        else if (i === 8) annotation = ' (Node count byte 0)';
        else if (i === 9) annotation = ' (Node count byte 1)';
        else if (i === 10) annotation = ' (Node count byte 2)';
        else if (i === 11) annotation = ' (Node count byte 3)';
        else if (i === 12) annotation = ' (String table size byte 0)';
        else if (i === 13) annotation = ' (String table size byte 1)';
        else if (i === 14) annotation = ' (String table size byte 2)';
        else if (i === 15) annotation = ' (String table size byte 3)';
        
        console.log(`${offset + i}: 0x${byte.toString(16).padStart(2, '0')} (${byte})${annotation}`);
    }
    
    offset = 16;
    console.log(`\\n--- STRING TABLE ---`);
    const stringTableSize = view.getUint32(12, true);
    console.log(`String table starts at offset ${offset}, size ${stringTableSize} bytes`);
    
    for (let i = 0; i < stringTableSize; i++) {
        const byte = view.getUint8(offset + i);
        console.log(`${offset + i}: 0x${byte.toString(16).padStart(2, '0')} (${byte}) '${String.fromCharCode(byte)}'`);
    }
    
    offset = 16 + stringTableSize;
    console.log(`\\n--- NODE DATA ---`);
    console.log(`Node data starts at offset ${offset}`);
    
    const remainingBytes = buffer.byteLength - offset;
    console.log(`Remaining bytes for nodes: ${remainingBytes}`);
    
    for (let i = 0; i < Math.min(remainingBytes, 50); i++) {
        const byte = view.getUint8(offset + i);
        let annotation = '';
        
        if (i === 0) annotation = ' <- Should be Node 0 Type (0x01)';
        else if (i === 1) annotation = ' <- Should be Node 0 Flags';
        else if (i === 2) annotation = ' <- Should be Node 0 Data Size Low';
        else if (i === 3) annotation = ' <- Should be Node 0 Data Size High';
        
        console.log(`${offset + i}: 0x${byte.toString(16).padStart(2, '0')} (${byte})${annotation}`);
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
}