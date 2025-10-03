# Test 107: Prefix Increment/Decrement - ULTRATHINK EXECUTION PLAN

**Date**: October 3, 2025
**Test**: example_107 (Chained_Assignments_and_Unary_Operators.ino)
**Current Status**: FAILING - Prefix operators not implemented
**Target**: EXACT MATCH with JavaScript reference

---

## 📋 EXECUTIVE SUMMARY

**Problem**: C++ `evaluateUnaryOperation()` rejects `++` and `--` operators with error message instead of implementing them.

**Root Cause**: Prefix increment/decrement operators need variable context (to update the variable), but `evaluateUnaryOperation()` only receives computed values. The implementation was never completed.

**Solution**: Handle prefix `++`/`--` in `evaluateExpression()` BEFORE evaluating operand (preserving variable context), following the same pattern used successfully in `PostfixExpressionNode`.

**Impact**: +1 test (121→122), 90.37% success rate, ZERO regression risk

---

## 🎯 DETAILED TASK BREAKDOWN

### PHASE 1: CODE ANALYSIS & VALIDATION

#### Task 1.1: Verify Current Failure Mode
**Action**: Confirm exact error location and behavior
```bash
cd /mnt/d/Devel/ASTInterpreter/build
./extract_cpp_commands 107 2>&1 | grep -i error
```

**Expected Output**:
```
{"type":"ERROR","message":"Increment/decrement operators require variable context"}
```

**Validation**: Error appears at line 16 (after `int y = ++x;`) and line 27 (in `--x * (y++)`)

#### Task 1.2: Examine PostfixExpressionNode Working Implementation
**Action**: Study the working postfix implementation pattern
**File**: `/mnt/d/Devel/ASTInterpreter/src/cpp/ASTInterpreter.cpp` lines 1996-2040

**Key Pattern to Extract**:
1. ✅ Get operand node directly (not value)
2. ✅ Check for IDENTIFIER node type
3. ✅ Extract variable name using `getValueAs<std::string>()`
4. ✅ Get variable from scopeManager
5. ✅ Calculate new value based on operator
6. ✅ Update variable with `setValue()`
7. ✅ Emit VAR_SET command
8. ✅ Return appropriate value (OLD for postfix, NEW for prefix)

#### Task 1.3: Analyze JavaScript Reference Implementation
**Action**: Understand JavaScript pattern for prefix operators
**File**: `/mnt/d/Devel/ASTInterpreter/src/javascript/ASTInterpreter.js` lines 5695-5741

**Key Differences from Postfix**:
- Postfix returns `oldValue` (value BEFORE increment)
- Prefix returns `newValue` (value AFTER increment)

---

### PHASE 2: IMPLEMENTATION - STEP BY STEP

#### Task 2.1: Add Prefix Operator Detection in evaluateExpression()
**File**: `/mnt/d/Devel/ASTInterpreter/src/cpp/ASTInterpreter.cpp` line 2686
**Location**: Inside `case arduino_ast::ASTNodeType::UNARY_OP:`

**Modification**:
```cpp
// Add BEFORE evaluating operand
if (op == "++" || op == "--") {
    // Handle prefix increment/decrement here
}
```

**Validation**: Check that we have access to `unaryNode->getOperand()` BEFORE it's evaluated

#### Task 2.2: Extract Variable Name from Operand
**Code to Add**:
```cpp
const auto* operand = unaryNode->getOperand();

// Only handle if operand is an identifier (variable)
if (operand && operand->getType() == arduino_ast::ASTNodeType::IDENTIFIER) {
    std::string varName = operand->getValueAs<std::string>();
    // Continue...
} else {
    emitError("Prefix increment/decrement requires variable operand");
    return std::monostate{};
}
```

**Edge Cases to Handle**:
- ❌ `++(5)` - operand is NumberNode, not IdentifierNode
- ❌ `++(x + y)` - operand is BinaryOpNode, not IdentifierNode
- ✅ `++x` - operand is IdentifierNode, valid

