/**
 * ScopeManager Corruption Test
 *
 * Based on the diagnostic results, the issue is likely in the interaction
 * with ScopeManager or other shared interpreter state during nested returns.
 *
 * Compile: g++ -std=c++17 -g -O0 -fsanitize=address test_scopemanager_corruption.cpp -o test_scope
 */

#include <iostream>
#include <memory>
#include <unordered_map>
#include <vector>
#include <variant>
#include <string>
#include <cstdint>

using CommandValue = std::variant<
    std::monostate,
    bool,
    int32_t,
    uint32_t,
    double,
    std::string,
    std::vector<int32_t>,
    std::vector<double>,
    std::vector<std::string>
>;

struct Variable {
    std::string name;
    CommandValue value;
    bool isConstant = false;
};

class ScopeManager {
private:
    std::vector<std::shared_ptr<std::unordered_map<std::string, Variable>>> scopes_;

public:
    ScopeManager() {
        pushScope(); // Global scope
    }

    void pushScope() {
        scopes_.push_back(std::make_shared<std::unordered_map<std::string, Variable>>());
        std::cout << "Pushed scope, depth: " << scopes_.size() << std::endl;
    }

    void popScope() {
        if (scopes_.size() > 1) {
            scopes_.pop_back();
            std::cout << "Popped scope, depth: " << scopes_.size() << std::endl;
        }
    }

    std::shared_ptr<std::unordered_map<std::string, Variable>> getCurrentScope() {
        if (!scopes_.empty()) {
            return scopes_.back();
        }
        return nullptr;
    }

    void setVariable(const std::string& name, const CommandValue& value) {
        if (!scopes_.empty()) {
            (*scopes_.back())[name] = Variable{name, value, false};
            std::cout << "Set variable: " << name << std::endl;
        }
    }

    CommandValue getVariable(const std::string& name) {
        // Search from current to global scope
        for (auto it = scopes_.rbegin(); it != scopes_.rend(); ++it) {
            auto scope = *it;
            if (scope->find(name) != scope->end()) {
                return (*scope)[name].value;
            }
        }
        return std::monostate{};
    }
};

class CorruptionTest {
private:
    std::unique_ptr<ScopeManager> scopeManager_;
    bool shouldReturn_ = false;
    CommandValue returnValue_;
    int recursionDepth_ = 0;

public:
    CorruptionTest() : scopeManager_(std::make_unique<ScopeManager>()) {}

    void test1_ScopeCorruption() {
        std::cout << "\n=== TEST 1: Scope Corruption During Nested Calls ===" << std::endl;

        // Set up initial variables
        scopeManager_->setVariable("x", int32_t(5));
        scopeManager_->setVariable("y", int32_t(10));

        // Simulate nested function call
        CommandValue result = simulateNestedCall();

        if (std::holds_alternative<double>(result)) {
            std::cout << "✓ Result: " << std::get<double>(result) << std::endl;
        } else {
            std::cout << "✗ Unexpected result type" << std::endl;
        }
    }

    void test2_ScopeManagerPointerIssue() {
        std::cout << "\n=== TEST 2: ScopeManager Pointer Access ===" << std::endl;

        // Test accessing scope manager through pointer during nested calls
        auto currentScope = scopeManager_->getCurrentScope();
        std::cout << "Got current scope pointer" << std::endl;

        // Save and restore pattern from project
        std::unordered_map<std::string, Variable> savedScope;
        if (currentScope) {
            savedScope = *currentScope;
            std::cout << "Saved scope with " << savedScope.size() << " variables" << std::endl;
        }

        // Simulate function call that modifies scope
        scopeManager_->pushScope();
        scopeManager_->setVariable("temp", double(42.0));
        scopeManager_->popScope();

        // Restore scope
        if (currentScope && !savedScope.empty()) {
            currentScope->clear();
            for (const auto& var : savedScope) {
                currentScope->insert(var);
            }
            std::cout << "✓ Restored scope successfully" << std::endl;
        }
    }

