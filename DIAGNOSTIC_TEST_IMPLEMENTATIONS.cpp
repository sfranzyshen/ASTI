/**
 * Test 96 Segmentation Fault Diagnostic Test Implementations
 *
 * These are alternative implementations of executeUserFunction to systematically
 * isolate the exact cause of the segmentation fault during nested function returns.
 *
 * Usage: Replace the existing executeUserFunction implementation with each version
 * sequentially, rebuild tools, and test to identify which component causes the crash.
 */

// =============================================================================
// TEST 1: MINIMAL VERSION - NO STATE MANAGEMENT
// =============================================================================
// Purpose: Test if basic CommandValue return works without any state management
// If this works: Issue is in state management logic
// If this fails: Issue is in fundamental CommandValue return mechanism

CommandValue ASTInterpreter::executeUserFunction_Minimal(
    const std::string& name,
    const arduino_ast::FuncDefNode* funcDef,
    const std::vector<CommandValue>& args) {

    debugLog("executeUserFunction_Minimal: Starting " + name);

    // NO return state management
    // NO scope restoration
    // Basic execution only

    if (!funcDef) {
        debugLog("executeUserFunction_Minimal: Function definition is null");
        return std::monostate{};
    }

    // Push new scope for function parameters
    scopeManager_->pushScope();

    // Set up parameters (simplified)
    const auto& parameters = funcDef->getParameters();
    for (size_t i = 0; i < std::min(args.size(), parameters.size()); ++i) {
        const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(parameters[i].get());
        if (paramNode) {
            const auto* declarator = paramNode->getDeclarator();
            if (const auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
                std::string paramName = declNode->getName();

                Variable paramVar;
                paramVar.type = "auto";
                paramVar.value = args[i];
                paramVar.isConst = false;

                scopeManager_->setVariable(paramName, paramVar);
                debugLog("executeUserFunction_Minimal: Set parameter " + paramName);
            }
        }
    }

    // Execute function body
    const auto* body = funcDef->getBody();
    if (body) {
        recursionDepth_++;
        body->accept(*this);
        recursionDepth_--;
    }

    // Get return value
    CommandValue result = returnValue_;

    // Clean up
    scopeManager_->popScope();

    debugLog("executeUserFunction_Minimal: Returning from " + name);
    return result;  // TEST POINT: Does this basic return cause crash?
}

// =============================================================================
// TEST 2: RETURN STATE ONLY - NO SCOPE MANAGEMENT
// =============================================================================
// Purpose: Test if return state management causes the crash
// If TEST 1 works but this fails: Issue is in return state management
// If both work: Issue is in scope restoration

CommandValue ASTInterpreter::executeUserFunction_ReturnStateOnly(
    const std::string& name,
    const arduino_ast::FuncDefNode* funcDef,
    const std::vector<CommandValue>& args) {

    debugLog("executeUserFunction_ReturnStateOnly: Starting " + name);

    // INCLUDE return state management
    bool savedShouldReturn = shouldReturn_;
    shouldReturn_ = false;
    CommandValue originalReturnValue = std::move(returnValue_);
    returnValue_ = std::monostate{};

    // NO scope restoration

    if (!funcDef) {
        debugLog("executeUserFunction_ReturnStateOnly: Function definition is null");
        shouldReturn_ = savedShouldReturn;
        returnValue_ = std::move(originalReturnValue);
        return std::monostate{};
    }

    // Basic function execution (same as TEST 1)
    scopeManager_->pushScope();

    const auto& parameters = funcDef->getParameters();
    for (size_t i = 0; i < std::min(args.size(), parameters.size()); ++i) {
        const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(parameters[i].get());
        if (paramNode) {
            const auto* declarator = paramNode->getDeclarator();
            if (const auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
                std::string paramName = declNode->getName();

                Variable paramVar;
                paramVar.type = "auto";
                paramVar.value = args[i];
                paramVar.isConst = false;

                scopeManager_->setVariable(paramName, paramVar);
            }
        }
    }

    const auto* body = funcDef->getBody();
    if (body) {
        recursionDepth_++;
        body->accept(*this);
        recursionDepth_--;
    }

    CommandValue result = returnValue_;
    scopeManager_->popScope();

    // RESTORE return state
    shouldReturn_ = savedShouldReturn;
    returnValue_ = std::move(originalReturnValue);

    debugLog("executeUserFunction_ReturnStateOnly: Returning from " + name);
    return result;  // TEST POINT: Does return state management cause crash?
}