**Validation**: Ensure error message for non-variable operands

#### Task 2.3: Retrieve Variable from ScopeManager
**Code to Add**:
```cpp
Variable* var = scopeManager_->getVariable(varName);

if (var) {
    // Proceed with increment/decrement
} else {
    emitError("Undefined variable in prefix operation: " + varName);
    return std::monostate{};
}
```

**Edge Cases**:
- ❌ `++undefinedVar` - variable doesn't exist
- ✅ `++x` - variable exists in current scope
- ✅ `++globalVar` - variable exists in parent scope

**Validation**: Proper error handling for undefined variables

#### Task 2.4: Implement Type-Safe Increment/Decrement Logic
**Code to Add**:
```cpp
CommandValue currentValue = var->value;
CommandValue newValue = currentValue;

// Apply prefix operation
if (op == "++") {
    if (std::holds_alternative<int32_t>(currentValue)) {
        newValue = std::get<int32_t>(currentValue) + 1;
    } else if (std::holds_alternative<double>(currentValue)) {
        newValue = std::get<double>(currentValue) + 1.0;
    } else {
        // Fallback: Try to convert to number and increment
        newValue = convertToInt(currentValue) + 1;
    }
} else { // op == "--"
    if (std::holds_alternative<int32_t>(currentValue)) {
        newValue = std::get<int32_t>(currentValue) - 1;
    } else if (std::holds_alternative<double>(currentValue)) {
        newValue = std::get<double>(currentValue) - 1.0;
    } else {
        // Fallback: Try to convert to number and decrement
        newValue = convertToInt(currentValue) - 1;
    }
}
```

**Type Handling Matrix**:
| Current Type | Operator | Result Type | Implementation |
|--------------|----------|-------------|----------------|
| int32_t | ++ | int32_t | `value + 1` |
| int32_t | -- | int32_t | `value - 1` |
| double | ++ | double | `value + 1.0` |
| double | -- | double | `value - 1.0` |
| Other | ++/-- | int32_t | `convertToInt(value) ± 1` |

**Validation**: Test with various types to ensure correct type preservation

#### Task 2.5: Update Variable and Emit VAR_SET Command
**Code to Add**:
```cpp
// Update variable with new value
var->setValue(newValue);

// Emit VAR_SET command to match JavaScript behavior
emitVarSet(varName, commandValueToJsonString(newValue));
```

**Cross-Platform Parity Check**:
- ✅ Variable updated in scopeManager (internal state)
- ✅ VAR_SET command emitted (external command stream)
- ✅ Command format matches JavaScript output

**Validation**: Check that JSON output matches JavaScript VAR_SET format

#### Task 2.6: Return Correct Value (PREFIX SEMANTICS)
**Code to Add**:
```cpp
// PREFIX SEMANTICS: Return the new value (after increment/decrement)
// This is critical for expressions like "int y = ++x" which should assign the incremented value
return newValue;
```

**Semantic Validation**:
- ✅ `int y = ++x;` → y gets incremented value of x
- ✅ `Serial.println(++x);` → prints incremented value
- ✅ `if (++count > 10)` → condition uses incremented value

**Validation**: Verify return value is NEW value, not OLD value

#### Task 2.7: Preserve Existing Unary Operator Handling
**Code to Add** (after prefix handling):
```cpp
// For all other unary operators, use evaluateUnaryOperation
CommandValue operand = evaluateExpression(const_cast<arduino_ast::ASTNode*>(unaryNode->getOperand()));
return evaluateUnaryOperation(op, operand);
```

**Regression Prevention**:
- ✅ Operators `-`, `+`, `!`, `~`, `*`, `&` still work correctly
- ✅ Only `++` and `--` take special path
- ✅ No impact on other unary operators

**Validation**: Test other unary operators to ensure no regression

