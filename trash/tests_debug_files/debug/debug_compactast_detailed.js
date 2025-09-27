#!/usr/bin/env node

/**
 * Detailed CompactAST Debugging Script
 * 
 * This script provides an in-depth analysis of the CompactAST export process
 * to identify exactly where the NumberNode value gets corrupted.
 */

const fs = require('fs');
const { parse, exportCompactAST, prettyPrintAST } = require('../../src/javascript/ArduinoParser.js');

console.log('='.repeat(80));
console.log('Detailed CompactAST Debugging Script');
console.log('='.repeat(80));

// Parse the test code
const testCode = 'int x = 5;';
console.log(`\nParsing: ${testCode}`);

const ast = parse(testCode);
console.log('\nFull AST structure:');
console.log(JSON.stringify(ast, null, 2));

// Now let's hook into the CompactAST export process to see what's happening
// We'll need to monkey-patch the CompactASTExporter to add debugging

// First, let's create a custom CompactASTExporter that inherits the debugging capability
const originalExportCompactAST = require('../../src/javascript/ArduinoParser.js').exportCompactAST;

// Let's create our own CompactAST exporter with debugging
class DebugCompactASTExporter {
    constructor(options = {}) {
        this.options = {
            version: 0x0100,
            flags: 0x0000,
            ...options
        };
        
        // String table for deduplication
        this.stringTable = new Map();
        this.strings = [];
        
        // Node processing
        this.nodes = [];
        this.nodeMap = new Map();
        
        // Type mapping
        this.nodeTypeMap = {
            'ProgramNode': 0x01,
            'ErrorNode': 0x02,
            'CommentNode': 0x03,
            'CompoundStmtNode': 0x10,
            'ExpressionStatement': 0x11,
            'IfStatement': 0x12,
            'WhileStatement': 0x13,
            'DoWhileStatement': 0x14,
            'ForStatement': 0x15,
            'RangeBasedForStatement': 0x16,
            'SwitchStatement': 0x17,
            'CaseStatement': 0x18,
            'DefaultStatement': 0x19,
            'BreakStatement': 0x1A,
            'ContinueStatement': 0x1B,
            'ReturnStatement': 0x1C,
            'GotoStatement': 0x1D,
            'LabelStatement': 0x1E,
            'EmptyStatement': 0x1F,
            'VarDeclNode': 0x20,
            'FuncDefNode': 0x21,
            'FuncCallNode': 0x22,
            'FunctionStyleCastNode': 0x23,
            'ConstructorCallNode': 0x24,
            'NewExpression': 0x25,
            'DeleteExpression': 0x26,
            'TypedefNode': 0x27,
            'StructNode': 0x28,
            'UnionNode': 0x29,
            'EnumNode': 0x2A,
            'ClassNode': 0x2B,
            'NamespaceNode': 0x2C,
            'UsingDirectiveNode': 0x2D,
            'BinaryOpNode': 0x30,
            'UnaryOpNode': 0x31,
            'AssignmentNode': 0x32,
            'TernaryExpression': 0x38,
            'NumberNode': 0x40,
            'StringLiteralNode': 0x41,
            'CharLiteralNode': 0x42,
            'IdentifierNode': 0x43,
            'ConstantNode': 0x44,
            'ArrayInitializerNode': 0x45,
            'DesignatedInitializerNode': 0x46,
            'TypeNode': 0x50,
            'ArrayTypeNode': 0x51,
            'PointerTypeNode': 0x52
        };
    }

    export(ast) {
        console.log('\n--- COMPACTAST EXPORT DEBUG ---');
        
        // Step 1: Collect all nodes
        console.log('\n1. COLLECTING NODES');
        this.collectNodes(ast);
        
        console.log(`   Total nodes collected: ${this.nodes.length}`);
        this.nodes.forEach((node, index) => {
            console.log(`   Node ${index}: ${node.type} ${node.value !== undefined ? `(value: ${JSON.stringify(node.value)})` : ''}`);
            if (node.type === 'NumberNode') {
                console.log(`     🔍 FOUND NumberNode at index ${index}: value=${node.value}, type=${typeof node.value}`);
            }
        });
        
        // Step 2: Calculate sizes 
        const totalSize = this.calculateTotalSize();
        console.log(`\n2. CALCULATED TOTAL SIZE: ${totalSize} bytes`);
        
        // Step 3: Create buffer and write data
        console.log('\n3. WRITING BINARY DATA');
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        
        let offset = 0;
        offset = this.writeHeader(view, offset);
        offset = this.writeStringTable(view, offset);
        offset = this.writeNodeData(view, offset);
        
        return buffer;
    }
    
