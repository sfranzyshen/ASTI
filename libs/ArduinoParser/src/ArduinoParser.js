#!/usr/bin/env node

// Load debug logger for performance optimization (Node.js only)
let conditionalLog = (verbose, ...args) => { if (verbose) console.log(...args); };
if (typeof require !== 'undefined') {
    try {
        const debugLogger = require('../../../src/javascript/utils/debug-logger.js');
        conditionalLog = debugLogger.conditionalLog;
    } catch (e) {
        // Fallback to simple implementation if debug logger not found
    }
}

/**
 * ArduinoParser - Comprehensive Arduino/C++ Parser with Integrated Preprocessing and Platform Emulation
 * 
 * A complete Arduino/C++ code parser with built-in preprocessor and platform emulation.
 * Combines parsing, macro expansion, conditional compilation, and platform-specific defines.
 * 
 * USAGE:
 *   // Basic parsing with default ESP32 platform
 *   const ast = parse(code);
 * 
 *   // Parsing with specific platform
 *   const ast = parse(code, { platform: 'ARDUINO_UNO' });
 * 
 *   // Class-based approach
 *   const parser = new Parser(code, { platform: 'ESP32_NANO' });
 *   const ast = parser.parse();
 * 
 * FEATURES:
 *   ✅ Complete Arduino/C++ language support
 *   ✅ Integrated preprocessor with macro expansion
 *   ✅ Platform emulation (ESP32 Nano, Arduino Uno)
 *   ✅ Library auto-activation from #include directives
 *   ✅ Conditional compilation (#ifdef, #ifndef, #if)
 *   ✅ Function-like and simple macro substitution
 *   ✅ Enhanced error handling and recovery
 *   ✅ Universal Node.js and browser compatibility
 * 
 * Architecture: Code → Platform Context → Preprocessor → Parser → Clean AST
 * 
 * CHANGELOG v5.3.0:
 *   + FILESYSTEM REORGANIZATION: Extracted as independent library from monolithic structure
 *   + Fixed CompactAST import path after extraction (../../CompactAST/src/CompactAST.js)
 *   + Maintained complete compatibility with Node.js and browser environments
 *   + Enhanced browser export pattern for standalone library usage
 *   + TESTED: All parser test harnesses work correctly with new structure
 * 
 * CHANGELOG v5.2.0:
 *   + CRITICAL FIX: CompactAST export mapping for ternary expressions
 *   + Fixed 'TernaryExpressionNode' → 'TernaryExpression' mapping for cross-platform compatibility
 *   + Ensures JavaScript ↔ C++ ternary expression parity in CompactAST format
 *   + MERGED: platform_emulation.js and preprocessor.js into single file
 *   + Added simplified API with platform string support
 *   + Maintained full backward compatibility
 *   + Updated to support both class and function-based APIs
 *   + Enhanced documentation and examples
 */

// =============================================================================
// PARSER CONSTANTS AND CONFIGURATION
// =============================================================================

const PARSER_VERSION = "6.0.0";
const PLATFORM_EMULATION_VERSION = '1.0.0';
const PREPROCESSOR_VERSION = '1.2.0';

// Import CompactAST library
let exportCompactAST;
try {
    if (typeof require !== 'undefined') {
        // Node.js environment
        const compactAST = require('../../CompactAST/src/CompactAST.js');
        exportCompactAST = compactAST.exportCompactAST;
    } else if (typeof window !== 'undefined' && window.CompactAST) {
        // Browser environment - use CompactAST namespace
        exportCompactAST = window.CompactAST.exportCompactAST;
    }
} catch (error) {
    // CompactAST not available - library will work without binary export (Node.js only)
    if (typeof require !== 'undefined') {
        console.warn('CompactAST library not found - binary export disabled');
    }
}

// =============================================================================
// PLATFORM EMULATION SYSTEM (integrated from platform_emulation.js)
// =============================================================================

/**
 * ESP32 Nano Platform Definition
 */
const ESP32_NANO_PLATFORM = {
    name: 'ESP32_NANO',
    displayName: 'Arduino Nano ESP32',
    defines: {
        'ESP32': '1', 'ARDUINO_NANO_ESP32': '1', 'ARDUINO': '2030100', 'ARDUINO_ESP32_NANO': '1',
        'ESP32_S3': '1', 'NORA_W106': '1', 'WIFI_SUPPORT': '1', 'BLUETOOTH_SUPPORT': '1',
        'BLE_SUPPORT': '1', 'USB_C_SUPPORT': '1', 'FLASH_SIZE': '16777216', 'RAM_SIZE': '524288',
        'PSRAM_SIZE': '8388608', 'OPERATING_VOLTAGE': '3300', 'MAX_PIN_CURRENT': '40',
        'VIN_MIN': '5000', 'VIN_MAX': '18000'
    },
    pins: {
        'D0': 0, 'D1': 1, 'D2': 2, 'D3': 3, 'D4': 4, 'D5': 5, 'D6': 6, 'D7': 7, 'D8': 8,
        'D9': 9, 'D10': 10, 'D11': 11, 'D12': 12, 'D13': 13, 'A0': 14, 'A1': 15, 'A2': 16,
        'A3': 17, 'A4': 18, 'A5': 19, 'A6': 20, 'A7': 21, 'LED_BUILTIN': 13, 'LED_RED': 46,
        'LED_GREEN': 45, 'LED_BLUE': 44, 'SDA': 18, 'SCL': 19, 'MOSI': 11, 'MISO': 12,
        'SCK': 13, 'SS': 10, 'TX': 1, 'RX': 0, 'VIN': -1, 'VBUS': -2, 'V3V3': -3, 'GND': -4
    },
    pinCapabilities: {
        pwm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
        analog: [14, 15, 16, 17, 18, 19, 20, 21],
        digital: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
        i2c: [18, 19], spi: [10, 11, 12, 13], serial: [0, 1]
    },
    libraries: ['WiFi', 'WiFiClient', 'WiFiServer', 'WiFiUDP', 'BluetoothSerial', 'BLE', 'Wire',
        'SPI', 'Servo', 'Stepper', 'EEPROM', 'SD', 'Adafruit_NeoPixel', 'FastLED', 'ArduinoJson',
        'PubSubClient', 'HTTPClient', 'WebServer', 'Update', 'Preferences'],
    clocks: { 'CPU_FREQ': '240000000', 'APB_FREQ': '80000000', 'XTAL_FREQ': '40000000' },
    memory: { 'FLASH_START': '0x10000', 'RAM_START': '0x3FC88000', 'PSRAM_START': '0x3F800000' }
};

const ARDUINO_UNO_PLATFORM = {
    name: 'ARDUINO_UNO', displayName: 'Arduino Uno',
    defines: { 'ARDUINO_AVR_UNO': '1', 'ARDUINO': '2030100', 'ATMEGA328P': '1' },
    pins: {
        'D0': 0, 'D1': 1, 'D2': 2, 'D3': 3, 'D4': 4, 'D5': 5, 'D6': 6, 'D7': 7, 'D8': 8,
        'D9': 9, 'D10': 10, 'D11': 11, 'D12': 12, 'D13': 13, 'A0': 14, 'A1': 15, 'A2': 16,
        'A3': 17, 'A4': 18, 'A5': 19, 'LED_BUILTIN': 13, 'SDA': 18, 'SCL': 19, 'MOSI': 11,
        'MISO': 12, 'SCK': 13, 'SS': 10, 'TX': 1, 'RX': 0
    },
    pinCapabilities: {
        pwm: [3, 5, 6, 9, 10, 11], analog: [14, 15, 16, 17, 18, 19],
        digital: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        i2c: [18, 19], spi: [10, 11, 12, 13], serial: [0, 1]
    },
    libraries: ['SoftwareSerial', 'Wire', 'SPI', 'Servo', 'Stepper', 'EEPROM', 'LiquidCrystal', 'SD'],
    clocks: { 'CPU_FREQ': '16000000' }
};

class PlatformEmulation {
    constructor(platformName = 'ESP32_NANO') {
        this.version = PLATFORM_EMULATION_VERSION;
        this.currentPlatform = null;
        this.availablePlatforms = { 'ESP32_NANO': ESP32_NANO_PLATFORM, 'ARDUINO_UNO': ARDUINO_UNO_PLATFORM };
        this.setPlatform(platformName);
    }
    
    setPlatform(platformName) {
        if (!this.availablePlatforms[platformName]) {
            throw new Error(`Platform '${platformName}' not supported. Available: ${Object.keys(this.availablePlatforms).join(', ')}`);
        }
        this.currentPlatform = this.availablePlatforms[platformName];
        return this.currentPlatform;
    }
    
    getDefines() { return { ...this.currentPlatform.defines }; }
    getPin(pinName) { return this.currentPlatform.pins[pinName] || null; }
    pinSupports(pin, capability) { const caps = this.currentPlatform.pinCapabilities[capability]; return caps && caps.includes(pin); }
    getLibraries() { return [...this.currentPlatform.libraries]; }
    hasLibrary(libraryName) { return this.currentPlatform.libraries.includes(libraryName); }
    getPlatformInfo() {
        return {
            name: this.currentPlatform.name, displayName: this.currentPlatform.displayName,
            defines: Object.keys(this.currentPlatform.defines).length, pins: Object.keys(this.currentPlatform.pins).length,
            libraries: this.currentPlatform.libraries.length, capabilities: Object.keys(this.currentPlatform.pinCapabilities)
        };
    }
}

// =============================================================================
// ARDUINO PREPROCESSOR SYSTEM (integrated from preprocessor.js)  
// =============================================================================

const LIBRARY_INCLUDES = {
    'Adafruit_NeoPixel.h': { library: 'Adafruit_NeoPixel', constants: { 'NEO_GRB': '0x52', 'NEO_RGB': '0x20', 'NEO_RGBW': '0x28', 'NEO_KHZ800': '0x0000', 'NEO_KHZ400': '0x0100' }, activate: true },
    'Servo.h': { library: 'Servo', constants: {}, activate: true },
    'SPI.h': { library: 'SPI', constants: { 'MSBFIRST': '1', 'LSBFIRST': '0', 'SPI_MODE0': '0', 'SPI_MODE1': '1', 'SPI_MODE2': '2', 'SPI_MODE3': '3' }, activate: true },
    'Wire.h': { library: 'Wire', constants: {}, activate: true },
    'EEPROM.h': { library: 'EEPROM', constants: {}, activate: true },
    'avr/power.h': { constants: { 'clock_div_1': '0x00', 'clock_div_2': '0x01', 'clock_div_4': '0x02', 'clock_div_8': '0x03', 'clock_div_16': '0x04', 'clock_div_32': '0x05', 'clock_div_64': '0x06', 'clock_div_128': '0x07', 'clock_div_256': '0x08' } },
    'Arduino.h': { constants: { 'HIGH': '1', 'LOW': '0', 'INPUT': '0', 'OUTPUT': '1', 'INPUT_PULLUP': '2', 'LED_BUILTIN': '13' } }
};

class ArduinoPreprocessor {
    constructor(options = {}) {
        this.options = { verbose: options.verbose || false, debug: options.debug || false, platformDefines: options.platformDefines || ['ARDUINO', '__AVR__'], platformContext: options.platformContext || null, ...options };
        this.macros = new Map(); this.functionMacros = new Map(); this.activeLibraries = new Set(); this.libraryConstants = new Map(); this.conditionalStack = [];
        this.initializeDefaultMacros();
    }
    
    initializeDefaultMacros() {
        this.macros.set('HIGH', '1'); this.macros.set('LOW', '0'); this.macros.set('INPUT', '0'); this.macros.set('OUTPUT', '1'); this.macros.set('INPUT_PULLUP', '2'); this.macros.set('LED_BUILTIN', '13'); this.macros.set('PI', '3.14159');
        if (this.options.platformContext) {
            const platformDefines = this.options.platformContext.getDefines();
            Object.entries(platformDefines).forEach(([key, value]) => { this.macros.set(key, String(value)); });
        } else {
            this.macros.set('ARDUINO_ARCH_AVR', '1'); this.macros.set('F_CPU', '16000000UL'); this.macros.set('ARDUINO_API_VERSION', '10001');
            this.macros.set('MOSI', '11'); this.macros.set('MISO', '12'); this.macros.set('SCK', '13');
            this.options.platformDefines.forEach(define => { this.macros.set(define, '1'); });
        }
    }
    
    preprocess(sourceCode) {
        try {
            let processedCode = this.processIncludes(sourceCode);
            processedCode = this.processDefines(processedCode); processedCode = this.processConditionals(processedCode); processedCode = this.performMacroSubstitution(processedCode);
            return { processedCode, activeLibraries: Array.from(this.activeLibraries), libraryConstants: Object.fromEntries(this.libraryConstants), macros: Object.fromEntries(this.macros), functionMacros: Object.fromEntries(this.functionMacros) };
        } catch (error) {
            return { processedCode: sourceCode, activeLibraries: [], libraryConstants: {}, macros: Object.fromEntries(this.macros), functionMacros: {}, error: error.message };
        }
    }
    
    processIncludes(code) { const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g; let processedCode = code; let match; includeRegex.lastIndex = 0; while ((match = includeRegex.exec(code)) !== null) { const includeFile = match[1]; const fullInclude = match[0]; if (LIBRARY_INCLUDES[includeFile]) { const config = LIBRARY_INCLUDES[includeFile]; if (config.activate && config.library) { this.activeLibraries.add(config.library); } Object.entries(config.constants || {}).forEach(([name, value]) => { this.macros.set(name, value); this.libraryConstants.set(name, value); }); } processedCode = processedCode.replace(fullInclude, ''); } return processedCode; }
    processDefines(code) { const lines = code.split('\n'); const processedLines = []; for (let i = 0; i < lines.length; i++) { const line = lines[i]; const trimmed = line.trim(); if (trimmed.startsWith('#define')) { this.processDefineDirective(trimmed); } else if (trimmed.startsWith('#undef')) { this.processUndefDirective(trimmed); } else { processedLines.push(line); } } return processedLines.join('\n'); }
    processDefineDirective(defineLine) { const content = defineLine.substring(7).trim(); const functionMacroMatch = content.match(/^([A-Z_][A-Z0-9_]*)\s*\(([^)]*)\)\s+(.+)$/i); if (functionMacroMatch) { const name = functionMacroMatch[1]; const paramsStr = functionMacroMatch[2].trim(); const body = functionMacroMatch[3].trim(); const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : []; this.functionMacros.set(name, { params: params, body: body }); } else { const parts = content.match(/^([A-Z_][A-Z0-9_]*)\s+(.+)$/i); if (parts) { const name = parts[1]; const value = parts[2].trim(); this.macros.set(name, value); } else { const nameMatch = content.match(/^([A-Z_][A-Z0-9_]*)$/i); if (nameMatch) { const name = nameMatch[1]; this.macros.set(name, '1'); } } } }
    processUndefDirective(undefLine) { const macroName = undefLine.substring(6).trim(); if (this.macros.has(macroName)) { this.macros.delete(macroName); } if (this.functionMacros.has(macroName)) { this.functionMacros.delete(macroName); } }
    processConditionals(code) { const lines = code.split('\n'); const processedLines = []; let skipLines = false; let conditionalDepth = 0; for (let i = 0; i < lines.length; i++) { const line = lines[i]; const trimmed = line.trim(); if (trimmed.startsWith('#ifdef')) { const macro = trimmed.substring(6).trim(); conditionalDepth++; skipLines = !this.macros.has(macro); } else if (trimmed.startsWith('#ifndef')) { const macro = trimmed.substring(7).trim(); conditionalDepth++; skipLines = this.macros.has(macro); } else if (trimmed.startsWith('#endif')) { conditionalDepth--; if (conditionalDepth === 0) { skipLines = false; } } else if (trimmed.startsWith('#else')) { skipLines = !skipLines; } else if (trimmed.startsWith('#if ')) { const expression = trimmed.substring(3).trim(); conditionalDepth++; try { let evalExpression = expression; evalExpression = evalExpression.replace(/defined\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g, (match, macroName) => { return this.macros.has(macroName) ? '1' : '0'; }); for (const [macro, value] of this.macros) { const regex = new RegExp(`\\b${macro}\\b`, 'g'); evalExpression = evalExpression.replace(regex, value); } evalExpression = evalExpression.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (match) => { if (/^[0-9]/.test(match) || ['&&', '||', '==', '!=', '>', '<', '>=', '<='].includes(match)) { return match; } return '0'; }); const result = eval(evalExpression); skipLines = !result; } catch (error) { skipLines = false; } } else { if (!skipLines) { processedLines.push(line); } } } return processedLines.join('\n'); }
    performMacroSubstitution(code) { let substitutedCode = code; for (const [macroName, macroValue] of this.macros) { const regex = new RegExp(`\\b${macroName}\\b`, 'g'); substitutedCode = substitutedCode.replace(regex, macroValue); } for (const [macroName, macroInfo] of this.functionMacros) { const { params, body } = macroInfo; const regex = new RegExp(`\\b${macroName}\\s*\\(([^)]*)\\)`, 'g'); substitutedCode = substitutedCode.replace(regex, (match, argsStr) => { const args = argsStr ? argsStr.split(',').map(arg => arg.trim()) : []; let expandedBody = body; for (let i = 0; i < params.length && i < args.length; i++) { const paramRegex = new RegExp(`\\b${params[i]}\\b`, 'g'); expandedBody = expandedBody.replace(paramRegex, args[i]); } return expandedBody; }); } return substitutedCode; }
    getStats() { return { version: PREPROCESSOR_VERSION, macros: this.macros.size, functionMacros: this.functionMacros.size, activeLibraries: this.activeLibraries.size, libraryConstants: this.libraryConstants.size }; }
}

// Import Arduino Preprocessor - now available internally  
function getArduinoPreprocessor() { return ArduinoPreprocessor; }

// =============================================================================
// KEYWORD MAPPINGS - Maps source code keywords to token types
// =============================================================================
const KEYWORDS = {
    // Primitive data types
    'void': 'VOID', 'int': 'INT', 'long': 'LONG', 'float': 'FLOAT', 'double': 'DOUBLE',
    'char': 'CHAR', 'short': 'SHORT', 'bool': 'BOOL', 'boolean': 'BOOLEAN', 'byte': 'BYTE',
    'size_t': 'SIZE_T', 'word': 'WORD', 'unsigned': 'UNSIGNED', 'signed': 'SIGNED',
    
    // Arduino-specific types and classes
    'String': 'STRING', 'Servo': 'SERVO', 'LiquidCrystal': 'LIQUID_CRYSTAL',
    
    // Standard integer types (stdint.h)
    'uint8_t': 'UINT8_T', 'int8_t': 'INT8_T', 'uint16_t': 'UINT16_T', 'int16_t': 'INT16_T',
    'uint32_t': 'UINT32_T', 'int32_t': 'INT32_T', 'uint64_t': 'UINT64_T', 'int64_t': 'INT64_T',
    
    // Storage class specifiers
    'const': 'CONST', 'static': 'STATIC', 'volatile': 'VOLATILE', 'extern': 'EXTERN',
    'PROGMEM': 'PROGMEM',  // Arduino-specific: store data in flash memory
    
    // Structure and type keywords
    'struct': 'STRUCT', 'typedef': 'TYPEDEF', 'enum': 'ENUM', 'union': 'UNION',
    'class': 'CLASS', 'template': 'TEMPLATE', 'typename': 'TYPENAME', 'auto': 'AUTO',
    
    // Access specifiers
    'public': 'PUBLIC', 'private': 'PRIVATE', 'protected': 'PROTECTED',
    
    // C++ specifiers and keywords
    'virtual': 'VIRTUAL', 'override': 'OVERRIDE', 'final': 'FINAL',
    'constexpr': 'CONSTEXPR', 'decltype': 'DECLTYPE', 'explicit': 'EXPLICIT',
    'mutable': 'MUTABLE', 'inline': 'INLINE', 'noexcept': 'NOEXCEPT',
    'nullptr': 'NULLPTR', 'friend': 'FRIEND', 'operator': 'OPERATOR',
    'new': 'NEW', 'delete': 'DELETE',
    'static_cast': 'STATIC_CAST', 'dynamic_cast': 'DYNAMIC_CAST', 'const_cast': 'CONST_CAST', 'reinterpret_cast': 'REINTERPRET_CAST',
    'namespace': 'NAMESPACE', 'using': 'USING',
    
    // Control flow keywords
    'if': 'IF', 'else': 'ELSE', 'for': 'FOR', 'while': 'WHILE', 'do': 'DO',
    'return': 'RETURN', 'break': 'BREAK', 'continue': 'CONTINUE', 
    'switch': 'SWITCH', 'case': 'CASE', 'default': 'DEFAULT', 'goto': 'GOTO',
    
    // Literal values
    'true': 'TRUE', 'false': 'FALSE', 'NULL': 'NULL',
    
    // Arduino constants
    'HIGH': 'HIGH', 'LOW': 'LOW', 'INPUT': 'INPUT', 'OUTPUT': 'OUTPUT', 
    'INPUT_PULLUP': 'INPUT_PULLUP', 'INPUT_PULLDOWN': 'INPUT_PULLDOWN', 
    'OUTPUT_OPENDRAIN': 'OUTPUT_OPENDRAIN', 'LED_BUILTIN': 'LED_BUILTIN',
    
    // Number format specifiers
    'HEX': 'HEX', 'DEC': 'DEC', 'OCT': 'OCT', 'BIN': 'BIN',
    
    // Operators and special keywords
    'sizeof': 'SIZEOF',
    
    // Arduino built-in functions
    'digitalRead': 'ARDUINO_FUNC', 'digitalWrite': 'ARDUINO_FUNC', 'pinMode': 'ARDUINO_FUNC',
    'analogRead': 'ARDUINO_FUNC', 'analogWrite': 'ARDUINO_FUNC', 'analogReference': 'ARDUINO_FUNC',
    'analogReadResolution': 'ARDUINO_FUNC', 'analogWriteResolution': 'ARDUINO_FUNC',
    'tone': 'ARDUINO_FUNC', 'noTone': 'ARDUINO_FUNC', 'pulseIn': 'ARDUINO_FUNC', 'pulseInLong': 'ARDUINO_FUNC',
    'shiftIn': 'ARDUINO_FUNC', 'shiftOut': 'ARDUINO_FUNC',
    'delay': 'ARDUINO_FUNC', 'delayMicroseconds': 'ARDUINO_FUNC', 'millis': 'ARDUINO_FUNC', 'micros': 'ARDUINO_FUNC',
    'map': 'ARDUINO_FUNC', 'constrain': 'ARDUINO_FUNC', 'min': 'ARDUINO_FUNC', 'max': 'ARDUINO_FUNC',
    'abs': 'ARDUINO_FUNC', 'sq': 'ARDUINO_FUNC', 'sqrt': 'ARDUINO_FUNC', 'pow': 'ARDUINO_FUNC',
    'sin': 'ARDUINO_FUNC', 'cos': 'ARDUINO_FUNC', 'tan': 'ARDUINO_FUNC',
    'random': 'ARDUINO_FUNC', 'randomSeed': 'ARDUINO_FUNC',
    'attachInterrupt': 'ARDUINO_FUNC', 'detachInterrupt': 'ARDUINO_FUNC',
    'interrupts': 'ARDUINO_FUNC', 'noInterrupts': 'ARDUINO_FUNC'
};

