# Test 96 Segmentation Fault Implementation Guide

**Objective:** Fix segmentation fault in nested user-defined function calls to advance from 78/135 to 79/135 passing tests.

## Quick Start

### **Option 1: Run Automated Diagnostic (Recommended)**
```bash
cd /mnt/d/Devel/ASTInterpreter
./test_segfault_diagnosis.sh
```
This will automatically test all diagnostic implementations and generate a results report.

### **Option 2: Manual Step-by-Step Testing**
Follow the manual procedures below for more controlled testing.

## Technical Analysis Summary

### **Primary Suspects (in order of probability)**

1. **std::variant Double-Destruction (High Probability)**
   - Move semantics in return state management may cause CommandValue objects to be destructed twice
   - Evidence: Crash occurs during function return when CommandValue is moved back to returnValue_

2. **Scope Map Deep Copy Issues (Medium Probability)**
   - Deep copy of `std::unordered_map<std::string, Variable>` where Variable contains CommandValue
   - Evidence: Complex objects being copied and restored during nested function calls

3. **Stack Unwinding Corruption (Medium Probability)**
   - Multiple CommandValue objects on stack being destructed during nested return unwinding
   - Evidence: Crash timing aligns with function return stack unwinding

4. **Basic CommandValue Return (Low Probability)**
   - Fundamental issue with std::variant return value handling
   - Evidence: Would affect all functions, but only nested calls crash

## Manual Implementation Procedure

### **Step 1: Backup Current State**
```bash
cd /mnt/d/Devel/ASTInterpreter
cp src/cpp/ASTInterpreter.cpp src/cpp/ASTInterpreter.cpp.backup_78tests
```

### **Step 2: Prepare Diagnostic Implementations**
Copy the diagnostic implementations from `DIAGNOSTIC_TEST_IMPLEMENTATIONS.cpp` into the actual `ASTInterpreter.cpp` file:

1. Add all 5 diagnostic functions to the private section of ASTInterpreter class
2. Add corresponding declarations to the header file if needed

### **Step 3: Test Each Implementation Systematically**

#### **Test 1: Minimal Version (No State Management)**
```bash
# Replace executeUserFunction with executeUserFunction_Minimal
sed -i 's/CommandValue executeUserFunction(/CommandValue executeUserFunction_Original(/g' src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction_Minimal(/executeUserFunction(/g' src/cpp/ASTInterpreter.cpp

# Rebuild and test
cd build && make arduino_ast_interpreter extract_cpp_commands
cd /mnt/d/Devel/ASTInterpreter && timeout 10 ./build/extract_cpp_commands 96

# If successful: Issue is in state management
# If crash persists: Issue is in basic CommandValue return
```

#### **Test 2: Return State Only (If Test 1 Succeeds)**
```bash
# Restore original and test return state management
cp src/cpp/ASTInterpreter.cpp.backup_78tests src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction(/executeUserFunction_Original(/g' src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction_ReturnStateOnly(/executeUserFunction(/g' src/cpp/ASTInterpreter.cpp

# Rebuild and test
cd build && make arduino_ast_interpreter extract_cpp_commands
cd /mnt/d/Devel/ASTInterpreter && timeout 10 ./build/extract_cpp_commands 96

# If successful: Scope restoration is the issue
# If crash persists: Return state management is the issue
```

#### **Test 3: Scope Only (If Test 1 Succeeds)**
```bash
# Test scope management isolation
cp src/cpp/ASTInterpreter.cpp.backup_78tests src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction(/executeUserFunction_Original(/g' src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction_ScopeOnly(/executeUserFunction(/g' src/cpp/ASTInterpreter.cpp

# Rebuild and test
cd build && make arduino_ast_interpreter extract_cpp_commands
cd /mnt/d/Devel/ASTInterpreter && timeout 10 ./build/extract_cpp_commands 96
```

#### **Test 4: Copy Semantics (If Move Semantics Suspected)**
```bash
# Test copy instead of move operations
cp src/cpp/ASTInterpreter.cpp.backup_78tests src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction(/executeUserFunction_Original(/g' src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction_CopySemantics(/executeUserFunction(/g' src/cpp/ASTInterpreter.cpp

# Rebuild and test
cd build && make arduino_ast_interpreter extract_cpp_commands
cd /mnt/d/Devel/ASTInterpreter && timeout 10 ./build/extract_cpp_commands 96
```

#### **Test 5: Heap Allocation (If Stack Corruption Suspected)**
```bash
# Test heap allocation to avoid stack issues
cp src/cpp/ASTInterpreter.cpp.backup_78tests src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction(/executeUserFunction_Original(/g' src/cpp/ASTInterpreter.cpp
sed -i 's/executeUserFunction_HeapAllocation(/executeUserFunction(/g' src/cpp/ASTInterpreter.cpp

# Rebuild and test
cd build && make arduino_ast_interpreter extract_cpp_commands
cd /mnt/d/Devel/ASTInterpreter && timeout 10 ./build/extract_cpp_commands 96
```