---

### PHASE 3: ERROR MESSAGE UPDATES

#### Task 3.1: Update evaluateUnaryOperation() Error Message
**File**: `/mnt/d/Devel/ASTInterpreter/src/cpp/ASTInterpreter.cpp` lines 6732-6736

**Current Code**:
```cpp
} else if (op == "++" || op == "--") {
    emitError("Increment/decrement operators require variable context");
    return std::monostate{};
}
```

**Updated Code**:
```cpp
} else if (op == "++" || op == "--") {
    // PREFIX increment/decrement should be handled in evaluateExpression context
    // This code path should never be reached if implementation is correct
    emitError("INTERNAL ERROR: Prefix increment/decrement reached evaluateUnaryOperation (should be handled in evaluateExpression)");
    return std::monostate{};
}
```

**Rationale**:
- Makes it clear this is an internal error (implementation bug)
- Helps with future debugging if this path is accidentally triggered
- Documents the correct implementation location

**Validation**: This error should NEVER appear in normal operation

---

### PHASE 4: BUILD AND TESTING

#### Task 4.1: Clean Build
**Commands**:
```bash
cd /mnt/d/Devel/ASTInterpreter/build
make clean
make arduino_ast_interpreter
```

**Expected**: Zero compilation errors, clean build

**Validation**: Check for warnings related to modified code

#### Task 4.2: Test Single Example (107)
**Command**:
```bash
./validate_cross_platform 107 107
```

**Expected Output**:
```
Test 107: EXACT MATCH ✅
Success rate: 100%
```

**Validation Steps**:
1. Check for ERROR commands in output (should be ZERO)
2. Verify `x: 11` (not `x: 10`)
3. Verify `y: 12` (not `y: null`)
4. Verify `z: 11` (not `z: null`)
5. Verify `Final result: 120` (not `Final result: 0`)

#### Task 4.3: Verify Command Stream Parity
**Compare**:
```bash
# Check C++ output
grep "VAR_SET" build/test107_cpp.json | grep -E '(x|y|z)'

# Check JavaScript reference
grep "VAR_SET" test_data/example_107.commands | grep -E '(x|y|z)'
```

**Expected Matches**:
```json
{"type":"VAR_SET","variable":"x","value":10}
{"type":"VAR_SET","variable":"x","value":11}  // ++x
{"type":"VAR_SET","variable":"y","value":11}  // int y = ++x
{"type":"VAR_SET","variable":"y","value":12}  // y++
{"type":"VAR_SET","variable":"z","value":11}  // int z = y++
```

**Validation**: Perfect 1:1 match between C++ and JavaScript

#### Task 4.4: Regression Testing - Adjacent Tests
**Command**:
```bash
./validate_cross_platform 105 110
```

**Expected**: All previously passing tests still pass
- Test 105: Status unchanged
- Test 106: EXACT MATCH (already fixed)
- Test 107: EXACT MATCH ✅ (newly fixed)
- Test 108: Status unchanged
- Test 109: Status unchanged
- Test 110: Status unchanged

**Validation**: Zero regressions in surrounding tests

#### Task 4.5: Full Baseline Validation
**Command**:
```bash
./run_baseline_validation.sh 0 134
```

**Expected Baseline**:
- Previous: 121/135 (89.62%)
- New: 122/135 (90.37%)
- Net change: +1 test
- Regressions: 0

**Validation**: Record exact passing test list for comparison

---

### PHASE 5: DOCUMENTATION UPDATES

#### Task 5.1: Update Test107 Investigation Document
**File**: `/mnt/d/Devel/ASTInterpreter/docs/Test107_UnaryOperators_Investigation.md`

**Changes**:
1. Update status: `FAILING → Implementation in progress` → `✅ COMPLETELY FIXED`
2. Add "Fix Implementation" section with exact code changes
3. Update "Expected Results After Fix" to "Actual Results"
4. Add "Validation" section with test output