// =============================================================================
// CENTRALIZED TYPE MANAGEMENT SYSTEM - Comprehensive type classification
// =============================================================================

// Type categories for systematic and consistent type checking
const TYPE_CATEGORIES = {
    // Fundamental C/C++ types
    FUNDAMENTAL: ['INT', 'CHAR', 'FLOAT', 'DOUBLE', 'VOID', 'BOOL', 'BOOLEAN'],
    
    // Standard library types (stddef.h, stdint.h, etc.)
    STDLIB: ['SIZE_T', 'PTRDIFF_T', 'WCHAR_T'],
    
    // Fixed-width integer types (stdint.h)
    FIXED_WIDTH: ['UINT8_T', 'INT8_T', 'UINT16_T', 'INT16_T', 'UINT32_T', 'INT32_T', 'UINT64_T', 'INT64_T'],
    
    // Arduino-specific types
    ARDUINO: ['STRING', 'BYTE', 'WORD', 'SERVO', 'LIQUID_CRYSTAL'],
    
    // Type modifiers and storage classes
    MODIFIERS: ['CONST', 'VOLATILE', 'STATIC', 'EXTERN', 'UNSIGNED', 'SIGNED'],
    
    // Additional type keywords
    EXTENDED: ['LONG', 'SHORT', 'AUTO'],
    
    // C++ specific specifiers
    CXX_SPECIFIERS: ['VIRTUAL', 'OVERRIDE', 'FINAL', 'CONSTEXPR', 'EXPLICIT', 'MUTABLE', 'INLINE']
};

// Flatten all type categories for quick lookup
const ALL_TYPES = Object.values(TYPE_CATEGORIES).flat();

/**
 * Centralized type checking function - replaces all hardcoded type arrays
 * @param {string} tokenType - The token type to check
 * @param {string} context - The parsing context ('declaration', 'cast', 'parameter', 'any')
 * @returns {boolean} True if the token is a valid type in the given context
 */
function isValidType(tokenType, context = 'any') {
    // Always include identifiers as potential custom types
    if (tokenType === 'IDENTIFIER') return true;
    
    // Check if it's a known type
    const isKnownType = ALL_TYPES.includes(tokenType);
    
    switch (context) {
        case 'declaration':
            // Variable declarations - all types except some C++ specifiers
            return isKnownType && !TYPE_CATEGORIES.CXX_SPECIFIERS.includes(tokenType);
            
        case 'cast': 
            // Cast expressions - fundamental types + stdlib + fixed-width + arduino + type modifiers
            return TYPE_CATEGORIES.FUNDAMENTAL.includes(tokenType) ||
                   TYPE_CATEGORIES.STDLIB.includes(tokenType) ||
                   TYPE_CATEGORIES.FIXED_WIDTH.includes(tokenType) ||
                   TYPE_CATEGORIES.ARDUINO.includes(tokenType) ||
                   TYPE_CATEGORIES.EXTENDED.includes(tokenType) ||
                   ['UNSIGNED', 'SIGNED', 'CONST', 'VOLATILE'].includes(tokenType) ||  // Allow type modifiers for multi-word casts
                   tokenType === 'IDENTIFIER';
                   
        case 'parameter':
            // Function parameters - all types
            return isKnownType;
            
        case 'any':
        default:
            // General type checking - all types
            return isKnownType;
    }
}

/**
 * Check if a token is a type modifier (const, volatile, etc.)
 * @param {string} tokenType - The token type to check
 * @returns {boolean} True if the token is a type modifier
 */
function isTypeModifier(tokenType) {
    return TYPE_CATEGORIES.MODIFIERS.includes(tokenType);
}

/**
 * Check if a token is a storage class specifier
 * @param {string} tokenType - The token type to check  
 * @returns {boolean} True if the token is a storage class specifier
 */
function isStorageClass(tokenType) {
    return ['STATIC', 'EXTERN', 'VOLATILE'].includes(tokenType);
}

// =============================================================================
// OPERATOR PRECEDENCE TABLE - Defines operator parsing priority (higher = more precedence)
// =============================================================================
const PRECEDENCE = {
    'COMMA': 0,      // Lowest precedence
    'OR': 1,
    'AND': 2,
    'BITWISE_OR': 3,
    'BITWISE_XOR': 4,
    'BITWISE_AND': 5,
    'AMPERSAND': 5,  // Bitwise AND (same precedence as BITWISE_AND)
    'EQ': 6, 'NEQ': 6,
    'LT': 7, 'GT': 7, 'LTE': 7, 'GTE': 7,
    'LSHIFT': 8, 'RSHIFT': 8,
    'PLUS': 9, 'MINUS': 9,
    'MUL': 10, 'DIV': 10, 'MOD': 10,
    // Unary operators handled separately
};


/**
 * Arduino/C++ Parser class for parsing Arduino source code into Abstract Syntax Trees
 * 
 * @class Parser
 * @description Comprehensive parser supporting Arduino/C++ syntax including:
 *              - Function definitions and declarations
 *              - Variable declarations with all C++ types
 *              - Control structures (if/else, for, while, switch)
 *              - Classes and constructors
 *              - Expressions and operators
 *              - Arduino-specific constants and functions
 */
class Parser {
    /**
     * Creates a new Parser instance
     * 
     * @param {string} code - The Arduino/C++ source code to parse
     * @param {Object} options - Parser configuration options
     * @param {boolean} options.verbose - Enable verbose output and analysis
     * @param {boolean} options.throwOnError - Throw errors instead of graceful recovery
     */
    constructor(code, options = {}) {
        this.code = code;
        this.options = options;
        this.position = 0;
        this.currentChar = this.code[this.position];
        this.line = 1;
        this.column = 1;
        this.currentToken = null;
        this.peekToken = null;
        this.peekToken2 = null;
        // Prime the tokens
        this.advanceToken();
        this.advanceToken();
        this.advanceToken();
    }

