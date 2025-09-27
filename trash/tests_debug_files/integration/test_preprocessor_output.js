#!/usr/bin/env node

/**
 * Test Preprocessor Output Debug
 * Check what the preprocessor is actually outputting
 */

const { ArduinoPreprocessor } = require('./preprocessor.js');
const { PlatformEmulation } = require('./platform_emulation.js');

const platform = new PlatformEmulation('ESP32_NANO');

const testCode = `
#include <WiFi.h>
#define LED_PIN 13
#define BLINK_DELAY 1000

void setup() {
    Serial.begin(9600);
    
    #ifdef ESP32
        Serial.println("ESP32 platform");
        pinMode(LED_PIN, OUTPUT);
    #endif
    
    #ifndef DEBUG
        Serial.println("Release mode");
    #endif
}

#if BLINK_DELAY > 500
void fastBlink() {
    digitalWrite(LED_PIN, HIGH);
    delay(BLINK_DELAY / 2);
    digitalWrite(LED_PIN, LOW);
}
#endif

void loop() {
    #ifdef ESP32
        fastBlink();
        delay(BLINK_DELAY);
    #endif
}
`;

console.log('📝 Original Code:');
console.log('================');
console.log(testCode);

console.log('\n🔍 Preprocessing with ESP32 Nano Platform:');
console.log('==========================================');

const preprocessor = new ArduinoPreprocessor({
    verbose: true,
    debug: true,
    platformContext: platform
});

const result = preprocessor.preprocess(testCode);

console.log('\n📤 Preprocessed Code Output:');
console.log('============================');
console.log(result.processedCode);

console.log('\n📊 Preprocessing Results:');
console.log('=========================');
console.log('Macros defined:', Object.keys(result.macros).length);
console.log('Active libraries:', result.activeLibraries.length);
console.log('Library constants:', Object.keys(result.libraryConstants).length);

console.log('\n🔑 Key Macros:');
['ESP32', 'LED_PIN', 'BLINK_DELAY', 'DEBUG'].forEach(macro => {
    const value = result.macros[macro];
    console.log(`   ${macro}: ${value !== undefined ? value : 'UNDEFINED'}`);
});