// =============================================================================
// TEST 3: SCOPE MANAGEMENT ONLY - NO RETURN STATE
// =============================================================================
// Purpose: Test if scope restoration causes the crash
// If TEST 1 works but this fails: Issue is in scope restoration
// If both work: Issue is combination of both features

CommandValue ASTInterpreter::executeUserFunction_ScopeOnly(
    const std::string& name,
    const arduino_ast::FuncDefNode* funcDef,
    const std::vector<CommandValue>& args) {

    debugLog("executeUserFunction_ScopeOnly: Starting " + name);

    // NO return state management

    // INCLUDE scope restoration
    std::unordered_map<std::string, Variable> savedScope;
    bool shouldRestoreScope = (recursionDepth_ > 0);
    if (shouldRestoreScope && scopeManager_) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            savedScope = *currentScope;  // TEST POINT: Does this deep copy cause issues?
        }
    }

    if (!funcDef) {
        debugLog("executeUserFunction_ScopeOnly: Function definition is null");
        return std::monostate{};
    }

    // Basic function execution
    scopeManager_->pushScope();

    const auto& parameters = funcDef->getParameters();
    for (size_t i = 0; i < std::min(args.size(), parameters.size()); ++i) {
        const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(parameters[i].get());
        if (paramNode) {
            const auto* declarator = paramNode->getDeclarator();
            if (const auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
                std::string paramName = declNode->getName();

                Variable paramVar;
                paramVar.type = "auto";
                paramVar.value = args[i];
                paramVar.isConst = false;

                scopeManager_->setVariable(paramName, paramVar);
            }
        }
    }

    const auto* body = funcDef->getBody();
    if (body) {
        recursionDepth_++;
        body->accept(*this);
        recursionDepth_--;
    }

    CommandValue result = returnValue_;
    scopeManager_->popScope();

    // RESTORE scope
    if (shouldRestoreScope && scopeManager_ && !savedScope.empty()) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            currentScope->clear();
            for (const auto& var : savedScope) {
                currentScope->insert(var);  // TEST POINT: Does scope restoration cause crash?
            }
        }
    }

    debugLog("executeUserFunction_ScopeOnly: Returning from " + name);
    return result;
}

// =============================================================================
// TEST 4: COPY SEMANTICS - NO MOVE OPERATIONS
// =============================================================================
// Purpose: Test if std::move operations cause the crash
// If previous tests work but original fails: Issue is in move semantics

CommandValue ASTInterpreter::executeUserFunction_CopySemantics(
    const std::string& name,
    const arduino_ast::FuncDefNode* funcDef,
    const std::vector<CommandValue>& args) {

    debugLog("executeUserFunction_CopySemantics: Starting " + name);

    // Use COPY semantics instead of move
    bool savedShouldReturn = shouldReturn_;
    shouldReturn_ = false;
    CommandValue originalReturnValue = returnValue_;  // COPY not move
    returnValue_ = std::monostate{};

    // Scope management with copy semantics
    std::unordered_map<std::string, Variable> savedScope;
    bool shouldRestoreScope = (recursionDepth_ > 0);
    if (shouldRestoreScope && scopeManager_) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            savedScope = *currentScope;
        }
    }

    if (!funcDef) {
        debugLog("executeUserFunction_CopySemantics: Function definition is null");
        shouldReturn_ = savedShouldReturn;
        returnValue_ = originalReturnValue;  // COPY not move
        return std::monostate{};
    }

    // Function execution (same as before)
    scopeManager_->pushScope();

    const auto& parameters = funcDef->getParameters();
    for (size_t i = 0; i < std::min(args.size(), parameters.size()); ++i) {
        const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(parameters[i].get());
        if (paramNode) {
            const auto* declarator = paramNode->getDeclarator();
            if (const auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
                std::string paramName = declNode->getName();

                Variable paramVar;
                paramVar.type = "auto";
                paramVar.value = args[i];
                paramVar.isConst = false;

                scopeManager_->setVariable(paramName, paramVar);
            }
        }
    }

    const auto* body = funcDef->getBody();
    if (body) {
        recursionDepth_++;
        body->accept(*this);
        recursionDepth_--;
    }

    CommandValue result = returnValue_;
    scopeManager_->popScope();

    // Restore scope (same as before)
    if (shouldRestoreScope && scopeManager_ && !savedScope.empty()) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            currentScope->clear();
            for (const auto& var : savedScope) {
                currentScope->insert(var);
            }
        }
    }

    // Restore return state with COPY semantics
    shouldReturn_ = savedShouldReturn;
    returnValue_ = originalReturnValue;  // COPY not move

    debugLog("executeUserFunction_CopySemantics: Returning from " + name);
    return result;  // TEST POINT: Do copy semantics fix the crash?
}

