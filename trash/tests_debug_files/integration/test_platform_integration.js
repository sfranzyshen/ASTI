#!/usr/bin/env node

/**
 * Test Platform Integration with Preprocessor
 * 
 * This test verifies that the platform emulation system works correctly
 * with the preprocessor for platform-specific conditional compilation.
 */

const { parse } = require('./parser.js');
const { ASTInterpreter } = require('./interpreter.js');
const { PlatformEmulation } = require('./platform_emulation.js');

console.log('🧪 Testing Platform Integration with Preprocessor');
console.log('================================================');

// Create platform emulation instance
const platform = new PlatformEmulation('ESP32_NANO');

// Test code with platform conditionals
const testCode = `
void setup() {
    Serial.begin(9600);
    
    #ifdef ESP32
        Serial.println("ESP32 detected");
        
        #ifdef WIFI_SUPPORT
            Serial.println("WiFi is available");
        #endif
        
        #ifdef BLUETOOTH_SUPPORT  
            Serial.println("Bluetooth is available");
        #endif
        
    #else
        Serial.println("Not ESP32 platform");
    #endif
    
    #ifdef ARDUINO_NANO_ESP32
        Serial.println("Running on Arduino Nano ESP32");
    #endif
}

void loop() {
    #ifdef ESP32
        delay(1000);  
    #else
        delay(5000); 
    #endif
}
`;

console.log('📝 Test Code:');
console.log(testCode);

console.log('\n🎯 Platform Defines Being Used:');
const defines = platform.getDefines();
console.log('Key platform defines:');
Object.entries(defines).forEach(([key, value]) => {
    if (['ESP32', 'ARDUINO_NANO_ESP32', 'WIFI_SUPPORT', 'BLUETOOTH_SUPPORT'].includes(key)) {
        console.log(`   ${key}: ${value}`);
    }
});

console.log('\n🔍 Testing with ESP32 Nano Platform:');

try {
    // Parse with platform context
    const ast = parse(testCode, { 
        enablePreprocessor: true, 
        verbose: true,
        platformContext: platform
    });
    
    console.log('\n📊 Running interpreter to see platform-specific execution...');
    
    const interpreter = new ASTInterpreter(ast, { 
        verbose: false, 
        debug: false, 
        stepDelay: 0, 
        maxLoopIterations: 1 
    });

    let commands = [];
    interpreter.onCommand = (command) => {
        commands.push(command);
    };

    // Suppress console output during execution
    const originalConsoleLog = console.log;
    console.log = () => {};

    interpreter.start();
    
    setTimeout(() => {
        console.log = originalConsoleLog;
        
        console.log('📋 Serial Output Analysis:');
        const serialCommands = commands.filter(cmd => 
            cmd.type === 'FUNCTION_CALL' && cmd.function === 'Serial.println'
        );
        
        console.log('Messages printed:');
        serialCommands.forEach((cmd, i) => {
            const message = cmd.arguments[0] || cmd.data || 'Unknown';
            console.log(`${i + 1}. ${message}`);
        });
        
        console.log('\n🎯 SUCCESS ANALYSIS:');
        const messages = serialCommands.map(cmd => cmd.arguments[0] || cmd.data || '');
        
        console.log('\n✅ Expected Messages (ESP32 Nano):');
        console.log('   - "ESP32 detected"');
        console.log('   - "WiFi is available"'); 
        console.log('   - "Bluetooth is available"');
        console.log('   - "Running on Arduino Nano ESP32"');
        
        console.log('\n📊 Actual Results:');
        if (messages.includes('"ESP32 detected"')) {
            console.log('✅ ESP32 branch executed correctly');
        } else {
            console.log('❌ ESP32 branch not executed');
        }
        
        if (messages.includes('"WiFi is available"')) {
            console.log('✅ WiFi support detected correctly');
        } else {
            console.log('❌ WiFi support not detected');
        }
        
        if (messages.includes('"Bluetooth is available"')) {
            console.log('✅ Bluetooth support detected correctly');
        } else {
            console.log('❌ Bluetooth support not detected');
        }
        
        if (messages.includes('"Running on Arduino Nano ESP32"')) {
            console.log('✅ Arduino Nano ESP32 platform detected correctly');
        } else {
            console.log('❌ Arduino Nano ESP32 platform not detected');
        }
        
        console.log('\n🎉 PLATFORM INTEGRATION TEST COMPLETE!');
        
        // Test platform switching
        console.log('\n🔄 Testing Platform Switching to Arduino Uno:');
        testPlatformSwitch();
        
    }, 500);
    
} catch (error) {
    console.error('❌ Error during platform integration test:', error.message);
}

function testPlatformSwitch() {
    const unoPlatform = new PlatformEmulation('ARDUINO_UNO');
    
    try {
        const ast = parse(testCode, { 
            enablePreprocessor: true, 
            verbose: false,
            platformContext: unoPlatform
        });
        
        const interpreter = new ASTInterpreter(ast, { 
            verbose: false, 
            debug: false, 
            stepDelay: 0, 
            maxLoopIterations: 1 
        });

        let commands = [];
        interpreter.onCommand = (command) => {
            commands.push(command);
        };

        const originalConsoleLog = console.log;
        console.log = () => {};

        interpreter.start();
        
        setTimeout(() => {
            console.log = originalConsoleLog;
            
            const serialCommands = commands.filter(cmd => 
                cmd.type === 'FUNCTION_CALL' && cmd.function === 'Serial.println'
            );
            
            const messages = serialCommands.map(cmd => cmd.arguments[0] || cmd.data || '');
            
            console.log('Arduino Uno Results:');
            if (messages.includes('"Not ESP32 platform"')) {
                console.log('✅ Correctly detected non-ESP32 platform');
            } else if (messages.includes('"ESP32 detected"')) {
                console.log('❌ Incorrectly detected ESP32 on Uno platform');
            }
            
            console.log('\n🏆 Platform switching test complete!');
            
        }, 200);
        
    } catch (error) {
        console.error('❌ Error during platform switch test:', error.message);
    }
}