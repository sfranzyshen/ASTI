# Interpreter Architecture

This document describes the architecture of the AST interpreter component of the project. The interpreter's role is to execute an Abstract Syntax Tree (AST) and translate it into a series of hardware-level commands. 

This component has two parallel implementations with a shared design:

-   **`ASTInterpreter.js`**: A mature, feature-rich interpreter for Node.js and browser environments.
-   **`ASTInterpreter.cpp`**: A C++ implementation designed for performance and portability, intended to match the behavior of the JavaScript version.

## Core Responsibilities

The interpreter is responsible for the following tasks:

1.  **AST Traversal**: It walks the nodes of the AST provided by the parser.
    -   The C++ version uses the classic Visitor design pattern.
    -   The JavaScript version uses an asynchronous traversal method.

2.  **Execution Flow Control**: It correctly simulates the Arduino program lifecycle by executing the `setup()` function once, followed by the `loop()` function continuously, up to a configurable limit.

3.  **State Management**: It manages the program's state, including global and local variables, using a stack-based scope manager (`ScopeManager`). This ensures that variables are created and accessed according to C++ scoping rules.

4.  **Hardware & Library Simulation**: It simulates calls to standard Arduino functions (`pinMode`, `digitalWrite`, `delay`) and library functions (`Servo.write`, `NeoPixel.show`) by generating commands.

5.  **Command Generation**: Its primary output is a stream of simple, serializable JSON objects that represent hardware actions. This decouples the interpreter from the hardware itself.

## Key Architectural Components

-   **Interpreter Class (`ASTInterpreter` / `ASTInterpreter`)**: The main engine that orchestrates the entire execution process.

-   **Scope Manager**: A stack-based data structure that holds all declared variables. When a new scope (e.g., a function call) is entered, a new map is pushed onto the stack. When the scope is exited, the map is popped.

-   **Command Protocol**: A defined set of command objects that represent all possible hardware interactions. This is the public API of the interpreter.

-   **Library Interface**: A mechanism for handling calls to library functions. 
    -   In JavaScript, this is a rich, data-driven system (`ARDUINO_LIBRARIES`) that can simulate dozens of methods from popular libraries.
    -   In C++, this is the `ArduinoLibraryInterface` class, which provides a basic framework for this functionality.

-   **Cross-Platform Architecture**: The project uses different internal approaches for C++ and JavaScript while maintaining identical external behavior:

## Current Architecture Approach (October 2025)

### C++ Synchronous Architecture
The C++ interpreter uses a straightforward synchronous blocking pattern:
- External data functions call SyncDataProvider interface methods directly (e.g., `dataProvider_->getDigitalReadValue(pin)`)
- Execution blocks until parent app provides value through the provider
- No async state machine or suspension mechanism (removed in Phase 3 cleanup)
- Fail-fast ConfigurationError if provider not injected
- Production code uses `syncMode` only for clean synchronous execution

**Example Implementation**:
```cpp
// src/cpp/ASTInterpreter.cpp (lines 4611-4617)
if (!dataProvider_) {
    emitError("digitalRead() called without SyncDataProvider - parent app must inject data source",
              "ConfigurationError");
    return -1;  // Sentinel value
}
return dataProvider_->getDigitalReadValue(pin);
```

### JavaScript Asynchronous Architecture
The JavaScript interpreter uses Promise-based async/await for non-blocking execution:
- External data functions emit REQUEST commands (e.g., DIGITAL_READ_REQUEST)
- `await waitForResponse(requestId, 5000)` pauses execution without blocking UI thread
- Parent app calls `handleResponse(requestId, value)` to resume execution
- Fail-fast ConfigurationError on 5000ms timeout
- State preservation maintains step/resume debugging workflow

**Example Implementation**:
```javascript
// src/javascript/ASTInterpreter.js (lines 7243-7252)
try {
    const response = await this.waitForResponse(requestId, 5000);
    return response.value;
} catch (error) {
    this.emitError('digitalRead() timeout - parent app must respond within 5000ms',
                   'ConfigurationError');
    return -1;  // Sentinel value
}
```

### Cross-Platform Compatibility
Despite different internal approaches, both produce identical command streams validated through automated cross-platform testing (`validate_cross_platform` tool maintains 100% parity)

For complete architecture documentation, see `docs/SYNCHRONOUS_VS_ASYNC_ARCHITECTURE.md`
