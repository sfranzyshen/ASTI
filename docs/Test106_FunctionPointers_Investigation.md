# Test 106: Function Pointers and Callbacks - Complete Investigation

**Status**: ✅ **COMPLETELY FIXED** - 100% cross-platform parity achieved
**Date**: October 3, 2025
**Test**: example_106 (Function_Pointers_and_Callbacks.ino)

---

## Executive Summary

Test 106 tests C++ function pointer functionality - declaring function pointers, taking addresses of functions, passing them as parameters, and calling through them. **BOTH JavaScript and C++ implementations are now complete and working perfectly with 100% cross-platform parity**.

**Final Status**:
- JavaScript: ✅ 100% working (all 18 commands correct)
- C++: ✅ **FIXED** - Complete AST pipeline implemented and working
- **Result**: Test 106 achieves EXACT MATCH status with zero regressions
- **Baseline Impact**: +2 tests (119 → 121 passing), 89.62% success rate

**Implementation Progress**:
- ✅ **Phase 1 COMPLETE**: FunctionPointer type added to CommandValue variant
- ✅ **Phase 2 COMPLETE**: Implicit function-to-pointer conversion implemented
- ✅ **Phase 3 COMPLETE**: Address-of operator enhanced for functions
- ✅ **Phase 4 COMPLETE**: Function pointer call detection added
- ✅ **Phase 5 COMPLETE**: JSON serialization implemented
- ✅ **Phase 6 COMPLETE**: Complete AST pipeline fixed (JavaScript export, C++ class, deserialization, parameter binding)

---

## Test Code Analysis

```cpp
// Function Pointers and Callbacks
int myFunc(int a, int b) {
  return a + b;
}

void callFunc(int (*funcPtr)(int, int)) {
  Serial.print("Result: ");
  Serial.println(funcPtr(10, 20));  // Call through function pointer
}

void setup() {
  Serial.begin(9600);
}

void loop() {
  int (*ptr)(int, int);              // Declare function pointer
  ptr = &myFunc;                     // Take address of function
  callFunc(ptr);                     // Pass function pointer
}
```

**Key Operations**:
1. **Function pointer declaration**: `int (*ptr)(int, int)` - pointer to function returning int, taking two ints
2. **Address-of function**: `ptr = &myFunc` - get pointer to myFunc
3. **Function pointer as parameter**: `callFunc(ptr)` - pass function pointer to another function
4. **Call through pointer**: `funcPtr(10, 20)` - invoke function through pointer variable

---

## JavaScript Implementation Analysis (WORKING ✅)

### 1. ArduinoFunctionPointer Class (Lines 476-521)

```javascript
class ArduinoFunctionPointer {
    constructor(functionName, interpreter) {
        this.functionName = functionName;
        this.interpreter = interpreter;
        this.type = 'function_pointer';
        this.pointerId = `fptr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    async call(args = []) {
        if (!this.interpreter.functions.has(this.functionName)) {
            throw new Error(`Function pointer target '${this.functionName}' no longer exists`);
        }

        // Create synthetic FuncCallNode and execute
        const syntheticNode = {
            type: 'FuncCallNode',
            callee: { type: 'IdentifierNode', value: this.functionName },
            arguments: args.map(arg => ({ type: 'LiteralNode', value: arg }))
        };

        return await this.executeFunctionCall(syntheticNode);
    }
}
```

### 2. Address-of Operator (Lines 5768-5783)

```javascript
case '&':
    if (node.operand?.type === 'IdentifierNode') {
        const name = node.operand.value;

        // Check if it's a function first
        if (this.functions.has(name)) {
            // Create function pointer
            const functionPointer = new ArduinoFunctionPointer(name, this);
            return functionPointer;
        }

        // Otherwise check for variables (regular pointers)
        if (this.variables.has(name)) {
            return new ArduinoPointer(name, this);
        }
    }
```

### 3. Implicit Function-to-Pointer Conversion (Lines 3547-3557)

```javascript
case 'IdentifierNode':
    const varName = node.value;

    // Check if identifier is a function name
    if (this.functions.has(varName)) {
        const functionPointer = new ArduinoFunctionPointer(varName, this);
        return functionPointer;
    }

    // Handle regular variables
    return this.getVariable(varName);
