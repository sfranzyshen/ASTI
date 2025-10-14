# Architecture Design

This document outlines the architecture of the ASTInterpreter system, a dual-language (JavaScript and C++) solution for parsing and interpreting Arduino/C++ code.

The system is designed around two primary, high-cohesion modules:

1.  **The Parser (`ArduinoParser.js`)**: An all-in-one module that consumes raw Arduino source code and produces a clean Abstract Syntax Tree (AST).
2.  **The Interpreter (`ASTInterpreter.js` / `ASTInterpreter.cpp`)**: An execution engine that consumes an AST and produces a hardware-agnostic command stream.

## Processing Pipeline

The data flow is a simple, linear pipeline from source code to a command stream:

```
Arduino Code → Parser (Integrated Preprocessor & Platform Context) → AST → Interpreter → Command Stream
     ↓                             ↓                                   ↓         ↓              ↓
  Raw C++        Handles #define, #if, #include, Platform Defines,   Abstract   Hardware    Structured
  Source         and Library Activation Internally                   Syntax     Simulation  Commands
  Code                                                               Tree       Events      for Parent App
```

## Core Components

### 1. The Parser (`ArduinoParser.js`)

This is the entry point for all source code. It is a comprehensive module that fully encapsulates all parsing-related concerns.

-   **Responsibilities**:
    -   **Platform Emulation**: Applies platform-specific defines and configurations based on a simple string (`'ARDUINO_UNO'`, `'ESP32_NANO'`). This is the first logical step internally.
    -   **Preprocessing**: Handles all C++ preprocessor directives, including simple and function-like macros (`#define`), conditional compilation (`#ifdef`, `#if`), and library detection (`#include`).
    -   **Lexical & Syntactic Analysis**: Performs tokenization and parsing of the cleaned code to generate a structured AST.
-   **Input**: Raw Arduino/C++ source code string.
-   **Output**: A clean, preprocessed Abstract Syntax Tree (AST).

### 2. The Interpreter (`ASTInterpreter.js` and `ASTInterpreter.cpp`)

The interpreter is the execution engine. It exists in two parallel implementations (JavaScript and C++) that share the same fundamental design.

-   **Responsibilities**:
    -   **AST Traversal**: Walks the AST provided by the parser.
    -   **State Management**: Manages global and local variable state using a stack-based scope manager.
    -   **Hardware Simulation**: Simulates Arduino hardware functions (`pinMode`, `digitalWrite`, `delay`, `millis`, etc.) by emitting commands.
    -   **Execution Flow Control**: Correctly executes the `setup()` function once and the `loop()` function repeatedly.
    -   **Library Simulation**: Provides interfaces for simulating common Arduino libraries (Servo, NeoPixel, etc.).
-   **Input**: An Abstract Syntax Tree (AST).
-   **Output**: A stream of structured, serializable commands.

## Data Formats

### Abstract Syntax Tree (AST)

The AST is a standard JSON-like tree structure representing the code's syntax. It is the common language that connects the Parser and the Interpreter.

### Command Stream

This is the final output of the system. It is a series of simple JSON objects, each representing a single hardware action. This design decouples the interpreter from any specific hardware, allowing a parent application to consume these commands and drive a real or virtual device.

```javascript
// Example Command
{ 
  type: 'DIGITAL_WRITE', 
  pin: 13, 
  value: 1 
}
```
