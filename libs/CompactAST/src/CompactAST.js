/**
 * CompactAST - Cross-Platform AST Binary Serialization Library
 * 
 * Provides efficient binary serialization for Abstract Syntax Trees with 12.5x compression
 * compared to JSON format. Designed for embedded deployment on ESP32-S3 and other
 * resource-constrained environments.
 * 
 * Features:
 * - 12.5x compression ratio over JSON
 * - Cross-platform compatibility (JavaScript ↔ C++)
 * - Type-safe number encoding with INT8/INT16 optimization
 * - String deduplication with UTF-8 support
 * - Visitor pattern compatibility
 * - Complete Arduino AST node type support (0x01-0x59)
 *
 * @version 3.0.0
 * @license MIT
 * @author Arduino AST Interpreter Project
 */

/**
 * Export an AST as CompactAST binary format
 * @param {Object} ast - The AST root node
 * @param {Object} options - Export options
 * @returns {ArrayBuffer} - Binary AST data
 */
function exportCompactAST(ast, options = {}) {
    const exporter = new CompactASTExporter(options);
    return exporter.export(ast);
}

class CompactASTExporter {
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
        
        // Type mapping for cross-platform compatibility
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
            'ReturnStatement': 0x19,
            'BreakStatement': 0x1A,
            'ContinueStatement': 0x1B,
            'EmptyStatement': 0x1C,
            'VarDeclNode': 0x20,
            'FuncDefNode': 0x21,
            'FuncDeclNode': 0x22,
            'StructDeclaration': 0x23,
            'EnumDeclaration': 0x24,
            'ClassDeclaration': 0x25,
            'TypedefDeclaration': 0x26,
            'TemplateDeclaration': 0x27,
            'BinaryOpNode': 0x30,
            'UnaryOpNode': 0x31,
            'AssignmentNode': 0x32,
            'FuncCallNode': 0x33,
            'MemberAccessNode': 0x34,
            'ArrayAccessNode': 0x35,
            'CastExpression': 0x36,
            'SizeofExpression': 0x37,
            'TernaryExpression': 0x38,
            'NumberNode': 0x40,
            'StringLiteralNode': 0x41,
            'CharLiteralNode': 0x42,
            'IdentifierNode': 0x43,
            'ConstantNode': 0x44,
            'ArrayInitializerNode': 0x45,
            'DesignatedInitializerNode': 0x47,
            'TypeNode': 0x50,
            'DeclaratorNode': 0x51,
            'ParamNode': 0x52,
            'PostfixExpressionNode': 0x53,
            'StructType': 0x54,
            'FunctionPointerDeclaratorNode': 0x55,
            'CommaExpression': 0x56,
            'ArrayDeclaratorNode': 0x57,
            'PointerDeclaratorNode': 0x58,
            'ConstructorCallNode': 0x59
        };
        
        this.valueTypeMap = {
            'undefined': 0x00,  // VOID_VAL
            'boolean': 0x01,    // BOOL_VAL  
            'number': 0x0B,     // FLOAT64_VAL (JavaScript numbers are 64-bit floats)
            'string': 0x0C,     // STRING_VAL
            'object': 0x0E      // NULL_VAL for null, ARRAY_VAL for arrays
        };
    }
    
    export(ast) {
        // CompactAST JavaScript Export Fix - ACTIVE
        // Consolidated solution from ChatGPT + Claude + Gemini reviews
        
        // Phase 1: Collect all nodes and build string table
        this.collectNodes(ast);

        // Phase 2: Calculate buffer size
        const headerSize = 16;
        const stringTableSize = this.calculateStringTableSize();
        const nodeDataSize = this.calculateNodeDataSize();
        const totalSize = headerSize + stringTableSize + nodeDataSize + 1024; // Add 1KB safety margin
        
        // Phase 3: Write binary data
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;
        
        // Write header
        offset = this.writeHeader(view, offset, stringTableSize);
        
        // Write string table
        offset = this.writeStringTable(view, offset);
        
        // Write node data
        this.writeNodeData(view, offset);
        
        return buffer;
    }
    
    collectNodes(node, index = 0) {
        if (!node) return index;

        // Node collection phase

        // Add to node list
        this.nodes[index] = node;
        this.nodeMap.set(node, index);
        
        // Add strings to string table
        if (node.value && typeof node.value === 'string') {
            this.addString(node.value);
        }
        // [FROM CHATGPT] Use the same robust extractor for the string table
        const opStr = this.getOperatorString(node);
        if (typeof opStr === 'string' && opStr.length > 0) {
            this.addString(opStr);
        }
        if (node.name && typeof node.name === 'string') {
            this.addString(node.name);
        }
        
        let nextIndex = index + 1;
        
        // Process children
        if (node.children) {
            for (const child of node.children) {
                nextIndex = this.collectNodes(child, nextIndex);
            }
        }
        
        // Process named children based on node type
        const namedChildren = this.getNamedChildren(node);
        for (const childName of namedChildren) {
            if (node[childName]) {
                if (Array.isArray(node[childName])) {
                    // Special handling for VarDeclNode declarations array
                    if (node.type === 'VarDeclNode' && childName === 'declarations') {
                        for (const decl of node[childName]) {
                            // Process declarator and initializer directly (skip declaration wrapper)
                            if (decl.declarator) {
                                nextIndex = this.collectNodes(decl.declarator, nextIndex);
                            }
                            if (decl.initializer) {
                                nextIndex = this.collectNodes(decl.initializer, nextIndex);
                            }
                        }
                    } else {
                        for (const child of node[childName]) {
                            nextIndex = this.collectNodes(child, nextIndex);
                        }
                    }
                } else {
                    nextIndex = this.collectNodes(node[childName], nextIndex);
                }
            }
        }
        
        return nextIndex;
    }
    
    getNamedChildren(node) {
        const childrenMap = {
            'VarDeclNode': ['varType', 'declarations'],
            'FuncDefNode': ['returnType', 'declarator', 'parameters', 'body'],
            'FuncCallNode': ['callee', 'arguments'],
            'ConstructorCallNode': ['callee', 'arguments'],
            'IfStatement': ['condition', 'consequent', 'alternate'],
            'WhileStatement': ['condition', 'body'],
            'DoWhileStatement': ['body', 'condition'],
            'ForStatement': ['initializer', 'condition', 'increment', 'body'],
            'BinaryOpNode': ['left', 'right'],
            'UnaryOpNode': ['operand'],
            'AssignmentNode': ['left', 'right'],
            'ExpressionStatement': ['expression'],
            'MemberAccessNode': ['object', 'property'],
            'ParamNode': ['paramType', 'declarator', 'defaultValue'],
            'ArrayAccessNode': ['identifier', 'index'],
            'ArrayInitializerNode': ['elements'],
            'DesignatedInitializerNode': ['value'],
            'FunctionPointerDeclaratorNode': ['identifier', 'parameters'],
            'SwitchStatement': ['discriminant', 'cases'],
            'CaseStatement': ['test', 'consequent'],
            'RangeBasedForStatement': ['variable', 'iterable', 'body'],
            'TernaryExpression': ['condition', 'consequent', 'alternate'],
            'PostfixExpressionNode': ['operand'],
            'CommaExpression': ['left', 'right'],
            'ArrayDeclaratorNode': ['identifier', 'dimensions'],
            'ReturnStatement': ['value'],  // ULTRATHINK: Re-adding for Test 42
            'CastExpression': ['operand']  // castType is a string value, not a child node
        };

        const childNames = childrenMap[node.type] || [];

        // 🔒 Guarantee BOTH children exist for BinaryOpNode / AssignmentNode
        if (node.type === 'BinaryOpNode' || node.type === 'AssignmentNode') {
            if (!('left' in node)) node.left = null;
            if (!('right' in node)) node.right = null;
        }

        return childNames;
    }
    
    /**
     * [FROM CHATGPT]
     * Return canonical operator string for a node, or undefined if none.
     * Checks several possible AST shapes to be robust against different AST producers.
     */
    getOperatorString(node) {
        if (!node) return undefined;
        
        // Robust operator extraction across different AST structures
        
        // 1) node.operator (common field)
        if (typeof node.operator === 'string' && node.operator.length > 0) return node.operator;
        
        // 2) node.op can be a string or an object with .value/.lexeme/.token
        if (node.op !== undefined) {
            if (typeof node.op === 'string' && node.op.length > 0) return node.op;
            if (typeof node.op === 'object' && node.op !== null) {
                if (typeof node.op.value === 'string' && node.op.value.length > 0) return node.op.value;
                if (typeof node.op.lexeme === 'string' && node.op.lexeme.length > 0) return node.op.lexeme;
                if (typeof node.op.token === 'string' && node.op.token.length > 0) return node.op.token;
            }
        }
        
        // 3) node.value if it's a string (some ASTs put operator directly in value)
        if (typeof node.value === 'string' && node.value.length > 0) return node.value;
        
        // 4) fallback to undefined to indicate no operator found
        return undefined;
    }
    
    /**
     * [FROM CLAUDE]
     * A helper to log the structure of operator nodes for easy debugging.
     */
    debugOperatorNode(node) {
        if (node.type === 'UnaryOpNode' || node.type === 'BinaryOpNode') {
            console.log(`\n=== DEBUG: ${node.type} ===`);
            console.log('node.operator:', node.operator);
            console.log('node.op:', node.op);
            console.log('node.op?.value:', node.op?.value);
            console.log('node.value:', node.value);
            console.log('Full node structure:', JSON.stringify(node, null, 2));
            console.log('========================\n');
        }
    }
    
    addString(str) {
        if (!this.stringTable.has(str)) {
            const index = this.strings.length;
            this.stringTable.set(str, index);
            this.strings.push(str);
        }
        return this.stringTable.get(str);
    }
    
    calculateStringTableSize() {
        let size = 4; // String count
        for (const str of this.strings) {
            size += 2; // Length prefix
            size += Buffer.byteLength(str, 'utf8'); // UTF-8 data
            size += 1; // Null terminator
        }
        // Align to 4-byte boundary
        return (size + 3) & ~3;
    }
    
    calculateNodeDataSize() {
        let size = 0;
        for (const node of this.nodes) {
            if (node) {
                size += this.calculateNodeSize(node);
            }
        }
        return size;
    }
    
    calculateNodeSize(node) {
        let size = 4; // NodeType + Flags + DataSize
        
        // Add value size if present
        if (node.value !== undefined) {
            size += this.calculateValueSize(node.value);
        }
        
        // Add operator size if present
        if (node.operator) {
            size += 3; // ValueType + StringIndex
        }
        
        // Add op.value size if present (for BinaryOpNode/UnaryOpNode)
        if (node.op && node.op.value) {
            size += 3; // ValueType + StringIndex
        }
        
        // Add children indices
        const childCount = this.getChildCount(node);
        size += childCount * 2; // 2 bytes per child index
        
        return size;
    }
    
    calculateValueSize(value) {
        const type = typeof value;
        switch (type) {
            case 'boolean': return 2; // ValueType + 1 byte
            case 'number': return 9; // ValueType + 8 bytes (double)
            case 'string': return 3; // ValueType + StringIndex
            case 'object':
                if (value === null) return 1; // ValueType only
                if (Array.isArray(value)) return 1 + value.length * 2; // ValueType + indices
                return 1; // ValueType only for other objects
            default: return 1; // VOID_VAL
        }
    }
    
    getChildCount(node) {
        let count = 0;

        if (node.children) {
            count += node.children.length;
        }

        const namedChildren = this.getNamedChildren(node);
        for (const childName of namedChildren) {
            if (node[childName]) {
                if (Array.isArray(node[childName])) {
                    count += node[childName].length;
                } else {
                    count += 1;
                }
            }
        }

        // CastExpression nodes have operand child + castType value

        return count;
    }
    
    writeHeader(view, offset, stringTableSize) {
        view.setUint32(offset, 0x50545341, true); // Magic 'ASTP' - little-endian to match C++ expectation
        view.setUint16(offset + 4, this.options.version, true);
        view.setUint16(offset + 6, this.options.flags, true);
        view.setUint32(offset + 8, this.nodes.length, true);
        view.setUint32(offset + 12, stringTableSize, true);
        return offset + 16;
    }
    
    writeStringTable(view, offset) {
        const startOffset = offset;
        
        // Write string count
        view.setUint32(offset, this.strings.length, true);
        offset += 4;
        
        // Write strings
        for (const str of this.strings) {
            const utf8Bytes = new TextEncoder().encode(str);
            
            // Write length
            view.setUint16(offset, utf8Bytes.length, true);
            offset += 2;
            
            // Write UTF-8 data
            for (let i = 0; i < utf8Bytes.length; i++) {
                view.setUint8(offset + i, utf8Bytes[i]);
            }
            offset += utf8Bytes.length;
            
            // Write null terminator
            view.setUint8(offset, 0);
            offset += 1;
        }
        
        // Align to 4-byte boundary
        while ((offset - startOffset) % 4 !== 0) {
            view.setUint8(offset, 0);
            offset++;
        }
        
        return offset;
    }
    
    writeNodeData(view, offset) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (node) {
                offset = this.writeNode(view, offset, node, i);
            }
        }
        return offset;
    }
    
    writeNode(view, offset, node, nodeIndex) {
        const startOffset = offset;
        
        // Write node type
        if (!node || !node.type) {
            throw new Error(`Invalid node during AST export: ${JSON.stringify(node)}`);
        }
        const nodeType = this.nodeTypeMap[node.type];
        if (nodeType === undefined) {
            throw new Error(`Unknown node type: ${node.type}`);
        }
        view.setUint8(offset, nodeType);
        offset += 1;
        
        // [FROM CLAUDE] Call the debug helper to inspect the node if needed (uncomment to debug)
        // this.debugOperatorNode(node);

        // --- CONSOLIDATED FLAG AND VALUE LOGIC ---
        // [INSPIRED BY GEMINI] The logic is structured to prioritize operator nodes first.
        // [FROM CHATGPT] This implementation is the most robust.
        
        // Calculate flags
        let flags = 0;
        if (this.getChildCount(node) > 0) flags |= 0x01; // HAS_CHILDREN

        // Extract operator using the robust helper function
        const operatorString = this.getOperatorString(node);

        // Set HAS_VALUE flag ONLY if we will actually write a value
        if (node.value !== undefined) {
            flags |= 0x02; // HAS_VALUE
        } else if (typeof operatorString === 'string') {
            flags |= 0x02; // HAS_VALUE for operator nodes, but only if operator exists
        } else if (node.type === 'CastExpression' && node.castType) {
            flags |= 0x02; // HAS_VALUE for CastExpression castType
        }

        view.setUint8(offset, flags);
        offset += 1;

        // Skip data size for now, will write at the end
        const dataSizeOffset = offset;
        offset += 2;
        const dataStartOffset = offset;

        // Write value if present (node.value takes precedence over operators)
        if (node.value !== undefined) {
            offset = this.writeValue(view, offset, node.value);
        } else if (typeof operatorString === 'string') {
            // Write the canonical operator we extracted
            offset = this.writeValue(view, offset, operatorString);
        } else if (node.type === 'CastExpression' && node.castType) {
            // Write castType for CastExpression nodes
            offset = this.writeValue(view, offset, node.castType);
        }
        // The faulty fallback that wrote an empty string is now removed.
        
        // Write children indices
        const childIndices = this.getChildIndices(node);
        for (const childIndex of childIndices) {
            view.setUint16(offset, childIndex, true);
            offset += 2;
        }
        
        // Write actual data size
        const dataSize = offset - dataStartOffset;
        view.setUint16(dataSizeOffset, dataSize, true);
        
        return offset;
    }
    
    writeValue(view, offset, value) {
        const type = typeof value;
        
        switch (type) {
            case 'boolean':
                view.setUint8(offset, 0x01); // BOOL_VAL
                view.setUint8(offset + 1, value ? 1 : 0);
                return offset + 2;
                
            case 'number':
                // Implement proper number type detection per CompactAST specification
                return this.writeNumber(view, offset, value);
                
            case 'string':
                view.setUint8(offset, 0x0C); // STRING_VAL
                view.setUint16(offset + 1, this.addString(value), true);
                return offset + 3;
                
            case 'object':
                if (value === null) {
                    view.setUint8(offset, 0x0E); // NULL_VAL
                    return offset + 1;
                }
                // For other objects, just mark as void
                view.setUint8(offset, 0x00); // VOID_VAL
                return offset + 1;
                
            default:
                view.setUint8(offset, 0x00); // VOID_VAL
                return offset + 1;
        }
    }
    
    /**
     * Write a JavaScript number with proper type detection and INT8/INT16 optimization
     * Follows CompactAST specification for type-safe number handling
     */
    writeNumber(view, offset, value) {
        // Check if the number is an integer
        if (Number.isInteger(value)) {
            // Determine the appropriate integer type based on value range
            if (value >= 0) {
                // Unsigned integer - optimize for smallest possible type
                if (value <= 0xFF) { // Fits in 8-bit unsigned
                    view.setUint8(offset, 0x03); // UINT8_VAL
                    view.setUint8(offset + 1, value);
                    return offset + 2;
                } else if (value <= 0xFFFF) { // Fits in 16-bit unsigned
                    view.setUint8(offset, 0x05); // UINT16_VAL
                    view.setUint16(offset + 1, value, true);
                    return offset + 3;
                } else if (value <= 0xFFFFFFFF) { // Fits in 32-bit unsigned
                    view.setUint8(offset, 0x07); // UINT32_VAL
                    view.setUint32(offset + 1, value, true);
                    return offset + 5;
                } else {
                    // Value too large for 32-bit, use double
                    view.setUint8(offset, 0x0B); // FLOAT64_VAL
                    view.setFloat64(offset + 1, value, true);
                    return offset + 9;
                }
            } else {
                // Signed integer - optimize for smallest possible type
                if (value >= -0x80 && value <= 0x7F) { // Fits in 8-bit signed
                    view.setUint8(offset, 0x02); // INT8_VAL
                    view.setInt8(offset + 1, value);
                    return offset + 2;
                } else if (value >= -0x8000 && value <= 0x7FFF) { // Fits in 16-bit signed
                    view.setUint8(offset, 0x04); // INT16_VAL
                    view.setInt16(offset + 1, value, true);
                    return offset + 3;
                } else if (value >= -0x80000000 && value <= 0x7FFFFFFF) { // Fits in 32-bit signed
                    view.setUint8(offset, 0x06); // INT32_VAL
                    view.setInt32(offset + 1, value, true);
                    return offset + 5;
                } else {
                    // Value too large for 32-bit, use double
                    view.setUint8(offset, 0x0B); // FLOAT64_VAL
                    view.setFloat64(offset + 1, value, true);
                    return offset + 9;
                }
            }
        } else {
            // Floating-point number
            // Check if it can be represented accurately as float32
            const float32Value = Math.fround(value);
            // Use a small tolerance for floating-point comparison
            const tolerance = 1e-7;
            if (Math.abs(float32Value - value) < tolerance) {
                // Can be represented as 32-bit float
                view.setUint8(offset, 0x0A); // FLOAT32_VAL
                view.setFloat32(offset + 1, value, true);
                return offset + 5;
            } else {
                // Requires 64-bit precision
                view.setUint8(offset, 0x0B); // FLOAT64_VAL
                view.setFloat64(offset + 1, value, true);
                return offset + 9;
            }
        }
    }
    
    getChildIndices(node) {
        const indices = [];

        if (node.children) {
            for (const child of node.children) {
                if (this.nodeMap.has(child)) {
                    indices.push(this.nodeMap.get(child));
                }
            }
        }

        const namedChildren = this.getNamedChildren(node);
        for (const childName of namedChildren) {
            if (node[childName]) {
                if (Array.isArray(node[childName])) {
                    // Special handling for VarDeclNode declarations array
                    if (node.type === 'VarDeclNode' && childName === 'declarations') {
                        for (const decl of node[childName]) {
                            // Process declarator and initializer directly (skip declaration wrapper)
                            if (decl.declarator && this.nodeMap.has(decl.declarator)) {
                                indices.push(this.nodeMap.get(decl.declarator));
                            }
                            if (decl.initializer && this.nodeMap.has(decl.initializer)) {
                                indices.push(this.nodeMap.get(decl.initializer));
                            }
                        }
                    } else {
                        // Normal array processing for other node types
                        for (const child of node[childName]) {
                            if (this.nodeMap.has(child)) {
                                indices.push(this.nodeMap.get(child));
                            }
                        }
                    }
                } else {
                    if (this.nodeMap.has(node[childName])) {
                        indices.push(this.nodeMap.get(node[childName]));
                    }
                }
            }
        }

        return indices;
    }
}

// Universal module pattern - supports both Node.js and browser
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    // Node.js environment
    module.exports = {
        exportCompactAST,
        CompactASTExporter
    };
} else {
    // Browser environment - use a namespace to avoid conflicts
    if (typeof window !== 'undefined') {
        if (!window.CompactAST) {
            window.CompactAST = {};
        }
        window.CompactAST.exportCompactAST = exportCompactAST;
        window.CompactAST.CompactASTExporter = CompactASTExporter;
        
        // Also provide direct access for backward compatibility (will be overridden by ArduinoParser)
        if (!window.exportCompactAST) {
            window.exportCompactAST = exportCompactAST;
        }
    }
}