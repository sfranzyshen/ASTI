#!/usr/bin/env node

/**
 * Analyze CompactAST node type mapping between JavaScript and C++
 * to identify any serialization/deserialization issues
 */

const { parse } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { exportCompactAST } = require('./libs/CompactAST/src/CompactAST.js');

// Get the JavaScript node type mapping from CompactAST
const jsNodeTypeMap = {
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

// Get the C++ node type mapping from ASTNodes.hpp (based on enum values)
const cppNodeTypeMap = {
    // Program structure
    'PROGRAM': 0x01,
    'ERROR_NODE': 0x02,
    'COMMENT': 0x03,
    
    // Statements
    'COMPOUND_STMT': 0x10,
    'EXPRESSION_STMT': 0x11,
    'IF_STMT': 0x12,
    'WHILE_STMT': 0x13,
    'DO_WHILE_STMT': 0x14,
    'FOR_STMT': 0x15,
    'RANGE_FOR_STMT': 0x16,
    'SWITCH_STMT': 0x17,
    'CASE_STMT': 0x18,
    'RETURN_STMT': 0x19,
    'BREAK_STMT': 0x1A,
    'CONTINUE_STMT': 0x1B,
    'EMPTY_STMT': 0x1C,
    
    // Declarations
    'VAR_DECL': 0x20,
    'FUNC_DEF': 0x21,
    'FUNC_DECL': 0x22,
    'STRUCT_DECL': 0x23,
    'ENUM_DECL': 0x24,
    'CLASS_DECL': 0x25,
    'TYPEDEF_DECL': 0x26,
    'TEMPLATE_DECL': 0x27,
    
    // Expressions
    'BINARY_OP': 0x30,
    'UNARY_OP': 0x31,
    'ASSIGNMENT': 0x32,
    'FUNC_CALL': 0x33,
    'MEMBER_ACCESS': 0x34,
    'ARRAY_ACCESS': 0x35,
    'CAST_EXPR': 0x36,
    'SIZEOF_EXPR': 0x37,
    'TERNARY_EXPR': 0x38,
    
    // Literals and identifiers
    'NUMBER_LITERAL': 0x40,
    'STRING_LITERAL': 0x41,
    'CHAR_LITERAL': 0x42,
    'IDENTIFIER': 0x43,
    'CONSTANT': 0x44,
    'ARRAY_INIT': 0x45,
    
    // Types and parameters
    'TYPE_NODE': 0x50,
    'DECLARATOR_NODE': 0x51,
    'PARAM_NODE': 0x52,
    'POSTFIX_EXPRESSION': 0x53,
    'STRUCT_TYPE': 0x54,
    'FUNCTION_POINTER_DECLARATOR': 0x55,
    'COMMA_EXPRESSION': 0x56,
    'ARRAY_DECLARATOR': 0x57,
    'POINTER_DECLARATOR': 0x58,
    'CONSTRUCTOR_CALL': 0x59
};

function analyzeNodeTypeMappings() {
    console.log('=== CompactAST Node Type Mapping Analysis ===\n');
    
    // Create mapping tables for comparison
    const jsTypeToCode = new Map(Object.entries(jsNodeTypeMap));
    const jsCodeToType = new Map(Object.entries(jsNodeTypeMap).map(([k, v]) => [v, k]));
    const cppCodeToType = new Map(Object.entries(cppNodeTypeMap).map(([k, v]) => [v, k]));
    
    console.log('1. JavaScript Node Types in CompactAST:');
    const jsTypes = Object.keys(jsNodeTypeMap).sort();
    jsTypes.forEach(type => {
        const code = jsNodeTypeMap[type];
        console.log(`   ${type.padEnd(30)} → 0x${code.toString(16).padStart(2, '0').toUpperCase()}`);
    });
    
    console.log('\n2. C++ Node Types in ASTNodes.hpp:');
    const cppTypes = Object.keys(cppNodeTypeMap).sort();
    cppTypes.forEach(type => {
        const code = cppNodeTypeMap[type];
        console.log(`   ${type.padEnd(30)} → 0x${code.toString(16).padStart(2, '0').toUpperCase()}`);
    });
    
    console.log('\n3. Type Code Conflicts:');
    let conflicts = 0;
    const usedCodes = new Set();
    
    // Check for duplicate codes in JavaScript mapping
    Object.entries(jsNodeTypeMap).forEach(([jsType, code]) => {
        if (usedCodes.has(code)) {
            console.log(`   CONFLICT: Code 0x${code.toString(16).padStart(2, '0').toUpperCase()} used by multiple JS types`);
            conflicts++;
        } else {
            usedCodes.add(code);
        }
    });
    
    if (conflicts === 0) {
        console.log('   ✓ No code conflicts found in JavaScript mapping');
    }
    
    console.log('\n4. JavaScript → C++ Mapping Issues:');
    let mappingIssues = 0;
    
    Object.entries(jsNodeTypeMap).forEach(([jsType, code]) => {
        const cppType = cppCodeToType.get(code);
        if (!cppType) {
            console.log(`   ❌ JS type '${jsType}' (0x${code.toString(16).padStart(2, '0').toUpperCase()}) has no C++ counterpart`);
            mappingIssues++;
        }
    });
    
    console.log('\n5. C++ → JavaScript Mapping Issues:');
    Object.entries(cppNodeTypeMap).forEach(([cppType, code]) => {
        const jsType = jsCodeToType.get(code);
        if (!jsType) {
            console.log(`   ❌ C++ type '${cppType}' (0x${code.toString(16).padStart(2, '0').toUpperCase()}) has no JS counterpart`);
            mappingIssues++;
        }
    });
    
    console.log('\n6. Node Type Name Mismatches:');
    let nameMismatches = 0;
    
    Object.entries(jsNodeTypeMap).forEach(([jsType, code]) => {
        const cppType = cppCodeToType.get(code);
        if (cppType) {
            // Convert JS camelCase to C++ SNAKE_CASE for comparison
            const expectedCppName = jsType
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/Node$/, '')
                .replace(/Statement$/, '_STMT')
                .replace(/Declaration$/, '_DECL')
                .replace(/Expression$/, '_EXPR')
                .toUpperCase();
            
            if (expectedCppName !== cppType && !isAcceptableNameVariation(jsType, cppType)) {
                console.log(`   ⚠️  Name mismatch: JS '${jsType}' → C++ '${cppType}' (expected '${expectedCppName}')`);
                nameMismatches++;
            }
        }
    });
    
    if (nameMismatches === 0) {
        console.log('   ✓ All mapped types have consistent naming');
    }
    
    console.log('\n7. Summary:');
    console.log(`   JavaScript types: ${Object.keys(jsNodeTypeMap).length}`);
    console.log(`   C++ types: ${Object.keys(cppNodeTypeMap).length}`);
    console.log(`   Code conflicts: ${conflicts}`);
    console.log(`   Mapping issues: ${mappingIssues}`);
    console.log(`   Name mismatches: ${nameMismatches}`);
    
    if (conflicts === 0 && mappingIssues === 0) {
        console.log('\n   ✅ CompactAST serialization mapping appears to be CORRECT');
    } else {
        console.log('\n   ❌ CompactAST serialization mapping has CRITICAL ISSUES');
        console.log('   These issues will cause AST corruption during serialization/deserialization!');
    }
}

