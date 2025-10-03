# Test 107: Prefix/Postfix Increment/Decrement Operators - Complete Investigation

**Status**: FAILING → Implementation in progress
**Date**: October 3, 2025
**Test**: example_107 (Chained_Assignments_and_Unary_Operators.ino)

---

## Executive Summary

Test 107 tests C++ unary increment/decrement operators in both prefix (`++x`, `--x`) and postfix (`x++`, `x--`) forms, plus chained assignments (`a = b = c = 5`). **C++ implementation is INCOMPLETE** - prefix operators are not implemented, causing all prefix increment/decrement operations to fail and return `null`.

**Current Status**:
- JavaScript: ✅ 100% working (all operators implemented correctly)
- C++: ❌ **FAILING** - Prefix increment/decrement NOT IMPLEMENTED
- Postfix operators: ✅ Working correctly via PostfixExpressionNode
- Chained assignments: ✅ Working correctly

**Root Cause**: The `evaluateUnaryOperation()` function in ASTInterpreter.cpp (lines 6732-6736) emits an error for `++` and `--` operators instead of implementing them. Comment says "These should be handled at a higher level with variable context" but this was never done.

---

## Test Code Analysis

```cpp
// Chained Assignments and Unary Operators
void setup() {
  Serial.begin(9600);
}

void loop() {
  int a, b, c;
  a = b = c = 5;           // Chained assignment
  int x = 10;
  int y = ++x;             // Prefix increment: x becomes 11, y = 11
  int z = y++;             // Postfix increment: z = 11, y becomes 12
  Serial.print("a: "); Serial.println(a);
  Serial.print("x: "); Serial.println(x);
  Serial.print("y: "); Serial.println(y);
  Serial.print("z: "); Serial.println(z);
  int result = --x * (y++); // Prefix decrement and postfix increment
  Serial.print("Final result: "); Serial.println(result);
}
```

**Key Operations**:
1. **Chained assignment**: `a = b = c = 5` - right-to-left evaluation
2. **Prefix increment**: `++x` - increment THEN return new value
3. **Postfix increment**: `y++` - return old value THEN increment
4. **Prefix decrement**: `--x` - decrement THEN return new value
5. **Complex expression**: `--x * (y++)` - mix of prefix and postfix in arithmetic

**Expected Execution Trace**:
1. `int x = 10;` → x = 10
2. `int y = ++x;` → x becomes 11 (PREFIX), y = 11
3. `int z = y++;` → z = 11 (old value), y becomes 12 (POSTFIX)
4. Print: a=5, x=11, y=12, z=11
5. `int result = --x * (y++);` → x becomes 10 (PREFIX), multiply by 12, y becomes 13, result = 120

---

## Current C++ Output vs JavaScript Reference

### C++ Output (FAILING):
```
a: 5       ✅
x: 10      ❌ (should be 11 after ++x)
y: null    ❌ (should be 11)
z: null    ❌ (should be 11)
Final result: 0  ❌ (should be 120)
```

### JavaScript Output (CORRECT):
```
a: 5       ✅
x: 11      ✅ (after ++x, before --x)
y: 12      ✅ (after y++ in line 17, before y++ in line 22)
z: 11      ✅ (old value from y++)
Final result: 120  ✅ (10 * 12)
```

### C++ JSON Debug Output Shows:
```json
{"type":"VAR_SET","variable":"x","value":10}
{"type":"ERROR","message":"Increment/decrement operators require variable context"}
{"type":"VAR_SET","variable":"y","value":null}
{"type":"VAR_SET","variable":"z","value":null}
{"type":"ERROR","message":"Increment/decrement operators require variable context"}
{"type":"VAR_SET","variable":"result","value":0}
```

**Analysis**: The ERROR messages at lines 16 and 27 confirm that `evaluateUnaryOperation()` is rejecting the prefix increment/decrement operators.

---

## Root Cause Technical Analysis

### Problem Location 1: `evaluateUnaryOperation()` Function
**File**: `/mnt/d/Devel/ASTInterpreter/src/cpp/ASTInterpreter.cpp` lines 6732-6736