    // Advance the parser's position
    advance() {
        if (this.currentChar === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
        this.currentChar = this.position < this.code.length ? this.code[this.position] : null;
    }
    
    // A version of eat that consumes a character, not a token
    eatChar(char) {
        if (this.currentChar === char) {
            this.advance();
        } else {
            throw new Error(`Lexer Error on line ${this.line}, column ${this.column}: Expected character '${char}' but found '${this.currentChar || 'EOF'}'`);
        }
    }

    // Look at the next character without consuming it
    peek() {
        const peekPos = this.position + 1;
        return peekPos < this.code.length ? this.code[peekPos] : null;
    }

    // Advance the tokens, maintaining the lookahead buffer
    advanceToken() {
        this.currentToken = this.peekToken;
        this.peekToken = this.peekToken2;
        this.peekToken2 = this.getNextToken();
    }

    // Consume a token of a specific type
    eat(tokenType) {
        if (this.currentToken.type === tokenType) {
            this.advanceToken();
        } else {
            // Special handling for SEMICOLON with problematic tokens
            if (tokenType === 'SEMICOLON' && ['PRIVATE', 'PUBLIC', 'PROTECTED', 'RETURN'].includes(this.currentToken.type)) {
                // Skip the problematic token and continue
                this.advanceToken();
                // Try to find the next semicolon or give up gracefully
                while (this.currentToken.type !== 'EOF' && 
                       this.currentToken.type !== 'SEMICOLON' && 
                       this.currentToken.type !== 'RBRACE') {
                    this.advanceToken();
                }
                if (this.currentToken.type === 'SEMICOLON') {
                    this.advanceToken(); // consume the semicolon we found
                }
                return; // Successfully recovered
            }
            
            const { line, column } = this.currentToken;
            throw new Error(`Parsing Error on line ${line}, column ${column}: Expected token type '${tokenType}' but found '${this.currentToken.type}' (value: '${this.currentToken.value}')`);
        }
    }

    // Skip over any whitespace
    skipWhitespace() {
        while (this.currentChar !== null && /\s/.test(this.currentChar)) {
            this.advance();
        }
    }

    // Skip over comments
    skipComments() {
        if (this.currentChar === '/' && this.peek() === '/') {
            while (this.currentChar !== null && this.currentChar !== '\n') {
                this.advance();
            }
            return true;
        }
        if (this.currentChar === '/' && this.peek() === '*') {
            this.advance(); // consume /
            this.advance(); // consume *
            while (this.currentChar !== null && !(this.currentChar === '*' && this.peek() === '/')) {
                this.advance();
            }
            this.eatChar('*');
            this.eatChar('/');
            return true;
        }
        return false;
    }
    
    // Parse a string literal
    stringLiteral() {
        let result = '';
        const startLine = this.line;
        const startColumn = this.column;
        
        this.eatChar('"'); // consume opening "
        
        // Enhanced parsing for HTML-friendly strings
        const webFriendlyMode = this.options.webFriendlyMode || false;
        
        while (this.currentChar !== null && this.currentChar !== '"') {
            if (this.currentChar === '\\') {
                this.advance(); // consume backslash
                if (this.currentChar !== null) {
                    // Handle escape sequences - enhanced for web content
                    switch (this.currentChar) {
                        case 'n': result += '\n'; break;
                        case 't': result += '\t'; break;
                        case 'r': result += '\r'; break;
                        case '\\': result += '\\'; break;
                        case '"': result += '"'; break;
                        case "'": result += "'"; break;
                        case '/': result += '/'; break;  // Common in HTML/URLs
                        case 'b': result += '\b'; break; // Backspace
                        case 'f': result += '\f'; break; // Form feed
                        case 'v': result += '\v'; break; // Vertical tab
                        case '\n': 
                            // Line continuation: backslash followed by newline
                            // The newline is consumed but not added to the string
                            this.advance(); // consume the newline
                            continue; // Continue loop without adding anything to result
                        case '\r':
                            // Handle Windows-style line endings for line continuation
                            this.advance(); // consume the \r
                            if (this.currentChar === '\n') {
                                this.advance(); // consume the \n as well
                            }
                            continue; // Continue loop without adding anything to result
                        default: 
                            // In web-friendly mode, be more permissive with escape sequences
                            if (webFriendlyMode) {
                                result += this.currentChar;
                            } else {
                                result += this.currentChar;
                            }
                            break;
                    }
                    this.advance();
                }
            } else if (this.currentChar === '\n') {
                // Handle multi-line strings better - common in HTML
                if (webFriendlyMode) {
                    result += this.currentChar;
                    this.advance();
                } else {
                    // Standard C++ doesn't allow unescaped newlines in strings
                    throw new Error(`Lexer Error on line ${this.line}, column ${this.column}: Unescaped newline in string literal`);
                }
            } else {
                result += this.currentChar;
                this.advance();
            }
        }
        
        // Enhanced error handling for unterminated strings
        if (this.currentChar !== '"') {
            if (webFriendlyMode) {
                // In web-friendly mode, try to recover gracefully
                if (this.options && this.options.verbose) {
                    console.warn(`Warning: Unterminated string literal starting at line ${startLine}, column ${startColumn}. Attempting recovery.`);
                }
                return { type: 'STRING_LITERAL', value: result, unterminated: true };
            } else {
                throw new Error(`Lexer Error on line ${startLine}, column ${startColumn}: Expected character '"' but found 'EOF'`);
            }
        }
        
        this.eatChar('"'); // consume closing "
        return { type: 'STRING_LITERAL', value: result };
    }

    // Parse a C++11 raw string literal: R"delimiter(content)delimiter"
    rawStringLiteral() {
        const startLine = this.line;
        const startColumn = this.column;
        
        // Consume 'R"'
        this.advance(); // consume 'R'
        this.advance(); // consume '"'
        
        // Parse the delimiter (up to 16 characters, until we hit '(')
        let delimiter = '';
        while (this.currentChar !== null && this.currentChar !== '(' && delimiter.length < 16) {
            delimiter += this.currentChar;
            this.advance();
        }
        
        if (this.currentChar !== '(') {
            throw new Error(`Lexer Error on line ${this.line}, column ${this.column}: Expected '(' in raw string literal`);
        }
        this.advance(); // consume '('
        
        // Parse the content until we find ')delimiter"'
        let content = '';
        const endPattern = ')' + delimiter + '"';
        let matchIndex = 0;
        
        while (this.currentChar !== null) {
            if (this.currentChar === endPattern[matchIndex]) {
                matchIndex++;
                if (matchIndex === endPattern.length) {
                    // Found complete end pattern - already consumed by loop advance
                    break;
                }
            } else {
                // If we were partially matching, add the partial match to content
                if (matchIndex > 0) {
                    content += endPattern.substring(0, matchIndex);
                    matchIndex = 0;
                }
                // Add current character to content if it's not starting a new match
                if (this.currentChar !== endPattern[0]) {
                    content += this.currentChar;
                } else {
                    matchIndex = 1; // Start matching from the first character
                }
            }
            this.advance();
        }
        
        if (matchIndex < endPattern.length) {
            // Handle unterminated raw string
            const webFriendlyMode = this.options && this.options.webFriendlyMode;
            if (webFriendlyMode) {
                if (this.options && this.options.verbose) {
                    console.warn(`Warning: Unterminated raw string literal starting at line ${startLine}, column ${startColumn}. Expected closing pattern: ${endPattern}`);
                }
                return { type: 'STRING_LITERAL', value: content, unterminated: true, rawString: true, delimiter: delimiter };
            } else {
                throw new Error(`Lexer Error on line ${startLine}, column ${startColumn}: Unterminated raw string literal. Expected closing pattern: ${endPattern}`);
            }
        }
        
        return { type: 'STRING_LITERAL', value: content, rawString: true, delimiter: delimiter };
    }

    // Parse a character literal
    charLiteral() {
        this.eatChar("'"); // consume opening '
        let result = '';
        
        // Handle potentially multi-character sequences in char literals
        while (this.currentChar !== "'" && this.currentChar !== null) {
            if (this.currentChar === '\\') {
                this.advance(); // consume backslash
                // Handle escape sequences
                switch (this.currentChar) {
                    case 'n': result += '\n'; break;
                    case 't': result += '\t'; break;
                    case 'r': result += '\r'; break;
                    case '\\': result += '\\'; break;
                    case "'": result += "'"; break;
                    case '"': result += '"'; break;
                    case '0': result += '\0'; break;  // null character
                    case 'b': result += '\b'; break;  // backspace
                    case 'f': result += '\f'; break;  // form feed
                    case 'v': result += '\v'; break;  // vertical tab
                    default: result += this.currentChar; break;
                }
                this.advance();
            } else {
                result += this.currentChar;
                this.advance();
            }
        }
        
        this.eatChar("'"); // consume closing '
        
        // For standard character literals, should be single character
        // But we'll allow multi-character for Arduino compatibility
        return { type: 'CHAR_LITERAL', value: result };
    }

    // 4. Updated number() method to handle octal, binary, and scientific notation
    number() {
        let result = '';
        
        // Check for hex prefix
        if (this.currentChar === '0' && (this.peek() === 'x' || this.peek() === 'X')) {
            result += this.currentChar; // '0'
            this.advance();
            result += this.currentChar; // 'x'
            this.advance();
            
            while (this.currentChar !== null && /[0-9a-fA-F]/.test(this.currentChar)) {
                result += this.currentChar;
                this.advance();
            }
            
            // Handle numeric suffixes for hex
            let suffix = '';
            while (this.currentChar !== null && /[LlUu]/.test(this.currentChar)) {
                suffix += this.currentChar;
                this.advance();
            }
            return { type: 'HEX_NUMBER', value: parseInt(result, 16), suffix: suffix };
        }
        
        // Check for octal prefix (0 followed by digits)
        if (this.currentChar === '0' && /[0-7]/.test(this.peek())) {
            result += this.currentChar; // '0'
            this.advance();
            
            while (this.currentChar !== null && /[0-7]/.test(this.currentChar)) {
                result += this.currentChar;
                this.advance();
            }
            
            // Handle numeric suffixes for octal
            let suffix = '';
            while (this.currentChar !== null && /[LlUu]/.test(this.currentChar)) {
                suffix += this.currentChar;
                this.advance();
            }
            return { type: 'OCTAL_NUMBER', value: parseInt(result, 8), suffix: suffix };
        }
        
        // Check for binary prefix
        if (this.currentChar === '0' && (this.peek() === 'b' || this.peek() === 'B')) {
            result += this.currentChar; // '0'
            this.advance();
            result += this.currentChar; // 'b'
            this.advance();
            
            while (this.currentChar !== null && /[01]/.test(this.currentChar)) {
                result += this.currentChar;
                this.advance();
            }
            
            // Handle numeric suffixes for binary
            let suffix = '';
            while (this.currentChar !== null && /[LlUu]/.test(this.currentChar)) {
                suffix += this.currentChar;
                this.advance();
            }
            return { type: 'BINARY_NUMBER', value: parseInt(result.substring(2), 2), suffix: suffix }; // Use substring to parse
        }
        
        // Parse regular numbers
        while (this.currentChar !== null && /\d/.test(this.currentChar)) {
            result += this.currentChar;
            this.advance();
        }
        
        // Handle floating point numbers
        if (this.currentChar === '.' && this.peek() && /\d/.test(this.peek())) {
            result += '.';
            this.advance();
            while (this.currentChar !== null && /\d/.test(this.currentChar)) {
                result += this.currentChar;
                this.advance();
            }
            
            // Handle scientific notation
            if (this.currentChar === 'e' || this.currentChar === 'E') {
                result += this.currentChar;
                this.advance();
                if (this.currentChar === '+' || this.currentChar === '-') {
                    result += this.currentChar;
                    this.advance();
                }
                while (this.currentChar !== null && /\d/.test(this.currentChar)) {
                    result += this.currentChar;
                    this.advance();
                }
            }
            
            // Handle numeric suffixes for floating point numbers
            let suffix = '';
            while (this.currentChar !== null && /[LlUufF]/.test(this.currentChar)) {
                suffix += this.currentChar;
                this.advance();
            }
            
            return { type: 'FLOAT_NUMBER', value: parseFloat(result), suffix: suffix };
        }
        
        // Handle numeric suffixes (L, U, LL, UL, f, F, etc.)
        let suffix = '';
        while (this.currentChar !== null && /[LlUufF]/.test(this.currentChar)) {
            suffix += this.currentChar;
            this.advance();
        }
        
        if (suffix) {
            // If suffix contains 'f' or 'F', treat as float
            if (/[fF]/.test(suffix)) {
                return { type: 'FLOAT_NUMBER', value: parseFloat(result), suffix: suffix };
            } else {
                return { type: 'NUMBER', value: Number(result), suffix: suffix };
            }
        }
        
        return { type: 'NUMBER', value: Number(result) };
    }
    
    // Parse floating point numbers that start with a dot (e.g., .5)
    floatFromDot() {
        let result = '';
        if (this.currentChar === '.') {
            result += '.';
            this.advance();
            while (this.currentChar !== null && /\d/.test(this.currentChar)) {
                result += this.currentChar;
                this.advance();
            }
            
            // Handle numeric suffixes for floating point numbers starting with dot
            let suffix = '';
            while (this.currentChar !== null && /[LlUufF]/.test(this.currentChar)) {
                suffix += this.currentChar;
                this.advance();
            }
            
            return { type: 'FLOAT_NUMBER', value: parseFloat(result), suffix: suffix };
        }
        return { type: 'DOT', value: '.' };
    }

    // Parse an identifier or keyword
    identifier() {
        let result = '';
        while (this.currentChar !== null && /[a-zA-Z0-9_]/.test(this.currentChar)) {
            result += this.currentChar;
            this.advance();
        }
        
        // Check if Arduino function recognition is disabled
        // Use hasOwnProperty to avoid prototype pollution (toString, valueOf, etc.)
        let tokenType = (KEYWORDS.hasOwnProperty(result) ? KEYWORDS[result] : null) || 'IDENTIFIER';
        if (!this.options.recognizeArduinoFunctions && tokenType === 'ARDUINO_FUNC') {
            tokenType = 'IDENTIFIER';
        }
        
        return { type: tokenType, value: result };
    }

    // The on-demand lexer
    getNextToken() {
        while (this.currentChar !== null) {
            const line = this.line;
            const column = this.column;

            if (/\s/.test(this.currentChar)) {
                this.skipWhitespace();
                continue;
            }

            if (this.currentChar === '/' && (this.peek() === '/' || this.peek() === '*')) {
                this.skipComments();
                continue;
            }

            // Preprocessor directives (#) should not appear in preprocessed code
            if (this.currentChar === '#') {
                throw new Error(`Unexpected preprocessor directive at line ${line}, column ${column}. All preprocessor directives should be handled before parsing.`);
            }

            if (this.currentChar === '"') {
                return { ...this.stringLiteral(), line, column };
            }

            if (this.currentChar === "'") {
                return { ...this.charLiteral(), line, column };
            }
            
            // 3. Added new multi-character operators
            // Handle multi-character operators first
            if (this.currentChar === '=' && this.peek() === '=') { 
                this.advance(); this.advance(); 
                return { type: 'EQ', value: '==', line, column }; 
            }
            if (this.currentChar === '!' && this.peek() === '=') { 
                this.advance(); this.advance(); 
                return { type: 'NEQ', value: '!=', line, column }; 
            }
            if (this.currentChar === '<' && this.peek() === '=') { 
                this.advance(); this.advance(); 
                return { type: 'LTE', value: '<=', line, column }; 
            }
            if (this.currentChar === '>' && this.peek() === '=') { 
                this.advance(); this.advance(); 
                return { type: 'GTE', value: '>=', line, column }; 
            }
            if (this.currentChar === '&' && this.peek() === '&') { 
                this.advance(); this.advance(); 
                return { type: 'AND', value: '&&', line, column }; 
            }
            if (this.currentChar === '|' && this.peek() === '|') { 
                this.advance(); this.advance(); 
                return { type: 'OR', value: '||', line, column }; 
            }
            if (this.currentChar === '+' && this.peek() === '=') { 
                this.advance(); this.advance(); 
                return { type: 'PLUS_ASSIGN', value: '+=', line, column }; 
            }
            if (this.currentChar === '-' && this.peek() === '=') { 
                this.advance(); this.advance(); 
                return { type: 'MINUS_ASSIGN', value: '-=', line, column }; 
            }
            if (this.currentChar === '+' && this.peek() === '+') { 
                this.advance(); this.advance(); 
                return { type: 'PLUS_PLUS', value: '++', line, column }; 
            }
            if (this.currentChar === '-' && this.peek() === '-') { 
                this.advance(); this.advance(); 
                return { type: 'MINUS_MINUS', value: '--', line, column }; 
            }
            // Handle shift assignment operators BEFORE regular shift operators
            if (this.currentChar === '<' && this.peek() === '<') {
                // Look ahead to see if this is <<= 
                const savedPos = this.position;
                const savedChar = this.currentChar;
                const savedLine = this.line;
                const savedColumn = this.column;
                this.advance(); this.advance(); // Skip <<
                if (this.currentChar === '=') {
                    this.advance(); // Skip =
                    return { type: 'LSHIFT_ASSIGN', value: '<<=', line, column };
                } else {
                    // Restore position for regular << handling
                    this.position = savedPos;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    // Now handle regular <<
                    this.advance(); this.advance();
                    return { type: 'LSHIFT', value: '<<', line, column };
                }
            }
            if (this.currentChar === '>' && this.peek() === '>') {
                // Look ahead to see if this is >>= 
                const savedPos = this.position;
                const savedChar = this.currentChar;
                const savedLine = this.line;
                const savedColumn = this.column;
                this.advance(); this.advance(); // Skip >>
                if (this.currentChar === '=') {
                    this.advance(); // Skip =
                    return { type: 'RSHIFT_ASSIGN', value: '>>=', line, column };
                } else {
                    // Restore position for regular >> handling
                    this.position = savedPos;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    // Now handle regular >>
                    this.advance(); this.advance();
                    return { type: 'RSHIFT', value: '>>', line, column };
                }
            }
            if (this.currentChar === '*' && this.peek() === '=') { this.advance(); this.advance(); return { type: 'MUL_ASSIGN', value: '*=', line, column }; }
            if (this.currentChar === '/' && this.peek() === '=') { this.advance(); this.advance(); return { type: 'DIV_ASSIGN', value: '/=', line, column }; }
            if (this.currentChar === '%' && this.peek() === '=') { this.advance(); this.advance(); return { type: 'MOD_ASSIGN', value: '%=', line, column }; }
            if (this.currentChar === '&' && this.peek() === '=') { this.advance(); this.advance(); return { type: 'AND_ASSIGN', value: '&=', line, column }; }
            if (this.currentChar === '|' && this.peek() === '=') { this.advance(); this.advance(); return { type: 'OR_ASSIGN', value: '|=', line, column }; }
            if (this.currentChar === '^' && this.peek() === '=') { this.advance(); this.advance(); return { type: 'XOR_ASSIGN', value: '^=', line, column }; }
            
            if (this.currentChar === '-' && this.peek() === '>') { this.advance(); this.advance(); return { type: 'ARROW', value: '->', line, column }; }


            if (/\d/.test(this.currentChar) || (this.currentChar === '0' && (this.peek() === 'x' || this.peek() === 'X'))) {
                return { ...this.number(), line, column };
            }
            
            if (this.currentChar === '.' && /\d/.test(this.peek())) {
                return { ...this.floatFromDot(), line, column };
            }

            // Check for raw string literals: R"delimiter(content)delimiter"
            if (this.currentChar === 'R' && this.peek() === '"') {
                return { ...this.rawStringLiteral(), line, column };
            }

            // Check for wide character literals: L'character'
            if (this.currentChar === 'L' && this.peek() === "'") {
                this.advance(); // consume 'L'
                const charLiteral = this.charLiteral();
                return { ...charLiteral, type: 'WIDE_CHAR_LITERAL', line, column };
            }

            if (/[a-zA-Z_]/.test(this.currentChar)) {
                return { ...this.identifier(), line, column };
            }

            const char = this.currentChar;
            
            // Special handling for :: before advancing
            if (char === ':' && this.peek() === ':') {
                this.advance(); // consume first ':'
                this.advance(); // consume second ':'
                return { type: 'SCOPE', value: '::', line, column };
            }
            
            this.advance();
            // 5. Updated switch statement in getNextToken
            switch (char) {
                case ';': return { type: 'SEMICOLON', value: ';', line, column };
                case '(': return { type: 'LPAREN', value: '(', line, column };
                case ')': return { type: 'RPAREN', value: ')', line, column };
                case '{': return { type: 'LBRACE', value: '{', line, column };
                case '}': return { type: 'RBRACE', value: '}', line, column };
                case '[': return { type: 'LBRACKET', value: '[', line, column };
                case ']': return { type: 'RBRACKET', value: ']', line, column };
                case ':': return { type: 'COLON', value: ':', line, column };
                case '=': return { type: 'ASSIGN', value: '=', line, column };
                case ',': return { type: 'COMMA', value: ',', line, column };
                case '.': 
                    // Check for ellipsis (...) operator
                    // We've already advanced past first dot, so check currentChar and peek for remaining dots
                    if (this.currentChar === '.' && this.peek() === '.') {
                        this.advance(); // consume second '.'
                        this.advance(); // consume third '.'
                        return { type: 'ELLIPSIS', value: '...', line, column };
                    }
                    return { type: 'DOT', value: '.', line, column };
                case '+': return { type: 'PLUS', value: '+', line, column };
                case '-': return { type: 'MINUS', value: '-', line, column };
                case '!': return { type: 'NOT', value: '!', line, column };
                case '*': return { type: 'MUL', value: '*', line, column };
                case '/': return { type: 'DIV', value: '/', line, column };
                case '%': return { type: 'MOD', value: '%', line, column };
                case '<': return { type: 'LT', value: '<', line, column };
                case '>': return { type: 'GT', value: '>', line, column };
                case '&': return { type: 'AMPERSAND', value: '&', line, column }; // Can be bitwise AND or address-of
                case '|': return { type: 'BITWISE_OR', value: '|', line, column };
                case '^': return { type: 'BITWISE_XOR', value: '^', line, column };
                case '~': return { type: 'BITWISE_NOT', value: '~', line, column };
                case '?': return { type: 'QUESTION', value: '?', line, column };
            }
            throw new Error(`Lexer Error on line ${line}, column ${column}: Unrecognized character '${char}' (ASCII: ${char.charCodeAt(0)})`);
        }
        return { type: 'EOF', value: null, line: this.line, column: this.column };
    }
    
    // Preprocessor directive parsing methods removed - 
    // preprocessing now happens before parsing stage

    // --- Recursive-Descent Parsing Functions ---

    parseCompoundStatement() {
        this.eat('LBRACE');
        const statements = [];
        while (this.currentToken.type !== 'RBRACE' && this.currentToken.type !== 'EOF') {
            statements.push(this.parseStatement());
        }
        this.eat('RBRACE');
        return { type: 'CompoundStmtNode', children: statements };
    }

    parseStatement() {
        // Preprocessor directives are now handled before parsing
        // Any remaining preprocessor tokens indicate an error in the preprocessing stage
        if (this.currentToken.type === 'PreprocessorDirective') {
            throw new Error(`Unexpected preprocessor directive in parsed code: ${this.currentToken.value}. Preprocessor should have handled this before parsing.`);
        }
        
        if (this.currentToken.type === 'IF') { return this.parseIfStatement(); }
        if (this.currentToken.type === 'WHILE') { return this.parseWhileStatement(); }
        // 7. Updated parseStatement to handle do...while
        if (this.currentToken.type === 'DO') { return this.parseDoWhileStatement(); }
        if (this.currentToken.type === 'FOR') { return this.parseForStatement(); }
        if (this.currentToken.type === 'SWITCH') { return this.parseSwitchStatement(); }
        if (this.currentToken.type === 'BREAK') { return this.parseBreakStatement(); }
        if (this.currentToken.type === 'CONTINUE') { return this.parseContinueStatement(); }
        if (this.currentToken.type === 'RETURN') { return this.parseReturnStatement(); }
        if (this.currentToken.type === 'LBRACE') { return this.parseCompoundStatement(); }
        if (this.currentToken.type === 'SEMICOLON') { 
            this.eat('SEMICOLON'); 
            return { type: 'EmptyStatement' }; 
        }
        
        const currentType = this.currentToken.type;
        // Expanded list of types
        const isType = isValidType(currentType, 'any') || isStorageClass(currentType);
        
        const isTypeConst = (currentType === 'INT' || currentType === 'LONG' || currentType === 'FLOAT') && this.peekToken.type === 'CONST';
        
        const isArrayDecl = (isType && this.peekToken.type === 'IDENTIFIER' && this.peekToken2.type === 'LBRACKET') ||
                           (isTypeConst && this.peekToken2.type === 'IDENTIFIER');
        
        // Check for pointer declarations: type * identifier or type * * identifier etc.
        const isPointerDecl = isType && this.peekToken.type === 'MUL';
        
        // Check for function pointer declarations: type (*identifier)()
        const isFunctionPointerDecl = isType && this.peekToken.type === 'LPAREN' && this.peekToken2 && this.peekToken2.type === 'MUL';
        
        // Check for const type* declarations: const type* identifier
        const isConstPointerDecl = (currentType === 'CONST') && 
                                   isValidType(this.peekToken.type, 'declaration') && 
                                   this.peekToken2 && this.peekToken2.type === 'MUL';
        
        // Check for const type declarations: const type identifier
        const isConstTypeDecl = (currentType === 'CONST') && 
                               isValidType(this.peekToken.type, 'declaration') && 
                               this.peekToken2 && this.peekToken2.type === 'IDENTIFIER';
        
        // Check for volatile/static type declarations: volatile/static type identifier
        const isVolatileTypeDecl = (currentType === 'VOLATILE') && 
                                  isValidType(this.peekToken.type, 'declaration') && 
                                  this.peekToken2 && this.peekToken2.type === 'IDENTIFIER';
        
        const isStaticTypeDecl = (currentType === 'STATIC') && 
                                (isValidType(this.peekToken.type, 'declaration') || 
                                 (this.peekToken.type === 'UNSIGNED' && ['LONG', 'INT', 'SHORT', 'CHAR'].includes(this.peekToken2?.type)));
        
        // Enhanced static type declaration detection for composite types  
        const isStaticCompositeType = (currentType === 'STATIC') && (
            // Handle cases like: static uint8_t identifier  
            (this.peekToken.type === 'IDENTIFIER' && this.peekToken.value?.match(/^(uint|int)\d+_t$/) && this.peekToken2?.type === 'IDENTIFIER') ||
            // Handle cases like: static long identifier
            (['LONG', 'SHORT'].includes(this.peekToken.type) && this.peekToken2?.type === 'IDENTIFIER')
        );
        
        // Check for template instantiation: TypeName<...> identifier  
        const isTemplateTypeDecl = isType && this.peekToken.type === 'LT';
        
        // Check for namespace-qualified template: namespace::TypeName<...> identifier
        // This should only match patterns like "std::vector<int> myVar;" not "rtttl::isPlaying();"
        const isNamespaceTemplateTypeDecl = (currentType === 'IDENTIFIER' && 
                                           this.peekToken.type === 'SCOPE' && 
                                           this.peekToken2.type === 'IDENTIFIER' &&
                                           // Peek ahead to see if there's template syntax or variable declaration pattern
                                           this.isNamespaceQualifiedVariableDeclaration());
        
        if ((isType && this.peekToken.type === 'IDENTIFIER') || (isTypeConst && this.peekToken2.type === 'IDENTIFIER') || isArrayDecl || isPointerDecl || isFunctionPointerDecl || isConstPointerDecl || isConstTypeDecl || isVolatileTypeDecl || isStaticTypeDecl || isStaticCompositeType || isTemplateTypeDecl || isNamespaceTemplateTypeDecl) {
            return this.parseVariableDeclaration();
        }
        
        if (currentType === 'UNSIGNED' && ['LONG', 'INT'].includes(this.peekToken.type)) {
            // Handle two-word types: unsigned long/int identifier
            if (this.peekToken2.type === 'IDENTIFIER') {
                return this.parseVariableDeclaration();
            }
            // Handle three-word types: unsigned long int identifier
            if (this.peekToken.type === 'LONG' && this.peekToken2.type === 'INT') {
                // Need to check the token after 'INT' for identifier
                const savedPosition = this.position;
                const savedChar = this.currentChar;
                const savedLine = this.line;
                const savedColumn = this.column;
                const savedCurrent = this.currentToken;
                const savedPeek = this.peekToken;
                const savedPeek2 = this.peekToken2;
                
                try {
                    // Advance to check token after INT
                    this.advanceToken(); // skip UNSIGNED
                    this.advanceToken(); // skip LONG  
                    this.advanceToken(); // skip INT
                    const isIdentifier = this.currentToken.type === 'IDENTIFIER';
                    
                    // Restore parser state
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                    
                    if (isIdentifier) {
                        return this.parseVariableDeclaration();
                    }
                } catch (e) {
                    // Restore parser state on any error
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                }
            }
        }
        
        if (currentType === 'LONG' && ['INT', 'DOUBLE'].includes(this.peekToken.type)) {
            // Handle two-word types starting with LONG: long int, long double
            if (this.peekToken2.type === 'IDENTIFIER') {
                return this.parseVariableDeclaration();
            }
        }
        
        if (currentType === 'STRUCT') {
            return this.parseStructDeclaration();
        }

        // Handle C++ access specifiers that appear in statement context (skip them)
        if (['PUBLIC', 'PRIVATE', 'PROTECTED'].includes(currentType)) {
            this.advanceToken(); // Skip the access specifier
            if (this.currentToken.type === 'COLON') {
                this.advanceToken(); // Skip the colon
            }
            // Return a comment node to indicate we skipped this
            return { type: 'CommentNode', value: `Skipped ${currentType.toLowerCase()} access specifier in statement` };
        }

        const expressionNode = this.parseExpression();
        this.eat('SEMICOLON');
        return { type: 'ExpressionStatement', expression: expressionNode };
    }

    parseReturnStatement() {
        this.eat('RETURN');
        let value = null;
        if (this.currentToken.type !== 'SEMICOLON') {
            value = this.parseExpression();
        }
        this.eat('SEMICOLON');
        return { type: 'ReturnStatement', value };
    }
    
    parseContinueStatement() {
        this.eat('CONTINUE');
        this.eat('SEMICOLON');
        return { type: 'ContinueStatement' };
    }

    parseIfStatement() {
        this.eat('IF');
        this.eat('LPAREN');
        const condition = this.parseExpression();
        this.eat('RPAREN');
        const consequent = this.parseStatement();
        let alternate = null;
        if (this.currentToken.type === 'ELSE') {
            this.eat('ELSE');
            alternate = this.parseStatement();
        }
        return { type: 'IfStatement', condition, consequent, alternate };
    }

    parseWhileStatement() {
        this.eat('WHILE');
        this.eat('LPAREN');
        const condition = this.parseExpression();
        this.eat('RPAREN');
        const body = this.parseStatement();
        return { type: 'WhileStatement', condition, body };
    }

    // 6. Added parseDoWhileStatement method
    parseDoWhileStatement() {
        this.eat('DO');
        const body = this.parseStatement();
        this.eat('WHILE');
        this.eat('LPAREN');
        const condition = this.parseExpression();
        this.eat('RPAREN');
        this.eat('SEMICOLON');
        return { type: 'DoWhileStatement', body, condition };
    }

    parseForStatement() {
        this.eat('FOR');
        this.eat('LPAREN');
        
        // Parse the initial part (either variable declaration or expression)
        let initializer = null;
        if (this.currentToken.type !== 'SEMICOLON') {
            const currentType = this.currentToken.type;
            
            // Special handling for IDENTIFIER in for loops
            // If we see IDENTIFIER followed by assignment operator, treat as expression not declaration
            if (currentType === 'IDENTIFIER' && 
                this.peekToken && 
                ['ASSIGN', 'PLUS_ASSIGN', 'MINUS_ASSIGN', 'MUL_ASSIGN', 'DIV_ASSIGN', 'MOD_ASSIGN'].includes(this.peekToken.type)) {
                initializer = this.parseExpression();
            }
            // If we see IDENTIFIER followed by semicolon, treat as expression (existing variable reference)
            else if (currentType === 'IDENTIFIER' && this.peekToken && this.peekToken.type === 'SEMICOLON') {
                initializer = this.parseExpression();
            } 
            // Otherwise use normal type/modifier checking
            else if (isValidType(currentType, 'declaration') || isTypeModifier(currentType)) {
                initializer = this.parseVariableDeclaration(false);
            } else {
                initializer = this.parseExpression();
            }
        }
        
        // Check if this is a range-based for loop (C++11): for (type var : range)
        if (this.currentToken.type === 'COLON') {
            this.eat('COLON');
            const range = this.parseExpression();
            this.eat('RPAREN');
            const body = this.parseStatement();
            return { 
                type: 'RangeBasedForStatement', 
                declaration: initializer,
                range: range,
                body: body 
            };
        }
        
        // Traditional C-style for loop: for (init; condition; increment)
        this.eat('SEMICOLON');
        let condition = null;
        if (this.currentToken.type !== 'SEMICOLON') {
            condition = this.parseExpression();
        }
        this.eat('SEMICOLON');
        let increment = null;
        if (this.currentToken.type !== 'RPAREN') {
            increment = this.parseExpression();
        }
        this.eat('RPAREN');
        const body = this.parseStatement();
        return { type: 'ForStatement', initializer, condition, increment, body };
    }

    parseSwitchStatement() {
        this.eat('SWITCH');
        this.eat('LPAREN');
        const discriminant = this.parseExpression();
        this.eat('RPAREN');
        this.eat('LBRACE');
        const cases = [];
        while (this.currentToken.type !== 'RBRACE' && this.currentToken.type !== 'EOF') {
            cases.push(this.parseCaseStatement());
        }
        this.eat('RBRACE');
        return { type: 'SwitchStatement', discriminant, cases };
    }

    parseCaseStatement() {
        let test = null;
        if (this.currentToken.type === 'CASE') {
            this.eat('CASE');
            test = this.parseCaseExpression();
        } else {
            this.eat('DEFAULT');
        }
        this.eat('COLON');
        const consequent = [];
        while (this.currentToken.type !== 'CASE' && this.currentToken.type !== 'DEFAULT' && this.currentToken.type !== 'RBRACE') {
            consequent.push(this.parseStatement());
        }
        return { type: 'CaseStatement', test, consequent };
    }
    
    parseCaseExpression() {
        const left = this.parseExpression();
        
        // Check for range expression (case 'a'...'z':)
        if (this.currentToken.type === 'ELLIPSIS') {
            this.eat('ELLIPSIS');
            const right = this.parseExpression();
            return { type: 'RangeExpression', start: left, end: right };
        }
        
        return left;
    }

    parseBreakStatement() {
        this.eat('BREAK');
        this.eat('SEMICOLON');
        return { type: 'BreakStatement' };
    }
    
    // 8. Added parseStructDeclaration and parseStructMember methods
    parseStructDeclaration(expectSemicolon = true) {
        this.eat('STRUCT');
        let name = null;
        if (this.currentToken.type === 'IDENTIFIER') {
            name = this.currentToken.value;
            this.eat('IDENTIFIER');
        }
        
        if (this.currentToken.type === 'LBRACE') {
            this.eat('LBRACE');
            const members = [];
            while (this.currentToken.type !== 'RBRACE' && this.currentToken.type !== 'EOF') {
                members.push(this.parseStructMember());
            }
            this.eat('RBRACE');
            if (expectSemicolon) {
                this.eat('SEMICOLON'); // Struct definitions are often followed by a semicolon
            }
            return { type: 'StructDeclaration', name, members };
        }
        
        // Just struct name reference (like in a variable declaration)
        return { type: 'StructType', name };
    }

    parseEnumDeclaration(expectSemicolon = true) {
        this.eat('ENUM');
        let name = null;
        if (this.currentToken.type === 'IDENTIFIER') {
            name = this.currentToken.value;
            this.eat('IDENTIFIER');
        }
        
        if (this.currentToken.type === 'LBRACE') {
            this.eat('LBRACE');
            const members = [];
            
            if (this.currentToken.type !== 'RBRACE') {
                // Parse first enum member
                members.push(this.parseEnumMember());
                
                while (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                    if (this.currentToken.type === 'RBRACE') break; // Allow trailing comma
                    members.push(this.parseEnumMember());
                }
            }
            
            this.eat('RBRACE');
            if (expectSemicolon) {
                this.eat('SEMICOLON');
            }
            return { type: 'EnumDeclaration', name, members };
        }
        
        // Just enum name reference (like in a variable declaration)
        return { type: 'EnumType', name };
    }

    parseEnumMember() {
        const name = this.currentToken.value;
        this.eat('IDENTIFIER');
        
        let value = null;
        if (this.currentToken.type === 'ASSIGN') {
            this.eat('ASSIGN');
            value = this.parseExpression();
        }
        
        return { type: 'EnumMember', name, value };
    }

    parseUnionDeclaration(expectSemicolon = true) {
        this.eat('UNION');
        let name = null;
        if (this.currentToken.type === 'IDENTIFIER') {
            name = this.currentToken.value;
            this.eat('IDENTIFIER');
        }
        
        if (this.currentToken.type === 'LBRACE') {
            this.eat('LBRACE');
            const members = [];
            while (this.currentToken.type !== 'RBRACE' && this.currentToken.type !== 'EOF') {
                members.push(this.parseStructMember()); // Reuse struct member parsing
            }
            this.eat('RBRACE');
            
            // Handle optional variable declarations after union: union {...} var1, var2;
            const variables = [];
            if (this.currentToken.type === 'IDENTIFIER') {
                variables.push(this.currentToken.value);
                this.eat('IDENTIFIER');
                
                while (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                    variables.push(this.currentToken.value);
                    this.eat('IDENTIFIER');
                }
            }
            
            if (expectSemicolon) {
                this.eat('SEMICOLON');
            }
            return { type: 'UnionDeclaration', name, members, variables };
        }
        
        // Just union name reference (like in a variable declaration)
        return { type: 'UnionType', name };
    }

    parseTypedefDeclaration() {
        this.eat('TYPEDEF');
        
        // Handle typedef struct { ... } TypeName;
        if (this.currentToken.type === 'STRUCT') {
            const structDecl = this.parseStructDeclaration(false); // Don't expect semicolon after struct
            // The next token should be the typedef name
            if (this.currentToken.type === 'IDENTIFIER') {
                const typeName = this.currentToken.value;
                this.eat('IDENTIFIER');
                this.eat('SEMICOLON');
                return { 
                    type: 'TypedefDeclaration', 
                    baseType: structDecl, 
                    typeName: typeName 
                };
            } else {
                throw new Error(`Expected typedef name after struct definition at line ${this.currentToken.line}`);
            }
        }
        
        // Handle typedef union { ... } TypeName;
        if (this.currentToken.type === 'UNION') {
            const unionDecl = this.parseUnionDeclaration(false); // Don't expect semicolon after union
            if (this.currentToken.type === 'IDENTIFIER') {
                const typeName = this.currentToken.value;
                this.eat('IDENTIFIER');
                this.eat('SEMICOLON');
                return { 
                    type: 'TypedefDeclaration', 
                    baseType: unionDecl, 
                    typeName: typeName 
                };
            } else {
                throw new Error(`Expected typedef name after union definition at line ${this.currentToken.line}`);
            }
        }
        
        // Handle typedef enum { ... } TypeName;
        if (this.currentToken.type === 'ENUM') {
            const enumDecl = this.parseEnumDeclaration(false); // Don't expect semicolon after enum
            if (this.currentToken.type === 'IDENTIFIER') {
                const typeName = this.currentToken.value;
                this.eat('IDENTIFIER');
                this.eat('SEMICOLON');
                return { 
                    type: 'TypedefDeclaration', 
                    baseType: enumDecl, 
                    typeName: typeName 
                };
            } else {
                throw new Error(`Expected typedef name after enum definition at line ${this.currentToken.line}`);
            }
        }
        
        // Handle typedef function pointers: typedef return_type (*TypeName)(args);
        const baseType = this.currentToken.value;
        this.eat(this.currentToken.type);
        
        if (this.currentToken.type === 'LPAREN' && this.peekToken.type === 'MUL') {
            this.eat('LPAREN');
            this.eat('MUL');
            const typeName = this.currentToken.value;
            this.eat('IDENTIFIER');
            this.eat('RPAREN');
            const parameters = this.parseParameterList();
            this.eat('SEMICOLON');
            return { 
                type: 'TypedefDeclaration', 
                baseType: { 
                    type: 'FunctionPointerType', 
                    returnType: baseType, 
                    parameters: parameters 
                }, 
                typeName: typeName 
            };
        }
        
        // Handle simple typedef: typedef int MyInt;
        const simpleBaseType = this.currentToken.value;
        this.eat(this.currentToken.type);
        
        if (this.currentToken.type === 'IDENTIFIER') {
            const typeName = this.currentToken.value;
            this.eat('IDENTIFIER');
            this.eat('SEMICOLON');
            return { 
                type: 'TypedefDeclaration', 
                baseType: { type: 'TypeNode', value: simpleBaseType }, 
                typeName: typeName 
            };
        } else {
            throw new Error(`Expected typedef name at line ${this.currentToken.line}`);
        }
    }

    parseType() {
        // Handle compound types like "struct StructName"
        if (this.currentToken.type === 'STRUCT') {
            let typeName = 'struct';
            this.eat('STRUCT');
            
            if (this.currentToken.type === 'IDENTIFIER') {
                typeName += ' ' + this.currentToken.value;
                this.eat('IDENTIFIER');
            }
            
            return { type: 'TypeNode', value: typeName };
        }
        
        // Handle storage class specifiers
        let typeValue = '';
        while (['STATIC', 'EXTERN', 'VOLATILE', 'CONST'].includes(this.currentToken.type)) {
            typeValue += this.currentToken.value + ' ';
            this.eat(this.currentToken.type);
        }
        
        // Handle unsigned/signed modifiers
        if (['UNSIGNED', 'SIGNED'].includes(this.currentToken.type)) {
            typeValue += this.currentToken.value + ' ';
            this.eat(this.currentToken.type);
        }
        
        // Handle the base type (including user-defined types like enums and classes)
        if (isValidType(this.currentToken.type, 'parameter')) {
            typeValue += this.currentToken.value;
            this.eat(this.currentToken.type);
        } else {
            throw new Error(`Expected type name at line ${this.currentToken.line}, column ${this.currentToken.column}, but found '${this.currentToken.value}'`);
        }
        
        // Handle template instantiation: ClassName<Type> or ClassName<>
        let templateArgs = null;
        if (this.currentToken.type === 'LT') {
            this.eat('LT'); // <
            templateArgs = [];
            
            // Parse template arguments (can be empty for <>)
            if (this.currentToken.type !== 'GT') {
                templateArgs.push(this.parseTemplateArgument());
                
                while (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                    templateArgs.push(this.parseTemplateArgument());
                }
            }
            
            this.eatTemplateClose(); // Handle > or >> (split into two >)
        }
        
        const typeNode = { 
            type: 'TypeNode', 
            value: typeValue,
            templateArgs: templateArgs
        };
        
        return typeNode;
    }

    isNamespaceQualifiedVariableDeclaration() {
        // Look ahead to see if namespace::identifier is followed by template syntax or variable pattern
        // This distinguishes "std::vector<int> myVar;" from "rtttl::isPlaying();"
        
        // Save current parser state
        const savedPosition = this.position;
        const savedChar = this.currentChar;
        const savedLine = this.line;
        const savedColumn = this.column;
        const savedCurrent = this.currentToken;
        const savedPeek = this.peekToken;
        const savedPeek2 = this.peekToken2;
        
        try {
            // Skip all namespace levels: namespace::sub::sub::type
            this.advanceToken(); // skip first namespace identifier
            
            // Handle multiple namespace levels
            while (this.currentToken.type === 'SCOPE' && this.peekToken.type === 'IDENTIFIER') {
                this.advanceToken(); // skip ::
                this.advanceToken(); // skip next namespace/type identifier
            }
            
            // Now check what follows:
            // - If it's '<', it's likely a template: std::vector<int>
            // - If it's an identifier, it might be a variable: std::string myVar
            // - If it's '(', it's likely a function call: rtttl::isPlaying()
            
            const isTemplate = this.currentToken.type === 'LT';
            const isDirectVariable = this.currentToken.type === 'IDENTIFIER';
            const isFunctionCall = this.currentToken.type === 'LPAREN';
            
            if (isFunctionCall) {
                return false; // This is a function call, not a variable declaration
            }
            
            if (isTemplate) {
                // Skip template arguments to see what's after
                let depth = 1;
                this.advanceToken(); // skip '<'
                while (depth > 0 && this.currentToken.type !== 'EOF') {
                    if (this.currentToken.type === 'LT') depth++;
                    else if (this.currentToken.type === 'GT') depth--;
                    this.advanceToken();
                }
                // Now check if there's an identifier (variable name) after template
                return this.currentToken.type === 'IDENTIFIER';
            }
            
            return isDirectVariable;
            
        } catch (e) {
            return false; // If any error occurs, assume it's not a variable declaration
        } finally {
            // Restore parser state
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;
        }
    }

    isAnonymousEnumWithVariable() {
        // Look ahead to see if enum { ... } is followed by a variable name
        // This distinguishes "enum { A, B };" from "enum { A, B } variable;"
        
        // Save current parser state
        const savedPosition = this.position;
        const savedChar = this.currentChar;
        const savedLine = this.line;
        const savedColumn = this.column;
        const savedCurrent = this.currentToken;
        const savedPeek = this.peekToken;
        const savedPeek2 = this.peekToken2;
        
        try {
            // Skip enum keyword
            this.advanceToken(); // skip 'enum'
            this.advanceToken(); // skip '{'
            
            // Skip through enum members until we find the closing brace
            let braceDepth = 1;
            while (braceDepth > 0 && this.currentToken.type !== 'EOF') {
                if (this.currentToken.type === 'LBRACE') {
                    braceDepth++;
                } else if (this.currentToken.type === 'RBRACE') {
                    braceDepth--;
                }
                this.advanceToken();
            }
            
            // Now check what follows the closing brace
            // If it's an identifier, this is an enum with variable declaration
            // If it's a semicolon, this is just an enum declaration
            return this.currentToken.type === 'IDENTIFIER';
            
        } catch (e) {
            return false; // If any error occurs, assume it's not a variable declaration
        } finally {
            // Restore parser state
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;
        }
    }

    parseAnonymousEnumWithVariable() {
        // Parse: enum { MEMBER1, MEMBER2, ... } variableName = value;
        
        this.eat('ENUM');
        this.eat('LBRACE');
        
        // Parse enum members
        const members = [];
        if (this.currentToken.type !== 'RBRACE') {
            members.push(this.parseEnumMember());
            
            while (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
                if (this.currentToken.type === 'RBRACE') break; // Allow trailing comma
                members.push(this.parseEnumMember());
            }
        }
        
        this.eat('RBRACE');
        
        // Parse the variable declaration part
        const variableName = this.currentToken.value;
        this.eat('IDENTIFIER');
        
        let initializer = null;
        if (this.currentToken.type === 'ASSIGN') {
            this.eat('ASSIGN');
            initializer = this.parseExpression();
        }
        
        this.eat('SEMICOLON');
        
        // Return a combined node that represents both the enum declaration and variable
        return {
            type: 'AnonymousEnumWithVariable',
            members: members,
            variable: {
                name: variableName,
                initializer: initializer
            }
        };
    }

    parseTemplateArgument() {
        // Template arguments can be types, constant expressions, or template template parameters
        // Enhanced to handle nested templates and complex expressions
        
        // Check if it's a type
        const currentType = this.currentToken.type;
        const isTypeName = isValidType(currentType, 'any') || isTypeModifier(currentType);
        
        if (isTypeName) {
            // Parse as a type, including nested templates
            return this.parseTemplateArgumentType();
        } else {
            // Parse as a constant expression with bracket awareness
            return this.parseAssignmentExpression(true); // true = in template context
        }
    }
    
    parseTemplateArgumentType() {
        // Parse a type that might contain nested templates
        const baseType = this.parseType();
        
        // Handle pointer modifiers (*, **, etc.)
        let pointerLevel = 0;
        let typeValue = baseType.value || baseType.name || baseType.type;
        
        while (this.currentToken.type === 'MUL') {
            this.eat('MUL');
            pointerLevel++;
            typeValue += '*';
        }
        
        return {
            type: 'TypeNode',
            value: typeValue,
            isPointer: pointerLevel > 0,
            pointerLevel: pointerLevel,
            templateArgs: baseType.templateArgs
        };
    }
    
    parseTemplateArgumentExpression() {
        // Parse an expression that should end at '>' or ',' at the correct bracket depth
        // This is needed for expressions like "16 * 1024" in template arguments
        
        const start = this.tokenIndex;
        let bracketDepth = 0;
        let parenDepth = 0;
        let squareDepth = 0;
        
        // Collect tokens until we reach a terminator at depth 0
        const tokens = [];
        
        while (this.currentToken.type !== 'EOF') {
            const token = this.currentToken;
            
            // Track bracket depths
            if (token.type === 'LT') bracketDepth++;
            else if (token.type === 'GT') {
                if (bracketDepth === 0) break; // Found our terminator
                bracketDepth--;
            }
            else if (token.type === 'LPAREN') parenDepth++;
            else if (token.type === 'RPAREN') parenDepth--;
            else if (token.type === 'LBRACKET') squareDepth++;
            else if (token.type === 'RBRACKET') squareDepth--;
            else if (token.type === 'COMMA' && bracketDepth === 0 && parenDepth === 0 && squareDepth === 0) {
                break; // Found argument separator at top level
            }
            
            tokens.push(token);
            this.advanceToken();
        }
        
        // For now, just use regular expression parsing
        // The expression parser should handle "16 * 1024" correctly
        return this.parseAssignmentExpression();
    }
    
    eatTemplateClose() {
        // Handle closing > in template context
        // If we encounter >>, split it into two > tokens for nested templates
        if (this.currentToken.type === 'GT') {
            this.eat('GT');
        } else if (this.currentToken.type === 'RSHIFT') {
            // Split >> into two > tokens
            // Create a fake GT token to replace the current RSHIFT
            const currentLine = this.currentToken.line;
            const currentColumn = this.currentToken.column;
            
            // Advance past the RSHIFT
            this.advanceToken();
            
            // Insert a GT token for the second >
            const fakeGT = { type: 'GT', value: '>', line: currentLine, column: currentColumn + 1 };
            // Inject the fake GT into the token stream using parser's token management
            
            // The current token is now the fake GT we just inserted
            this.currentToken = fakeGT;
        } else {
            throw new Error(`Expected '>' to close template, but found '${this.currentToken.value}' at line ${this.currentToken.line}, column ${this.currentToken.column}`);
        }
    }

    parseStructMember() {
        // Handle anonymous struct/union
        if (this.currentToken.type === 'STRUCT' || this.currentToken.type === 'UNION') {
            const isStruct = this.currentToken.type === 'STRUCT';
            
            if (isStruct) {
                this.eat('STRUCT');
            } else {
                this.eat('UNION');
            }
            
            // Check for anonymous struct/union (no name, just { ... })
            if (this.currentToken.type === 'LBRACE') {
                this.eat('LBRACE');
                const members = [];
                while (this.currentToken.type !== 'RBRACE' && this.currentToken.type !== 'EOF') {
                    members.push(this.parseStructMember());
                }
                this.eat('RBRACE');
                
                // Parse the declarator (variable name) after the anonymous struct/union
                const declarator = this.parseDeclarator();
                this.eat('SEMICOLON');
                
                return {
                    type: 'StructMember',
                    memberType: {
                        type: isStruct ? 'AnonymousStruct' : 'AnonymousUnion',
                        members: members
                    },
                    declarator: declarator,
                    bitField: null
                };
            }
        }
        
        const type = this.parseType();
        
        // Handle multiple declarations: type var1, var2, var3;
        const declarations = [];
        
        // Parse first declarator
        const firstDeclarator = this.parseDeclarator();
        
        // Handle C++11 member default initialization: member = value
        let defaultValue = null;
        if (this.currentToken.type === 'ASSIGN') {
            this.eat('ASSIGN');
            defaultValue = this.parseExpression();
        }
        
        // Handle bit fields
        let bitField = null;
        if (this.currentToken.type === 'COLON') {
            this.eat('COLON');
            bitField = this.parseExpression();
        }
        
        declarations.push({
            declarator: firstDeclarator,
            defaultValue: defaultValue,
            bitField: bitField
        });
        
        // Parse additional declarators separated by commas
        while (this.currentToken.type === 'COMMA') {
            this.eat('COMMA');
            const declarator = this.parseDeclarator();
            
            // Each declarator can have its own default value and bit field
            let declDefaultValue = null;
            if (this.currentToken.type === 'ASSIGN') {
                this.eat('ASSIGN');
                declDefaultValue = this.parseExpression();
            }
            
            let declBitField = null;
            if (this.currentToken.type === 'COLON') {
                this.eat('COLON');
                declBitField = this.parseExpression();
            }
            
            declarations.push({
                declarator: declarator,
                defaultValue: declDefaultValue,
                bitField: declBitField
            });
        }
        
        this.eat('SEMICOLON');
        
        // If there's only one declaration, return the original format for backward compatibility
        if (declarations.length === 1) {
            const decl = declarations[0];
            const memberNode = { type: 'StructMember', memberType: type, declarator: decl.declarator, bitField: decl.bitField };
            if (decl.defaultValue !== null) {
                memberNode.defaultValue = decl.defaultValue;
            }
            return memberNode;
        } else {
            // Multiple declarations: return a new node type
            return {
                type: 'MultipleStructMembers',
                memberType: type,
                declarations: declarations
            };
        }
    }

    // Parse C++11 lambda expressions: [capture](parameters) { body }
    parseLambdaExpression() {
        const startLine = this.currentToken.line;
        const startColumn = this.currentToken.column;
        
        // Parse capture list: []
        this.eat('LBRACKET');
        const captureList = [];
        
        while (this.currentToken.type !== 'RBRACKET' && this.currentToken.type !== 'EOF') {
            if (this.currentToken.type === 'ASSIGN') {
                // [=] - capture by value
                captureList.push({ type: 'CaptureAll', mode: 'value' });
                this.eat('ASSIGN');
            } else if (this.currentToken.type === 'AMPERSAND') {
                // [&] - capture by reference
                captureList.push({ type: 'CaptureAll', mode: 'reference' });
                this.eat('AMPERSAND');
            } else if (this.currentToken.type === 'IDENTIFIER') {
                // [var] or [&var] - capture specific variable
                const captureName = this.currentToken.value;
                this.eat('IDENTIFIER');
                captureList.push({ type: 'CaptureVariable', name: captureName, mode: 'value' });
            }
            
            if (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
            }
        }
        this.eat('RBRACKET');
        
        // Parse parameter list: (params)
        let parameters = [];
        if (this.currentToken.type === 'LPAREN') {
            parameters = this.parseParameterList();
        }
        
        // Optional: parse mutable keyword
        let isMutable = false;
        if (this.currentToken.type === 'IDENTIFIER' && this.currentToken.value === 'mutable') {
            isMutable = true;
            this.eat('IDENTIFIER');
        }
        
        // Optional: parse return type -> type
        let returnType = null;
        if (this.currentToken.type === 'ARROW') {
            this.eat('ARROW');
            returnType = this.parseType();
        }
        
        // Parse body: { statements }
        let body = null;
        if (this.currentToken.type === 'LBRACE') {
            body = this.parseCompoundStatement();
        } else {
            throw new Error(`Expected lambda body at line ${this.currentToken.line}, column ${this.currentToken.column}`);
        }
        
        return {
            type: 'LambdaExpression',
            captureList: captureList,
            parameters: parameters,
            body: body,
            mutable: isMutable,
            returnType: returnType,
            line: startLine,
            column: startColumn
        };
    }

    // --- Expression Parsing (Table-Driven Precedence Climbing) ---
    
    parseExpression() {
        return this.parseCommaExpression();
    }
    
    // Parse comma expressions (lowest precedence)
    parseCommaExpression() {
        let left = this.parseAssignmentExpression();
        
        while (this.currentToken.type === 'COMMA') {
            const operator = this.currentToken;
            this.eat('COMMA');
            const right = this.parseAssignmentExpression();
            left = { type: 'CommaExpression', left, op: operator, right };
        }
        
        return left;
    }
    
    // 11. Updated parseAssignmentExpression to call parseTernaryExpression
    parseAssignmentExpression(inTemplate = false) {
        const left = this.parseTernaryExpression(inTemplate); // Changed from parseBinaryExpression
        const assignmentTokens = ['ASSIGN', 'PLUS_ASSIGN', 'MINUS_ASSIGN', 'MUL_ASSIGN', 'DIV_ASSIGN', 'MOD_ASSIGN', 'AND_ASSIGN', 'OR_ASSIGN', 'XOR_ASSIGN', 'LSHIFT_ASSIGN', 'RSHIFT_ASSIGN'];
        if (assignmentTokens.includes(this.currentToken.type)) {
            const operator = this.currentToken.value;
            this.eat(this.currentToken.type);
            const right = this.parseAssignmentExpression(inTemplate); // right-associative
            return { type: 'AssignmentNode', operator, left, right };
        }
        return left;
    }
    
    // 10. Added parseTernaryExpression method
    parseTernaryExpression(inTemplate = false) {
        const condition = this.parseBinaryExpression(0, inTemplate);
        
        if (this.currentToken.type === 'QUESTION') {
            this.eat('QUESTION');
            const consequent = this.parseExpression();
            this.eat('COLON');
            const alternate = this.parseTernaryExpression(); // right-associative
            return { type: 'TernaryExpression', condition, consequent, alternate };
        }
        
        return condition;
    }

    parseBinaryExpression(precedence = 0, inTemplate = false) {
        let left = this.parseUnaryExpression();

        while (precedence < (PRECEDENCE[this.currentToken.type] || 0)) {
            // In template context, stop at GT (>) and COMMA (,) tokens
            if (inTemplate && (this.currentToken.type === 'GT' || this.currentToken.type === 'COMMA')) {
                break;
            }
            const operator = this.currentToken;
            this.eat(operator.type);
            const right = this.parseBinaryExpression(PRECEDENCE[operator.type], inTemplate);
            left = { type: 'BinaryOpNode', left, op: operator, right };
        }
        return left;
    }

    // 9. Updated parseUnaryExpression to handle more operators
    parseUnaryExpression() {
        // Handle prefix operators
        if (['NOT', 'MINUS', 'PLUS', 'PLUS_PLUS', 'MINUS_MINUS', 'BITWISE_NOT', 'AMPERSAND', 'MUL'].includes(this.currentToken.type)) {
            const operator = this.currentToken;
            this.advanceToken();
            
            if (operator.type === 'MUL') {
                 // Could be dereference operator
                const operand = this.parseUnaryExpression();
                return { type: 'UnaryOpNode', op: { ...operator, value: '*', semantic: 'dereference' }, operand };
            }
            if (operator.type === 'AMPERSAND') {
                // Could be address-of operator
                const operand = this.parseUnaryExpression();
                return { type: 'UnaryOpNode', op: { ...operator, value: '&', semantic: 'address-of' }, operand };
            }
            
            const operand = this.parseUnaryExpression();
            return { type: 'UnaryOpNode', op: operator, operand };
        }
        
        // Handle sizeof operator
        if (this.currentToken.type === 'SIZEOF') {
            this.eat('SIZEOF');
            if (this.currentToken.type === 'LPAREN') {
                this.eat('LPAREN');
                
                // Check if this is a simple type name vs an expression
                const currentType = this.currentToken.type;
                const isValidTypeToken = isValidType(currentType, 'any');
                
                // Use lookahead to distinguish type names from expressions
                // Type name: sizeof(int), sizeof(MyClass), sizeof(char*) - simple type constructs
                // Expression: sizeof(arr[0]), sizeof(obj.member) - complex expressions
                
                let isSimpleTypeName = false;
                
                if (isValidTypeToken && this.peekToken) {
                    if (this.peekToken.type === 'RPAREN') {
                        // Simple type: sizeof(int), sizeof(MyClass)
                        isSimpleTypeName = true;
                    } else if (this.peekToken.type === 'MUL' && this.peekToken2 && this.peekToken2.type === 'RPAREN') {
                        // Pointer type: sizeof(char*), sizeof(int*)
                        isSimpleTypeName = true;
                    }
                }
                
                if (isSimpleTypeName) {
                    // Parse as type name - create a TypeNode
                    let typeName = this.currentToken.value;
                    this.eat(this.currentToken.type);
                    
                    // Handle pointer types (e.g., char*, int*)
                    if (this.currentToken.type === 'MUL') {
                        typeName += '*';
                        this.eat('MUL');
                    }
                    
                    this.eat('RPAREN');
                    return { type: 'SizeofExpression', operand: { type: 'TypeNode', value: typeName } };
                } else {
                    // Parse as expression (handles arr[0], obj.member, complex expressions, etc.)
                    const expr = this.parseExpression();
                    this.eat('RPAREN');
                    return { type: 'SizeofExpression', operand: expr };
                }
            }
            // sizeof variable
            const operand = this.parseUnaryExpression();
            return { type: 'SizeofExpression', operand };
        }
        
        // Handle new operator
        if (this.currentToken.type === 'NEW') {
            return this.parseNewExpression();
        }
        
        return this.parsePostfixExpression();
    }
    
    parseNewExpression() {
        this.eat('NEW');
        
        // Parse the type to be allocated
        const type = this.parseType();
        
        // Check for array allocation: new Type[size]
        if (this.currentToken.type === 'LBRACKET') {
            this.eat('LBRACKET');
            const size = this.parseExpression();
            this.eat('RBRACKET');
            return {
                type: 'NewExpression',
                allocationType: type,
                isArray: true,
                size: size
            };
        }
        
        // Check for constructor call: new Type(args)
        let args = [];
        if (this.currentToken.type === 'LPAREN') {
            this.eat('LPAREN');
            if (this.currentToken.type !== 'RPAREN') {
                args.push(this.parseExpression());
                while (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                    args.push(this.parseExpression());
                }
            }
            this.eat('RPAREN');
        }
        
        return {
            type: 'NewExpression',
            allocationType: type,
            isArray: false,
            arguments: args
        };
    }
    
    parsePostfixExpression() {
        let left = this.parseCallMemberExpression();
        
        if (this.currentToken.type === 'PLUS_PLUS' || this.currentToken.type === 'MINUS_MINUS') {
            const operator = this.currentToken;
            this.eat(operator.type);
            return { type: 'PostfixExpressionNode', operand: left, op: operator };
        }
        
        return left;
    }
    
    parseCallMemberExpression() {
        let left = this.parsePrimaryExpression();
        while (this.currentToken.type === 'DOT' || this.currentToken.type === 'ARROW' || this.currentToken.type === 'SCOPE' || this.currentToken.type === 'LPAREN' || this.currentToken.type === 'LBRACKET') {
            if (this.currentToken.type === 'DOT' || this.currentToken.type === 'ARROW') {
                const operatorType = this.currentToken.type;
                this.eat(operatorType);
                const property = { type: 'IdentifierNode', value: this.currentToken.value };
                this.eat('IDENTIFIER');
                left = { type: 'MemberAccessNode', object: left, property, operator: operatorType };
            } else if (this.currentToken.type === 'SCOPE') {
                this.eat('SCOPE');
                const property = { type: 'IdentifierNode', value: this.currentToken.value };
                this.eat('IDENTIFIER');
                left = { type: 'NamespaceAccessNode', namespace: left, member: property };
            } else if (this.currentToken.type === 'LBRACKET') {
                this.eat('LBRACKET');
                const index = this.parseExpression();
                this.eat('RBRACKET');
                left = { type: 'ArrayAccessNode', identifier: left, index };
            } else {
                left = this.parseFunctionCall(left);
            }
        }
        return left;
    }

    parsePrimaryExpression() {
        const token = this.currentToken;

        // Handle C++ cast expressions: static_cast<Type>(expression)
        if (['STATIC_CAST', 'DYNAMIC_CAST', 'CONST_CAST', 'REINTERPRET_CAST'].includes(token.type)) {
            return this.parseCppCast();
        }
        
        if (token.type === 'LPAREN') {
            const savedPosition = this.position;
            const savedChar = this.currentChar;
            const savedLine = this.line;
            const savedColumn = this.column;
            const savedCurrent = this.currentToken;
            const savedPeek = this.peekToken;
            const savedPeek2 = this.peekToken2;
            
            this.advanceToken();
            const possibleType = this.currentToken.type;
            // Use centralized type checking for cast detection
            
            // Check for C-style cast: type, type*, type**, etc.
            let isCast = false;
            const isValidForCast = isValidType(possibleType, 'cast');
            
            // Quick check for simple single-word type casts like (byte), (int), etc.
            if (isValidForCast && this.peekToken.type === 'RPAREN') {
                // Look ahead past RPAREN to see if there's an expression to cast
                const nextAfterRParen = this.peekToken2?.type;
                const canStartExpression = ['IDENTIFIER', 'NUMBER', 'HEX_NUMBER', 'OCTAL_NUMBER', 
                                           'BINARY_NUMBER', 'FLOAT_NUMBER', 'STRING_LITERAL', 
                                           'CHAR_LITERAL', 'TRUE', 'FALSE', 'LPAREN', 'MINUS', 
                                           'PLUS', 'NOT', 'BITWISE_NOT', 'PLUS_PLUS', 'MINUS_MINUS',
                                           'AMPERSAND', 'MUL', 'SIZEOF', 'HIGH', 'LOW', 'INPUT', 'OUTPUT',
                                           'INPUT_PULLUP', 'INPUT_PULLDOWN', 'OUTPUT_OPENDRAIN'].includes(nextAfterRParen);
                
                if (canStartExpression) {
                    isCast = true;
                }
            }
            
            if (!isCast && isValidForCast) {
                // Look ahead to see if we have type, type*, type**, etc. followed by )
                let tempPos = this.position;
                let tempChar = this.currentChar;
                let tempLine = this.line;
                let tempColumn = this.column;
                let tempCurrent = this.currentToken;
                let tempPeek = this.peekToken;
                let tempPeek2 = this.peekToken2;
                
                try {
                    this.advanceToken(); // move past first type token
                    
                    // Handle type modifiers: const type, volatile type, etc.
                    if (['CONST', 'VOLATILE'].includes(possibleType)) {
                        // After const/volatile, we should have the actual type
                        if (isValidType(this.currentToken.type, 'cast')) {
                            this.advanceToken(); // move past the actual type
                        }
                    }
                    // Handle multi-word types: unsigned long, long long, etc.
                    else if (possibleType === 'UNSIGNED' && ['LONG', 'INT', 'SHORT', 'CHAR'].includes(this.currentToken.type)) {
                        this.advanceToken(); // skip the second type word
                        // Handle triple-word types: unsigned long int
                        if (this.currentToken.type === 'INT') {
                            this.advanceToken();
                        }
                    } else if (possibleType === 'LONG' && this.currentToken.type === 'LONG') {
                        this.advanceToken(); // skip second 'long' in 'long long'
                        if (this.currentToken.type === 'INT') {
                            this.advanceToken(); // skip 'int' in 'long long int'
                        }
                    }
                    
                    // Handle pointer levels: *, **, ***, etc.
                    while (this.currentToken.type === 'MUL') {
                        this.advanceToken();
                    }
                    // Should now be at RPAREN for a valid cast
                    if (this.currentToken.type === 'RPAREN') {
                        // Look ahead past the RPAREN to see if there's something to cast
                        this.advanceToken(); // move past RPAREN
                        
                        // For a valid cast, there should be an expression to cast after the )
                        // Check if the next token can start an expression (valid cast operand)
                        const nextToken = this.currentToken.type;
                        const canStartExpression = ['IDENTIFIER', 'NUMBER', 'HEX_NUMBER', 'OCTAL_NUMBER', 
                                                   'BINARY_NUMBER', 'FLOAT_NUMBER', 'STRING_LITERAL', 
                                                   'CHAR_LITERAL', 'TRUE', 'FALSE', 'LPAREN', 'MINUS', 
                                                   'PLUS', 'NOT', 'BITWISE_NOT', 'PLUS_PLUS', 'MINUS_MINUS',
                                                   'AMPERSAND', 'MUL', 'SIZEOF'].includes(nextToken);
                        
                        // If we don't have a valid cast operand after ), it's a parenthesized expression
                        isCast = canStartExpression;
                    } else {
                        isCast = false;
                    }
                } catch (e) {
                    isCast = false;
                }
                
                // Restore state
                this.position = tempPos;
                this.currentChar = tempChar;
                this.line = tempLine;
                this.column = tempColumn;
                this.currentToken = tempCurrent;
                this.peekToken = tempPeek;
                this.peekToken2 = tempPeek2;
            }
            
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;

            if (isCast) {
                return this.parseCastExpression();
            } else {
                this.eat('LPAREN');
                const expr = this.parseExpression();
                this.eat('RPAREN');
                return expr;
            }
        }
        
        switch(token.type) {
            case 'NUMBER':
            case 'HEX_NUMBER':
            case 'OCTAL_NUMBER':
            case 'BINARY_NUMBER':
            case 'FLOAT_NUMBER':
                this.eat(token.type);
                const node = { 
                    type: 'NumberNode', 
                    value: token.value
                };
                // Add position info only if requested (for backwards compatibility)
                if (this.options.includePositions) {
                    node.line = token.line;
                    node.column = token.column;
                }
                return node;
            case 'STRING_LITERAL':
                const currentStringToken = this.currentToken;
                this.eat('STRING_LITERAL');
                const stringNode = { 
                    type: 'StringLiteralNode', 
                    value: currentStringToken.value
                };
                // Add position info only if requested (for backwards compatibility)
                if (this.options.includePositions) {
                    stringNode.line = currentStringToken.line;
                    stringNode.column = currentStringToken.column;
                }
                // Preserve raw string properties if present
                if (currentStringToken.rawString) {
                    stringNode.rawString = currentStringToken.rawString;
                    stringNode.delimiter = currentStringToken.delimiter;
                }
                if (currentStringToken.unterminated) {
                    stringNode.unterminated = currentStringToken.unterminated;
                }
                return stringNode;
            case 'CHAR_LITERAL':
                this.eat('CHAR_LITERAL');
                const charNode = { 
                    type: 'CharLiteralNode', 
                    value: token.value
                };
                // Add position info only if requested (for backwards compatibility)
                if (this.options.includePositions) {
                    charNode.line = token.line;
                    charNode.column = token.column;
                }
                return charNode;
            case 'WIDE_CHAR_LITERAL':
                this.eat('WIDE_CHAR_LITERAL');
                return { type: 'WideCharLiteralNode', value: token.value };
            case 'STRING':
                this.eat('STRING');
                return { type: 'IdentifierNode', value: token.value };
            case 'LBRACE':
                return this.parseArrayInitializer();
            case 'LBRACKET':
                // Detect lambda expression: [capture](params) { body }
                return this.parseLambdaExpression();
            case 'IDENTIFIER':
            case 'LED_BUILTIN':
            case 'HIGH':
            case 'LOW':
            case 'OUTPUT':
            case 'INPUT':
            case 'INPUT_PULLUP':
            case 'INPUT_PULLDOWN':
            case 'OUTPUT_OPENDRAIN':
            case 'TRUE':
            case 'FALSE':
            case 'HEX':
            case 'DEC':
            case 'OCT':
            case 'BIN':
            case 'NULL':
            case 'NULLPTR':
            case 'ARDUINO_FUNC':
                this.advanceToken();
                let nodeType;
                if (token.type === 'IDENTIFIER') {
                    nodeType = 'IdentifierNode';
                } else if (token.type === 'ARDUINO_FUNC') {
                    nodeType = 'ArduinoFunctionNode';
                } else {
                    nodeType = 'ConstantNode';
                }
                const resultNode = { 
                    type: nodeType, 
                    value: token.value
                };
                // Add position info only if requested (for backwards compatibility)
                if (this.options.includePositions) {
                    resultNode.line = token.line;
                    resultNode.column = token.column;
                }
                return resultNode;
        }
        
        // Handle type tokens used as function-style casts: byte(x), int(x), float(x), etc.
        if (['BYTE', 'INT', 'LONG', 'FLOAT', 'DOUBLE', 'CHAR', 'SHORT', 'BOOL', 'BOOLEAN', 'UINT8_T', 'INT8_T', 'UINT16_T', 'INT16_T', 'UINT32_T', 'INT32_T', 'UINT64_T', 'INT64_T'].includes(token.type) && this.peekToken.type === 'LPAREN') {
            const castType = token.value;
            this.advanceToken(); // consume the type token
            this.eat('LPAREN');
            const argument = this.parseExpression();
            this.eat('RPAREN');
            return { type: 'FunctionStyleCastNode', castType: castType, argument: argument };
        }

        // Handle problematic tokens in expression context
        if (['PRIVATE', 'PUBLIC', 'PROTECTED', 'RETURN'].includes(token.type)) {
            // Skip the problematic token and return a placeholder node
            this.advanceToken();
            return { type: 'IdentifierNode', value: 'SKIPPED_' + token.type };
        }
        
        const { line, column, type } = this.currentToken;
        throw new Error(`Parsing Error on line ${line}, column: ${column}: Unexpected token ${type} in expression.`);
    }
    

    parseCppCast() {
        // Parse C++ cast expressions: static_cast<Type>(expression)
        const castType = this.currentToken.value; // static_cast, dynamic_cast, etc.
        this.eat(this.currentToken.type);
        
        // Parse template argument: <Type>
        this.eat('LT');
        const targetType = this.parseType();
        this.eatTemplateClose(); // Handle > or >> (split into two >)
        
        // Parse the expression to cast: (expression)
        this.eat('LPAREN');
        const expression = this.parseExpression();
        this.eat('RPAREN');
        
        return {
            type: 'CppCastNode',
            castType: castType,
            targetType: targetType,
            expression: expression
        };
    }
    parseCastExpression() {
        this.eat('LPAREN');
        
        // Parse the cast type, which can include type modifiers, multi-word types and pointers
        let castType = '';
        
        // Handle type modifiers first: const, volatile
        while (['CONST', 'VOLATILE'].includes(this.currentToken.type)) {
            castType += this.currentToken.value + ' ';
            this.eat(this.currentToken.type);
        }
        
        // Now parse the main type
        castType += this.currentToken.value;
        const mainType = this.currentToken.type;
        this.eat(this.currentToken.type);
        
        // Handle multi-word types: unsigned long, long long, etc.
        if (mainType === 'UNSIGNED' && ['LONG', 'INT', 'SHORT', 'CHAR'].includes(this.currentToken.type)) {
            castType += ' ' + this.currentToken.value;
            this.eat(this.currentToken.type);
            // Handle triple-word types: unsigned long int
            if (this.currentToken.type === 'INT') {
                castType += ' ' + this.currentToken.value;
                this.eat(this.currentToken.type);
            }
        } else if (mainType === 'LONG' && this.currentToken.type === 'LONG') {
            castType += ' ' + this.currentToken.value;
            this.eat(this.currentToken.type);
            if (this.currentToken.type === 'INT') {
                castType += ' ' + this.currentToken.value;
                this.eat(this.currentToken.type);
            }
        }
        
        // Handle pointer types: *, **, etc.
        while (this.currentToken.type === 'MUL') {
            castType += '*';
            this.eat('MUL');
        }
        
        this.eat('RPAREN');
        const operand = this.parseUnaryExpression();
        return { type: 'CastExpression', castType, operand };
    }

    parseArrayInitializer() {
        this.eat('LBRACE');
        const elements = [];
        if (this.currentToken.type !== 'RBRACE') {
            elements.push(this.parseInitializerElement());
            while (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
                if (this.currentToken.type === 'RBRACE') break;
                elements.push(this.parseInitializerElement());
            }
        }
        this.eat('RBRACE');
        return { type: 'ArrayInitializerNode', elements };
    }
    
    parseInitializerElement() {
        // Check for designated initializer: .fieldName = value
        if (this.currentToken.type === 'DOT') {
            this.eat('DOT');
            const fieldName = this.currentToken.value;
            this.eat('IDENTIFIER');
            this.eat('ASSIGN');
            const value = this.parseAssignmentExpression();
            return {
                type: 'DesignatedInitializerNode',
                field: { type: 'IdentifierNode', value: fieldName },
                value: value
            };
        }
        
        // Regular assignment expression (avoid comma operator issues)
        return this.parseAssignmentExpression();
    }

    parseFunctionCall(callee) {
        this.eat('LPAREN');
        const args = [];
        if (this.currentToken.type !== 'RPAREN') {
            args.push(this.parseAssignmentExpression());
            while (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
                args.push(this.parseAssignmentExpression());
            }
        }
        this.eat('RPAREN');
        return { type: 'FuncCallNode', callee, arguments: args };
    }
    
    parseConstructorCall(typeValue) {
        const callee = { type: 'IdentifierNode', value: typeValue };
        this.eat('LPAREN');
        const args = [];
        if (this.currentToken.type !== 'RPAREN') {
            args.push(this.parseAssignmentExpression());
            while (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
                args.push(this.parseAssignmentExpression());
            }
        }
        this.eat('RPAREN');
        return { type: 'ConstructorCallNode', callee: callee, arguments: args };
    }

    parseFunctionDefinition() {
        let storageClass = '';
        
        // Handle storage class specifiers like 'static'
        if (['STATIC', 'EXTERN', 'VOLATILE'].includes(this.currentToken.type)) {
            storageClass = this.currentToken.value;
            this.eat(this.currentToken.type);
        }
        
        // Handle type modifiers like 'const', 'volatile'
        let typeModifiers = '';
        while (['CONST', 'VOLATILE'].includes(this.currentToken.type)) {
            typeModifiers += this.currentToken.value + ' ';
            this.eat(this.currentToken.type);
        }
        
        // Parse return type (handle pointer types like int*)
        let returnTypeValue = this.currentToken.value;
        this.eat(this.currentToken.type);
        
        // Handle pointer types: check for * after the base type
        while (this.currentToken.type === 'MUL') {
            returnTypeValue += '*';
            this.eat('MUL');
        }
        
        // Combine all parts
        let fullReturnType = '';
        if (storageClass) fullReturnType += storageClass + ' ';
        if (typeModifiers) fullReturnType += typeModifiers;
        fullReturnType += returnTypeValue;
        
        const typeNode = { type: 'TypeNode', value: fullReturnType.trim() };
        
        const declarator = { type: 'DeclaratorNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        const parameters = this.parseParameterList();
        const body = this.parseCompoundStatement();
        return { type: 'FuncDefNode', returnType: typeNode, declarator, parameters, body };
    }

    parseConstructorDefinition() {
        // Parse Class::Constructor(params) { body }
        
        // Parse the class name
        const className = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        
        // Parse the scope resolution operator
        this.eat('SCOPE');
        
        // Parse the constructor name (should match class name)
        const constructorName = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        
        // Parse parameters
        const parameters = this.parseParameterList();
        
        // Handle optional initializer list: : member1(value1), member2(value2)
        let initializerList = [];
        if (this.currentToken.type === 'COLON') {
            this.eat('COLON');
            
            // Parse member initializers
            do {
                const memberName = { type: 'IdentifierNode', value: this.currentToken.value };
                this.eat('IDENTIFIER');
                this.eat('LPAREN');
                const initValue = this.parseExpression();
                this.eat('RPAREN');
                
                initializerList.push({
                    type: 'MemberInitializer',
                    member: memberName,
                    value: initValue
                });
                
                if (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                } else {
                    break;
                }
            } while (true);
        }
        
        // Parse constructor body
        const body = this.parseCompoundStatement();
        
        return {
            type: 'ConstructorDefinition',
            className: className,
            constructorName: constructorName,
            parameters: parameters,
            initializerList: initializerList,
            body: body
        };
    }

    parseScopedFunctionDefinition() {
        // Parse Class::Method(params) { body } or Class::~Destructor(params) { body }
        
        // Parse the class name
        const className = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        
        // Parse the scope resolution operator
        this.eat('SCOPE');
        
        // Check if it's a destructor
        let isDestructor = false;
        if (this.currentToken.type === 'BITWISE_NOT') {
            isDestructor = true;
            this.eat('BITWISE_NOT');
        }
        
        // Parse the method/constructor/destructor name
        const methodName = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        
        // Parse parameters
        const parameters = this.parseParameterList();
        
        // Handle optional initializer list for constructors: : member1(value1), member2(value2)
        let initializerList = [];
        if (!isDestructor && this.currentToken.type === 'COLON') {
            this.eat('COLON');
            
            // Parse member initializers
            do {
                const memberName = { type: 'IdentifierNode', value: this.currentToken.value };
                this.eat('IDENTIFIER');
                this.eat('LPAREN');
                const initValue = this.parseExpression();
                this.eat('RPAREN');
                
                initializerList.push({
                    type: 'MemberInitializer',
                    member: memberName,
                    value: initValue
                });
            } while (this.currentToken.type === 'COMMA' && (this.advanceToken(), true));
        }
        
        // Parse function body
        const body = this.parseCompoundStatement();
        
        if (isDestructor) {
            return {
                type: 'DestructorDefinition',
                className: className,
                destructorName: methodName,
                parameters: parameters,
                body: body
            };
        } else {
            // Could be constructor or regular method
            return {
                type: 'ScopedFunctionDefinition',
                className: className,
                methodName: methodName,
                parameters: parameters,
                initializerList: initializerList,
                body: body
            };
        }
    }

    parseScopedMethodDefinition() {
        // Parse returnType ClassName::MethodName(params) { body } or returnType ClassName::~DestructorName(params) { body }
        
        // Parse the return type
        const returnType = this.parseType();
        
        // Parse the class name
        const className = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        
        // Parse the scope resolution operator
        this.eat('SCOPE');
        
        // Check if it's a destructor
        let isDestructor = false;
        if (this.currentToken.type === 'BITWISE_NOT') {
            isDestructor = true;
            this.eat('BITWISE_NOT');
        }
        
        // Parse the method/destructor name
        const methodName = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        
        // Parse parameters
        const parameters = this.parseParameterList();
        
        // Handle optional initializer list for constructors (not applicable to destructors or regular methods)
        let initializerList = [];
        
        // Parse function body
        const body = this.parseCompoundStatement();
        
        if (isDestructor) {
            return {
                type: 'ScopedDestructorDefinition',
                returnType: returnType,
                className: className,
                destructorName: methodName,
                parameters: parameters,
                body: body
            };
        } else {
            return {
                type: 'ScopedMethodDefinition',
                returnType: returnType,
                className: className,
                methodName: methodName,
                parameters: parameters,
                body: body
            };
        }
    }

    parseParameterList() {
        const params = [];
        this.eat('LPAREN');
        if (this.currentToken.type === 'RPAREN') {
            this.eat('RPAREN');
            return params;
        }

        params.push(this.parseParameter());
        while (this.currentToken.type === 'COMMA') {
            this.eat('COMMA');
            
            // Check for variadic parameter: ... 
            if (this.currentToken.type === 'ELLIPSIS') {
                this.eat('ELLIPSIS');
                params.push({ type: 'VariadicParameter', name: '...' });
                break; // Ellipsis must be the last parameter
            } else {
                params.push(this.parseParameter());
            }
        }

        this.eat('RPAREN');
        return params;
    }

    parseParameter() {
        // Parse the parameter type - can be a keyword type or an identifier type (like uint8_t)
        let typeValue = this.currentToken.value;
        const currentType = this.currentToken.type;
        

        // Validate that this is actually a valid type in parameter context
        if (!isValidType(currentType, 'parameter') && !isTypeModifier(currentType) && !isStorageClass(currentType)) {
            throw new Error(`Expected type in parameter, but found '${this.currentToken.value}' (${currentType}) at line ${this.currentToken.line}, column ${this.currentToken.column}`);
        }
        // Handle composite types and type modifiers
        if (['UNSIGNED', 'SIGNED', 'CONST', 'VOLATILE', 'STATIC'].includes(currentType)) {
            typeValue += ' ';
            this.eat(currentType);
            // Add the next part of the type
            if (this.currentToken.type !== 'RPAREN' && this.currentToken.type !== 'COMMA') {
                typeValue += this.currentToken.value;
                this.eat(this.currentToken.type);
            }
        } else {
            // Single token type (including IDENTIFIER types like uint8_t)
            this.eat(currentType);
        }
        
        // Handle pointer types: char*, int*, etc.
        let pointerLevel = 0;
        while (this.currentToken.type === 'MUL') {
            this.eat('MUL');
            typeValue += '*';
            pointerLevel++;
        }
        
        // Handle reference types: char&, int&, etc.
        let isReference = false;
        if (this.currentToken.type === 'AMPERSAND') {
            this.eat('AMPERSAND');
            typeValue += '&';
            isReference = true;
        }
        
        const typeNode = { 
            type: 'TypeNode', 
            value: typeValue, 
            isPointer: pointerLevel > 0, 
            pointerLevel: pointerLevel
        };
        
        // Only add isReference field if it's actually true (for backward compatibility)
        if (isReference) {
            typeNode.isReference = isReference;
        }
        
        // Handle function pointer parameters: type (*name)(args)
        if (this.currentToken.type === 'LPAREN' && this.peekToken.type === 'MUL') {
            this.eat('LPAREN');
            this.eat('MUL');
            const name = this.currentToken.value;
            this.eat('IDENTIFIER');
            this.eat('RPAREN');
            
            // Parse the function signature: (arg1, arg2, ...)
            const parameters = this.parseParameterList();
            
            const declarator = { 
                type: 'FunctionPointerDeclaratorNode', 
                identifier: { type: 'IdentifierNode', value: name },
                parameters: parameters 
            };
            return { type: 'ParamNode', paramType: typeNode, declarator: declarator };
        }
        
        // Handle regular parameters - parameter name is optional (for function pointer signatures)
        if (this.currentToken.type === 'IDENTIFIER') {
            const declarator = { type: 'DeclaratorNode', value: this.currentToken.value };
            this.eat('IDENTIFIER');
            
            // Handle array parameters: paramName[size]
            if (this.currentToken.type === 'LBRACKET') {
                this.eat('LBRACKET');
                let arraySize = null;
                if (this.currentToken.type !== 'RBRACKET') {
                    arraySize = this.parseExpression();
                }
                this.eat('RBRACKET');
                
                // Convert declarator to array declarator using consistent format
                declarator.type = 'ArrayDeclaratorNode';
                declarator.identifier = { type: 'IdentifierNode', value: declarator.value };
                declarator.dimensions = [arraySize];
                delete declarator.value; // Remove the old value field
            }
            
            // Handle default parameter values: paramName = defaultValue
            const result = { type: 'ParamNode', paramType: typeNode, declarator: declarator };
            if (this.currentToken.type === 'ASSIGN') {
                this.eat('ASSIGN');
                result.defaultValue = this.parseExpression();
            }
            
            return result;
        } else {
            // Parameter without name (just type) - create anonymous declarator
            return { type: 'ParamNode', paramType: typeNode, declarator: { type: 'DeclaratorNode', value: '' } };
        }
    }

    // 12. Updated parseVariableDeclaration to handle pointers and storage classes
    parseVariableDeclaration(expectSemicolon = true) {
        let typeValue = '';
        let isPointer = false;
        let pointerLevel = 0;

        // Handle storage class specifiers (STATIC, EXTERN, PROGMEM)
        if (['STATIC', 'EXTERN', 'PROGMEM'].includes(this.currentToken.type)) {
            const storageClass = this.currentToken.value;
            this.eat(this.currentToken.type);
            typeValue += storageClass + ' ';
        }
        
        // Handle type qualifiers separately (VOLATILE, CONST)
        if (this.currentToken.type === 'VOLATILE') {
            this.eat('VOLATILE');
            typeValue += 'volatile ';
        }
        
        // Handle constexpr modifier
        if (this.currentToken.type === 'CONSTEXPR') {
            this.eat('CONSTEXPR');
            typeValue += 'constexpr ';
        }
        
        if (this.currentToken.type === 'CONST') {
            this.eat('CONST');
            typeValue += 'const ';
        }
        
        // Handle PROGMEM that appears after const: const PROGMEM type
        if (this.currentToken.type === 'PROGMEM') {
            this.eat('PROGMEM');
            typeValue += 'PROGMEM ';
        }
        
        if (this.currentToken.type === 'UNSIGNED') {
            this.eat('UNSIGNED');
            typeValue += 'unsigned ';
        }

        if (this.currentToken.type === 'STRUCT') {
            const structType = this.parseStructDeclaration(); // This is just for the name
            typeValue += 'struct ' + (structType.name || '');
        } else if (this.currentToken.type === 'DECLTYPE') {
            // Handle decltype(expression) as type specifier
            this.eat('DECLTYPE');
            typeValue += 'decltype';
            this.eat('LPAREN');
            typeValue += '(';
            
            // Parse the expression inside decltype
            const expr = this.parseExpression();
            if (expr && expr.type) {
                typeValue += expr.value || 'expr';
            }
            
            this.eat('RPAREN');
            typeValue += ')';
        } else {
            // Append the base type(s) - handle multi-word types like "long int"
            typeValue += this.currentToken.value;
            this.eat(this.currentToken.type);
            
            // Handle namespace qualification: namespace::TypeName
            if (this.currentToken.type === 'SCOPE') {
                this.eat('SCOPE'); // ::
                typeValue += '::';
                typeValue += this.currentToken.value;
                this.eat('IDENTIFIER');
            }
            
            // Handle template instantiation: ClassName<Type> or ClassName<>
            if (this.currentToken.type === 'LT') {
                this.eat('LT'); // <
                typeValue += '<';
                
                // Parse template arguments (can be empty for <>)
                if (this.currentToken.type !== 'GT') {
                    const firstArg = this.parseTemplateArgument();
                    if (firstArg.type === 'TypeNode') {
                        typeValue += firstArg.value;
                    } else {
                        typeValue += firstArg.value || 'unknown';
                    }
                    
                    while (this.currentToken.type === 'COMMA') {
                        this.eat('COMMA');
                        typeValue += ', ';
                        const arg = this.parseTemplateArgument();
                        if (arg.type === 'TypeNode') {
                            typeValue += arg.value;
                        } else {
                            typeValue += arg.value || 'unknown';
                        }
                    }
                }
                
                this.eatTemplateClose(); // Handle > or >> (split into two >)
                typeValue += '>';
            }
            
            // Check for additional type words (e.g., "long int", "long long")
            if (['LONG', 'INT', 'SHORT', 'CHAR', 'DOUBLE'].includes(this.currentToken.type)) {
                typeValue += ' ' + this.currentToken.value;
                this.eat(this.currentToken.type);
            }
        }
        
        // Handle const after the base type (e.g., "int const")
        if (this.currentToken.type === 'CONST') {
            this.eat('CONST');
            typeValue += ' const';
        }
        
        // Handle pointer declarators
        while (this.currentToken.type === 'MUL') {
            isPointer = true;
            pointerLevel++;
            this.eat('MUL');
        }
        
        if (isPointer) {
            typeValue += ' ' + '*'.repeat(pointerLevel);
        }
        
        // Handle reference declarators
        let isReference = false;
        if (this.currentToken.type === 'AMPERSAND') {
            isReference = true;
            this.eat('AMPERSAND');
            typeValue += '&';
        }
        
        const typeNode = { type: 'TypeNode', value: typeValue.trim(), isPointer, pointerLevel, isReference };
        
        const declarations = [];
        declarations.push(this.parseVariableDeclarator(typeValue));
        
        while (this.currentToken.type === 'COMMA') {
            this.eat('COMMA');
            declarations.push(this.parseVariableDeclarator(typeValue));
        }
        
        if (expectSemicolon) {
            // Check if we encounter a LBRACE instead of SEMICOLON (function definition case)
            if (this.currentToken.type === 'LBRACE') {
                // This is likely a function definition that was misidentified as a variable declaration
                // Skip the function body to recover
                let braceDepth = 1;
                this.advanceToken(); // consume opening brace
                while (braceDepth > 0 && this.currentToken.type !== 'EOF') {
                    if (this.currentToken.type === 'LBRACE') {
                        braceDepth++;
                    } else if (this.currentToken.type === 'RBRACE') {
                        braceDepth--;
                    }
                    this.advanceToken();
                }
                // Return the parsed variable declaration as-is; the function body was skipped
                return { type: 'VarDeclNode', varType: typeNode, declarations };
            } else if (this.currentToken.type === 'RETURN') {
                // RETURN found where semicolon expected - likely malformed code
                // Skip to next semicolon or brace for error recovery
                while (this.currentToken.type !== 'EOF' && 
                       this.currentToken.type !== 'SEMICOLON' && 
                       this.currentToken.type !== 'RBRACE') {
                    this.advanceToken();
                }
                if (this.currentToken.type === 'SEMICOLON') {
                    this.advanceToken();
                }
                return { type: 'VarDeclNode', varType: typeNode, declarations };
            } else {
                this.eat('SEMICOLON');
            }
        }
        
        return { type: 'VarDeclNode', varType: typeNode, declarations };
    }
    
    parseVariableDeclarator(typeValue = null) {
        const declarator = this.parseDeclarator();
        let initializer = null;
        if (this.currentToken.type === 'ASSIGN') {
            this.eat('ASSIGN');
            // Check for problematic tokens in expression context
            if (['PRIVATE', 'PUBLIC', 'PROTECTED', 'RETURN'].includes(this.currentToken.type)) {
                // Skip problematic token and continue
                this.advanceToken();
                // Try to find next valid expression or give up
                if (['SEMICOLON', 'COMMA', 'RBRACE'].includes(this.currentToken.type)) {
                    initializer = null; // No valid initializer found
                } else {
                    try {
                        initializer = this.parseExpression();
                    } catch (e) {
                        initializer = null; // Give up on initializer
                    }
                }
            } else {
                initializer = this.parseExpression();
            }
        } else if (this.currentToken.type === 'LPAREN') {
            initializer = this.parseConstructorCall(typeValue);
        }
        return { declarator, initializer };
    }
    
    parseDeclarator() {
        // Handle PROGMEM that appears before the identifier: PROGMEM identifier
        let hasProgmemPrefix = false;
        if (this.currentToken.type === 'PROGMEM') {
            hasProgmemPrefix = true;
            this.eat('PROGMEM');
        }
        
        // Handle function pointer syntax: (*functionName)
        if (this.currentToken.type === 'LPAREN' && this.peekToken.type === 'MUL') {
            this.eat('LPAREN');
            this.eat('MUL');
            const identifier = { type: 'IdentifierNode', value: this.currentToken.value };
            this.eat('IDENTIFIER');
            this.eat('RPAREN');
            
            // Now handle the function parameter list if it exists
            if (this.currentToken.type === 'LPAREN') {
                const parameters = this.parseParameterList();
                return { 
                    type: 'FunctionPointerDeclaratorNode', 
                    identifier: identifier, 
                    parameters: parameters 
                };
            }
            
            return { type: 'PointerDeclaratorNode', identifier: identifier };
        }
        
        // Handle regular pointer declarators: *identifier
        if (this.currentToken.type === 'MUL') {
            this.eat('MUL');
            if (this.currentToken.type === 'IDENTIFIER') {
                const identifier = { type: 'IdentifierNode', value: this.currentToken.value };
                this.eat('IDENTIFIER');
                return { type: 'PointerDeclaratorNode', identifier: identifier };
            } else {
                throw new Error(`Parsing Error on line ${this.currentToken.line}: Expected identifier after *`);
            }
        }
        
        // Handle regular identifiers
        if (this.currentToken.type !== 'IDENTIFIER') {
            throw new Error(`Parsing Error on line ${this.currentToken.line}: Expected identifier in declarator`);
        }
        
        const identifier = { type: 'IdentifierNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');

        const dimensions = [];
        while (this.currentToken.type === 'LBRACKET') {
            this.eat('LBRACKET');
            let size = null;
            if (this.currentToken.type !== 'RBRACKET') {
                size = this.parseExpression();
            }
            this.eat('RBRACKET');
            dimensions.push(size);
        }
        
        // Check for PROGMEM after array declaration: const char array[] PROGMEM = ...
        let hasProgmem = false;
        if (this.currentToken.type === 'PROGMEM') {
            hasProgmem = true;
            this.eat('PROGMEM');
        }
        
        if (dimensions.length > 0) {
            const arrayNode = { 
                type: 'ArrayDeclaratorNode', 
                identifier: identifier, 
                dimensions: dimensions,
                hasProgmem: hasProgmem || hasProgmemPrefix
            };
            return arrayNode;
        }

        const declaratorNode = { type: 'DeclaratorNode', value: identifier.value };
        if (hasProgmem || hasProgmemPrefix) {
            declaratorNode.hasProgmem = true;
        }
        return declaratorNode;
    }

    /**
     * Main parsing method that converts Arduino/C++ source code into an Abstract Syntax Tree
     * 
     * @returns {Object} ProgramNode containing the parsed AST with children array
     * @description Parses the entire program by processing top-level statements until EOF.
     *              Includes error recovery to continue parsing after syntax errors.
     */
    parse() {
        const programNode = { type: 'ProgramNode', children: [] };        
        while (this.currentToken.type !== 'EOF') {
            try {
                const statement = this.parseTopLevelStatement();
                if (statement !== null && statement !== undefined) {
                    programNode.children.push(statement);
                }
            } catch (e) {
                // Only log errors in verbose mode to reduce console noise
                if (this.options && this.options.verbose) {
                    console.error(e);
                }
                programNode.children.push({ type: 'ErrorNode', value: e.message });
                // Attempt to recover by advancing to the next semicolon or brace
                while (this.currentToken.type !== 'EOF' && this.currentToken.type !== 'SEMICOLON' && this.currentToken.type !== 'RBRACE') {
                    this.advanceToken();
                }
                if (this.currentToken.type === 'SEMICOLON' || this.currentToken.type === 'RBRACE') {
                    this.advanceToken();
                }
            }
        }
        return programNode;
    }

    /**
     * Determines if a statement is a constructor call vs function declaration
     * Examples:
     * - Constructor call: LiquidCrystal lcd(12, 11, 5, 4);
     * - Function decl:    int myFunction(int x, float y);
     */
    isConstructorCall() {
        // Save current parser state
        const savedPosition = this.position;
        const savedChar = this.currentChar;
        const savedLine = this.line;
        const savedColumn = this.column;
        const savedCurrent = this.currentToken;
        const savedPeek = this.peekToken;
        const savedPeek2 = this.peekToken2;
        
        try {
            // Skip past type and identifier to the opening parenthesis
            this.advanceToken(); // skip type (e.g., LiquidCrystal)
            this.advanceToken(); // skip identifier (e.g., lcd)
            this.advanceToken(); // skip LPAREN
            
            // If we immediately see RPAREN, it could be either (empty constructor or void function)
            if (this.currentToken.type === 'RPAREN') {
                // Look ahead to see what follows
                this.advanceToken(); // skip RPAREN
                // If followed by semicolon, it's a constructor call
                // If followed by brace, it's a function definition
                return this.currentToken.type === 'SEMICOLON';
            }
            
            // Look at the first token inside parentheses
            const firstTokenType = this.currentToken.type;
            
            // If it's a type keyword followed by an identifier, it's likely a function parameter
            // e.g., (int x, float y) - function parameters
            // Use more specific type checking to avoid confusing constructor args with function params
            const isExplicitType = TYPE_CATEGORIES.FUNDAMENTAL.includes(firstTokenType) ||
                                   TYPE_CATEGORIES.FIXED_WIDTH.includes(firstTokenType) ||
                                   TYPE_CATEGORIES.STDLIB.includes(firstTokenType) ||
                                   TYPE_CATEGORIES.ARDUINO.includes(firstTokenType) ||
                                   TYPE_CATEGORIES.MODIFIERS.includes(firstTokenType);
            
            if (isExplicitType) {
                this.advanceToken();
                if (this.currentToken.type === 'IDENTIFIER') {
                    return false; // This is a function parameter list
                }
            }
            
            // Check for type identifiers (like uint8_t) followed by parameter names
            // e.g., (uint8_t x, bool flag) - function parameters with type identifiers
            if (firstTokenType === 'IDENTIFIER') {
                const possibleTypeName = this.currentToken.value;
                this.advanceToken();
                
                // If the identifier looks like a type (ends with _t, or is followed by another identifier)
                if (this.currentToken.type === 'IDENTIFIER' || 
                    possibleTypeName?.match(/^(uint|int)\d+_t$/)) {
                    return false; // This is a function parameter list
                }
                
                // If it's just a single identifier followed by comma/rparen, could be constructor arg
                if (['COMMA', 'RPAREN'].includes(this.currentToken.type)) {
                    return true; // Likely constructor argument
                }
            }
            
            // If it's a number, constant, or expression, it's likely a constructor argument
            // e.g., (12, 11, 5, 4) - constructor arguments
            if (['NUMBER', 'HEX_NUMBER', 'OCTAL_NUMBER', 'BINARY_NUMBER', 'FLOAT_NUMBER', 'STRING_LITERAL', 'CHAR_LITERAL', 'HIGH', 'LOW', 'TRUE', 'FALSE'].includes(firstTokenType)) {
                return true; // This is a constructor call
            }
            
            // Default to function definition if we're not sure
            return false;
            
        } finally {
            // Restore parser state
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;
        }
    }

    isFunctionDeclaration() {
        // Save current parser state
        const savedPosition = this.position;
        const savedChar = this.currentChar;
        const savedLine = this.line;
        const savedColumn = this.column;
        const savedCurrent = this.currentToken;
        const savedPeek = this.peekToken;
        const savedPeek2 = this.peekToken2;
        
        try {
            // Skip past type and identifier to the opening parenthesis
            this.advanceToken(); // skip type (e.g., void)
            this.advanceToken(); // skip identifier (e.g., pulse)
            this.advanceToken(); // skip LPAREN
            
            // Skip through the parameter list to find the closing parenthesis
            let parenDepth = 1;
            while (parenDepth > 0 && this.currentToken.type !== 'EOF') {
                if (this.currentToken.type === 'LPAREN') {
                    parenDepth++;
                } else if (this.currentToken.type === 'RPAREN') {
                    parenDepth--;
                }
                if (parenDepth > 0) {
                    this.advanceToken();
                }
            }
            
            // Now check what follows the closing parenthesis
            if (this.currentToken.type === 'RPAREN') {
                this.advanceToken(); // skip RPAREN
                // If followed by semicolon, it's a function declaration
                // If followed by brace, it's a function definition
                return this.currentToken.type === 'SEMICOLON';
            }
            
            return false;
            
        } catch (e) {
            return false;
            
        } finally {
            // Restore parser state
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;
        }
    }

    parseFunctionDeclaration() {
        let storageClass = '';
        
        // Handle storage class specifiers like 'static'
        if (['STATIC', 'EXTERN', 'VOLATILE'].includes(this.currentToken.type)) {
            storageClass = this.currentToken.value;
            this.eat(this.currentToken.type);
        }
        
        // Handle type modifiers like 'const', 'volatile'
        let typeModifiers = '';
        while (['CONST', 'VOLATILE'].includes(this.currentToken.type)) {
            typeModifiers += this.currentToken.value + ' ';
            this.eat(this.currentToken.type);
        }
        
        // Parse return type
        let returnTypeValue = this.currentToken.value;
        this.eat(this.currentToken.type);
        
        // Handle pointer types: check for * after the base type
        while (this.currentToken.type === 'MUL') {
            returnTypeValue += '*';
            this.eat('MUL');
        }
        
        // Combine all parts
        let fullReturnType = '';
        if (storageClass) fullReturnType += storageClass + ' ';
        if (typeModifiers) fullReturnType += typeModifiers;
        fullReturnType += returnTypeValue;
        
        const typeNode = { type: 'TypeNode', value: fullReturnType.trim() };
        
        const declarator = { type: 'DeclaratorNode', value: this.currentToken.value };
        this.eat('IDENTIFIER');
        const parameters = this.parseParameterList();
        this.eat('SEMICOLON'); // Function declarations end with semicolon
        
        return { type: 'FuncDeclNode', returnType: typeNode, declarator, parameters };
    }
    
    // Helper methods for class parsing
    addError(message) {
        // Only log errors in verbose mode to reduce console noise
        if (this.options && this.options.verbose) {
            console.error(`Parser Error: ${message}`);
        }
    }
    
    skipToNext(tokenTypes) {
        while (this.currentToken.type !== 'EOF' && !tokenTypes.includes(this.currentToken.type)) {
            this.advanceToken();
        }
    }
    
    parseBlock() {
        return this.parseCompoundStatement();
    }

    parseClassDeclaration() {
        this.eat('CLASS');
        const className = this.currentToken.value;
        this.eat('IDENTIFIER');
        
        // Handle inheritance: class Derived : public Base
        let baseClasses = [];
        if (this.currentToken.type === 'COLON') {
            this.eat('COLON');
            
            do {
                // Parse access specifier (public, private, protected)
                let accessSpecifier = 'private'; // Default for classes
                if (['PUBLIC', 'PRIVATE', 'PROTECTED'].includes(this.currentToken.type)) {
                    accessSpecifier = this.currentToken.value;
                    this.eat(this.currentToken.type);
                }
                
                // Parse base class name
                const baseClassName = this.currentToken.value;
                this.eat('IDENTIFIER');
                
                baseClasses.push({
                    type: 'BaseClass',
                    name: baseClassName,
                    accessSpecifier: accessSpecifier
                });
                
                // Handle multiple inheritance: class Derived : public Base1, private Base2
                if (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                } else {
                    break;
                }
            } while (this.currentToken.type === 'PUBLIC' || 
                     this.currentToken.type === 'PRIVATE' || 
                     this.currentToken.type === 'PROTECTED' ||
                     this.currentToken.type === 'IDENTIFIER');
        }
        
        this.eat('LBRACE');
        
        const members = [];
        let currentAccessSpecifier = 'private'; // Classes default to private in C++
        
        while (this.currentToken.type !== 'RBRACE' && this.currentToken.type !== 'EOF') {
            // Handle access specifiers
            if (['PUBLIC', 'PRIVATE', 'PROTECTED'].includes(this.currentToken.type)) {
                currentAccessSpecifier = this.currentToken.value;
                this.eat(this.currentToken.type);
                this.eat('COLON');
                continue;
            }
            
            try {
                // Parse member (function or variable)
                const member = this.parseClassMember(className, currentAccessSpecifier);
                if (member) {
                    member.accessSpecifier = currentAccessSpecifier;
                    members.push(member);
                }
            } catch (error) {
                // Error recovery - skip to next semicolon or brace
                this.addError(`Error parsing class member: ${error.message}`);
                this.skipToNext(['SEMICOLON', 'RBRACE', 'PUBLIC', 'PRIVATE', 'PROTECTED']);
                if (this.currentToken.type === 'SEMICOLON') {
                    this.advanceToken();
                }
            }
        }
        
        this.eat('RBRACE');
        this.eat('SEMICOLON');
        
        return {
            type: 'ClassDeclaration',
            name: className,
            baseClasses: baseClasses,
            members: members
        };
    }

    parseClassMember(className, accessSpecifier) {
        const currentType = this.currentToken.type;
        const peekType = this.peekToken?.type;
        const peek2Type = this.peekToken2?.type;
        
        // Skip empty statements and extra semicolons
        if (currentType === 'SEMICOLON') {
            this.eat('SEMICOLON');
            return null;
        }
        
        // Check for constructor (same name as class)
        if (currentType === 'IDENTIFIER' && this.currentToken.value === className && peekType === 'LPAREN') {
            return this.parseConstructor(className);
        }
        
        // Check for destructor (~ClassName)
        if (currentType === 'BITWISE_NOT' && peekType === 'IDENTIFIER' && this.peekToken.value === className) {
            // Skip destructor for now - not fully implemented
            this.advanceToken(); // skip ~
            this.advanceToken(); // skip className
            if (this.currentToken.type === 'LPAREN') {
                this.skipToNext(['SEMICOLON', 'LBRACE', 'RBRACE']);
                if (this.currentToken.type === 'SEMICOLON') {
                    this.advanceToken();
                }
            }
            return null;
        }
        
        // Check for member function or function declaration
        const isType = isValidType(currentType, 'any') || isTypeModifier(currentType) || isStorageClass(currentType);
        
        if (isType && peekType === 'IDENTIFIER' && peek2Type === 'LPAREN') {
            return this.parseMemberFunctionOrDeclaration();
        }
        
        // Member variable declaration - with better error handling
        if (isType) {
            try {
                return this.parseVariableDeclaration();
            } catch (e) {
                // If variable declaration fails, skip to next safe point
                this.skipToNext(['SEMICOLON', 'RBRACE', 'PUBLIC', 'PRIVATE', 'PROTECTED']);
                if (this.currentToken.type === 'SEMICOLON') {
                    this.advanceToken();
                }
                return null;
            }
        }
        
        // Skip unknown tokens more gracefully
        if (this.options && this.options.verbose) {
            console.warn(`Skipping unknown class member token: ${currentType} (${this.currentToken.value}) at line ${this.currentToken.line}`);
        }
        this.advanceToken();
        return null;
    }

    parseConstructor(className) {
        this.eat('IDENTIFIER'); // constructor name (same as class)
        const parameters = this.parseParameterList();
        
        let initializerList = null;
        
        // Handle constructor initializer list: ClassName() : member(value) { ... }
        if (this.currentToken.type === 'COLON') {
            this.eat('COLON');
            initializerList = [];
            
            do {
                const memberName = this.currentToken.value;
                this.eat('IDENTIFIER');
                this.eat('LPAREN');
                const initValue = this.parseExpression();
                this.eat('RPAREN');
                
                initializerList.push({
                    type: 'MemberInitializer',
                    member: memberName,
                    value: initValue
                });
                
                if (this.currentToken.type === 'COMMA') {
                    this.eat('COMMA');
                }
            } while (this.currentToken.type === 'IDENTIFIER');
        }
        
        const body = this.parseBlock();
        
        return {
            type: 'ConstructorDeclaration',
            name: className,
            parameters: parameters,
            initializerList: initializerList,
            body: body
        };
    }

    parseMemberFunctionOrDeclaration() {
        // Parse return type
        const returnType = this.currentToken.value;
        this.eat(this.currentToken.type);
        
        // Parse function name
        const functionName = this.currentToken.value;
        this.eat('IDENTIFIER');
        
        // Parse parameters
        const parameters = this.parseParameterList();
        
        // Handle const member functions: getClockFreq() const { ... }
        let isConst = false;
        if (this.currentToken.type === 'CONST') {
            isConst = true;
            this.eat('CONST');
        }
        
        // Check if it's a declaration (semicolon) or definition (body)
        if (this.currentToken.type === 'SEMICOLON') {
            this.eat('SEMICOLON');
            return {
                type: 'MemberFunctionDeclaration',
                returnType: returnType,
                name: functionName,
                parameters: parameters,
                isConst: isConst,
                body: null // No body for declarations
            };
        } else {
            // Function definition with body
            const body = this.parseBlock();
            return {
                type: 'MemberFunctionDeclaration',
                returnType: returnType,
                name: functionName,
                parameters: parameters,
                isConst: isConst,
                body: body
            };
        }
    }

    parseTemplateDeclaration() {
        this.eat('TEMPLATE');
        this.eat('LT'); // <
        
        const parameters = [];
        
        // Parse template parameters: template<typename T, int N>
        if (this.currentToken.type !== 'GT') {
            parameters.push(this.parseTemplateParameter());
            
            while (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
                parameters.push(this.parseTemplateParameter());
            }
        }
        
        this.eatTemplateClose(); // Handle > or >> (split into two >)
        
        // Parse the templated declaration (class, function, etc.)
        const declaration = this.parseTopLevelStatement();
        
        return {
            type: 'TemplateDeclaration',
            parameters: parameters,
            declaration: declaration
        };
    }

    parseTemplateParameter() {
        if (this.currentToken.type === 'TYPENAME' || this.currentToken.type === 'CLASS') {
            const kind = this.currentToken.value;
            this.eat(this.currentToken.type);
            
            let name = null;
            if (this.currentToken.type === 'IDENTIFIER') {
                name = this.currentToken.value;
                this.eat('IDENTIFIER');
            }
            
            return {
                type: 'TemplateTypeParameter',
                kind: kind,
                name: name
            };
        } else {
            // Non-type template parameter: int N
            const paramType = this.currentToken.value;
            this.eat(this.currentToken.type);
            
            const name = this.currentToken.value;
            this.eat('IDENTIFIER');
            
            return {
                type: 'TemplateValueParameter',
                paramType: paramType,
                name: name
            };
        }
    }

    /**
     * Parses top-level statements in Arduino/C++ programs
     * 
     * @returns {Object} AST node representing the parsed statement
     * @description Determines the type of top-level construct and delegates to appropriate parser.
     *              Handles: functions, variables, classes, structs, typedefs, enums, templates, etc.
     */
    parseTopLevelStatement() {
        const currentType = this.currentToken.type;
        const peekType = this.peekToken.type;
        const peek2Type = this.peekToken2.type;
        
        // Check if current token is a type keyword (used for various parsing decisions)
        // Uses centralized type system for consistency
        const isType = isValidType(currentType, 'any') || isTypeModifier(currentType) || isStorageClass(currentType);
        
        if (currentType === 'STRUCT' && peekType === 'IDENTIFIER' && peek2Type === 'LBRACE') {
            return this.parseStructDeclaration();
        }
        
        if (currentType === 'STRUCT' && peekType === 'IDENTIFIER') {
            // This handles struct variable declarations: struct Point p = {...};
            return this.parseVariableDeclaration();
        }
        
        if (currentType === 'ENUM' && peekType === 'IDENTIFIER' && peek2Type === 'LBRACE') {
            return this.parseEnumDeclaration();
        }
        
        if (currentType === 'ENUM' && peekType === 'LBRACE') {
            // Check if this is an anonymous enum with variable declaration: enum { ... } variable
            if (this.isAnonymousEnumWithVariable()) {
                return this.parseAnonymousEnumWithVariable();
            } else {
                return this.parseEnumDeclaration();
            }
        }
        

        // Handle enum variable declarations: enum TypeName variableName = value;
        if (currentType === 'ENUM' && peekType === 'IDENTIFIER' && peek2Type === 'IDENTIFIER') {
            return this.parseVariableDeclaration();
        }
        if (currentType === 'UNION' && peekType === 'IDENTIFIER' && peek2Type === 'LBRACE') {
            return this.parseUnionDeclaration();
        }
        
        if (currentType === 'UNION' && peekType === 'LBRACE') {
            return this.parseUnionDeclaration();
        }
        
        if (currentType === 'TYPEDEF') {
            return this.parseTypedefDeclaration();
        }
        
        if (currentType === 'CLASS') {
            return this.parseClassDeclaration();
        }
        
        if (currentType === 'TEMPLATE') {
            return this.parseTemplateDeclaration();
        }
        
        if (currentType === 'TEMPLATE') {
            return this.parseTemplateDeclaration();
        }
        
        // Handle modern C++ keywords that start variable declarations
        if (currentType === 'DECLTYPE' || currentType === 'CONSTEXPR') {
            return this.parseVariableDeclaration();
        }

        if (isType && peekType === 'LPAREN' && peek2Type === 'MUL') {
            // Function pointer declaration: type (*name)(...) = ...;
            return this.parseVariableDeclaration();
        }
        
        if (isType && peekType === 'MUL') {
            // Check if this is a pointer function: type* identifier(...) vs pointer variable: type* identifier;
            if (this.peekToken2 && this.peekToken2.type === 'IDENTIFIER') {
                // Look ahead to see if there's an LPAREN after the identifier
                // Need to peek beyond peekToken2 to see the 4th token
                const savedPosition = this.position;
                const savedChar = this.currentChar;
                const savedLine = this.line;
                const savedColumn = this.column;
                const savedCurrent = this.currentToken;
                const savedPeek = this.peekToken;
                const savedPeek2 = this.peekToken2;
                
                try {
                    // Advance to get the token after identifier
                    this.advanceToken(); // skip type (INT)
                    this.advanceToken(); // skip MUL (*)
                    this.advanceToken(); // skip IDENTIFIER
                    // Now currentToken is the token after identifier
                    
                    const isFunction = this.currentToken.type === 'LPAREN';
                    
                    // Restore parser state
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                    
                    if (isFunction) {
                        // This is a pointer function: int* functionName(...)
                        if (this.isFunctionDeclaration()) {
                            return this.parseFunctionDeclaration();
                        } else {
                            return this.parseFunctionDefinition();
                        }
                    }
                } catch (e) {
                    // Restore state on any error
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                }
            }
            // Pointer variable declaration: type* identifier = ...;
            return this.parseVariableDeclaration();
        }
        
        // Handle scoped function definitions with return types: returnType ClassName::MethodName(params) { body }
        if (isType && peekType === 'IDENTIFIER' && peek2Type === 'SCOPE') {
            // Look ahead to see if it matches: returnType ClassName::MethodName(...)
            const savedPosition = this.position;
            const savedChar = this.currentChar;
            const savedLine = this.line;
            const savedColumn = this.column;
            const savedCurrent = this.currentToken;
            const savedPeek = this.peekToken;
            const savedPeek2 = this.peekToken2;
            
            try {
                this.advanceToken(); // skip return type
                this.advanceToken(); // skip class name
                this.advanceToken(); // skip ::
                
                // Check if next is method name or destructor
                let isDestructor = false;
                if (this.currentToken.type === 'BITWISE_NOT') {
                    isDestructor = true;
                    this.advanceToken(); // skip ~
                }
                
                // Should have method/destructor name
                if (this.currentToken.type === 'IDENTIFIER') {
                    this.advanceToken(); // skip method name
                    
                    // Should have opening parenthesis
                    if (this.currentToken.type === 'LPAREN') {
                        // This looks like a scoped function definition
                        // Restore state and parse it
                        this.position = savedPosition;
                        this.currentChar = savedChar;
                        this.line = savedLine;
                        this.column = savedColumn;
                        this.currentToken = savedCurrent;
                        this.peekToken = savedPeek;
                        this.peekToken2 = savedPeek2;
                        
                        return this.parseScopedMethodDefinition();
                    }
                }
            } catch (e) {
                // Not a scoped function, restore state
            }
            
            // Restore state and continue with normal parsing
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;
        }
        
        if (isType && peekType === 'IDENTIFIER') {
            if (peek2Type === 'LPAREN') {
                // Need to distinguish between function definition and constructor call
                // Function def: int myFunc(int x, float y) { ... }
                // Constructor call: LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
                
                // Look ahead to see what's inside the parentheses
                if (this.isConstructorCall()) {
                    return this.parseVariableDeclaration();
                } else if (this.isFunctionDeclaration()) {
                    return this.parseFunctionDeclaration();
                } else {
                    return this.parseFunctionDefinition();
                }
            } else if (isStorageClass(currentType) && peek2Type === 'IDENTIFIER') {
                // Handle storage class patterns: static type identifier(...)
                // Need to look ahead one more token to see if there are parentheses
                const savedPosition = this.position;
                const savedChar = this.currentChar;
                const savedLine = this.line;
                const savedColumn = this.column;
                const savedCurrent = this.currentToken;
                const savedPeek = this.peekToken;
                const savedPeek2 = this.peekToken2;
                
                try {
                    this.advanceToken(); // skip storage class
                    this.advanceToken(); // skip type
                    this.advanceToken(); // skip identifier
                    
                    if (this.currentToken.type === 'LPAREN') {
                        // This is a function definition with storage class
                        // Restore state and parse as function
                        this.position = savedPosition;
                        this.currentChar = savedChar;
                        this.line = savedLine;
                        this.column = savedColumn;
                        this.currentToken = savedCurrent;
                        this.peekToken = savedPeek;
                        this.peekToken2 = savedPeek2;
                        
                        return this.parseFunctionDefinition();
                    }
                } catch (e) {
                    // On error, fall through to variable declaration
                }
                
                // Restore state and parse as variable declaration
                this.position = savedPosition;
                this.currentChar = savedChar;
                this.line = savedLine;
                this.column = savedColumn;
                this.currentToken = savedCurrent;
                this.peekToken = savedPeek;
                this.peekToken2 = savedPeek2;
                
                return this.parseVariableDeclaration();
            } else {
                return this.parseVariableDeclaration();
            }
        } 
        // Check for template instantiation: TypeName<...> identifier  
        else if (isType && peekType === 'LT') {
            return this.parseVariableDeclaration();
        }
        // Check for namespace-qualified template: namespace::TypeName<...> identifier
        else if (currentType === 'IDENTIFIER' && peekType === 'SCOPE' && peek2Type === 'IDENTIFIER' && this.isNamespaceQualifiedVariableDeclaration()) {
            return this.parseVariableDeclaration();
        }
        else if (currentType === 'UNSIGNED' && ['INT', 'LONG', 'FLOAT', 'CHAR', 'SHORT'].includes(peekType)) {
            // Handle two-word types: unsigned long/int identifier
            if (peek2Type === 'IDENTIFIER') {
                return this.parseVariableDeclaration();
            }
            // Handle three-word types: unsigned long int identifier
            if (peekType === 'LONG' && peek2Type === 'INT') {
                // Need to check the token after 'INT' for identifier
                const savedPosition = this.position;
                const savedChar = this.currentChar;
                const savedLine = this.line;
                const savedColumn = this.column;
                const savedCurrent = this.currentToken;
                const savedPeek = this.peekToken;
                const savedPeek2 = this.peekToken2;
                
                try {
                    // Advance to check token after INT
                    this.advanceToken(); // skip UNSIGNED
                    this.advanceToken(); // skip LONG  
                    this.advanceToken(); // skip INT
                    const isIdentifier = this.currentToken.type === 'IDENTIFIER';
                    
                    // Restore parser state
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                    
                    if (isIdentifier) {
                        return this.parseVariableDeclaration();
                    }
                } catch (e) {
                    // Restore parser state on any error
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                }
            }
        }
        else if (currentType === 'LONG' && ['INT', 'DOUBLE'].includes(peekType)) {
            // Handle two-word types starting with LONG: long int, long double
            if (peek2Type === 'IDENTIFIER') {
                return this.parseVariableDeclaration();
            }
        }
        else if (isValidType(currentType, 'declaration') && peekType === 'CONST' && peek2Type === 'IDENTIFIER') {
            return this.parseVariableDeclaration();
        }
        else if (currentType === 'CONST') {
            // Need to look ahead to distinguish const variable vs const function
            const savedPosition = this.position;
            const savedChar = this.currentChar;
            const savedLine = this.line;
            const savedColumn = this.column;
            const savedCurrent = this.currentToken;
            const savedPeek = this.peekToken;
            const savedPeek2 = this.peekToken2;
            
            try {
                // Parse through: const type [*] identifier
                this.advanceToken(); // move past CONST
                
                // Skip the type (could be multi-word like "unsigned int")
                if (isValidType(this.currentToken.type, 'declaration')) {
                    this.advanceToken();
                    
                    // Handle multi-word types
                    if (this.currentToken.type === 'LONG' || this.currentToken.type === 'INT' || this.currentToken.type === 'SHORT') {
                        this.advanceToken();
                    }
                }
                
                // Skip pointer asterisks
                while (this.currentToken.type === 'MUL') {
                    this.advanceToken();
                }
                
                // Now we should be at the identifier
                if (this.currentToken.type === 'IDENTIFIER') {
                    this.advanceToken();
                    // Check if followed by parentheses (function) or not (variable)
                    if (this.currentToken.type === 'LPAREN') {
                        // Restore state and parse as function
                        this.position = savedPosition;
                        this.currentChar = savedChar;
                        this.line = savedLine;
                        this.column = savedColumn;
                        this.currentToken = savedCurrent;
                        this.peekToken = savedPeek;
                        this.peekToken2 = savedPeek2;
                        return this.parseFunctionDefinition();
                    }
                }
            } catch (e) {
                // On any error, fall through to variable declaration
            }
            
            // Restore state and parse as variable declaration
            this.position = savedPosition;
            this.currentChar = savedChar;
            this.line = savedLine;
            this.column = savedColumn;
            this.currentToken = savedCurrent;
            this.peekToken = savedPeek;
            this.peekToken2 = savedPeek2;
            return this.parseVariableDeclaration();
        }
        // Check for extern declarations: extern type identifier
        else if (currentType === 'EXTERN' && 
                 (isValidType(peekType, 'declaration') || isTypeModifier(peekType))) {
            return this.parseVariableDeclaration();
        }
        // Check for static declarations: static type identifier  
        else if (currentType === 'STATIC') {
            return this.parseVariableDeclaration();
        }
        // Check for volatile declarations: volatile type ...
        else if (currentType === 'VOLATILE') {
            return this.parseVariableDeclaration();
        }
        // Check for signed declarations: signed type ...
        else if (currentType === 'SIGNED') {
            return this.parseVariableDeclaration();
        }
        // Check for PROGMEM declarations: PROGMEM type ...
        else if (currentType === 'PROGMEM' && 
                 (isValidType(peekType, 'declaration') || isTypeModifier(peekType))) {
            return this.parseVariableDeclaration();
        }
        // Handle C++ specifiers that can appear at top level
        else if (['VIRTUAL', 'INLINE', 'EXPLICIT', 'CONSTEXPR'].includes(currentType)) {
            // These are function/class specifiers - parse as function definition
            return this.parseFunctionDefinition();
        }
        // Handle auto type declarations: auto variable = ...
        else if (currentType === 'AUTO') {
            return this.parseVariableDeclaration();
        }
        // Handle C++ access specifiers that appear outside class context (skip them)
        else if (['PUBLIC', 'PRIVATE', 'PROTECTED'].includes(currentType)) {
            this.advanceToken(); // Skip the access specifier
            if (this.currentToken.type === 'COLON') {
                this.advanceToken(); // Skip the colon
            }
            // Return a comment node to indicate we skipped this
            return { type: 'CommentNode', value: `Skipped ${currentType.toLowerCase()} access specifier` };
        }
        // Handle stray braces and other tokens that appear from error recovery
        else if (['RBRACE', 'SEMICOLON', 'RETURN'].includes(currentType)) {
            this.advanceToken(); // Skip the stray token
            return { type: 'CommentNode', value: `Skipped stray ${currentType.toLowerCase()}` };
        }
        // Preprocessor directives should not appear in preprocessed code
        else if (currentType === 'PreprocessorDirective') {
            throw new Error(`Unexpected preprocessor directive: ${this.currentToken.value}. All preprocessor directives should be handled before parsing.`);
        }
        // Handle constructor/destructor definitions with scope resolution: Class::Constructor(params) { body } or Class::~Constructor(params) { body }
        else if (currentType === 'IDENTIFIER' && peekType === 'SCOPE' && (peek2Type === 'IDENTIFIER' || peek2Type === 'BITWISE_NOT')) {
            // Look ahead to see if it's a constructor definition (has parentheses and braces)
            const savedPosition = this.position;
            const savedChar = this.currentChar;
            const savedLine = this.line;
            const savedColumn = this.column;
            const savedCurrent = this.currentToken;
            const savedPeek = this.peekToken;
            const savedPeek2 = this.peekToken2;
            
            try {
                // Advance past Class::Constructor or Class::~Constructor to check for parentheses
                this.advanceToken(); // skip Class
                this.advanceToken(); // skip ::
                
                // Check if it's a destructor (has ~)
                const isDestructor = this.currentToken.type === 'BITWISE_NOT';
                if (isDestructor) {
                    this.advanceToken(); // skip ~
                    // Ensure we have a destructor name after ~
                    if (this.currentToken.type !== 'IDENTIFIER') {
                        throw new Error('Expected destructor name after ~');
                    }
                }
                this.advanceToken(); // skip Constructor/Destructor name
                
                if (this.currentToken.type === 'LPAREN') {
                    // This looks like a constructor definition
                    // Restore state and parse as constructor
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                    
                    return this.parseScopedFunctionDefinition();
                } else {
                    // Not a constructor definition, restore and parse as expression
                    this.position = savedPosition;
                    this.currentChar = savedChar;
                    this.line = savedLine;
                    this.column = savedColumn;
                    this.currentToken = savedCurrent;
                    this.peekToken = savedPeek;
                    this.peekToken2 = savedPeek2;
                    
                    const expressionNode = this.parseExpression();
                    this.eat('SEMICOLON');
                    return { type: 'ExpressionStatement', expression: expressionNode };
                }
            } catch (e) {
                // Restore state on any error and treat as expression
                this.position = savedPosition;
                this.currentChar = savedChar;
                this.line = savedLine;
                this.column = savedColumn;
                this.currentToken = savedCurrent;
                this.peekToken = savedPeek;
                this.peekToken2 = savedPeek2;
                
                const expressionNode = this.parseExpression();
                this.eat('SEMICOLON');
                return { type: 'ExpressionStatement', expression: expressionNode };
            }
        }
        // Handle control flow statements at top level (for script-like code)
        else if (['WHILE', 'FOR', 'IF', 'DO'].includes(currentType)) {
            return this.parseStatement();
        }
        // Handle expression statements at top level (like assignments)
        else if (currentType === 'IDENTIFIER') {
            const expressionNode = this.parseExpression();
            this.eat('SEMICOLON');
            return { type: 'ExpressionStatement', expression: expressionNode };
        }
        // Handle pointer dereference assignments at top level: *ptr = value;
        else if (currentType === 'MUL') {
            const expressionNode = this.parseExpression();
            this.eat('SEMICOLON');
            return { type: 'ExpressionStatement', expression: expressionNode };
        }
        // Handle prefix operators at top level: --y; ++x;
        else if (['MINUS_MINUS', 'PLUS_PLUS', 'NOT', 'BITWISE_NOT'].includes(currentType)) {
            const expressionNode = this.parseExpression();
            this.eat('SEMICOLON');
            return { type: 'ExpressionStatement', expression: expressionNode };
        }
        else {
            throw new Error(`Parser Error on line ${this.currentToken.line}: Unexpected token ${currentType} at top level`);
        }
    }
}

/**
 * Main parse function for Arduino/C++ source code
 * 
 * @param {string} code - The Arduino/C++ source code to parse
 * @param {Object} options - Parser configuration options
 * @param {boolean} [options.verbose=false] - Enable verbose output with analysis and suggestions
 * @param {boolean} [options.throwOnError=false] - Throw errors instead of graceful recovery  
 * @param {boolean} [options.includePreprocessor=false] - Include preprocessor directives in AST
 * @param {boolean} [options.recognizeArduinoFunctions=false] - Recognize Arduino-specific functions
 * @returns {Object} Abstract Syntax Tree (AST) representing the parsed code
 * @description Primary entry point for parsing Arduino/C++ code. Provides error recovery,
 *              detailed analysis when verbose is enabled, and comprehensive Arduino support.
 */
function parse(code, options = {}) {
    const { verbose = false, throwOnError = false, includePreprocessor = false, recognizeArduinoFunctions = false, webFriendlyMode = false, enablePreprocessor = true, platformContext = null } = options;
    
    try {
        let processedCode = code;
        let preprocessorResult = null;
        
        // Apply Arduino Preprocessing if available and enabled
        const ArduinoPreprocessorClass = getArduinoPreprocessor();
        if (enablePreprocessor && ArduinoPreprocessorClass) {
            try {
                const preprocessor = new ArduinoPreprocessorClass({
                    verbose: verbose,
                    debug: false,
                    platformContext: platformContext
                });
                
                preprocessorResult = preprocessor.preprocess(code);
                processedCode = preprocessorResult.processedCode;
                
                if (verbose) {
                    conditionalLog(verbose, '✅ Arduino Preprocessing completed:');
                    conditionalLog(verbose, `   📊 Macros defined: ${Object.keys(preprocessorResult.macros || {}).length}`);
                    conditionalLog(verbose, `   📚 Active libraries: ${preprocessorResult.activeLibraries?.length || 0}`);
                    conditionalLog(verbose, `   🔧 Library constants: ${Object.keys(preprocessorResult.libraryConstants || {}).length}`);
                    
                    if (preprocessorResult.activeLibraries?.length > 0) {
                        conditionalLog(verbose, `   📦 Libraries: ${preprocessorResult.activeLibraries.join(', ')}`);
                    }
                }
            } catch (preprocessorError) {
                if (verbose) {
                    console.warn('⚠️  Preprocessor error, using original code:', preprocessorError.message);
                }
                // Continue with original code if preprocessing fails
                processedCode = code;
            }
        }
        
        // Create parser with preprocessor directives disabled (they've already been processed)
        const parserOptions = { ...options, includePreprocessor: false };
        const parser = new Parser(processedCode, parserOptions);
        const ast = parser.parse();
        
        // Attach preprocessor results to AST if available
        if (preprocessorResult) {
            ast.preprocessorInfo = {
                activeLibraries: preprocessorResult.activeLibraries || [],
                macros: preprocessorResult.macros || {},
                functionMacros: preprocessorResult.functionMacros || {},
                libraryConstants: preprocessorResult.libraryConstants || {}
            };
        }
        
        // Check for any ErrorNodes in the result
        const errors = [];
        function collectErrors(node) {
            if (node && typeof node === 'object') {
                if (node.type === 'ErrorNode') {
                    errors.push(node.value);
                }
                for (const key in node) {
                    if (Array.isArray(node[key])) {
                        node[key].forEach(collectErrors);
                    } else if (typeof node[key] === 'object') {
                        collectErrors(node[key]);
                    }
                }
            }
        }
        collectErrors(ast);
        
        if (verbose || errors.length > 0) {
            const totalNodes = countNodes(ast);
            const successRate = errors.length === 0 ? 100 : Math.max(0, ((totalNodes - errors.length) / totalNodes * 100));
            
            conditionalLog(verbose || errors.length > 0, `\n🔍 Parser Analysis (v${PARSER_VERSION}):`);
            conditionalLog(verbose || errors.length > 0, `   📊 Success Rate: ${successRate.toFixed(1)}%`);
            conditionalLog(verbose || errors.length > 0, `   ✅ Successful Nodes: ${totalNodes - errors.length}`);
            conditionalLog(verbose || errors.length > 0, `   ❌ Error Nodes: ${errors.length}`);
            
            if (errors.length > 0) {
                conditionalLog(verbose || errors.length > 0, `\n🚨 Parsing Issues Found:`);
                errors.forEach((error, i) => {
                    conditionalLog(verbose || errors.length > 0, `   ${i + 1}. ${error}`);
                });
                
                conditionalLog(verbose || errors.length > 0, `\n💡 Suggestions:`);
                if (errors.some(e => e.includes('Unexpected token'))) {
                    conditionalLog(verbose || errors.length > 0, `   • Check for missing semicolons or braces`);
                }
                if (errors.some(e => e.includes('Expected token'))) {
                    conditionalLog(verbose || errors.length > 0, `   • Verify syntax matches C++ standards`);
                }
                if (errors.some(e => e.includes('function') || e.includes('LBRACE'))) {
                    conditionalLog(verbose || errors.length > 0, `   • Check function declarations vs definitions`);
                }
                conditionalLog(verbose || errors.length > 0, `   • Consider updating to latest parser version`);
            }
        }
        
        return ast;
        
    } catch (e) {
        const errorMsg = createDetailedErrorMessage(e, code);
        
        if (verbose) {
            console.error(`\n💥 Critical Parser Error (v${PARSER_VERSION}):`);
            console.error(`   ${errorMsg}`);
            console.error(`\n🔧 Recovery Suggestions:`);
            console.error(`   • Check for syntax errors near the reported line`);
            console.error(`   • Ensure all braces and parentheses are balanced`);
            console.error(`   • Verify that all statements end with semicolons`);
            console.error(`   • Consider breaking complex expressions into simpler parts`);
        }
        
        if (throwOnError) {
            throw new Error(errorMsg);
        }
        
        return { 
            type: 'ProgramNode', 
            children: [{ 
                type: 'ErrorNode', 
                value: errorMsg,
                severity: 'critical',
                suggestions: [
                    'Check syntax near the error location',
                    'Ensure balanced braces and parentheses',
                    'Verify semicolon placement'
                ]
            }] 
        };
    }
}

function createDetailedErrorMessage(error, code) {
    const lines = code.split('\n');
    const lineMatch = error.message.match(/line (\d+)/);
    
    if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]);
        const contextStart = Math.max(0, lineNum - 3);
        const contextEnd = Math.min(lines.length, lineNum + 2);
        