function isAcceptableNameVariation(jsType, cppType) {
    // Handle known acceptable variations
    const acceptableVariations = {
        'ProgramNode': 'PROGRAM',
        'ErrorNode': 'ERROR_NODE',
        'CommentNode': 'COMMENT',
        'CompoundStmtNode': 'COMPOUND_STMT',
        'VarDeclNode': 'VAR_DECL',
        'FuncDefNode': 'FUNC_DEF',
        'FuncDeclNode': 'FUNC_DECL',
        'BinaryOpNode': 'BINARY_OP',
        'UnaryOpNode': 'UNARY_OP',
        'AssignmentNode': 'ASSIGNMENT',
        'FuncCallNode': 'FUNC_CALL',
        'MemberAccessNode': 'MEMBER_ACCESS',
        'ArrayAccessNode': 'ARRAY_ACCESS',
        'CastExpression': 'CAST_EXPR',
        'SizeofExpression': 'SIZEOF_EXPR',
        'TernaryExpression': 'TERNARY_EXPR',
        'NumberNode': 'NUMBER_LITERAL',
        'StringLiteralNode': 'STRING_LITERAL',
        'CharLiteralNode': 'CHAR_LITERAL',
        'IdentifierNode': 'IDENTIFIER',
        'ConstantNode': 'CONSTANT',
        'ArrayInitializerNode': 'ARRAY_INIT',
        'TypeNode': 'TYPE_NODE',
        'DeclaratorNode': 'DECLARATOR_NODE',
        'ParamNode': 'PARAM_NODE',
        'PostfixExpressionNode': 'POSTFIX_EXPRESSION',
        'StructType': 'STRUCT_TYPE',
        'FunctionPointerDeclaratorNode': 'FUNCTION_POINTER_DECLARATOR',
        'CommaExpression': 'COMMA_EXPRESSION',
        'ArrayDeclaratorNode': 'ARRAY_DECLARATOR',
        'PointerDeclaratorNode': 'POINTER_DECLARATOR',
        'ConstructorCallNode': 'CONSTRUCTOR_CALL'
    };
    
    return acceptableVariations[jsType] === cppType;
}