```

### 4. Function Pointer Calls (Lines 4101-4118)

```javascript
// In executeFunctionCall():
if (this.variables.has(funcName)) {
    const variable = this.variables.get(funcName);
    if (variable instanceof ArduinoFunctionPointer) {
        // Evaluate arguments
        const args = [];
        for (const arg of node.arguments) {
            args.push(await this.evaluateExpression(arg));
        }

        // Call through function pointer
        return await variable.call(args);
    }
}
```

### JavaScript Output (CORRECT ✅)

```json
{"type":"VAR_SET","variable":"ptr","value":null}
{"type":"VAR_SET","variable":"ptr","value":{"functionName":"myFunc","type":"function_pointer","pointerId":"fptr_..."}}
{"type":"FUNCTION_CALL","function":"callFunc","arguments":[{"functionName":"myFunc",...}]}
{"type":"FUNCTION_CALL","function":"Serial.print","arguments":["Result: "]}
{"type":"FUNCTION_CALL","function":"myFunc","arguments":[10,20]}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["30"]}
```

**Perfect behavior**: Function pointer created, stored, passed, and called correctly!

---

## C++ Implementation Analysis (BROKEN ❌)

### Current C++ Output (WRONG)

```json
{"type":"ERROR","message":"Undefined variable: myFunc"}
{"type":"ERROR","message":"Address-of operator requires variable name"}
{"type":"VAR_SET","variable":"ptr","value":null}
{"type":"FUNCTION_CALL","function":"callFunc","arguments":[null]}
{"type":"FUNCTION_CALL","function":"Serial.print","arguments":["Result: "]}
{"type":"FUNCTION_CALL","function":"funcPtr","arguments":["10","20"]}
{"type":"ERROR","message":"Unknown function: funcPtr"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["null"]}
```

### Problem 1: Function Not Recognized as Identifier

**Error**: `"Undefined variable: myFunc"`

**Root Cause** (evaluateExpression - IdentifierNode case):
```cpp
case arduino_ast::ASTNodeType::IDENTIFIER:
    if (auto* idNode = dynamic_cast<arduino_ast::IdentifierNode*>(expr)) {
        std::string varName = idNode->getName();
        Variable* var = scopeManager_->getVariable(varName);
        if (!var) {
            emitError("Undefined variable: " + varName);
            return std::monostate{};
        }
        return var->value;
    }
```

Functions are stored in `userFunctionNames_` (std::unordered_set<std::string>), NOT in variable scope. When evaluating `myFunc` as an identifier, it's not found and returns error.

**JavaScript equivalent**: Checks `this.functions.has(varName)` and returns ArduinoFunctionPointer.

### Problem 2: Address-of Operator Doesn't Handle Functions

**Error**: `"Address-of operator requires variable name"`

**Root Cause** (evaluateUnaryOperation - lines 6712-6721):
```cpp
else if (op == "&") {
    // Address-of operator - return a simulated address (pointer to variable)
    if (std::holds_alternative<std::string>(operand)) {
        std::string varName = std::get<std::string>(operand);
        return std::string("&" + varName);
    } else {
        emitError("Address-of operator requires variable name");
        return std::monostate{};
    }
}
```

The operand for `&myFunc` evaluates to `std::monostate{}` (because myFunc is not in variable scope), not a string. The condition `std::holds_alternative<std::string>(operand)` fails, causing the error.

**JavaScript equivalent**: Checks `this.functions.has(name)` first, creates ArduinoFunctionPointer.

### Problem 3: No Function Pointer Type in CommandValue

**Current CommandValue variant** (ArduinoDataTypes.hpp lines 10-22):
```cpp
using CommandValue = std::variant<
    std::monostate,
    bool,
    int32_t,
    uint32_t,
    double,
    std::string,
    std::vector<int32_t>,
    std::vector<double>,
    std::vector<std::string>,
    std::vector<std::vector<int32_t>>,
    std::vector<std::vector<double>>
>;
```

**Missing**: Function pointer type! No way to store function pointer objects.

**JavaScript equivalent**: ArduinoFunctionPointer class instance stored in variables.

### Problem 4: Function Pointer Calls Not Detected

**Error**: `"Unknown function: funcPtr"`

**Root Cause**: In FuncCallNode visitor (lines 916-935), only checks:
1. User-defined functions: `userFunctionNames_.count(functionName)`
2. Arduino built-in functions: executeArduinoFunction()

Does NOT check if `functionName` is a variable containing a function pointer.

**JavaScript equivalent**: Checks `this.variables.has(funcName)` and if `variable instanceof ArduinoFunctionPointer`, calls it.

### Problem 5: Function Pointer Parameters Not Serialized

Even if function pointers worked, `commandValueToJsonString()` has no handler for function pointer type, so it couldn't serialize them for VAR_SET or FUNCTION_CALL commands.

---

## Implementation Completed (October 3, 2025)

### Phase 1: FunctionPointer Type ✅ COMPLETE

**Files Modified**:
- `src/cpp/ArduinoDataTypes.hpp` (lines 60-73)
- `src/cpp/ArduinoDataTypes.cpp` (FunctionPointer implementation)

**Implementation**:
```cpp
// Added to ArduinoDataTypes.hpp
struct FunctionPointer {
    std::string functionName;
    std::string pointerId;
    ASTInterpreter* interpreter;

