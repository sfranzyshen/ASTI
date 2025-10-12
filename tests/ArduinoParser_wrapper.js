#!/usr/bin/env node

/**
 * ArduinoParser - Compatibility Wrapper
 * 
 * This file provides backward compatibility by loading the ArduinoParser library.
 * 
 * For Node.js: Loads from libs/ArduinoParser/src/ArduinoParser.js
 * For Browser: This file should not be loaded directly - load the library files directly
 */

if (typeof window !== 'undefined') {
    // Browser environment - this wrapper cannot work with dynamic loading
    // Playgrounds must load libraries directly in correct order:
    // 1. <script src="../libs/CompactAST/src/CompactAST.js"></script>
    // 2. <script src="../libs/ArduinoParser/src/ArduinoParser.js"></script>
    // 3. Then this wrapper can re-export to maintain compatibility
    
    // Check if libraries are already loaded
    if (typeof window.parse === 'undefined' || typeof window.Parser === 'undefined') {
        throw new Error(`
Browser libraries not loaded correctly. Please load in HTML in this order:
1. <script src="../libs/CompactAST/src/CompactAST.js"></script>
2. <script src="../libs/ArduinoParser/src/ArduinoParser.js"></script>
3. Then load this compatibility wrapper

Current status:
- parse function: ${typeof window.parse}
- Parser class: ${typeof window.Parser}
- PlatformEmulation: ${typeof window.PlatformEmulation}
        `);
    }
    
    // Libraries loaded successfully - wrapper not needed in browser
    return;
}

// Node.js environment only
let ArduinoParserLib;
try {
    ArduinoParserLib = require('../../libs/ArduinoParser/src/ArduinoParser.js');
} catch (error) {
    throw new Error(`Cannot load ArduinoParser library: ${error.message}\nMake sure libs/ArduinoParser/src/ArduinoParser.js exists`);
}

// Re-export all functionality for backward compatibility
const {
    Parser,
    parse,
    prettyPrintAST,
    exportCompactAST,
    PlatformEmulation,
    ESP32_NANO_PLATFORM,
    ARDUINO_UNO_PLATFORM, 
    PLATFORM_EMULATION_VERSION,
    ArduinoPreprocessor,
    LIBRARY_INCLUDES,
    PREPROCESSOR_VERSION,
    PARSER_VERSION
} = ArduinoParserLib;

// Node.js environment exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Main API
        Parser,
        parse,
        prettyPrintAST,
        exportCompactAST,
        
        // Platform Emulation
        PlatformEmulation,
        ESP32_NANO_PLATFORM,
        ARDUINO_UNO_PLATFORM,
        PLATFORM_EMULATION_VERSION,
        
        // Preprocessor
        ArduinoPreprocessor,
        LIBRARY_INCLUDES,
        PREPROCESSOR_VERSION,
        
        // Version info
        PARSER_VERSION
    };
}