**Validation**: Document accurately reflects final state

#### Task 5.2: Update CLAUDE.md with New Baseline
**File**: `/mnt/d/Devel/ASTInterpreter/CLAUDE.md`

**Add New Section** (at top):
```markdown
# 🎉 VERSION 17.0.0 - PREFIX OPERATORS COMPLETE + 90.37% SUCCESS RATE 🎉

## **OCTOBER 3, 2025 - INCREMENTAL PROGRESS MILESTONE**

### **PREFIX INCREMENT/DECREMENT CROSS-PLATFORM PARITY**

**IMPLEMENTATION COMPLETE**: Fixed prefix increment/decrement operators achieving **122/135 tests passing (90.37% success rate)** with **NET +1 IMPROVEMENT**.

**Key Achievements**:
- ✅ **Test 107 FIXED**: Prefix `++x` and `--x` now work correctly
- ✅ **Type Safety**: Proper int32_t and double type handling
- ✅ **Postfix Already Working**: `x++` and `x--` working via PostfixExpressionNode
- ✅ **Cross-Platform Parity**: Perfect command stream matching with JavaScript
- ✅ **Zero Regressions**: All 121 previously passing tests maintained

**Technical Implementation**:
- **Root Cause**: `evaluateUnaryOperation()` rejected prefix operators (never implemented)
- **Solution**: Handle in `evaluateExpression()` to preserve variable context
- **Pattern**: Follow PostfixExpressionNode model, return NEW value instead of OLD value
- **Files Modified**:
  - `src/cpp/ASTInterpreter.cpp` (evaluateExpression UNARY_OP case)
  - `src/cpp/ASTInterpreter.cpp` (evaluateUnaryOperation error message)

**Baseline Results** (October 3, 2025):
```
Test Range: 0-134
Total Tests: 135
Passing: 122 (90.37%)
Failing: 13 (9.63%)
```

**Passing Tests**: 0-106,108-112,115,117-121,124,131,133,134

**Failing Tests**: 107 → ✅ FIXED, still failing: 113,114,116,122,123,125-130,132
```

**Validation**: Accurate baseline numbers and test lists

#### Task 5.3: Create ULTRATHINK_PLAN.md Completion Summary
**File**: `/mnt/d/Devel/ASTInterpreter/docs/Test107_ULTRATHINK_PLAN.md` (this file)

**Add "Execution Summary" Section**:
- All tasks completed successfully
- Actual vs expected results
- Lessons learned
- Future improvement notes

**Validation**: Complete execution record for future reference

---

### PHASE 6: GIT COMMIT AND PUSH

#### Task 6.1: Stage All Changes
**Command**:
```bash
git add -A
git status
```

**Expected Files**:
- Modified: `src/cpp/ASTInterpreter.cpp`
- Modified: `CLAUDE.md`
- Modified: `docs/Test107_UnaryOperators_Investigation.md`
- Added: `docs/Test107_ULTRATHINK_PLAN.md`

**Validation**: Only expected files staged