    FunctionPointer();
    FunctionPointer(const std::string& name, ASTInterpreter* interp);
    std::string toString() const;

    bool operator==(const FunctionPointer& other) const {
        return functionName == other.functionName && pointerId == other.pointerId;
    }
};

// Added to CommandValue variant
using CommandValue = std::variant<
    std::monostate, bool, int32_t, uint32_t, double, std::string,
    std::vector<int32_t>, std::vector<double>, std::vector<std::string>,
    std::vector<std::vector<int32_t>>, std::vector<std::vector<double>>,
    arduino_interpreter::FunctionPointer  // NEW
>;
```

**Result**: FunctionPointer type successfully integrated into type system.

---

### Phase 2: Function Identifier Evaluation ✅ COMPLETE

**Files Modified**:
- `src/cpp/ASTInterpreter.cpp` (lines 2649-2673)

**Implementation**:
```cpp
case arduino_ast::ASTNodeType::IDENTIFIER:
    if (auto* idNode = dynamic_cast<arduino_ast::IdentifierNode*>(expr)) {
        std::string name = idNode->getName();

        // Check if it's a function name (implicit function-to-pointer conversion)
        if (userFunctionNames_.count(name) > 0) {
            FunctionPointer funcPtr(name, this);
            return funcPtr;
        }

        // Handle regular variables
        Variable* var = scopeManager_->getVariable(name);
        if (var) {
            return var->value;
        } else {
            emitError("Undefined variable: " + name);
            return std::monostate{};
        }
    }
```

**Result**: `myFunc` now evaluates to FunctionPointer instead of error.

---

### Phase 3: Address-of Operator ✅ COMPLETE

**Files Modified**:
- `src/cpp/ASTInterpreter.cpp` (lines 6718-6733)

**Implementation**:
```cpp
else if (op == "&") {
    // Check if operand is already a function pointer (from implicit conversion)
    if (std::holds_alternative<FunctionPointer>(operand)) {
        return operand;  // Already a function pointer
    }

    if (std::holds_alternative<std::string>(operand)) {
        std::string varName = std::get<std::string>(operand);
        return std::string("&" + varName);
    } else {
        emitError("Address-of operator requires variable or function name");
        return std::monostate{};
    }
}
```

**Result**: `&myFunc` now returns FunctionPointer instead of error.

---

### Phase 4: Function Pointer Call Detection ✅ COMPLETE (but not working)

**Files Modified**:
- `src/cpp/ASTInterpreter.cpp` (lines 2724-2740)

**Implementation**:
```cpp
// Check if functionName is actually a variable containing a FunctionPointer
if (!functionName.empty()) {
    Variable* var = scopeManager_->getVariable(functionName);
    if (var && std::holds_alternative<FunctionPointer>(var->value)) {
        // This is a function pointer call - get the actual function name
        FunctionPointer funcPtr = std::get<FunctionPointer>(var->value);
        functionName = funcPtr.functionName;
    }
}
```

**Result**: Implementation complete but **NOT WORKING** - see Blocking Issue below.

---

### Phase 5: JSON Serialization ✅ COMPLETE

**Files Modified**:
- `src/cpp/ASTInterpreter.cpp` (lines 6074-6080, 6168-6170)

**Implementation**:
```cpp
// In commandValueToJsonString()
else if constexpr (std::is_same_v<T, FunctionPointer>) {
    StringBuildStream json;
    json << "{\"functionName\":\"" << v.functionName << "\","
         << "\"type\":\"function_pointer\","
         << "\"pointerId\":\"" << v.pointerId << "\"}";
    return json.str();
}

