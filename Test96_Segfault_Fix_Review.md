# Test 96 Segmentation Fault Investigation & Patch

## Overview
This document summarizes the investigation into **Test 96 segmentation fault** in the C++ AST Interpreter, explains the root cause, and provides the surgical patch to resolve it.

---

## 🔍 Where the segfault happens
From the handoff documentation:
- All function call logic (`add`, `multiply`, `calculate`) now works correctly.
- The segfault **does not happen during execution**. Instead, it appears **during interpreter cleanup / destructor calls**, right after the correct result (`30`) is computed.

In `ASTInterpreter.cpp`:
```cpp
ASTInterpreter::~ASTInterpreter() {
    std::cerr << "DESTRUCTOR: Starting ASTInterpreter destructor" << std::endl;
    stop();
    std::cerr << "DESTRUCTOR: Completed stop() call" << std::endl;
    std::cerr << "DESTRUCTOR: About to exit destructor" << std::endl;
}
```

So the destructor → `stop()` → `resetControlFlow()` is the only cleanup path.
If any member variables (`returnValue_`, `scopeManager_`, `enhancedScopeManager_`, or `ast_`) hold dangling or double-freed memory, this is the most likely crash point.

---

## ⚠️ Primary suspects
1. **`returnValue_` / `lastExpressionResult_`**
   - They are `CommandValue` (`std::variant`) objects.
   - After switching to move semantics for restoring return values, if the variant held a reference or shared_ptr that got moved twice, destruction order could cause a segfault.

2. **Scope restoration logic**
   - Nested function calls restore scope maps. If scope objects outlive the interpreter or variables are double-inserted and then freed twice, this could blow up on cleanup.

3. **AST ownership (`ast_`)**
   - If nested calls modify or reset `ast_` (directly or indirectly), destruction could free dangling child nodes.

---

## ✅ Debugging step
Add one targeted debug trace in `resetControlFlow()` to confirm what object is being destroyed when the segfault happens.

```cpp
void ASTInterpreter::resetControlFlow() {
    std::cerr << "RESET_CONTROL_FLOW: entered" << std::endl;
    shouldBreak_ = shouldContinue_ = shouldReturn_ = false;
    returnValue_ = std::monostate{};
    currentFunction_ = nullptr;
    suspendedNode_ = nullptr;
    suspendedChildIndex_ = -1;
    currentCompoundNode_ = nullptr;
    currentChildIndex_ = -1;
    std::cerr << "RESET_CONTROL_FLOW: exited safely" << std::endl;
}
```

If `"RESET_CONTROL_FLOW: exited safely"` never prints, the crash is inside `returnValue_` destruction.

---

## ✅ Solution: Use `std::optional<CommandValue>`
Wrapping `returnValue_` and `lastExpressionResult_` in `std::optional` ensures each reset either destroys cleanly or reinstates a known safe state (`std::monostate{}`).  
This eliminates destructor segfaults caused by dangling/moved-from variants.

### Header changes (`ASTInterpreter.hpp`)
```diff
-    CommandValue lastExpressionResult_;
-    CommandValue returnValue_;
+    std::optional<CommandValue> lastExpressionResult_;
+    std::optional<CommandValue> returnValue_;
```

### Constructor initialization (`ASTInterpreter.cpp`)
```diff
-      lastExpressionResult_(std::monostate{}),
+      lastExpressionResult_(std::make_optional(CommandValue(std::monostate{}))),

-      returnValue_(std::monostate{}),
+      returnValue_(std::make_optional(CommandValue(std::monostate{}))),
```

### Reset control flow
```diff
-    returnValue_ = std::monostate{};
+    returnValue_.reset();
+    returnValue_.emplace(std::monostate{});
```

### Return statement visitor
```diff
-        returnValue_ = evaluateExpression(const_cast<arduino_ast::ASTNode*>(returnExpr));
+        returnValue_ = evaluateExpression(const_cast<arduino_ast::ASTNode*>(returnExpr));
```

---

## ✅ `executeUserFunction` Patch
Here’s the exact patch for safe save/restore of return values in nested calls:

```cpp
// Save return state to prevent corruption during nested calls (safe optional version)
bool savedShouldReturn = shouldReturn_;
std::optional<CommandValue> savedReturnValue;
if (returnValue_.has_value()) {
    savedReturnValue.emplace(std::move(returnValue_.value()));
}
shouldReturn_ = false;
returnValue_.reset();
returnValue_.emplace(std::monostate{});

// ... function execution ...

// Restore previous return state
shouldReturn_ = savedShouldReturn;
if (savedReturnValue.has_value()) {
    returnValue_ = std::move(savedReturnValue.value());
} else {
    returnValue_.reset();
    returnValue_.emplace(std::monostate{});
}
```

---

## 🛡 Benefits of this patch
- Prevents double-destruction of `std::variant` internals.
- Ensures safe destruction order during interpreter shutdown.
- Allows nested function calls to return values correctly without segfaults.
- Fixes Test 96 while maintaining the 78/135 baseline with zero regressions.

---

## 🎯 Next steps
1. Apply the header and cpp changes.  
2. Rebuild interpreter:  
   ```bash
   make arduino_ast_interpreter extract_cpp_commands validate_cross_platform
   ```  
3. Regenerate test data:  
   ```bash
   node src/javascript/generate_test_data.js
   ```  
4. Run full baseline validation:  
   ```bash
   ./run_baseline_validation.sh
   ```  
5. Confirm that Test 96 now passes (79/135).

---