    collectNodes(node, visited = new Set()) {
        if (!node || typeof node !== 'object' || visited.has(node)) {
            return;
        }
        visited.add(node);
        
        // Add current node with debugging
        if (node.type) {
            console.log(`     Collecting: ${node.type} ${node.value !== undefined ? `(value: ${JSON.stringify(node.value)})` : ''}`);
            const nodeIndex = this.nodes.length;
            this.nodes.push(node);
            this.nodeMap.set(node, nodeIndex);
        }
        
        // Recursively collect children
        if (node.children) {
            for (const child of node.children) {
                this.collectNodes(child, visited);
            }
        }
        
        // Collect named children
        const namedChildren = this.getNamedChildren(node);
        for (const childName of namedChildren) {
            if (node[childName]) {
                if (Array.isArray(node[childName])) {
                    // Special handling for VarDeclNode declarations
                    if (node.type === 'VarDeclNode' && childName === 'declarations') {
                        console.log(`     Processing VarDeclNode declarations array:`, node[childName]);
                        for (const decl of node[childName]) {
                            console.log(`       Declaration:`, decl);
                            if (decl.declarator) {
                                this.collectNodes(decl.declarator, visited);
                            }
                            if (decl.initializer) {
                                console.log(`       🎯 Processing initializer:`, decl.initializer);
                                this.collectNodes(decl.initializer, visited);
                            }
                        }
                    } else {
                        for (const child of node[childName]) {
                            this.collectNodes(child, visited);
                        }
                    }
                } else {
                    this.collectNodes(node[childName], visited);
                }
            }
        }
    }
    
    getNamedChildren(node) {
        const namedChildrenMap = {
            'VarDeclNode': ['varType', 'declarations'],
            'FuncDefNode': ['returnType', 'declarator', 'parameters', 'body'],
            'FuncCallNode': ['callee', 'arguments'],
            'BinaryOpNode': ['left', 'right'],
            'AssignmentNode': ['left', 'right'],
            'ExpressionStatement': ['expression']
        };
        
        return namedChildrenMap[node.type] || [];
    }
    
    calculateTotalSize() {
        // Header: magic(4) + version(2) + flags(2) + stringCount(4) + stringTableSize(4) + nodeCount(4) = 20
        let size = 20;
        
        // String table size
        for (const str of this.strings) {
            size += str.length + 1; // null terminated
        }
        
        // Nodes size (rough estimate)
        size += this.nodes.length * 10; // rough estimate per node
        
        return size + 100; // Add buffer for safety
    }
    
    writeHeader(view, offset) {
        // Magic number "PTSA"
        view.setUint8(offset + 0, 0x50); // 'P'
        view.setUint8(offset + 1, 0x54); // 'T' 
        view.setUint8(offset + 2, 0x53); // 'S'
        view.setUint8(offset + 3, 0x41); // 'A'
        
        view.setUint16(offset + 4, this.options.version, true);
        view.setUint16(offset + 6, this.options.flags, true);
        view.setUint32(offset + 8, this.strings.length, true);
        view.setUint32(offset + 12, this.getStringTableSize(), true);
        view.setUint32(offset + 16, this.nodes.length, true);
        
        return offset + 20;
    }
    