```cpp
} else if (op == "++" || op == "--") {
    // Note: Increment/decrement need variable context, not just value
    // These should be handled at a higher level with variable access
    emitError("Increment/decrement operators require variable context");
    return std::monostate{};
}
```

**Problem**: This code rejects all `++` and `--` operators and returns `null`. The comment indicates this was a TODO that was never completed.

### Problem Location 2: `evaluateExpression()` UNARY_OP Case
**File**: `/mnt/d/Devel/ASTInterpreter/src/cpp/ASTInterpreter.cpp` lines 2686-2693

```cpp
case arduino_ast::ASTNodeType::UNARY_OP:
    if (auto* unaryNode = dynamic_cast<arduino_ast::UnaryOpNode*>(expr)) {
        std::string op = unaryNode->getOperator();

        // BUG: Evaluates operand first, losing variable context
        CommandValue operand = evaluateExpression(const_cast<arduino_ast::ASTNode*>(unaryNode->getOperand()));
        return evaluateUnaryOperation(op, operand);
    }
    break;
```

**Problem**: The code evaluates the operand (converting variable to value), then passes just the value to `evaluateUnaryOperation()`. This loses the variable context needed to update the variable.

### Why PostfixExpressionNode Works

**File**: `/mnt/d/Devel/ASTInterpreter/src/cpp/ASTInterpreter.cpp` lines 1996-2040

The PostfixExpressionNode visitor correctly implements postfix operators:
1. Gets the operand node directly (preserves variable context)
2. Extracts variable name from IdentifierNode
3. Gets current value from scopeManager
4. Calculates new value (increment/decrement)
5. Updates variable in scopeManager
6. Emits VAR_SET command
7. Returns ORIGINAL value (postfix semantics)

**This is the pattern we need to follow for prefix operators!**

---

## JavaScript Implementation Analysis (WORKING ✅)

### Prefix Increment/Decrement Handler
**File**: `/mnt/d/Devel/ASTInterpreter/src/javascript/ASTInterpreter.js` lines 5695-5741

```javascript
case '++':
    // Prefix increment: ++i
    if (node.operand?.type === 'IdentifierNode') {
        const varName = node.operand.value;
        const newValue = operand + 1;
        const result = this.variables.set(varName, newValue);

        if (!result.success) {
            this.emitError(result.message || `Failed to increment variable '${varName}'`);
            return operand;
        }

        this.variables.markAsInitialized(varName);

        // Emit variable set command
        this.emitCommand({
            type: COMMAND_TYPES.VAR_SET,
            variable: varName,
            value: this.sanitizeForCommand(newValue),
            timestamp: Date.now()
        });

        return newValue;  // PREFIX: Return NEW value
    }
    return operand + 1;
```

**Key Implementation Details**:
1. Checks if operand is IdentifierNode (variable)
2. Gets variable name directly from node
3. Calculates new value (current + 1)
4. Updates variable storage
5. Emits VAR_SET command
6. Returns **new value** (prefix semantics)

---

## Fix Strategy

### Approach: Handle Prefix Operators in `evaluateExpression()`

Instead of trying to handle prefix operators in `evaluateUnaryOperation()` (which only receives values), we need to handle them in `evaluateExpression()` where we still have access to the UnaryOpNode and can extract the variable name.

**Implementation Pattern** (following PostfixExpressionNode model):

```cpp
case arduino_ast::ASTNodeType::UNARY_OP:
    if (auto* unaryNode = dynamic_cast<arduino_ast::UnaryOpNode*>(expr)) {
        std::string op = unaryNode->getOperator();

        // Special handling for prefix increment/decrement
        if (op == "++" || op == "--") {
            const auto* operand = unaryNode->getOperand();

            if (operand && operand->getType() == arduino_ast::ASTNodeType::IDENTIFIER) {
                std::string varName = operand->getValueAs<std::string>();
                Variable* var = scopeManager_->getVariable(varName);

                if (var) {
                    CommandValue currentValue = var->value;
                    CommandValue newValue;

                    // Calculate new value
                    if (op == "++") {
                        newValue = convertToInt(currentValue) + 1;
                    } else {
                        newValue = convertToInt(currentValue) - 1;
                    }

                    // Update variable
                    var->setValue(newValue);

                    // Emit VAR_SET command
                    emitVarSet(varName, commandValueToJsonString(newValue));

                    // PREFIX: Return NEW value
                    return newValue;
                }
            }
        }

        // For other unary operators, use evaluateUnaryOperation
        CommandValue operand = evaluateExpression(const_cast<arduino_ast::ASTNode*>(unaryNode->getOperand()));
        return evaluateUnaryOperation(op, operand);
    }
    break;
```