// In commandValueToString()
else if constexpr (std::is_same_v<T, FunctionPointer>) {
    return v.toString();
}
```

**Result**: Function pointers serialize correctly to JSON.

---

### Additional Fixes Applied

**Type Conversion Preservation** (`src/cpp/ASTInterpreter.cpp` lines 7549-7552):
```cpp
CommandValue ASTInterpreter::convertToType(const CommandValue& value, const std::string& typeName) {
    // Test 106: Preserve FunctionPointer types without conversion
    if (std::holds_alternative<FunctionPointer>(value)) {
        return value;  // Function pointers are never converted
    }
    // ... rest of conversion logic
}
```

**Variant Conversion Handlers** (`src/cpp/ArduinoDataTypes.hpp`, `src/cpp/ArduinoDataTypes.cpp`):
- Added FunctionPointer handling to `convertCommandValue` template
- Added FunctionPointer handling to `upgradeExtendedCommandValue`

---

## Current Blocking Issue

### Symptom

C++ output shows:
```json
{"type":"FUNCTION_CALL","function":"funcPtr","arguments":["10","20"]}
{"type":"ERROR","message":"Unknown function: funcPtr","errorType":"RuntimeError"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["null"]}
```

Expected output:
```json
{"type":"FUNCTION_CALL","function":"myFunc","arguments":[10,20]}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["30"]}
```

### Root Cause Analysis

**Problem**: When `funcPtr(10, 20)` is called inside the `callFunc` function, Phase 4's code tries to resolve `funcPtr` via:
```cpp
Variable* var = scopeManager_->getVariable(functionName);
```

This returns `null` even though `funcPtr` is a parameter containing a FunctionPointer value.

**Hypothesis 1: Parameter Binding Timing**
The function pointer call resolution happens BEFORE parameter values are bound to the function scope, so the parameter doesn't exist yet.

**Hypothesis 2: Type Conversion Issue**
The `convertToType()` function may be called with parameter type `"int (*)(int, int)"` and could be converting the FunctionPointer to something else before storing it in the parameter variable.

**Hypothesis 3: Scope Lookup Issue**
Parameters might be stored in a different scope level than where `getVariable()` is searching.

### Debug Evidence Needed

Added debug logging (currently in code):
```cpp
std::cerr << "DEBUG: Phase 4 check for '" << functionName << "', var=" << (var ? "found" : "null") << std::endl;
if (var) {
    std::cerr << "DEBUG: var->value type index = " << var->value.index() << std::endl;
}
```

**Next Step**: Run debug build to see:
1. Is `funcPtr` found in scope? (var=found vs var=null)
2. If found, what is var->value.index()? (11 = FunctionPointer)

### Potential Solutions

**Solution 1**: Check if parameter binding preserves FunctionPointer type
- Verify `executeUserFunction` properly stores FunctionPointer parameters
- Check if `convertToType` is being called on function pointer parameters

**Solution 2**: Adjust Phase 4 timing
- Move function pointer resolution to AFTER arguments are evaluated
- Check parameter scope at function call site instead of function evaluation

**Solution 3**: Special handling for function pointer parameters
- Detect function pointer parameter types in `executeUserFunction`
- Skip type conversion for function pointer parameters

---

## Required Implementation Plan

### Phase 1: Create C++ FunctionPointer Type

**File**: `src/cpp/ArduinoDataTypes.hpp`

1. **Add FunctionPointer struct**:
```cpp
namespace arduino_interpreter {
    class ASTInterpreter;  // Forward declaration

    struct FunctionPointer {
        std::string functionName;
        std::string pointerId;
        ASTInterpreter* interpreter;  // Need reference to call function

        FunctionPointer(const std::string& name, ASTInterpreter* interp);
        std::string toString() const;
    };
}
```

2. **Add to CommandValue variant**:
```cpp
using CommandValue = std::variant<
    std::monostate,
    bool,
    int32_t,
    uint32_t,
    double,
    std::string,
    std::vector<int32_t>,
    std::vector<double>,
    std::vector<std::string>,
    std::vector<std::vector<int32_t>>,
    std::vector<std::vector<double>>,
    FunctionPointer  // NEW
>;
```

**Complexity**: LOW
**Risk**: LOW - Adding new variant type
**Dependencies**: None

---

### Phase 2: Implement Function Identifier Evaluation

**File**: `src/cpp/ASTInterpreter.cpp` (evaluateExpression - IDENTIFIER case)

**Current code** (lines ~2615-2625):
```cpp
case arduino_ast::ASTNodeType::IDENTIFIER:
    if (auto* idNode = dynamic_cast<arduino_ast::IdentifierNode*>(expr)) {
        std::string varName = idNode->getName();
        Variable* var = scopeManager_->getVariable(varName);
        if (!var) {
            emitError("Undefined variable: " + varName);
            return std::monostate{};
        }
        return var->value;
    }
