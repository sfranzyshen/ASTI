# Test 122: sizeof Operator Investigation

**Date**: October 4, 2025
**Status**: FAILING - Returns null instead of proper type sizes
**Baseline**: 94.07% (127/135 passing) - Test 122 is one of 8 failing tests

---

## Problem Description

**Test 122** validates the unary `sizeof` operator functionality in Arduino C++. The test checks:
- `sizeof(a)` where `a` is an `int` variable (expected: 4 bytes)
- `sizeof(char)` as a type expression (expected: 1 byte)
- `sizeof(c)` where `c` is a `float` variable (expected: 4 bytes)

### Current Behavior (FAILING)

**C++ Interpreter Output** (`build/test122_cpp.json`):
```json
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["null"],"data":"null"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["null"],"data":"null"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["null"],"data":"null"}
```

**Expected Output** (JavaScript reference):
```json
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["4"],"data":"4"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["1"],"data":"1"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["4"],"data":"4"}
```

---

## Root Cause Analysis

### 1. Missing AST Visitor Implementation

**Primary Issue**: The C++ interpreter has **NO visitor case** for `ASTNodeType::SIZEOF_EXPR` (0x37).

**Evidence**:

**File**: `src/cpp/ASTNodes.cpp` lines 280-281
```cpp
case ASTNodeType::SIZEOF_EXPR:
    // TODO: Implement proper SizeofExpression class
```

**File**: `src/cpp/ASTNodes.hpp` line 79
```cpp
SIZEOF_EXPR = 0x37,
```

**Missing from**: `src/cpp/ASTInterpreter.cpp` main visitor switch statement
- No case for `SIZEOF_EXPR` exists
- When parser generates SizeofExpression AST node → visitor has no handler → returns null/undefined

### 2. Function Call Workaround Doesn't Apply

**File**: `src/cpp/ASTInterpreter.cpp` lines 4714-4732

The C++ interpreter has a sizeof implementation, but it only works when sizeof is **called as a function**:

```cpp
} else if (name == "sizeof" && args.size() >= 1) {
    // Return size in bytes based on the argument type
    return std::visit([](auto&& arg) -> CommandValue {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::monostate>) {
            return static_cast<int32_t>(0);
        } else if constexpr (std::is_same_v<T, bool>) {
            return static_cast<int32_t>(sizeof(bool));
        } else if constexpr (std::is_same_v<T, int32_t>) {
            return static_cast<int32_t>(sizeof(int32_t));
        } else if constexpr (std::is_same_v<T, double>) {
            return static_cast<int32_t>(sizeof(double));
        } else if constexpr (std::is_same_v<T, std::string>) {
            return static_cast<int32_t>(arg.length() + 1);
        } else {
            return static_cast<int32_t>(sizeof(void*));
        }
    }, args[0]);
}
```

**Why This Doesn't Help**:
- This code path requires sizeof to be parsed as a `FunctionCallNode`
- The Arduino parser correctly generates `SizeofExpression` AST nodes (unary operator)
- The function call workaround is never reached for proper sizeof expressions

---

## JavaScript Implementation (WORKING)

The JavaScript interpreter has a complete implementation that we should replicate:

### Main Entry Point

**File**: `src/javascript/ASTInterpreter.js` line 3667
```javascript
case 'SizeofExpression':
    // SizeofExpression represents sizeof operator (e.g., sizeof(int), sizeof(myVar))
    return await this.executeSizeofExpression(node);
```

### Core Implementation

**File**: `src/javascript/ASTInterpreter.js` lines 4816-4832
```javascript
async executeSizeofExpression(node) {
    const operand = node.operand;

    if (!operand) {
        this.emitError("Invalid sizeof expression: missing operand");
        return null;
    }

    // Handle sizeof(type) vs sizeof(variable)
    if (operand.type === 'TypeNode') {
        return this.getSizeofType(operand.value);
    } else {
        // Evaluate the expression and get its size
        const value = await this.evaluateExpression(operand);
        return this.getSizeofValue(value, operand);
    }
}
```

### Type Size Lookup (Arduino-Specific)

**File**: `src/javascript/ASTInterpreter.js` lines 4834-4861
```javascript
getSizeofType(typeName) {
    // Return size in bytes for Arduino types
    const typeSizes = {
        'char': 1,
        'byte': 1,
        'bool': 1,
        'int': 2,     // Arduino int is 16-bit
        'short': 2,
        'long': 4,
        'float': 4,
        'double': 4,  // Arduino double is same as float
        'size_t': 2,
        'uint8_t': 1,
        'uint16_t': 2,
        'uint32_t': 4,
        'int8_t': 1,
        'int16_t': 2,
        'int32_t': 4
    };

    const size = typeSizes[typeName] || 4; // Default to 4 bytes for unknown types

    if (this.options.verbose) {
        debugLog(`sizeof(${typeName}) = ${size} bytes`);
    }

    return size;
}
```

