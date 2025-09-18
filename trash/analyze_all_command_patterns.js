#!/usr/bin/env node

/**
 * Comprehensive Command Pattern Analysis
 * Analyzes ALL JavaScript command patterns from 135 test cases
 * to identify the complete command generation requirements
 */

const fs = require('fs');
const path = require('path');

// Command type frequency tracking
const commandStats = {
    types: new Map(),
    fields: new Map(),
    messages: new Map(),
    patterns: new Map()
};

// Unique command structures
const commandStructures = new Map();

function analyzeCommandFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const commands = JSON.parse(content);
        
        return {
            file: path.basename(filePath),
            count: commands.length,
            commands: commands
        };
    } catch (error) {
        console.warn(`⚠️  Could not parse ${filePath}: ${error.message}`);
        return null;
    }
}

function catalogCommand(cmd) {
    const type = cmd.type;
    
    // Count command types
    commandStats.types.set(type, (commandStats.types.get(type) || 0) + 1);
    
    // Catalog all fields for this command type
    const fields = Object.keys(cmd).filter(k => k !== 'timestamp');
    const fieldKey = `${type}:fields`;
    if (!commandStats.fields.has(fieldKey)) {
        commandStats.fields.set(fieldKey, new Set());
    }
    fields.forEach(field => commandStats.fields.get(fieldKey).add(field));
    
    // Catalog messages
    if (cmd.message) {
        const msgKey = `${type}:message`;
        if (!commandStats.messages.has(msgKey)) {
            commandStats.messages.set(msgKey, new Set());
        }
        commandStats.messages.get(msgKey).add(cmd.message);
    }
    
    // Create command structure fingerprint
    const structure = {
        type: type,
        fields: fields.sort(),
        hasMessage: !!cmd.message,
        hasIteration: !!cmd.iteration,
        hasCompleted: !!cmd.completed,
        hasFunction: !!cmd.function
    };
    
    const structKey = JSON.stringify(structure);
    if (!commandStructures.has(structKey)) {
        commandStructures.set(structKey, {
            structure,
            examples: [],
            count: 0
        });
    }
    commandStructures.get(structKey).count++;
    if (commandStructures.get(structKey).examples.length < 3) {
        commandStructures.get(structKey).examples.push(cmd);
    }
}

function main() {
    console.log('🔍 COMPREHENSIVE COMMAND PATTERN ANALYSIS');
    console.log('==========================================');
    
    // Find all .commands files
    const testDataDir = 'test_data';
    const commandFiles = fs.readdirSync(testDataDir)
        .filter(f => f.endsWith('.commands'))
        .map(f => path.join(testDataDir, f));
    
    console.log(`📁 Found ${commandFiles.length} command files`);
    
    let totalCommands = 0;
    let totalFiles = 0;
    
    // Analyze each file
    for (const filePath of commandFiles) {
        const analysis = analyzeCommandFile(filePath);
        if (analysis) {
            totalFiles++;
            totalCommands += analysis.count;
            
            // Catalog each command
            analysis.commands.forEach(catalogCommand);
        }
    }
    
    console.log(`✅ Analyzed ${totalFiles} files with ${totalCommands} total commands`);
    console.log();
    
    // Report command types
    console.log('📊 COMMAND TYPE FREQUENCY:');
    console.log('==========================');
    const sortedTypes = Array.from(commandStats.types.entries())
        .sort((a, b) => b[1] - a[1]);
    
    for (const [type, count] of sortedTypes) {
        const percentage = ((count / totalCommands) * 100).toFixed(1);
        console.log(`${type}: ${count} (${percentage}%)`);
    }
    console.log();
    
    // Report unique command structures
    console.log('🏗️  UNIQUE COMMAND STRUCTURES:');
    console.log('==============================');
    let structureIndex = 1;
    for (const [key, data] of commandStructures.entries()) {
        console.log(`[${structureIndex}] ${data.structure.type} (${data.count} instances)`);
        console.log(`    Fields: ${data.structure.fields.join(', ')}`);
        console.log(`    Has message: ${data.structure.hasMessage}`);
        console.log(`    Has iteration: ${data.structure.hasIteration}`);
        console.log(`    Has completed: ${data.structure.hasCompleted}`);
        console.log(`    Has function: ${data.structure.hasFunction}`);
        console.log(`    Example:`, JSON.stringify(data.examples[0], null, 2).substring(0, 200) + '...');
        console.log();
        structureIndex++;
    }
    
    // Report message patterns
    console.log('💬 MESSAGE PATTERNS BY COMMAND TYPE:');
    console.log('====================================');
    for (const [key, messages] of commandStats.messages.entries()) {
        console.log(`${key}:`);
        Array.from(messages).slice(0, 5).forEach(msg => {
            console.log(`  - "${msg}"`);
        });
        if (messages.size > 5) {
            console.log(`  ... and ${messages.size - 5} more patterns`);
        }
        console.log();
    }
    
    // Generate C++ implementation guidance
    console.log('🎯 C++ IMPLEMENTATION REQUIREMENTS:');
    console.log('===================================');
    console.log('Based on this analysis, C++ must generate:');
    console.log();
    
    for (const [type, count] of sortedTypes.slice(0, 10)) {
        console.log(`${type}:`);
        const fieldKey = `${type}:fields`;
        if (commandStats.fields.has(fieldKey)) {
            const fields = Array.from(commandStats.fields.get(fieldKey));
            console.log(`  Required fields: ${fields.join(', ')}`);
        }
        
        const msgKey = `${type}:message`;
        if (commandStats.messages.has(msgKey)) {
            const msgCount = commandStats.messages.get(msgKey).size;
            console.log(`  Message patterns: ${msgCount} unique patterns`);
            
            // Show most common patterns
            const messages = Array.from(commandStats.messages.get(msgKey));
            console.log(`  Common messages: ${messages.slice(0, 3).join('; ')}`);
        }
        console.log();
    }
}

if (require.main === module) {
    main();
}