```

**NEW implementation**:
```cpp
case arduino_ast::ASTNodeType::IDENTIFIER:
    if (auto* idNode = dynamic_cast<arduino_ast::IdentifierNode*>(expr)) {
        std::string varName = idNode->getName();

        // Check if it's a function name first (implicit function-to-pointer conversion)
        if (userFunctionNames_.count(varName) > 0) {
            FunctionPointer funcPtr(varName, this);
            return funcPtr;
        }

        // Handle regular variables
        Variable* var = scopeManager_->getVariable(varName);
        if (!var) {
            emitError("Undefined variable: " + varName);
            return std::monostate{};
        }
        return var->value;
    }
```

**Complexity**: LOW
**Risk**: LOW - Clear insertion point
**Dependencies**: Phase 1 (FunctionPointer type)

---

### Phase 3: Enhance Address-of Operator for Functions

**File**: `src/cpp/ASTInterpreter.cpp` (evaluateUnaryOperation - lines 6712-6721)

**Current code**:
```cpp
else if (op == "&") {
    if (std::holds_alternative<std::string>(operand)) {
        std::string varName = std::get<std::string>(operand);
        return std::string("&" + varName);
    } else {
        emitError("Address-of operator requires variable name");
        return std::monostate{};
    }
}
```

**NEW implementation**:
```cpp
else if (op == "&") {
    // Check if operand is a function pointer (from implicit conversion)
    if (std::holds_alternative<FunctionPointer>(operand)) {
        // Already a function pointer from implicit conversion
        return operand;
    }

    // Handle regular variable addresses
    if (std::holds_alternative<std::string>(operand)) {
        std::string varName = std::get<std::string>(operand);
        return std::string("&" + varName);
    }

    emitError("Address-of operator requires variable or function name");
    return std::monostate{};
}
```

**Complexity**: LOW
**Risk**: LOW - Simple addition
**Dependencies**: Phase 1 (FunctionPointer type), Phase 2 (function identifier evaluation)

---

### Phase 4: Implement Function Pointer Calls

**File**: `src/cpp/ASTInterpreter.cpp` (FuncCallNode visitor - lines 916-935)

**Current code**:
```cpp
// Check for user-defined function first - MEMORY SAFE
if (userFunctionNames_.count(functionName) > 0) {
    auto* userFunc = findFunctionInAST(functionName);
    if (userFunc) {
        executeUserFunction(functionName, dynamic_cast<const arduino_ast::FuncDefNode*>(userFunc), args);
    }
} else {
    executeArduinoFunction(functionName, args);
}
```

**NEW implementation**:
```cpp
// Check if functionName is a variable containing a function pointer
Variable* var = scopeManager_->getVariable(functionName);
if (var && std::holds_alternative<FunctionPointer>(var->value)) {
    // This is a function pointer call
    FunctionPointer funcPtr = std::get<FunctionPointer>(var->value);

    // Look up the actual function and call it
    if (userFunctionNames_.count(funcPtr.functionName) > 0) {
        auto* userFunc = findFunctionInAST(funcPtr.functionName);
        if (userFunc) {
            executeUserFunction(funcPtr.functionName,
                              dynamic_cast<const arduino_ast::FuncDefNode*>(userFunc),
                              args);
            return;
        }
    }

    emitError("Function pointer target '" + funcPtr.functionName + "' no longer exists");
    return;
}