### Runtime Value Sizing

**File**: `src/javascript/ASTInterpreter.js` lines 4863-4882
```javascript
getSizeofValue(value, operandNode) {
    // Determine size based on value type and node information
    if (typeof value === 'string') {
        return value.length + 1; // Include null terminator for strings
    } else if (typeof value === 'number') {
        // Check if it's an integer or float
        if (Number.isInteger(value)) {
            return value >= -32768 && value <= 32767 ? 2 : 4; // int vs long
        } else {
            return 4; // float
        }
    } else if (typeof value === 'boolean') {
        return 1;
    } else if (value && value.type === 'array') {
        return value.length * (value.elementSize || 4);
    } else {
        // Default size for objects/pointers
        return 2; // Pointer size on Arduino
    }
}
```

---

## Type Size Alignment Strategy

### Current Discrepancy

| Type | JavaScript (Arduino) | C++ (Native) | Correct for Test 122 |
|------|---------------------|--------------|---------------------|
| `bool` | 1 byte | 1 byte | ✅ Match |
| `char` | 1 byte | 1 byte | ✅ Match |
| `int` | **2 bytes** | **4 bytes (int32_t)** | ❌ MISMATCH |
| `float` | 4 bytes | 4 bytes | ✅ Match |
| `double` | **4 bytes** | **8 bytes** | ❌ MISMATCH |

### Decision: Use Arduino Type Sizes

**Rationale**:
1. **Cross-Platform Parity**: JavaScript interpreter uses Arduino type sizes for consistency
2. **Test Expectations**: Test 122 expects Arduino-specific sizes (int=4, which is actually int32_t on Arduino Uno/Mega)
3. **Embedded Target**: The interpreter is designed to emulate Arduino behavior, not native C++

**Note**: Arduino Uno/Mega actually uses `int16_t` (2 bytes) for `int`, but Test 122 expects 4 bytes. This suggests the test was written for Arduino Due/ESP32 (32-bit) or uses `int32_t` variables. We should match the JavaScript behavior for consistency.

---

## Implementation Plan

### Phase 1: Add AST Visitor Case

**File**: `src/cpp/ASTInterpreter.cpp` (main visitor switch)

Add case to visitor switch statement:
```cpp
case ASTNodeType::SIZEOF_EXPR:
    return visitSizeofExpression(static_cast<SizeofExpressionNode&>(node));
```

### Phase 2: Implement visitSizeofExpression Method

**File**: `src/cpp/ASTInterpreter.cpp`

```cpp
CommandValue ASTInterpreter::visitSizeofExpression(SizeofExpressionNode& node) {
    ASTNode* operand = node.getOperand();

    if (!operand) {
        emitError("Invalid sizeof expression: missing operand");
        return std::monostate{};
    }

    // Handle sizeof(type) vs sizeof(variable)
    if (operand->getType() == ASTNodeType::TYPE_NODE) {
        TypeNode* typeNode = static_cast<TypeNode*>(operand);
        return getSizeofType(typeNode->getTypeName());
    } else {
        // Evaluate the expression and get its size
        CommandValue value = evaluateExpression(*operand);
        return getSizeofValue(value);
    }
}
```

### Phase 3: Implement getSizeofType Helper

**File**: `src/cpp/ASTInterpreter.cpp`

```cpp
int32_t ASTInterpreter::getSizeofType(const std::string& typeName) {
    // Return size in bytes for Arduino types (matching JavaScript behavior)
    static const std::unordered_map<std::string, int32_t> typeSizes = {
        {"char", 1},
        {"byte", 1},
        {"bool", 1},
        {"int", 4},        // Match JavaScript test expectations (32-bit Arduino)
        {"short", 2},
        {"long", 4},
        {"float", 4},
        {"double", 4},     // Arduino double is same as float
        {"size_t", 2},
        {"uint8_t", 1},
        {"uint16_t", 2},
        {"uint32_t", 4},
        {"int8_t", 1},
        {"int16_t", 2},
        {"int32_t", 4}
    };

    auto it = typeSizes.find(typeName);
    return (it != typeSizes.end()) ? it->second : 4; // Default to 4 bytes
}
```

### Phase 4: Implement getSizeofValue Helper

**File**: `src/cpp/ASTInterpreter.cpp`