#### Task 6.2: Create Descriptive Commit
**Command**:
```bash
git commit -m "$(cat <<'EOF'
Fix Test 107: Implement prefix increment/decrement operators + 90.37% baseline

PROBLEM:
- Prefix operators ++x and --x were not implemented in C++ interpreter
- evaluateUnaryOperation() rejected them with error message
- Postfix operators x++ and x-- already working via PostfixExpressionNode

ROOT CAUSE:
- evaluateUnaryOperation() only receives values, needs variable context
- Implementation was started but never completed (TODO comment)

SOLUTION:
- Handle prefix ++/-- in evaluateExpression() before evaluating operand
- Follow PostfixExpressionNode pattern: extract variable name, update value, emit VAR_SET
- Return NEW value (prefix semantics) vs OLD value (postfix semantics)

FILES MODIFIED:
- src/cpp/ASTInterpreter.cpp (evaluateExpression UNARY_OP case - added prefix handling)
- src/cpp/ASTInterpreter.cpp (evaluateUnaryOperation - improved error message)
- CLAUDE.md (updated baseline to 122/135 tests - 90.37% success rate)
- docs/Test107_UnaryOperators_Investigation.md (status: FIXED)

TECHNICAL DETAILS:
- Type-safe implementation: handles int32_t, double, and fallback conversion
- Proper error handling: undefined variables, non-variable operands
- Cross-platform parity: VAR_SET commands match JavaScript exactly
- Zero regressions: all 121 previously passing tests maintained

TEST RESULTS:
- Test 107: EXACT MATCH ✅
- Baseline: 121 → 122 passing tests (+1 improvement)
- Success Rate: 89.62% → 90.37%
- Regressions: 0

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Validation**: Commit message comprehensive and accurate

#### Task 6.3: Push to GitHub
**Command**:
```bash
git push origin main
```

**Expected**: Clean push, no conflicts

**Validation**: Verify commit appears on GitHub

---

## 🔍 EDGE CASES AND CONSIDERATIONS

### Edge Case Matrix

| Scenario | Input | Expected Behavior | Implementation |
|----------|-------|-------------------|----------------|
| Prefix on int | `int x=10; ++x;` | x becomes 11, returns 11 | ✅ Implemented |
| Prefix on double | `double x=10.5; ++x;` | x becomes 11.5, returns 11.5 | ✅ Implemented |
| Prefix in assignment | `int y = ++x;` | x increments, y gets new value | ✅ Implemented |
| Prefix in expression | `--x * 5` | x decrements, multiply new value | ✅ Implemented |
| Prefix on undefined | `++undefinedVar` | Error: undefined variable | ✅ Error handling |
| Prefix on non-variable | `++(5)` | Error: requires variable | ✅ Error handling |
| Prefix on expression | `++(x+y)` | Error: requires variable | ✅ Error handling |
| Multiple prefix | `++++x` | Nested prefix operations | ✅ Recursive handling |
| Mixed prefix/postfix | `--x * (y++)` | Both work correctly | ✅ Separate implementations |

### Type Preservation Logic

**Integer Operations** (preserve int type):
- `int x = 10; ++x;` → x is int32_t = 11
- `int y = x++;` → y is int32_t = 10

**Floating Point Operations** (preserve double type):
- `double x = 10.5; ++x;` → x is double = 11.5
- `double y = x++;` → y is double = 10.5

**Type Conversion** (fallback):
- If value is neither int32_t nor double, convert to int first
- Applies to: string numbers, boolean, or unusual types

### Regression Prevention Checklist

**Operators NOT Affected**:
- ✅ Unary minus `-x`
- ✅ Unary plus `+x`
- ✅ Logical NOT `!x`
- ✅ Bitwise NOT `~x`
- ✅ Address-of `&x`
- ✅ Dereference `*ptr`

**Operators Modified**:
- ✅ Prefix increment `++x` (NEW implementation)
- ✅ Prefix decrement `--x` (NEW implementation)
- ✅ Postfix increment `x++` (unchanged - already working)
- ✅ Postfix decrement `x--` (unchanged - already working)

---

## 📊 SUCCESS CRITERIA

### Mandatory Requirements (ALL must pass)

1. **✅ Test 107 Exact Match**
   - All Serial.println outputs match JavaScript reference
   - No ERROR commands in output
   - Command stream identical to JavaScript

2. **✅ Zero Regressions**
   - All 121 previously passing tests still pass
   - No new failures introduced
   - Other unary operators unaffected

3. **✅ Type Safety**
   - int32_t operations preserve int type
   - double operations preserve double type
   - Proper conversion fallback for other types

4. **✅ Error Handling**
   - Undefined variables → clear error message
   - Non-variable operands → clear error message
   - No crashes or segfaults

5. **✅ Cross-Platform Parity**
   - VAR_SET commands match JavaScript format
   - Variable updates match JavaScript behavior
   - Return values match JavaScript semantics

### Performance Metrics

**Baseline Improvement**:
- Previous: 121/135 (89.62%)
- Target: 122/135 (90.37%)
- Improvement: +1 test (+0.74%)

**Code Quality**:
- No code duplication
- Clear comments
- Follows existing patterns (PostfixExpressionNode model)
- Maintainable and testable

---

## 🚀 EXECUTION SEQUENCE

**Total Estimated Time**: 60-90 minutes

### Sequence Order (DO NOT SKIP STEPS)

1. **Code Analysis** (15 min)
   - Task 1.1: Verify failure mode
   - Task 1.2: Study PostfixExpressionNode
   - Task 1.3: Analyze JavaScript reference

2. **Implementation** (30 min)
   - Task 2.1: Add prefix operator detection
   - Task 2.2: Extract variable name
   - Task 2.3: Retrieve variable from scope
   - Task 2.4: Implement increment/decrement logic
   - Task 2.5: Update variable and emit command
   - Task 2.6: Return correct value
   - Task 2.7: Preserve existing operator handling

3. **Error Messages** (5 min)
   - Task 3.1: Update evaluateUnaryOperation() message

4. **Testing** (20 min)
   - Task 4.1: Clean build
   - Task 4.2: Test example 107
   - Task 4.3: Verify command stream parity
   - Task 4.4: Regression test adjacent tests
   - Task 4.5: Full baseline validation

5. **Documentation** (10 min)
   - Task 5.1: Update Test107 investigation
   - Task 5.2: Update CLAUDE.md baseline
   - Task 5.3: Complete ULTRATHINK_PLAN summary

6. **Git Commit** (10 min)
   - Task 6.1: Stage changes
   - Task 6.2: Create commit
   - Task 6.3: Push to GitHub

---

## 📝 NOTES AND OBSERVATIONS

### Key Insights

1. **Variable Context is Critical**: The core issue was that `evaluateUnaryOperation()` received computed values, losing the variable reference needed for updates.

2. **Pattern Consistency**: Following the PostfixExpressionNode pattern ensures consistency and reduces bugs.

3. **Semantic Difference**: The ONLY difference between prefix and postfix is the return value:
   - Prefix: return NEW value (after modification)
   - Postfix: return OLD value (before modification)

4. **Type Preservation**: Maintaining type safety (int vs double) is important for Arduino compatibility.

### Lessons for Future Fixes

1. Always check if similar functionality exists elsewhere (PostfixExpressionNode was the perfect reference)
2. Understand the data flow - where do we have access to what information?
3. Follow existing patterns rather than inventing new approaches
4. Test edge cases early to catch issues before full implementation

### Potential Future Enhancements

1. **Compound Assignment Operators**: `+=`, `-=`, `*=`, `/=`, etc. could follow same pattern
2. **Pre-increment Optimization**: Could optimize `for(int i=0; i<10; ++i)` to avoid temporary value creation
3. **Static Analysis**: Could detect `++` on non-lvalue expressions at parse time

---

## ✅ COMPLETION CHECKLIST

- [ ] All Phase 1 tasks complete
- [ ] All Phase 2 tasks complete
- [ ] All Phase 3 tasks complete
- [ ] All Phase 4 tasks complete
- [ ] All Phase 5 tasks complete
- [ ] All Phase 6 tasks complete
- [ ] Test 107: EXACT MATCH ✅
- [ ] Baseline: 122/135 (90.37%)
- [ ] Zero regressions confirmed
- [ ] Documentation updated
- [ ] Git commit pushed
- [ ] ULTRATHINK_PLAN execution summary written

---

**STATUS**: PLAN READY FOR EXECUTION
**NEXT ACTION**: Begin Phase 1, Task 1.1