// =============================================================================
// TEST 5: HEAP ALLOCATION - AVOID STACK CORRUPTION
// =============================================================================
// Purpose: Test if stack corruption during unwinding is the issue
// If this works: Issue is in stack-based variable destruction

CommandValue ASTInterpreter::executeUserFunction_HeapAllocation(
    const std::string& name,
    const arduino_ast::FuncDefNode* funcDef,
    const std::vector<CommandValue>& args) {

    debugLog("executeUserFunction_HeapAllocation: Starting " + name);

    // Use heap allocation for saved state
    auto savedReturnState = std::make_unique<std::pair<bool, CommandValue>>(
        shouldReturn_, std::move(returnValue_)
    );
    shouldReturn_ = false;
    returnValue_ = std::monostate{};

    auto savedScope = std::make_unique<std::unordered_map<std::string, Variable>>();
    bool shouldRestoreScope = (recursionDepth_ > 0);
    if (shouldRestoreScope && scopeManager_) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            *savedScope = *currentScope;
        }
    }

    if (!funcDef) {
        debugLog("executeUserFunction_HeapAllocation: Function definition is null");
        shouldReturn_ = savedReturnState->first;
        returnValue_ = std::move(savedReturnState->second);
        return std::monostate{};
    }

    // Function execution (same)
    scopeManager_->pushScope();

    const auto& parameters = funcDef->getParameters();
    for (size_t i = 0; i < std::min(args.size(), parameters.size()); ++i) {
        const auto* paramNode = dynamic_cast<const arduino_ast::ParamNode*>(parameters[i].get());
        if (paramNode) {
            const auto* declarator = paramNode->getDeclarator();
            if (const auto* declNode = dynamic_cast<const arduino_ast::DeclaratorNode*>(declarator)) {
                std::string paramName = declNode->getName();

                Variable paramVar;
                paramVar.type = "auto";
                paramVar.value = args[i];
                paramVar.isConst = false;

                scopeManager_->setVariable(paramName, paramVar);
            }
        }
    }

    const auto* body = funcDef->getBody();
    if (body) {
        recursionDepth_++;
        body->accept(*this);
        recursionDepth_--;
    }

    CommandValue result = returnValue_;
    scopeManager_->popScope();

    // Restore from heap
    if (shouldRestoreScope && scopeManager_ && !savedScope->empty()) {
        auto currentScope = scopeManager_->getCurrentScope();
        if (currentScope) {
            currentScope->clear();
            for (const auto& var : *savedScope) {
                currentScope->insert(var);
            }
        }
    }

    shouldReturn_ = savedReturnState->first;
    returnValue_ = std::move(savedReturnState->second);

    debugLog("executeUserFunction_HeapAllocation: Returning from " + name);
    return result;  // TEST POINT: Does heap allocation prevent crash?
}

// =============================================================================
// USAGE INSTRUCTIONS
// =============================================================================
/*
To use these diagnostic tests:

1. Backup current implementation:
   cp src/cpp/ASTInterpreter.cpp src/cpp/ASTInterpreter.cpp.backup_78tests

2. Replace executeUserFunction with executeUserFunction_Minimal in ASTInterpreter.cpp

3. Rebuild and test:
   cd build && make arduino_ast_interpreter extract_cpp_commands
   cd /mnt/d/Devel/ASTInterpreter && timeout 10 ./build/extract_cpp_commands 96

4. If TEST 1 works, try TEST 2, then TEST 3, etc.

5. Document which version works/fails to isolate exact cause

6. Implement targeted fix based on findings

7. Restore original if all tests fail:
   cp src/cpp/ASTInterpreter.cpp.backup_78tests src/cpp/ASTInterpreter.cpp
*/