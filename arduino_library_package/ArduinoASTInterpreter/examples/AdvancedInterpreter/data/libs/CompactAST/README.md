# CompactAST - Binary AST Serialization Library

Cross-platform AST binary serialization library with **12.5x compression** for embedded deployment on ESP32-S3 and other resource-constrained environments.

## Features

- **12.5x compression ratio** over JSON format
- **Cross-platform compatibility** (JavaScript ↔ C++)
- **Type-safe number encoding** with INT8/INT16 optimization
- **String deduplication** with UTF-8 support
- **Visitor pattern compatibility** for efficient traversal
- **Complete Arduino AST node type support** (0x01-0x59)
- **Universal module support** (Node.js and browser)

## Installation

### JavaScript (Node.js/Browser)

```javascript
// Node.js
const { exportCompactAST } = require('./src/CompactAST.js');

// Browser
<script src="./src/CompactAST.js"></script>
// Uses window.exportCompactAST
```

### C++

```cpp
#include "CompactAST.hpp"
using namespace arduino_interpreter;
```

## Usage

### JavaScript Export

```javascript
const ast = parse(arduinoCode);
const binaryData = exportCompactAST(ast, {
    version: 0x0100,
    flags: 0x0000
});

// Save binary data to file or send to embedded device
const buffer = Buffer.from(binaryData);
require('fs').writeFileSync('program.ast', buffer);
```

### C++ Import

```cpp
#include "CompactAST.hpp"

// Load binary AST data
std::ifstream file("program.ast", std::ios::binary);
CompactASTReader reader(file);
auto rootNode = reader.readAST();

// Use with interpreter
ASTInterpreter interpreter(rootNode.get());
interpreter.start();
```

## Binary Format

The CompactAST format uses a structured binary layout:

```
Header (16 bytes):
- Magic: 'ASTP' (0x50545341)
- Version: 0x0100
- Flags: 0x0000
- Node Count: uint32
- String Table Size: uint32

String Table:
- Count: uint32
- Strings: [length:uint16][utf8_data][null_terminator]

Node Data:
- For each node: [type:uint8][flags:uint8][data_size:uint16][data]
```

## Node Types

Supports all Arduino AST node types:

| Type | Code | Description |
|------|------|-------------|
| ProgramNode | 0x01 | Root program node |
| VarDeclNode | 0x20 | Variable declaration |
| FuncDefNode | 0x21 | Function definition |
| BinaryOpNode | 0x30 | Binary operation |
| NumberNode | 0x40 | Numeric literal |
| ... | ... | (Complete mapping in source) |

## Performance

- **Space Efficiency**: 12.5x smaller than JSON
- **Type Optimization**: INT8/INT16 for small values (60% space savings)
- **String Deduplication**: Eliminates duplicate strings
- **Memory Safety**: Bounds checking and validation

## Compatibility

- **JavaScript**: Node.js 14+, Modern browsers
- **C++**: C++17 standard, ESP32-S3 toolchain
- **Cross-Platform**: Identical binary format between implementations

## License

MIT License - See parent project for details.