---

## Implementation Checklist

### Phase 1: Core Implementation ✅
- [ ] Modify `evaluateExpression()` UNARY_OP case to handle `++` and `--` operators
- [ ] Handle variable name extraction from IdentifierNode operand
- [ ] Implement value increment/decrement logic
- [ ] Update variable in scopeManager
- [ ] Emit VAR_SET command for cross-platform parity
- [ ] Return new value (prefix semantics)

### Phase 2: Error Handling ✅
- [ ] Check for IdentifierNode operand type
- [ ] Handle undefined variable errors
- [ ] Handle non-variable operands gracefully
- [ ] Update `evaluateUnaryOperation()` error message for clarity

### Phase 3: Type Support ✅
- [ ] Support int32_t increment/decrement
- [ ] Support double increment/decrement
- [ ] Fallback to numeric conversion for other types

### Phase 4: Testing and Validation ✅
- [ ] Build C++ interpreter
- [ ] Test example 107 for EXACT MATCH
- [ ] Run full baseline validation (0-134)
- [ ] Verify zero regressions

---

## Expected Results After Fix

### Test 107 Output (EXPECTED):
```
a: 5       ✅
x: 11      ✅ (after ++x)
y: 12      ✅ (after y++)
z: 11      ✅ (old value from y++)
Final result: 120  ✅ (10 * 12 = 120)
```

### Command Stream Comparison:
**JavaScript Reference**:
```json
{"type":"VAR_SET","variable":"x","value":10}
{"type":"VAR_SET","variable":"x","value":11}   // ++x
{"type":"VAR_SET","variable":"y","value":11}   // int y = ++x
{"type":"VAR_SET","variable":"y","value":12}   // y++
{"type":"VAR_SET","variable":"z","value":11}   // int z = y++
```

**C++ Output (AFTER FIX)**:
```json
{"type":"VAR_SET","variable":"x","value":10}
{"type":"VAR_SET","variable":"x","value":11}   // ++x (FIXED!)
{"type":"VAR_SET","variable":"y","value":11}   // int y = ++x
{"type":"VAR_SET","variable":"y","value":12}   // y++
{"type":"VAR_SET","variable":"z","value":11}   // int z = y++
```

---

## Baseline Impact Projection

**Current Baseline**: 121/135 tests (89.62% success rate)

**Expected After Fix**:
- Test 107: ❌ → ✅ (EXACT MATCH)
- New Baseline: 122/135 tests (90.37% success rate)
- Net Improvement: +1 test
- Regression Risk: **ZERO** (only adding missing functionality, not changing existing behavior)

---

## Key Insights

1. **Prefix vs Postfix**: The key difference is return value:
   - **Prefix (`++x`)**: Returns NEW value after increment
   - **Postfix (`x++`)**: Returns OLD value before increment

2. **Variable Context**: Increment/decrement operators require variable context to:
   - Extract variable name
   - Update the variable's stored value
   - Emit VAR_SET command for cross-platform parity

3. **Implementation Location**: Must handle in `evaluateExpression()` where we have access to the AST node structure, not in `evaluateUnaryOperation()` which only receives computed values.

4. **Cross-Platform Parity**: JavaScript implementation already works correctly and provides the reference pattern to follow.

---

## Conclusion

Test 107 reveals a **fundamental missing implementation** in the C++ interpreter - prefix increment/decrement operators were never completed. The fix is straightforward: implement the same pattern used successfully in PostfixExpressionNode, but return the new value instead of the old value. This will achieve 100% cross-platform parity for all unary increment/decrement operators.
