# Design Proposal: The Command Processor Architecture

## 1. Problem Statement: Competing, Flawed Architectures

The C++ codebase contains two parallel, competing, and equally flawed systems for handling commands, leading to significant technical debt and architectural confusion.

### Flaw 1: The `FlexibleCommand.hpp` System

The `FlexibleCommand.hpp` file is not a command execution system. It is a brittle, data-driven but ultimately misused system that has been perverted into a manual JSON serialization engine. Its primary function is to generate a JSON string output that exactly matches the output of the golden-standard JavaScript implementation.

This approach has critical flaws:

*   **Extreme Brittleness:** The system relies on a massive `if-else-if` block in its `toJSON()` method to hardcode the order of JSON fields for over 20 different command types.
*   **Unscalable:** The `FlexibleCommandFactory` namespace contains over 50 hardcoded factory functions, making the system rigid and hard to extend.
*   **Low Maintainability:** Debugging is a nightmare, as errors originate from a complex, central serialization method, not from the isolated logic of the command itself.

### Flaw 2: The `CommandProtocol.hpp` System

This is an older, more traditional but equally problematic system based on C++ inheritance.

*   **Class Explosion:** It uses a rigid inheritance model where every command is a separate `struct` (e.g., `PinModeCommand`, `DigitalWriteCommand`). This creates dozens of boilerplate-heavy classes and makes adding new commands cumbersome.
*   **Manual Serialization (x2):** This system contains *two* manual serializers: a debug-style `toString()` method on each class, and a giant `switch` statement in a global `serializeCommand()` function that manually builds a JSON string using `dynamic_cast`.
*   **Type-Safety Failure:** As acknowledged by a `TODO` in the code, `FunctionCallCommand` cannot properly handle typed arguments and falls back to storing them as a `vector<string>`, which is a critical design failure.

### The Core Architectural Mistake

Both systems, despite their different approaches, make the same fundamental error: **they focus on manually replicating a string format instead of modeling and executing behavior.** This has resulted in two parallel, unmaintainable hacks.

## 2. Proposed Solution: A Unifying Runtime Command Processor

To fix this, we must replace **both** legacy systems with a single, standard, robust software design pattern: the **Command Processor**.

This architecture embraces the dynamic nature of the problem. Instead of trying to generate a perfect string, it focuses on correctly **executing the behavior** of each command. It will serve as the single, unified mechanism for all command handling.

## 3. Core Components

The new architecture consists of a few simple, decoupled components.

### 3.1. The `Value` Type

A `std::variant` that can hold any value type our interpreter supports. This provides a universal way to pass arguments.

```cpp
// A simple, expandable variant type for command arguments and return values.
using Value = std::variant<std::monostate, bool, int, double, std::string>;
```

### 3.2. The `ICommandHandler` Interface

An abstract base class that defines the interface for all command handlers. Each command we want to implement will have a class that inherits from this.

```cpp
// The interface for a class that handles a specific command.
class ICommandHandler {
public:
    virtual ~ICommandHandler() = default;
    virtual void execute(const std::vector<Value>& args) = 0;
};
```

### 3.3. The `CommandProcessor`

A central class that holds a registry of all known commands. Its job is to receive a command, look up the correct handler in its registry, and dispatch the command to it.

```cpp
// The main runtime command processor.
class CommandProcessor {
public:
    void registerCommand(const std::string& name, std::unique_ptr<ICommandHandler> handler);
    void dispatch(const std::string& name, const std::vector<Value>& args);

private:
    std::map<std::string, std::unique_ptr<ICommandHandler>> registry_;
};
```

## 4. Example Implementation: `digitalWrite`

Let's see how handling `digitalWrite` changes.

### Before:

The interpreter logic calls a factory from one of the two legacy systems to create a data object, which is later manually serialized.

```cpp
// 1. Create a data object using a brittle factory.
auto cmd = FlexibleCommandFactory::createDigitalWrite(13, 1);

// 2. Pass to a listener which later calls a monstrous toJSON() method.
listener->onCommand(cmd);
```

### After:

The logic is separated into a clean handler, and the interpreter simply dispatches the command by name.

**1. Create a dedicated handler:**

```cpp
// In its own file, e.g., DigitalWriteHandler.hpp
class DigitalWriteHandler : public ICommandHandler {
public:
    void execute(const std::vector<Value>& args) override {
        if (args.size() != 2) { /* handle error */ }
        int pin = std::get<int>(args[0]);
        int value = std::get<int>(args[1]);

        // The actual logic lives here!
        ArduinoMock::digitalWrite(pin, value);
    }
};
```

**2. Register the handler at startup:**

```cpp
// At initialization
commandProcessor.registerCommand("digitalWrite", std::make_unique<DigitalWriteHandler>());
```

**3. Dispatch from the interpreter:**

```cpp
// The interpreter's job is now simple and clean.
std::vector<Value> args = {13, 1};
commandProcessor.dispatch("digitalWrite", args);
```

## 5. Benefits of This Architecture

*   **Unifying Solution:** Replaces two complex, competing systems with one clean pattern.
*   **Scalable:** We can register thousands of commands without increasing the complexity of the dispatcher.
*   **Maintainable:** Logic for each command is isolated in its own handler class. Bugs are easy to find and fix.
*   **Debuggable:** Stack traces point directly to the specific handler where an error occurred.
*   **Correct Architectural Pattern:** It uses a runtime solution for a runtime problem. This is a standard, proven pattern for building interpreters, game engines, and other dynamic systems.
*   **Eliminates Hacks:** This design will allow for the complete deletion of both `FlexibleCommand.hpp` and `CommandProtocol.hpp` and all the hacks they contain.

## 6. Migration Strategy

We will not replace the system all at once. We will:
1.  Introduce the `CommandProcessor` alongside the existing systems.
2.  Migrate one command at a time, starting with `digitalWrite`.
3.  Create a temporary "bridge" where the new `dispatch` method can, after executing its logic, call the old `FlexibleCommandFactory` to generate the JSON needed to pass the existing baseline tests.
4.  Once all commands are migrated, we will remove the bridge, delete `FlexibleCommand.hpp` and `CommandProtocol.hpp`, and adapt the test harness to check for behavioral correctness instead of string equality.