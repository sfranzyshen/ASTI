# ArduinoParser - Arduino C++ Parser Library

Complete Arduino C++ parser with **preprocessor support** and **platform emulation** for parsing real-world Arduino code into clean Abstract Syntax Trees.

## Features

- **Complete C++ Language Support**: Variables, functions, classes, templates, namespaces
- **Arduino-Specific Constructs**: Pin modes, constants, hardware functions
- **Full Preprocessor**: `#define`, `#include`, `#ifdef`, `#ifndef` with macro expansion
- **Platform Emulation**: ESP32-S3 and Arduino Uno platform contexts
- **Clean Architecture**: Preprocessing → Parsing → Clean AST (no preprocessor pollution)
- **Universal Module Support**: Node.js and browser compatible
- **CompactAST Integration**: Binary AST export via CompactAST library
- **Error Recovery**: Continues parsing after syntax errors with detailed error reporting

## Installation

### JavaScript (Node.js/Browser)

```javascript
// Node.js
const { Parser, parse, PlatformEmulation, ArduinoPreprocessor } = require('./src/ArduinoParser.js');

// Browser
<script src="./src/ArduinoParser.js"></script>
// Uses window.Parser, window.parse, etc.
```

## Usage

### Basic Parsing

```javascript
const { parse } = require('@arduino-ast-interpreter/arduino-parser');

const code = `
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}
`;

const ast = parse(code);
console.log(ast);
```

### Platform-Aware Parsing

```javascript
const { parse, PlatformEmulation } = require('@arduino-ast-interpreter/arduino-parser');

// Create platform context
const platform = new PlatformEmulation('ESP32_NANO'); // or 'ARDUINO_UNO'

// Parse with platform awareness
const ast = parse(code, {
    enablePreprocessor: true,
    platformContext: platform
});
```

### Advanced Preprocessing

```javascript
const { ArduinoPreprocessor, PlatformEmulation } = require('@arduino-ast-interpreter/arduino-parser');

const platform = new PlatformEmulation('ESP32_NANO');
const preprocessor = new ArduinoPreprocessor({
    defines: platform.getDefines(),
    libraries: platform.getLibraries()
});

const result = preprocessor.preprocess(`
#define LED_COUNT 60
#ifdef WIFI_SUPPORT
  #include <WiFi.h>
  WiFiClient client;
#endif

void setup() {
    for (int i = 0; i < LED_COUNT; i++) {
        // Process LEDs
    }
}
`);

console.log(result.processedCode); // Clean code ready for parsing
```

### With CompactAST Export

```javascript
const { parse } = require('@arduino-ast-interpreter/arduino-parser');
const { exportCompactAST } = require('@arduino-ast-interpreter/compact-ast');

const ast = parse(arduinoCode);
const binaryData = exportCompactAST(ast);

// Save for embedded deployment
require('fs').writeFileSync('program.ast', Buffer.from(binaryData));
```

## Architecture

### Clean Separation of Concerns

```
Arduino Code → Platform Context → Preprocessor → Parser → Clean AST
```

1. **Platform Emulation**: Provides platform-specific defines and library contexts
2. **Preprocessor**: Handles all `#define`, `#include`, `#ifdef` directives 
3. **Parser**: Processes clean C++ code into structured AST
4. **Clean AST**: No preprocessor artifacts, ready for interpretation

### Supported Language Features

- **Data Types**: `int`, `float`, `double`, `char`, `bool`, `String`, `byte`
- **Control Flow**: `if/else`, `for`, `while`, `do-while`, `switch/case`
- **Functions**: Definitions, calls, parameters, return types
- **Classes**: Declarations, methods, inheritance
- **Templates**: Template instantiations and declarations
- **Pointers & References**: Basic pointer operations
- **Arrays**: Multi-dimensional arrays, initialization
- **Preprocessor**: Complete macro system with conditional compilation

### Platform Support

#### ESP32 Nano (Default)
- **Defines**: `ESP32`, `WIFI_SUPPORT`, `BLUETOOTH_SUPPORT`
- **Libraries**: WiFi, Bluetooth, NeoPixel, Servo
- **Pins**: Complete GPIO mapping
- **Hardware**: 240MHz, 320KB RAM, 4MB Flash

#### Arduino Uno  
- **Defines**: `ARDUINO_UNO`, `AVR_BOARD` 
- **Libraries**: Basic Arduino libraries
- **Pins**: Standard Arduino pin mapping
- **Hardware**: 16MHz, 2KB RAM, 32KB Flash

## Error Handling

The parser implements robust error recovery:

```javascript
const ast = parse(codeWithSyntaxErrors);

// Check for parse errors
if (ast.errors && ast.errors.length > 0) {
    ast.errors.forEach(error => {
        console.log(`Line ${error.line}: ${error.message}`);
    });
}
```

## Performance

- **Fast Parsing**: Recursive descent parser optimized for Arduino code
- **Memory Efficient**: Clean AST representation without preprocessor overhead  
- **Scalable**: Handles large Arduino projects with multiple files
- **CompactAST Ready**: Seamless integration with binary AST export

## Compatibility

- **JavaScript**: Node.js 14+, Modern browsers
- **Arduino Code**: Arduino IDE, PlatformIO, ESP-IDF compatible
- **Preprocessor**: GCC-compatible macro system
- **Standards**: C++17 language features supported

## Dependencies

- `@arduino-ast-interpreter/compact-ast`: Binary AST serialization

## License

MIT License - See parent project for details.