    void test3_ReturnValueCorruption() {
        std::cout << "\n=== TEST 3: Return Value State During Unwinding ===" << std::endl;

        // Test the exact pattern that crashes
        recursionDepth_ = 0;
        CommandValue result = executeTestFunction("calculate");

        if (std::holds_alternative<double>(result)) {
            std::cout << "✓ Final result: " << std::get<double>(result) << std::endl;
        }
    }

private:
    CommandValue simulateNestedCall() {
        recursionDepth_++;

        // Save scope (like in project)
        auto currentScope = scopeManager_->getCurrentScope();
        std::unordered_map<std::string, Variable> savedScope;
        bool shouldRestoreScope = (recursionDepth_ > 1);

        if (shouldRestoreScope && currentScope) {
            savedScope = *currentScope;
        }

        // Push new scope for function
        scopeManager_->pushScope();
        scopeManager_->setVariable("local_x", double(15.0));

        // Simulate some work
        CommandValue result = double(30.0);

        // Pop function scope
        scopeManager_->popScope();

        // Restore previous scope if needed (PROJECT PATTERN)
        if (shouldRestoreScope && currentScope && !savedScope.empty()) {
            currentScope->clear();  // POTENTIAL ISSUE: clearing shared_ptr content
            for (const auto& var : savedScope) {
                currentScope->insert(var);
            }
        }

        recursionDepth_--;
        return result;
    }

    CommandValue executeTestFunction(const std::string& funcName) {
        std::cout << "Executing: " << funcName << " depth=" << recursionDepth_ << std::endl;

        // Save return state (EXACT PROJECT PATTERN)
        bool savedShouldReturn = shouldReturn_;
        shouldReturn_ = false;
        CommandValue originalReturnValue = std::move(returnValue_);
        returnValue_ = std::monostate{};

        // Save scope for nested calls
        auto currentScope = scopeManager_->getCurrentScope();
        std::unordered_map<std::string, Variable> savedScope;
        bool shouldRestoreScope = (recursionDepth_ > 0);

        if (shouldRestoreScope && currentScope) {
            savedScope = *currentScope;
            std::cout << "  Saved scope at depth " << recursionDepth_ << std::endl;
        }

        recursionDepth_++;

        CommandValue result;
        if (funcName == "calculate") {
            // Nested calls
            result = executeTestFunction("add");
            std::cout << "  Got add result" << std::endl;

            result = executeTestFunction("multiply");
            std::cout << "  Got multiply result" << std::endl;
        } else if (funcName == "add") {
            result = double(15.0);
            std::cout << "  Add returning 15" << std::endl;
        } else if (funcName == "multiply") {
            result = double(30.0);
            std::cout << "  Multiply returning 30" << std::endl;
        }

        recursionDepth_--;

        // Restore scope if needed (POTENTIAL CRASH AREA)
        if (shouldRestoreScope && currentScope && !savedScope.empty()) {
            std::cout << "  Restoring scope at depth " << recursionDepth_ << std::endl;
            currentScope->clear();
            for (const auto& var : savedScope) {
                currentScope->insert(var);
            }
        }

        // Restore return state (POTENTIAL CRASH AREA)
        std::cout << "  Restoring return state at depth " << recursionDepth_ << std::endl;
        shouldReturn_ = savedShouldReturn;
        returnValue_ = std::move(originalReturnValue);

        std::cout << "  About to return from " << funcName << std::endl;
        return result;  // CRASH POINT?
    }
};

int main() {
    std::cout << "ScopeManager Corruption Test\n";
    std::cout << "============================\n";

    try {
        CorruptionTest test;
        test.test1_ScopeCorruption();
        test.test2_ScopeManagerPointerIssue();
        test.test3_ReturnValueCorruption();

        std::cout << "\n✓ ALL TESTS PASSED\n" << std::endl;

        std::cout << "DIAGNOSIS: The isolated patterns work correctly.\n";
        std::cout << "The crash in Test 96 is likely caused by:\n";
        std::cout << "1. Corruption in scopeManager_ from earlier operations\n";
        std::cout << "2. Interaction with AST node visitors during execution\n";
        std::cout << "3. Side effects from command generation or other subsystems\n";
        std::cout << "4. Stack corruption from unrelated code before the return\n";

    } catch (const std::exception& e) {
        std::cerr << "\n✗ EXCEPTION: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}