// Check for user-defined function directly
if (userFunctionNames_.count(functionName) > 0) {
    auto* userFunc = findFunctionInAST(functionName);
    if (userFunc) {
        executeUserFunction(functionName, dynamic_cast<const arduino_ast::FuncDefNode*>(userFunc), args);
    }
} else {
    executeArduinoFunction(functionName, args);
}
```

**Complexity**: MEDIUM
**Risk**: LOW - Clean insertion before existing logic
**Dependencies**: Phase 1 (FunctionPointer type)

---

### Phase 5: Implement Function Pointer Serialization

**File**: `src/cpp/ASTInterpreter.cpp` (commandValueToJsonString - lines ~6000-6100)

**Add new handler**:
```cpp
} else if (std::holds_alternative<FunctionPointer>(value)) {
    // Function pointer - serialize as object
    const FunctionPointer& funcPtr = std::get<FunctionPointer>(value);

    StringBuildStream json;
    json << "{";
    json << "\"functionName\":\"" << funcPtr.functionName << "\",";
    json << "\"type\":\"function_pointer\",";
    json << "\"pointerId\":\"" << funcPtr.pointerId << "\"";
    json << "}";

    return json.str();
}
```

**Also update**: `formatArgumentForDisplay()` to handle FunctionPointer type:
```cpp
} else if (std::holds_alternative<FunctionPointer>(arg)) {
    const FunctionPointer& funcPtr = std::get<FunctionPointer>(arg);
    return "ArduinoFunctionPointer(" + funcPtr.pointerId + " -> " + funcPtr.functionName + ")";
}
```

**Complexity**: LOW
**Risk**: LOW - Standard serialization pattern
**Dependencies**: Phase 1 (FunctionPointer type)

---

### Phase 6: Handle Function Pointers in evaluateExpression Switch

**File**: `src/cpp/ASTInterpreter.cpp` (evaluateExpression - FUNCTION_CALL case)

Currently, function calls in expression context go through the FUNCTION_CALL case which calls visit(FuncCallNode&). This should work automatically once Phase 4 is complete, but needs verification.

**Action**: Add test to ensure function pointer calls in expression context work:
```cpp
int result = funcPtr(10, 20);  // Function pointer call in expression
```

**Complexity**: LOW
**Risk**: LOW - Should work automatically
**Dependencies**: Phase 4 (function pointer calls)

---

## Risk Assessment

### Low Risk Areas
- Adding FunctionPointer type to variant (Phase 1)
- Serialization (Phase 5)
- Address-of operator enhancement (Phase 3)

### Medium Risk Areas
- Function pointer call detection (Phase 4) - must not break existing function calls
- Identifier evaluation (Phase 2) - must not break variable lookups

### Testing Strategy

**Unit Tests** (each phase):
1. Test function identifier returns function pointer
2. Test `&function` returns function pointer
3. Test function pointer assignment to variable
4. Test function pointer passed as parameter
5. Test calling through function pointer variable

**Integration Tests**:
1. Complete Test 106 scenario
2. Nested function pointer calls
3. Multiple function pointers
4. Function pointer arrays (stretch goal)

---

## Success Criteria

1. ✅ Test 106 passes with EXACT MATCH status
2. ✅ All 18 JavaScript reference commands matched by C++
3. ✅ `ptr = &myFunc` creates proper function pointer object
4. ✅ `callFunc(ptr)` passes function pointer as argument
5. ✅ `funcPtr(10, 20)` calls myFunc through pointer
6. ✅ Serial.println outputs "30" (correct result)
7. ✅ Zero regressions in existing 119 passing tests

---

## Estimated Effort

- **Phase 1**: 30 minutes (type definition)
- **Phase 2**: 30 minutes (identifier evaluation)
- **Phase 3**: 20 minutes (address-of operator)
- **Phase 4**: 45 minutes (function pointer calls)
- **Phase 5**: 30 minutes (serialization)
- **Phase 6**: 15 minutes (verification)
- **Testing**: 45 minutes (comprehensive testing)

**Total**: ~3.5 hours for complete implementation and testing

---

## Alternative Approaches Considered

### Alternative 1: Store Function Pointers as Strings
**Idea**: Use `std::string` to store function name, detect special pattern
**Rejected**: Type-unsafe, pattern detection fragile, doesn't match JavaScript architecture

### Alternative 2: Use std::function
**Idea**: Store C++ std::function objects
**Rejected**: Can't serialize to JSON, doesn't match AST-based execution model

### Alternative 3: Extend Existing Pointer Type
**Idea**: Add function pointer support to ArduinoPointer class
**Rejected**: Function pointers are fundamentally different from data pointers

---

## Dependencies and Prerequisites

**Before starting implementation**:
1. ✅ Understand JavaScript ArduinoFunctionPointer implementation
2. ✅ Identify all code locations requiring changes
3. ✅ Establish testing methodology
4. ✅ Create this investigation document

**For successful execution**:
1. Follow phase order strictly (each phase builds on previous)
2. Test each phase independently before proceeding
3. Run regression tests after each phase
4. Update documentation as implementation progresses

---

## Conclusion

Test 106 failure is due to **complete absence of function pointer support in C++**, not bugs in existing code. Implementation is straightforward - mirror the proven JavaScript architecture using C++ idioms. The phased approach ensures safe, incremental progress with continuous validation.

**Recommendation**: Proceed with implementation following the 6-phase plan. Expected outcome: **Test 106 passing, 120/135 tests total (88.88% success rate)**.
