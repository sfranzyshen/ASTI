#!/usr/bin/env node

const fs = require('fs');

// Test what our JavaScript is actually writing
const buffer = new ArrayBuffer(8);
const view = new DataView(buffer);

console.log('🔍 Magic Number Debug Test\n');

// Test what we're supposed to write
console.log('Expected: 0x41535450 ("ASTP")');
view.setUint32(0, 0x41535450, false); // false = big-endian for correct reading

// Convert to Buffer and examine
const testBuffer = Buffer.from(buffer);
console.log('Hex output:', testBuffer.toString('hex').substring(0, 8));
console.log('ASCII output:', testBuffer.toString('ascii', 0, 4));

// Check what we currently output 
fs.writeFileSync('magic_test.bin', testBuffer);
console.log('\n🔍 Written to magic_test.bin');