        let context = '\n📍 Code Context:\n';
        for (let i = contextStart; i < contextEnd; i++) {
            const marker = i === lineNum - 1 ? '>>> ' : '    ';
            const lineNumStr = (i + 1).toString().padStart(3, ' ');
            context += `${marker}${lineNumStr}: ${lines[i] || '(empty)'}\n`;
        }
        
        return error.message + context;
    }
    
    return error.message;
}

function countNodes(node) {
    if (!node || typeof node !== 'object') return 0;
    
    let count = 1;
    for (const key in node) {
        if (Array.isArray(node[key])) {
            count += node[key].reduce((sum, item) => sum + countNodes(item), 0);
        } else if (typeof node[key] === 'object') {
            count += countNodes(node[key]);
        }
    }
    return count;
}

// =============================================================================
// COMPACT AST EXPORT SYSTEM  
// =============================================================================

/**
 * Export AST in compact binary format for C++ consumption
 * Follows Compact AST Binary Format Specification v1.0
 * 
 * @param {Object} ast - The AST root node
 * @param {Object} options - Export options
 * @returns {ArrayBuffer} - Binary AST data
 */
// CompactAST functionality is imported from CompactAST library above
// exportCompactAST function is available if CompactAST library is present

// CompactASTExporter class moved to libs/CompactAST/src/CompactAST.js
// The complete CompactASTExporter implementation is now in the separate CompactAST library
// CompactASTExporter class implementation removed - now in CompactAST library
function prettyPrintAST(node, indent = '') {
    // ... (rest of the prettyPrintAST function is unchanged) ...
    if (!node) return '';
    let output = indent + `└── ${node.type}`;
    if (node.value !== undefined && typeof node.value !== 'object') {
        output += ` (${JSON.stringify(node.value)})`;
    }
    if (node.op) {
        output += ` (${JSON.stringify(node.op.value)})`;
    }
    if (node.operator) {
        output += ` (${JSON.stringify(node.operator)})`;
    }
    output += '\n';

    const newIndent = indent + '    ';
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            output += prettyPrintAST(node.children[i], newIndent);
        }
    }

    const namedChildren = {
        'VarDeclNode': ['varType', 'declarations'],
        'FuncDefNode': ['returnType', 'declarator', 'parameters', 'body'],
        'FuncCallNode': ['callee', 'arguments'],
        'FunctionStyleCastNode': ['argument'],
        'IfStatement': ['condition', 'consequent', 'alternate'],
        'WhileStatement': ['condition', 'body'],
        'DoWhileStatement': ['body', 'condition'], // Added
        'ForStatement': ['initializer', 'condition', 'increment', 'body'],
        'RangeBasedForStatement': ['declaration', 'range', 'body'],
        'SwitchStatement': ['discriminant', 'cases'],
        'CaseStatement': ['test', 'consequent'],
        'RangeExpression': ['start', 'end'],
        'BinaryOpNode': ['left', 'right'],
        'AssignmentNode': ['left', 'right'], // Removed operator from here, it's on the node
        'ExpressionStatement': ['expression'],
        'MemberAccessNode': ['object', 'property'],
        'NamespaceAccessNode': ['namespace', 'member'],
        'UnaryOpNode': ['operand'], // Removed op from here, it's on the node
        'ParamNode': ['paramType', 'declarator', 'defaultValue'],
        'ArrayDeclaratorNode': ['identifier', 'dimensions'],
        'FunctionPointerDeclaratorNode': ['identifier', 'parameters'],
        'PointerDeclaratorNode': ['identifier'],
        'ArrayAccessNode': ['identifier', 'index'],
        'ConstructorCallNode': ['callee', 'arguments'],
        'ArrayInitializerNode': ['elements'],
        'DesignatedInitializerNode': ['field', 'value'],
        'PostfixExpressionNode': ['operand', 'op'],
        'ReturnStatement': ['value'],
        'CastExpression': ['castType', 'operand'],
        'NewExpression': ['allocationType', 'size', 'arguments'],
        'TernaryExpression': ['condition', 'consequent', 'alternate'], // Added
        'StructDeclaration': ['name', 'members'], // Added
        'StructMember': ['memberType', 'declarator', 'bitField'], // Added
        'MultipleStructMembers': ['memberType', 'declarations'], // Added
        'EnumDeclaration': ['name', 'members'], // Added
        'EnumMember': ['name', 'value'], // Added
        'AnonymousEnumWithVariable': ['members', 'variable'], // Added
        'UnionDeclaration': ['name', 'members', 'variables'], // Added
        // PreprocessorDirective removed - preprocessing now happens before parsing
        'SizeofExpression': ['operand'], // Added
        'TypeNode': ['templateArgs'], // Added for template support
        'ContinueStatement': [],
        'ConstructorDefinition': ['className', 'constructorName', 'parameters', 'initializerList', 'body'], // Added
        'MemberInitializer': ['member', 'value'] // Added
    };

    if (namedChildren[node.type]) {
        namedChildren[node.type].forEach(key => {
            const child = node[key];
            if (child) {
                if (Array.isArray(child)) {
                    if (child.length > 0) {
                        output += newIndent + `├── ${key}:\n`;
                        child.forEach((item) => {
                            // Special handling for variable declarations only
                            if (typeof item === 'object' && item && item.declarator && key === 'declarations') {
                                const declName = item.declarator.value || item.declarator.identifier?.value || 'unnamed';
                                output += newIndent + '│   ' + `├── declarator: ${declName}\n`;
                                if (item.initializer) {
                                    output += newIndent + '│   ' + `├── initializer:\n`;
                                    output += prettyPrintAST(item.initializer, newIndent + '│   ' + '│   ');
                                }
                            } else {
                                // For all other arrays (like parameters), use normal AST printing
                                output += prettyPrintAST(item, newIndent + '│   ');
                            }
                        });
                    }
                } else if (typeof child === 'object') {
                    if (key === 'body' && child.children && child.children.length === 0) {
                         output += newIndent + `├── ${key}: {}\n`;
                    } else {
                        output += newIndent + `├── ${key}:\n`;
                        output += prettyPrintAST(child, newIndent + '│   ');
                    }
                } else {
                    output += newIndent + `├── ${key}: ${child}\n`;
                }
            }
        });
    }

    return output;
}


