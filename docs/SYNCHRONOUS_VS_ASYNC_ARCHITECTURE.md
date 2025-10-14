# Cross-Platform Architecture: Synchronous C++ vs Async JavaScript

## Overview

This document describes the Arduino AST Interpreter's cross-platform architecture, focusing on how the C++ and JavaScript implementations use **different internal approaches** to achieve **identical external behavior** and command stream output.

**Key Principle**: Different implementations, same results.

---

## Table of Contents

1. [Architecture Summary](#architecture-summary)
2. [C++ Synchronous Architecture](#c-synchronous-architecture)
3. [JavaScript Asynchronous Architecture](#javascript-asynchronous-architecture)
4. [Cross-Platform Compatibility](#cross-platform-compatibility)
5. [Parent App Integration](#parent-app-integration)
6. [Command Stream Examples](#command-stream-examples)
7. [Migration History](#migration-history)

---

## Architecture Summary

### Current Architecture (October 2025)

The interpreter uses **two distinct internal architectures** that produce identical command streams:

| Aspect | C++ Implementation | JavaScript Implementation |
|--------|-------------------|---------------------------|
| **Pattern** | Synchronous blocking | Asynchronous promises |
| **Data Flow** | Direct function call | REQUEST → RESPONSE protocol |
| **Execution** | Blocks until value returned | Awaits with timeout |
| **Error Handling** | Immediate ConfigurationError | Timeout ConfigurationError |
| **State Machine** | None (removed) | None (promise-based) |
| **Parent API** | SyncDataProvider interface | handleResponse() method |

### Why Different Approaches?

- **C++**: Designed for embedded/performance environments where synchronous blocking is acceptable and efficient
- **JavaScript**: Designed for browser/Node.js where async is required to prevent UI thread blocking
- **Both**: Validated through comprehensive cross-platform testing maintaining 100% command stream parity

---

## C++ Synchronous Architecture

### Design Philosophy

The C++ interpreter uses a **straightforward synchronous blocking pattern** with no async state machine or suspension mechanism. When external data is needed, the interpreter directly calls a provider interface and **blocks until the value is returned**.

### SyncDataProvider Interface

Parent applications must implement the `SyncDataProvider` interface:

```cpp
// src/cpp/SyncDataProvider.hpp

class SyncDataProvider {
public:
    virtual ~SyncDataProvider() = default;

    /**
     * Get value for analogRead(pin)
     * Called synchronously when interpreter executes analogRead().
     * Execution blocks until this returns.
     */
    virtual int32_t getAnalogReadValue(int32_t pin) = 0;

    /**
     * Get value for digitalRead(pin)
     * @return Digital value (0=LOW, 1=HIGH)
     */
    virtual int32_t getDigitalReadValue(int32_t pin) = 0;

    /**
     * Get value for millis()
     * @return Milliseconds since program start
     */
    virtual uint32_t getMillisValue() = 0;

    /**
     * Get value for micros()
     * @return Microseconds since program start
     */
    virtual uint32_t getMicrosValue() = 0;

    /**
     * Get value for library sensor methods
     * @return Sensor reading (library-specific)
     */
    virtual int32_t getLibrarySensorValue(const std::string& libraryName,
                                         const std::string& methodName,
                                         int32_t param) = 0;
};
```

### Execution Flow

**Step 1**: Interpreter encounters external data function (e.g., `digitalRead(2)`)

**Step 2**: Emit REQUEST command for command stream consistency:
```cpp
// src/cpp/ASTInterpreter.cpp (line 4609)

emitDigitalReadRequest(pin, requestId);
```

**Step 3**: Check for SyncDataProvider and fail-fast if missing:
```cpp
// src/cpp/ASTInterpreter.cpp (lines 4611-4617)

// Get external value from parent app provider
// Parent app MUST provide SyncDataProvider implementation
if (!dataProvider_) {
    emitError("digitalRead() called without SyncDataProvider - parent app must inject data source",
              "ConfigurationError");
    return -1;  // Sentinel value indicating configuration error
}
return dataProvider_->getDigitalReadValue(pin);
```

**Step 4**: Execution blocks until provider returns value

**Step 5**: Continue with returned value

### Fail-Fast Error Handling

If SyncDataProvider is not injected, the interpreter **immediately emits an ERROR command**:

```json
{
  "type": "ERROR",
  "message": "digitalRead() called without SyncDataProvider - parent app must inject data source",
  "errorType": "ConfigurationError",
  "timestamp": 0
}
```

This **replaces the old silent fallback** (return 0) with **explicit error reporting**.

### No Async State Machine

**Removed in Phase 3 cleanup (September 2025)**:
- ❌ `tick()` method - 153 lines removed
- ❌ `resumeWithValue()` method - 27 lines removed
- ❌ `lastExpressionResult_` variable - Unused in syncMode
- ❌ `ExecutionState::WAITING_FOR_RESPONSE` - Not used in production
- ❌ `suspendedNode_`, `waitingForRequestId_` - Legacy async variables

**Current production code uses syncMode only**, which is a clean synchronous pattern with no state machine complexity.

### Parent App Integration Example

```cpp
// tests/DeterministicDataProvider.hpp

class DeterministicDataProvider : public SyncDataProvider {
public:
    int32_t getDigitalReadValue(int32_t pin) override {
        // Deterministic formula for testing
        return (pin % 2 == 0) ? 1 : 0;
    }

    int32_t getAnalogReadValue(int32_t pin) override {
        // Deterministic formula for testing
        return 512 + (pin * 10);
    }

    uint32_t getMillisValue() override {
        return currentMillis_;
    }

    uint32_t getMicrosValue() override {
        return currentMicros_;
    }

private:
    uint32_t currentMillis_ = 1000;
    uint32_t currentMicros_ = 1000000;
};

// Usage in parent app
auto dataProvider = std::make_unique<DeterministicDataProvider>();
interpreter.setSyncDataProvider(dataProvider.get());
```

---

## JavaScript Asynchronous Architecture

### Design Philosophy

The JavaScript interpreter uses an **asynchronous Promise-based pattern** to prevent blocking the browser UI thread or Node.js event loop. When external data is needed, the interpreter **emits a REQUEST command** and **awaits a response** from the parent application.

### Execution Flow

**Step 1**: Interpreter encounters external data function (e.g., `digitalRead(2)`)

**Step 2**: Generate unique request ID:
```javascript
const requestId = `digitalRead_${Date.now()}_${Math.random()}`;
```

**Step 3**: Emit REQUEST command:
```javascript
// src/javascript/ASTInterpreter.js (lines 7233-7239)

this.emitCommand({
    type: COMMAND_TYPES.DIGITAL_READ_REQUEST,
    pin: pin,
    requestId: requestId,
    timestamp: Date.now()
});
```

**Step 4**: Set execution state for debugging compatibility:
```javascript
// src/javascript/ASTInterpreter.js (lines 7241-7242)

this.previousExecutionState = this.state;
this.state = EXECUTION_STATE.WAITING_FOR_RESPONSE;
this.waitingForRequestId = requestId;
this.suspendedNode = node;
```

**Step 5**: Await response with 5000ms timeout:
```javascript
// src/javascript/ASTInterpreter.js (lines 7243-7252)

try {
    const response = await this.waitForResponse(requestId, 5000);
    return response.value;
} catch (error) {
    this.emitError(
        'digitalRead() timeout - parent app must respond to DIGITAL_READ_REQUEST within 5000ms',
        'ConfigurationError'
    );
    return -1; // Sentinel value indicating configuration error
}
```

**Step 6**: Parent app calls `handleResponse(requestId, value)` to resume execution

**Step 7**: Continue with provided value

### Promise Management System

The interpreter maintains a map of pending requests with timeout handlers:

```javascript
// src/javascript/ASTInterpreter.js

// Promise storage for pending requests
this.pendingRequests = new Map();

// Creates a Promise that resolves when parent app responds
async waitForResponse(requestId, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        // Set up timeout
        const timeout = setTimeout(() => {
            this.pendingRequests.delete(requestId);
            reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        // Store promise handlers
        this.pendingRequests.set(requestId, { resolve, reject, timeout });
    });
}

// Parent app calls this to provide response values
handleResponse(requestId, value, error = null) {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if (error) {
            pending.reject(new Error(error));
        } else {
            pending.resolve({ value });
        }
    }
}
```

### Fail-Fast Error Handling

If parent app doesn't respond within 5000ms, the interpreter **emits an ERROR command**:

```json
{
  "type": "ERROR",
  "message": "digitalRead() timeout - parent app must respond to DIGITAL_READ_REQUEST within 5000ms",
  "errorType": "ConfigurationError",
  "timestamp": 1234567890
}
```

This **replaces the old random fallback** (`Math.random() > 0.5 ? 1 : 0`) with **explicit error reporting**.

### Parent App Integration Example

```javascript
// src/javascript/generate_test_data.js

const interpreter = new ASTInterpreter(ast, {
    onCommand: (command) => {
        commands.push(command);

        // Respond to REQUEST commands
        if (command.type === 'DIGITAL_READ_REQUEST') {
            // Deterministic formula for testing
            const value = (command.pin % 2 === 0) ? 1 : 0;
            interpreter.handleResponse(command.requestId, value);
        }
        else if (command.type === 'ANALOG_READ_REQUEST') {
            // Deterministic formula for testing
            const value = 512 + (command.pin * 10);
            interpreter.handleResponse(command.requestId, value);
        }
        else if (command.type === 'MILLIS_REQUEST') {
            interpreter.handleResponse(command.requestId, mockMillis);
        }
        else if (command.type === 'MICROS_REQUEST') {
            interpreter.handleResponse(command.requestId, mockMicros);
        }
    }
});

await interpreter.start();
```

---

## Cross-Platform Compatibility

### ✅ COMPATIBILITY CONFIRMED

Despite using **completely different internal approaches**, both implementations produce **identical command streams** verified through automated cross-platform testing.

### 1. Identical External Command Protocol

Both implementations emit **exactly the same REQUEST commands**:

**JavaScript**:
```javascript
{
    type: 'DIGITAL_READ_REQUEST',
    pin: 2,
    requestId: 'digitalRead_1693834567890_0.7234567',
    timestamp: 1693834567890
}
```

**C++**:
```cpp
// Produces identical command structure
{
    "type": "DIGITAL_READ_REQUEST",
    "pin": 2,
    "requestId": "digitalRead_static_2",
    "timestamp": 0
}
```

### 2. Identical Command Stream Output

Both produce **identical command sequences** (after normalization of timestamps and requestIds):

```json
[
  {"type": "DIGITAL_READ_REQUEST", "pin": 2, "requestId": "...", "timestamp": 0},
  {"type": "VAR_SET", "variable": "pinValue", "value": 1, "timestamp": 0},
  {"type": "FUNCTION_CALL", "function": "Serial.println", "arguments": ["1"], "timestamp": 0}
]
```

### 3. Cross-Platform Validation

The `validate_cross_platform` tool ensures 100% command stream parity:

```bash
cd build && ./validate_cross_platform 0 75
# Tests processed: 76
# Exact matches: 76
# Success rate: 100%
```

### 4. Request ID Format Compatibility

Both implementations generate compatible request ID formats:

```javascript
// JavaScript: uses Date.now() and Math.random()
requestId = `digitalRead_${Date.now()}_${Math.random()}`;

// C++ equivalent: uses static pin-based IDs in syncMode
requestId = "digitalRead_static_" + std::to_string(pin);
```

The validation tool normalizes these differences, ensuring compatibility.

---

## Parent App Integration

### C++ Parent App Requirements

1. **Implement SyncDataProvider interface**
2. **Inject provider before calling start()**
3. **Provide synchronous blocking values**

```cpp
// Create provider
auto dataProvider = std::make_unique<YourDataProvider>();

// Inject into interpreter
interpreter.setSyncDataProvider(dataProvider.get());

// Start execution (blocks until complete)
interpreter.start();
```

### JavaScript Parent App Requirements

1. **Listen for REQUEST commands in onCommand callback**
2. **Call handleResponse() with appropriate values**
3. **Respond within 5000ms to avoid timeout**

```javascript
const interpreter = new ASTInterpreter(ast, {
    onCommand: (command) => {
        // Handle REQUEST commands
        if (command.type === 'DIGITAL_READ_REQUEST') {
            const value = getDigitalPinValue(command.pin);
            interpreter.handleResponse(command.requestId, value);
        }
        // ... handle other REQUEST types
    }
});

await interpreter.start();
```

---

## Command Stream Examples

### AnalogReadSerial Example

**Arduino Code**:
```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  Serial.print("Sensor: ");
  Serial.println(sensorValue);
  delay(1000);
}
```

**Command Stream (Identical from both implementations)**:
```json
[
  {"type": "SETUP_START", "timestamp": 0},
  {"type": "FUNCTION_CALL", "function": "Serial.begin", "arguments": [9600], "timestamp": 0},
  {"type": "SETUP_END", "timestamp": 0},
  {"type": "LOOP_START", "timestamp": 0},
  {"type": "ANALOG_READ_REQUEST", "pin": 14, "requestId": "...", "timestamp": 0},
  {"type": "VAR_SET", "variable": "sensorValue", "value": 512, "timestamp": 0},
  {"type": "FUNCTION_CALL", "function": "Serial.print", "arguments": ["Sensor: "], "timestamp": 0},
  {"type": "FUNCTION_CALL", "function": "Serial.println", "arguments": ["512"], "timestamp": 0},
  {"type": "DELAY", "duration": 1000, "timestamp": 0},
  {"type": "LOOP_END", "timestamp": 0}
]
```

### BlinkWithoutDelay Example

**Arduino Code**:
```cpp
unsigned long previousMillis = 0;
const long interval = 1000;

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    digitalWrite(LED_BUILTIN, HIGH);
  }
}
```

**Command Stream (Identical from both implementations)**:
```json
[
  {"type": "LOOP_START", "timestamp": 0},
  {"type": "MILLIS_REQUEST", "requestId": "...", "timestamp": 0},
  {"type": "VAR_SET", "variable": "currentMillis", "value": 5000, "timestamp": 0},
  {"type": "IF_STATEMENT", "condition": true, "branch": "then", "timestamp": 0},
  {"type": "VAR_SET", "variable": "previousMillis", "value": 5000, "timestamp": 0},
  {"type": "DIGITAL_WRITE", "pin": 13, "value": 1, "timestamp": 0},
  {"type": "LOOP_END", "timestamp": 0}
]
```

---

## Migration History

### Phase 1-2: Terminology Refactoring (September 2025)

**Commits**: `a0a1250`, `fe6131f`

**Changes**:
- Renamed "mock" terminology to data-agnostic terms
- `MockDataProvider` → `SyncDataProvider`
- `mockValue` → `externalValue`
- Improved semantic clarity

### Phase 3: Async State Machine Removal (September 2025)

**Commit**: `a564812`

**Changes**:
- Removed `tick()` method - 153 lines
- Removed `resumeWithValue()` method - 27 lines
- Removed unused async state machine variables
- Production code uses syncMode only

**Impact**: Cleaner C++ codebase with no unused async complexity

### Phase 4: Fail-Fast Error Handling (October 2025)

**Commits**: `8bea24b` (C++), `2d4624d` (JavaScript)

**Changes**:
- Removed silent fallback values (return 0, random values)
- Added explicit ConfigurationError emission
- Return -1 as sentinel for missing provider/timeout
- Enforces fail-fast principle

**Impact**: Better debugging, clearer error messages, explicit dependency contracts

---

## Conclusion

The Arduino AST Interpreter achieves **100% cross-platform compatibility** through two distinct but equivalent architectural approaches:

**Key Achievements**:
- ✅ **C++ Simplicity**: Synchronous blocking with no state machine complexity
- ✅ **JavaScript Async**: Promise-based non-blocking for UI responsiveness
- ✅ **Command Stream Parity**: Identical external behavior validated through comprehensive testing
- ✅ **Fail-Fast Design**: Explicit errors instead of silent fallbacks
- ✅ **Clear Contracts**: Well-defined parent app integration interfaces

The architectural philosophy: **"Different paths, same destination"** - allowing each platform to use its strengths while maintaining perfect cross-platform compatibility.