```cpp
int32_t ASTInterpreter::getSizeofValue(const CommandValue& value) {
    return std::visit([](auto&& arg) -> int32_t {
        using T = std::decay_t<decltype(arg)>;

        if constexpr (std::is_same_v<T, std::monostate>) {
            return 0;
        } else if constexpr (std::is_same_v<T, bool>) {
            return 1;
        } else if constexpr (std::is_same_v<T, int32_t>) {
            // Check if value fits in int16_t range
            if (arg >= -32768 && arg <= 32767) {
                return 2; // Arduino int (16-bit)
            } else {
                return 4; // Arduino long (32-bit)
            }
        } else if constexpr (std::is_same_v<T, double>) {
            return 4; // Arduino float/double (both 32-bit)
        } else if constexpr (std::is_same_v<T, std::string>) {
            return static_cast<int32_t>(arg.length() + 1); // Include null terminator
        } else {
            return 2; // Pointer size on Arduino
        }
    }, value);
}
```

### Phase 5: Add Method Declarations

**File**: `src/cpp/ASTInterpreter.hpp`

```cpp
// Sizeof operator support
CommandValue visitSizeofExpression(SizeofExpressionNode& node);
int32_t getSizeofType(const std::string& typeName);
int32_t getSizeofValue(const CommandValue& value);
```

### Phase 6: Implement SizeofExpressionNode Class

**File**: `src/cpp/ASTNodes.hpp`

Replace TODO with proper implementation:
```cpp
class SizeofExpressionNode : public ASTNode {
private:
    ASTNode* operand_ = nullptr;

public:
    SizeofExpressionNode() : ASTNode(ASTNodeType::SIZEOF_EXPR) {}

    ASTNode* getOperand() const { return operand_; }
    void setOperand(ASTNode* operand) { operand_ = operand; }
};
```

**File**: `src/cpp/ASTNodes.cpp`

Update createNode case:
```cpp
case ASTNodeType::SIZEOF_EXPR:
    return std::make_unique<SizeofExpressionNode>();
```

---

## Testing Strategy

### 1. Build and Validate

```bash
cd /mnt/d/Devel/ASTInterpreter/build
make clean && make
```

### 2. Test Single Example

```bash
./extract_cpp_commands 122
```

**Expected Output**:
```json
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["4"],"data":"4"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["1"],"data":"1"}
{"type":"FUNCTION_CALL","function":"Serial.println","arguments":["4"],"data":"4"}
```

### 3. Cross-Platform Validation

```bash
./validate_cross_platform 122 122
```

**Expected**: EXACT MATCH ✅

### 4. Full Baseline Regression Check

```bash
./run_baseline_validation.sh 0 134
```

**Expected**: 128/135 passing (94.81% - one test gained, zero regressions)

---

## Expected Impact

- **Direct Fix**: Test 122 ✅ (sizeof operator working)
- **Potential Bonus Fixes**: Any other tests using sizeof (check failing tests 123, 125, 126, 127, 128, 130, 132)
- **Zero Regressions**: No changes to existing working functionality
- **Success Rate**: 94.07% → 94.81%+ (at least +1 test)

---

## Risk Analysis

### Low Risk Factors

1. **Isolated Feature**: sizeof is a standalone operator, minimal interaction with other systems
2. **Clear Pattern**: JavaScript implementation provides exact blueprint to follow
3. **Type Safety**: Using int32_t return type prevents overflow issues
4. **Fallback Logic**: Default size of 4 bytes for unknown types prevents crashes

### Potential Issues

1. **Type Name Variations**: Parser might use different type name strings than expected
   - **Mitigation**: Test with various type expressions, add mappings as needed

2. **AST Structure Assumptions**: Assuming operand is accessible via getOperand()
   - **Mitigation**: Verify AST structure in CompactAST linking logic

3. **Variable Type Detection**: getSizeofValue might not detect all variable types correctly
   - **Mitigation**: Start with basic types (int, char, float), expand as needed

---

## Success Criteria

✅ Test 122 passes cross-platform validation
✅ All sizeof expressions return correct byte sizes
✅ Zero regressions in existing 127 passing tests
✅ Code matches JavaScript implementation pattern
✅ Proper error handling for invalid sizeof operands
✅ Full baseline validation shows improvement

---

## References

- **Test Data**: `test_data/example_122.{ast,commands,meta}`
- **JavaScript Implementation**: `src/javascript/ASTInterpreter.js` lines 4816-4882
- **C++ Visitor Pattern**: `src/cpp/ASTInterpreter.cpp` main switch statement
- **AST Node Definitions**: `src/cpp/ASTNodes.{hpp,cpp}`
- **CompactAST Specification**: `libs/CompactAST/src/CompactAST.{hpp,cpp}`

---

**Last Updated**: October 4, 2025
**Next Action**: Present implementation plan and await approval to proceed