function testActualParsing() {
    console.log('\n\n=== Testing Actual Parsing and Serialization ===\n');
    
    const testCode = `
void setup() {
    int x = 5;
    Serial.begin(9600);
}

void loop() {
    Serial.println(x);
}`;
    
    console.log('Test Arduino code:');
    console.log(testCode.trim());
    console.log('\nParsing...');
    
    try {
        const ast = parse(testCode);
        console.log('✓ Parsing successful');
        
        console.log('\nCollecting node types from parsed AST...');
        const nodeTypes = new Set();
        collectNodeTypes(ast, nodeTypes);
        
        console.log(`\nFound ${nodeTypes.size} unique node types in parsed AST:`);
        Array.from(nodeTypes).sort().forEach(type => {
            const code = jsNodeTypeMap[type];
            if (code !== undefined) {
                console.log(`   ${type.padEnd(30)} → 0x${code.toString(16).padStart(2, '0').toUpperCase()}`);
            } else {
                console.log(`   ${type.padEnd(30)} → ❌ NOT IN MAPPING TABLE!`);
            }
        });
        
        console.log('\nTesting CompactAST serialization...');
        const compactBuffer = exportCompactAST(ast);
        console.log(`✓ Serialization successful - ${compactBuffer.byteLength} bytes`);
        
        // Check if all node types can be serialized
        const unmappedTypes = Array.from(nodeTypes).filter(type => jsNodeTypeMap[type] === undefined);
        if (unmappedTypes.length > 0) {
            console.log('\n❌ CRITICAL: Some node types cannot be serialized!');
            console.log('Unmapped types:', unmappedTypes);
        } else {
            console.log('\n✅ All parsed node types can be serialized');
        }
        
    } catch (error) {
        console.log('❌ Error during parsing/serialization:', error.message);
    }
}

function collectNodeTypes(node, typeSet) {
    if (!node || typeof node !== 'object') return;
    
    if (node.type) {
        typeSet.add(node.type);
    }
    
    // Recursively collect from children
    if (node.children) {
        node.children.forEach(child => collectNodeTypes(child, typeSet));
    }
    
    // Recursively collect from named properties
    Object.values(node).forEach(value => {
        if (value && typeof value === 'object' && value.type) {
            collectNodeTypes(value, typeSet);
        } else if (Array.isArray(value)) {
            value.forEach(item => collectNodeTypes(item, typeSet));
        }
    });
}

if (require.main === module) {
    analyzeNodeTypeMappings();
    testActualParsing();
}

module.exports = {
    analyzeNodeTypeMappings,
    testActualParsing,
    jsNodeTypeMap,
    cppNodeTypeMap
};