### **Step 4: Validate Each Test**
After each test that succeeds:
```bash
# Ensure no regressions in baseline
cd /mnt/d/Devel/ASTInterpreter/build
./validate_cross_platform 0 5

# Check if core functionality intact
cd /mnt/d/Devel/ASTInterpreter
./run_baseline_validation.sh 0 10
```

### **Step 5: Implement Targeted Fix**
Based on which test succeeds, implement the appropriate fix:

#### **If Minimal Version Works:**
Issue is in state management. Implement alternative approach:
```cpp
// Alternative: Use simple flag-based state management
struct FunctionState {
    bool shouldReturn;
    CommandValue returnValue;
    int scopeDepth;
};

// Save state without complex move operations
FunctionState savedState = {shouldReturn_, returnValue_, scopeManager_->getCurrentDepth()};
```

#### **If Copy Semantics Works:**
Issue is in move operations. Implement copy-based approach:
```cpp
// Use copy semantics for return state
CommandValue originalReturnValue = returnValue_;  // Copy instead of move
// ... later ...
returnValue_ = originalReturnValue;  // Copy instead of move
```

#### **If Scope-Only Fails:**
Issue is in scope restoration. Implement alternative:
```cpp
// Alternative: Selective scope restoration
if (shouldRestoreScope && scopeManager_) {
    // Only restore specific variables, not entire scope
    for (const auto& param : originalParameters) {
        scopeManager_->restoreVariable(param.first, param.second);
    }
}
```

#### **If Heap Allocation Works:**
Issue is in stack unwinding. Use heap-based state management:
```cpp
// Use smart pointers for state management
auto stateManager = std::make_unique<FunctionStateManager>(shouldReturn_, returnValue_);
// ... function execution ...
stateManager->restore(shouldReturn_, returnValue_);
```

### **Step 6: Full Validation**
After implementing the fix:
```bash
# MANDATORY PROCEDURE
cd /mnt/d/Devel/ASTInterpreter/build
make arduino_ast_interpreter extract_cpp_commands validate_cross_platform

cd /mnt/d/Devel/ASTInterpreter
node src/javascript/generate_test_data.js

# Full baseline validation
./run_baseline_validation.sh

# Test specific success
timeout 10 ./build/extract_cpp_commands 96
```

### **Step 7: Verify Success**
```bash
# Check Test 96 specifically
cd /mnt/d/Devel/ASTInterpreter/build
./validate_cross_platform 96 96

# Verify progress
cd /mnt/d/Devel/ASTInterpreter
./run_baseline_validation.sh 96 96

# Should show: 79/135 tests passing (58.52% success rate)
```

## Memory Debugging (If All Tests Fail)

If all diagnostic tests still crash, use memory debugging tools:

### **AddressSanitizer**
```bash
cd /mnt/d/Devel/ASTInterpreter/build
g++ -fsanitize=address -g -O0 -I../src/cpp ../src/cpp/ASTInterpreter.cpp -o debug_interpreter
./debug_interpreter ../test_data/example_096.ast
```

### **Valgrind**
```bash
cd /mnt/d/Devel/ASTInterpreter/build
valgrind --tool=memcheck --leak-check=full ./extract_cpp_commands 96
```

### **GDB Debugging**
```bash
cd /mnt/d/Devel/ASTInterpreter/build
gdb ./extract_cpp_commands
(gdb) run 96
(gdb) bt  # When it crashes, show backtrace
```

## Success Criteria

✅ **Test 96 passes without segmentation fault**
✅ **79/135 tests passing (58.52% success rate)**
✅ **No regressions in existing 78 tests**
✅ **Clean architecture maintained**

## Rollback Procedure

If any approach fails:
```bash
cd /mnt/d/Devel/ASTInterpreter
cp src/cpp/ASTInterpreter.cpp.backup_78tests src/cpp/ASTInterpreter.cpp

# Rebuild to restore baseline
cd build && make arduino_ast_interpreter extract_cpp_commands
cd /mnt/d/Devel/ASTInterpreter && ./run_baseline_validation.sh 0 10

# Should confirm 78/135 baseline restored
```

## Expected Outcomes

**Most Likely:** Copy semantics or minimal version will work, indicating move operation issues
**Secondary:** Scope management is causing the corruption through deep copy operations
**Least Likely:** All tests fail, indicating fundamental CommandValue/std::variant issue requiring architectural change

The systematic approach ensures we identify the exact cause and implement only the necessary fix to advance from 78 to 79 passing tests.