    writeStringTable(view, offset) {
        for (const str of this.strings) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset, str.charCodeAt(i));
                offset++;
            }
            view.setUint8(offset, 0); // null terminator
            offset++;
        }
        return offset;
    }
    
    writeNodeData(view, offset) {
        console.log('\n4. WRITING NODE DATA');
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            console.log(`\n   Writing node ${i}: ${node.type}`);
            offset = this.writeNode(view, offset, node, i);
        }
        return offset;
    }
    
    writeNode(view, offset, node, nodeIndex) {
        const startOffset = offset;
        
        console.log(`     Node ${nodeIndex} at offset ${offset}:`);
        console.log(`       Type: ${node.type}`);
        console.log(`       Value: ${JSON.stringify(node.value)}`);
        
        // Write node type
        const nodeType = this.nodeTypeMap[node.type];
        if (nodeType === undefined) {
            throw new Error(`Unknown node type: ${node.type}`);
        }
        
        console.log(`       Writing type byte: 0x${nodeType.toString(16)} at offset ${offset}`);
        view.setUint8(offset, nodeType);
        offset += 1;
        
        // Calculate flags
        let flags = 0;
        if (this.getChildCount(node) > 0) flags |= 0x01; // HAS_CHILDREN
        if (node.value !== undefined) flags |= 0x02; // HAS_VALUE
        
        console.log(`       Writing flags: 0x${flags.toString(16)} at offset ${offset}`);
        view.setUint8(offset, flags);
        offset += 1;
        
        // Skip data size for now
        const dataSizeOffset = offset;
        offset += 2;
        const dataStartOffset = offset;
        
        // Write value if present
        if (node.value !== undefined) {
            console.log(`       🎯 Writing value: ${JSON.stringify(node.value)} at offset ${offset}`);
            const valueBefore = offset;
            offset = this.writeValue(view, offset, node.value);
            console.log(`       🎯 Value written from ${valueBefore} to ${offset-1}`);
            
            // Debug: Show what was actually written for the value
            const valueBytes = [];
            for (let i = valueBefore; i < offset; i++) {
                valueBytes.push(`0x${view.getUint8(i).toString(16).padStart(2, '0')}`);
            }
            console.log(`       🎯 Value bytes: [${valueBytes.join(', ')}]`);
        }
        
        // Write actual data size
        const dataSize = offset - dataStartOffset;
        view.setUint16(dataSizeOffset, dataSize, true);
        
        console.log(`       Total node size: ${offset - startOffset} bytes`);
        return offset;
    }
    
    writeValue(view, offset, value) {
        const type = typeof value;
        console.log(`         writeValue called with: ${JSON.stringify(value)} (type: ${type})`);
        
        switch (type) {
            case 'number':
                console.log(`         Calling writeNumber for: ${value}`);
                return this.writeNumber(view, offset, value);
            case 'string':
                view.setUint8(offset, 0x0C); // STRING_VAL
                view.setUint16(offset + 1, this.addString(value), true);
                return offset + 3;
            default:
                view.setUint8(offset, 0x00); // VOID_VAL
                return offset + 1;
        }
    }
    
    writeNumber(view, offset, value) {
        console.log(`           writeNumber called with: ${value}`);
        
        if (Number.isInteger(value)) {
            if (value >= 0) {
                if (value <= 0xFF) {
                    console.log(`           Writing as UINT8: ${value}`);
                    view.setUint8(offset, 0x03); // UINT8_VAL
                    view.setUint8(offset + 1, value);
                    console.log(`           Wrote bytes: [0x03, 0x${value.toString(16)}]`);
                    return offset + 2;
                }
            } else {
                if (value >= -0x80 && value <= 0x7F) {
                    console.log(`           Writing as INT8: ${value}`);
                    view.setUint8(offset, 0x02); // INT8_VAL
                    view.setInt8(offset + 1, value);
                    console.log(`           Wrote bytes: [0x02, 0x${(value & 0xFF).toString(16)}]`);
                    return offset + 2;
                }
            }
        }
        
        // Fallback to float64
        console.log(`           Writing as FLOAT64: ${value}`);
        view.setUint8(offset, 0x0B); // FLOAT64_VAL
        view.setFloat64(offset + 1, value, true);
        return offset + 9;
    }
    
    getChildCount(node) {
        return 0; // Simplified for debugging
    }
    
    addString(str) {
        if (!this.stringTable.has(str)) {
            const index = this.strings.length;
            this.strings.push(str);
            this.stringTable.set(str, index);
            return index;
        }
        return this.stringTable.get(str);
    }
    
    getStringTableSize() {
        return this.strings.reduce((size, str) => size + str.length + 1, 0);
    }
}

// Run our debugging export
console.log('\n--- RUNNING DEBUG EXPORT ---');
const debugExporter = new DebugCompactASTExporter();
const debugBuffer = debugExporter.export(ast);

console.log(`\nDebug export completed. Buffer size: ${debugBuffer.byteLength} bytes`);

// Save and analyze the result
fs.writeFileSync('debug_detailed.ast', Buffer.from(debugBuffer));
console.log('Debug AST saved to: debug_detailed.ast');

console.log('\n' + '='.repeat(80));