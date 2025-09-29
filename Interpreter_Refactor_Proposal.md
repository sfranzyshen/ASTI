# Proposal: Refactoring FlexibleCommand & CommandProtocol into a Production-Quality System

## Current Issues
- Hardcoded function names and long `if/else` chains in the interpreter (unscalable).
- Function calls represented as strings (`argumentStrings`) lose type information.
- Tight coupling between interpreter logic and command serialization.
- Ad-hoc async handling and command emission.

## Industry Context
This problem is best described as:
- Building a **table-driven command dispatcher (function registry)** with a proper **FFI-style binding layer**.
- Related concepts:
  - **Command Dispatcher / Function Registry**: Routes function names to handlers.
  - **Command Processor**: Manages lifecycle, queuing, orchestration (complementary role).
  - **Command Pattern (GoF)**: Encapsulating function calls as command objects.

## Proposed Refactor

### 1. Introduce Function Registry / Dispatch Table
- Create a central `FunctionRegistry` mapping function names → handler functions.
- Each handler accepts `std::vector<CommandValue>` arguments and returns a `HandlerResult`.

### 2. Typed Argument Handling
- Replace `std::vector<std::string>` with `std::vector<CommandValue>` in `FunctionCallCommand`.
- Maintain a temporary adapter for backward compatibility.

### 3. Separate Emission from Execution
- Handlers can return:
  - Immediate results (`HandlerResult::IMMEDIATE`).
  - Async requests (`HandlerResult::EMIT_AND_WAIT`).
  - Errors.

### 4. Simplify Serialization
- Each command type implements `toKV()` → serializer builds JSON without large `switch`/`dynamic_cast` blocks.

### 5. Migration Plan
1. Add `FunctionRegistry` with a few functions (Serial, pinMode, digitalWrite, map).
2. Update `FunctionCallCommand` to use typed arguments but keep string adapter.
3. Convert more handlers incrementally.
4. Replace serializer with `toKV()` system.
5. Remove adapters once migration is complete.

### 6. Testing & Production Practices
- Unit tests for each function handler.
- Serializer round-trip tests (Command → JSON → Command).
- CI with cross-compilation for embedded targets.
- Fuzz tests for AST → Interpreter → Command pipeline.

## Example Code Sketch

```cpp
// FunctionRegistry.hpp
using FunctionHandler = std::function<HandlerResult(const std::vector<CommandValue>&)>;

class FunctionRegistry {
public:
    void registerFunction(const std::string& name, FunctionHandler handler);
    bool hasFunction(const std::string& name) const;
    HandlerResult callFunction(const std::string& name, const std::vector<CommandValue>& args) const;
private:
    std::unordered_map<std::string, FunctionHandler> handlers_;
};
```

```cpp
// Example registration
functionRegistry.registerFunction("digitalWrite",
    [](const std::vector<CommandValue>& args)->HandlerResult {
        if (args.size() < 2) return HandlerResult::error("digitalWrite requires 2 args");
        int pin = convertToInt(args[0]);
        int val = convertToInt(args[1]);
        emitCommand(CommandFactory::createDigitalWrite(pin, val ? DigitalValue::HIGH : DigitalValue::LOW));
        return HandlerResult::immediate(std::monostate{});
    });
```

---

## Executive Summary
We are replacing a brittle prototype with a **table-driven command dispatcher and typed FFI binding system**.  
This shifts the interpreter from a “Rube Goldberg machine” to a clean, extensible, production-grade architecture.
