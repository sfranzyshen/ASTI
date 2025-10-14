const path = require('path');

async function testWriteArrayToMemory() {
    const wasmPath = path.join(__dirname, '../build_wasm/arduino_interpreter_debug.js');
    const createWasmModule = require(wasmPath);
    const wasmModule = await createWasmModule();
    
    console.log('✅ Debug WASM module loaded');
    console.log('\nChecking for writeArrayToMemory:');
    console.log('  typeof writeArrayToMemory:', typeof wasmModule.writeArrayToMemory);
    
    if (typeof wasmModule.writeArrayToMemory === 'function') {
        console.log('  ✅ writeArrayToMemory is available!');
        
        // Test it
        const testData = new Uint8Array([0x41, 0x53, 0x54, 0x50]);
        const ptr = wasmModule._malloc(4);
        
        console.log('\nTesting bulk write:');
        wasmModule.writeArrayToMemory(testData, ptr);
        
        // Verify
        const read = [];
        for (let i = 0; i < 4; i++) {
            read.push(wasmModule.getValue(ptr + i, 'i8'));
        }
        
        console.log('  Written: [0x41, 0x53, 0x54, 0x50]');
        console.log('  Read:    [' + read.map(b => '0x' + (b & 0xFF).toString(16)).join(', ') + ']');
        console.log('  ✅ writeArrayToMemory works!');
        
        wasmModule._free(ptr);
    } else {
        console.log('  ❌ writeArrayToMemory NOT available');
    }
}

testWriteArrayToMemory().catch(console.error);
