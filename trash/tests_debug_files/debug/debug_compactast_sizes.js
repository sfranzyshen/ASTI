const { Parser, parse } = require('../../src/javascript/ArduinoParser.js');

/**
 * Debug CompactAST size calculations
 */

console.log('=== CompactAST Size Calculation Debug ===');

// Simple test code
const testCode = `int x = 13;`;

try {
    console.log('1. Parsing code:', testCode);
    const ast = parse(testCode);
    
    if (!ast || ast.type !== 'ProgramNode') {
        throw new Error('Failed to parse test code');
    }
    
    console.log('2. Creating CompactAST exporter and manually testing size calculation...');
    
    // Import the actual CompactASTExporter class to test it
    const ArduinoParser = require('../../src/javascript/ArduinoParser.js');
    
    // Use reflection to access the CompactASTExporter class
    const exporterCode = `
        const { Parser, parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');
        
        // Create a custom exporter class that exposes internal methods
        class TestCompactASTExporter extends eval('(' + exportCompactAST.toString().match(/class CompactASTExporter[\\s\\S]*?(?=function exportCompactAST|$)/)[0] + ')') {
            testSizes(ast) {
                console.log('3. Phase 1: Collecting nodes...');
                this.collectNodes(ast);
                
                console.log('4. Calculating sizes...');
                
                const headerSize = 16;
                console.log('   Header size:', headerSize, 'bytes');
                
                const stringTableSize = this.calculateStringTableSize();
                console.log('   String table size:', stringTableSize, 'bytes');
                
                const nodeDataSize = this.calculateNodeDataSize();
                console.log('   Node data size:', nodeDataSize, 'bytes');
                
                const totalSize = headerSize + stringTableSize + nodeDataSize;
                console.log('   Total size:', totalSize, 'bytes');
                
                console.log('\\n5. Node size breakdown:');
                for (let i = 0; i < this.nodes.length; i++) {
                    const node = this.nodes[i];
                    if (node) {
                        const nodeSize = this.calculateNodeSize(node);
                        console.log('   Node', i, '(' + node.type + '):', nodeSize, 'bytes');
                    }
                }
                
                console.log('\\n6. String table breakdown:');
                let strTableCalc = 4; // String count
                for (let i = 0; i < this.strings.length; i++) {
                    const str = this.strings[i];
                    const utf8Bytes = new TextEncoder().encode(str);
                    const strSize = 2 + utf8Bytes.length + 1; // Length + UTF-8 + null terminator
                    strTableCalc += strSize;
                    console.log('   String', i, '("' + str + '"):', strSize, 'bytes');
                }
                console.log('   Calculated string table size:', strTableCalc, 'bytes');
                
                return { headerSize, stringTableSize, nodeDataSize, totalSize };
            }
        }
    `;
    
    // This approach won't work directly, so let me try a different method
    // Let's directly call exportCompactAST and see what it produces
    
    console.log('3. Calling exportCompactAST directly...');
    const buffer = ArduinoParser.exportCompactAST(ast);
    
    console.log('4. Analyzing produced buffer...');
    console.log('   Buffer size:', buffer.byteLength, 'bytes');
    
    const view = new DataView(buffer);
    
    // Check header
    const nodeCount = view.getUint32(8, true);
    const stringTableSize = view.getUint32(12, true);
    console.log('   Header node count:', nodeCount);
    console.log('   Header string table size:', stringTableSize, 'bytes');
    
    // Calculate expected vs actual sizes
    const expectedNodeDataBytes = buffer.byteLength - 16 - stringTableSize;
    console.log('   Expected node data size:', expectedNodeDataBytes, 'bytes');
    
    if (expectedNodeDataBytes === 0) {
        console.log('❌ CRITICAL ISSUE: Node data size is 0!');
        console.log('   This means calculateNodeDataSize() is returning 0');
        console.log('   The issue is in the size calculation logic');
    } else {
        console.log('✅ Node data size looks reasonable');
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
}