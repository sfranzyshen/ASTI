#!/usr/bin/env node

/**
 * CompactAST Export Bug Analysis
 * 
 * This script shows the exact bug in the CompactAST export process.
 * The collectNodes method has special VarDeclNode handling, but getChildIndices doesn't.
 */

const { parse, exportCompactAST } = require('../../src/javascript/ArduinoParser.js');

function debugCompactASTExport() {
    console.log('='.repeat(80));
    console.log('COMPACTAST EXPORT BUG ANALYSIS');
    console.log('='.repeat(80));
    
    const testCode = 'int x = 5;';
    console.log(`\nAnalyzing: "${testCode}"`);
    
    const ast = parse(testCode);
    
    // Find the VarDeclNode
    const varDeclNode = findVarDeclNode(ast);
    
    console.log('\n🔍 VARDECLNODE STRUCTURE:');
    console.log(JSON.stringify(varDeclNode, null, 2));
    
    // Simulate the CompactAST export process
    console.log('\n📦 SIMULATING COMPACTAST EXPORT PROCESS:');
    
    // Create a minimal exporter to show the bug
    class DebugExporter {
        constructor() {
            this.nodes = [];
            this.nodeMap = new Map();
        }
        
        // This mimics the collectNodes method from the real exporter
        collectNodes(node, index = 0) {
            if (!node || this.nodeMap.has(node)) {
                return index;
            }
            
            this.nodeMap.set(node, index);
            this.nodes[index] = node;
            let nextIndex = index + 1;
            
            console.log(`   📝 Collecting Node ${index}: ${node.type} (${node.value || 'no value'})`);
            
            // Process children array
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
                        // 🎯 SPECIAL HANDLING FOR VARDECLNODE DECLARATIONS ARRAY
                        if (node.type === 'VarDeclNode' && childName === 'declarations') {
                            console.log(`   🔧 SPECIAL VARDECLNODE HANDLING: Processing declarations array`);
                            for (const decl of node[childName]) {
                                console.log(`     📋 Processing declaration wrapper: ${JSON.stringify(Object.keys(decl))}`);
                                // Process declarator and initializer directly (skip declaration wrapper)
                                if (decl.declarator) {
                                    console.log(`     📛 Adding declarator: ${decl.declarator.value}`);
                                    nextIndex = this.collectNodes(decl.declarator, nextIndex);
                                }
                                if (decl.initializer) {
                                    console.log(`     🎯 Adding initializer: ${decl.initializer.value}`);
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
        
        // This mimics the getChildIndices method from the real exporter
        getChildIndices(node) {
            const indices = [];
            
            console.log(`   🔍 Getting child indices for ${node.type}:`);
            
            if (node.children) {
                for (const child of node.children) {
                    if (this.nodeMap.has(child)) {
                        const childIndex = this.nodeMap.get(child);
                        indices.push(childIndex);
                        console.log(`     👶 Child: Node ${childIndex} (${child.type})`);
                    }
                }
            }
            
            const namedChildren = this.getNamedChildren(node);
            for (const childName of namedChildren) {
                console.log(`     🔍 Checking named child: ${childName}`);
                if (node[childName]) {
                    if (Array.isArray(node[childName])) {
                        console.log(`     📋 Array child ${childName} has ${node[childName].length} items`);
                        // 🚨 BUG: NO SPECIAL HANDLING FOR VARDECLNODE HERE!
                        for (const child of node[childName]) {
                            if (this.nodeMap.has(child)) {
                                const childIndex = this.nodeMap.get(child);
                                indices.push(childIndex);
                                console.log(`     👶 Array Child: Node ${childIndex} (${child.type})`);
                            } else {
                                console.log(`     ❌ Array child not in nodeMap: ${child.type || 'unknown'} - ${JSON.stringify(Object.keys(child))}`);
                            }
                        }
                    } else {
                        if (this.nodeMap.has(node[childName])) {
                            const childIndex = this.nodeMap.get(node[childName]);
                            indices.push(childIndex);
                            console.log(`     👶 Named Child: Node ${childIndex} (${node[childName].type})`);
                        }
                    }
                }
            }
            
            return indices;
        }
        
        getNamedChildren(node) {
            const childrenMap = {
                'VarDeclNode': ['varType', 'declarations'],
                'ProgramNode': ['children']
            };
            
            return childrenMap[node.type] || [];
        }
    }
    
    console.log('\n🏗️ PHASE 1: COLLECT NODES (this works correctly)');
    console.log('-'.repeat(50));
    
    const exporter = new DebugExporter();
    exporter.collectNodes(ast);
    
    console.log(`\n   ✅ Total nodes collected: ${exporter.nodes.length}`);
    for (let i = 0; i < exporter.nodes.length; i++) {
        const node = exporter.nodes[i];
        console.log(`     Node ${i}: ${node.type} (${node.value || 'no value'})`);
    }
    
    console.log('\n🔗 PHASE 2: GET CHILD INDICES (this has the bug)');
    console.log('-'.repeat(50));
    
    const varDeclIndex = exporter.nodeMap.get(varDeclNode);
    console.log(`\n   VarDeclNode is at index: ${varDeclIndex}`);
    
    const childIndices = exporter.getChildIndices(varDeclNode);
    console.log(`\n   🚨 VarDeclNode child indices: [${childIndices.join(', ')}]`);
    console.log(`   Expected: [TypeNode, DeclaratorNode, NumberNode] indices`);
    console.log(`   Actual: Only [TypeNode] index - DeclaratorNode and NumberNode are missing!`);
    
    console.log('\n' + '='.repeat(80));
    console.log('🚨 ROOT CAUSE IDENTIFIED:');
    console.log('='.repeat(80));
    console.log('1. collectNodes() has special VarDeclNode handling (lines 4704-4713)');
    console.log('2. getChildIndices() does NOT have the same special handling');
    console.log('3. DeclaratorNode and NumberNode are collected but not linked as children');
    console.log('4. C++ reader looks for children but only finds TypeNode');
    console.log('\n💡 FIX: Add same special VarDeclNode handling to getChildIndices()');
}

function findVarDeclNode(node) {
    if (!node) return null;
    if (node.type === 'VarDeclNode') return node;
    
    if (node.children) {
        for (const child of node.children) {
            const found = findVarDeclNode(child);
            if (found) return found;
        }
    }
    
    const namedChildren = ['varType', 'declarations', 'body', 'condition'];
    for (const prop of namedChildren) {
        if (node[prop]) {
            if (Array.isArray(node[prop])) {
                for (const child of node[prop]) {
                    const found = findVarDeclNode(child);
                    if (found) return found;
                }
            } else {
                const found = findVarDeclNode(node[prop]);
                if (found) return found;
            }
        }
    }
    
    return null;
}

debugCompactASTExport();