// =============================================================================
// UNIVERSAL EXPORTS - Node.js and Browser Compatibility
// =============================================================================

// Browser environment
if (typeof window !== 'undefined') {
    window.Parser = Parser;
    window.parse = parse;
    window.prettyPrintAST = prettyPrintAST;
    
    // CompactAST integration - don't override if already exists
    if (!window.exportCompactAST) {
        if (exportCompactAST) {
            window.exportCompactAST = exportCompactAST;
        } else if (window.CompactAST && window.CompactAST.exportCompactAST) {
            window.exportCompactAST = window.CompactAST.exportCompactAST;
        }
    }
    
    window.PlatformEmulation = PlatformEmulation;
    window.ArduinoPreprocessor = ArduinoPreprocessor;
    window.ESP32_NANO_PLATFORM = ESP32_NANO_PLATFORM;
    window.ARDUINO_UNO_PLATFORM = ARDUINO_UNO_PLATFORM;
    window.LIBRARY_INCLUDES = LIBRARY_INCLUDES;
    window.PARSER_VERSION = PARSER_VERSION;
    window.PLATFORM_EMULATION_VERSION = PLATFORM_EMULATION_VERSION;
    window.PREPROCESSOR_VERSION = PREPROCESSOR_VERSION;
}

// Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Main API
        Parser,
        parse,
        prettyPrintAST,
        // CompactAST integration (if available)
        exportCompactAST,
        
        // Platform Emulation (previously from platform_emulation.js)
        PlatformEmulation,
        ESP32_NANO_PLATFORM,
        ARDUINO_UNO_PLATFORM,
        PLATFORM_EMULATION_VERSION,
        
        // Preprocessor (previously from preprocessor.js)
        ArduinoPreprocessor,
        LIBRARY_INCLUDES,
        PREPROCESSOR_VERSION,
        
        // Version info
        PARSER_VERSION
    };
}