/**
 * CommandValue Segmentation Fault Diagnostic Test
 *
 * This test file diagnoses the segmentation fault occurring during
 * nested function returns with CommandValue objects.
 *
 * Problem: Crash occurs when multiply() returns CommandValue(30) back to calculate()
 *
 * Compile with:
 * g++ -std=c++17 -g -O0 -fsanitize=address -fno-omit-frame-pointer test_commandvalue_segfault.cpp -o test_segfault
 */

#include <iostream>
#include <variant>
#include <vector>
#include <string>
#include <unordered_map>
#include <memory>
#include <cstdint>
#include <cassert>

// Exact CommandValue definition from the project
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

// Variable structure similar to project
struct Variable {
    std::string name;
    CommandValue value;

    Variable() = default;
    Variable(const std::string& n, const CommandValue& v) : name(n), value(v) {}
    Variable(const Variable&) = default;
    Variable(Variable&&) = default;
    Variable& operator=(const Variable&) = default;
    Variable& operator=(Variable&&) = default;
    ~Variable() = default;
};

// Test class simulating the interpreter's structure
class TestInterpreter {
private:
    bool shouldReturn_ = false;
    CommandValue returnValue_;
    int recursionDepth_ = 0;
    std::unordered_map<std::string, Variable> currentScope_;

public:
    // Test 1: Basic CommandValue return
    void test1_BasicReturn() {
        std::cout << "\n=== TEST 1: Basic CommandValue Return ===" << std::endl;

        CommandValue value = double(30.0);
        std::cout << "Created CommandValue with double(30.0)" << std::endl;

        CommandValue returned = returnCommandValue(value);
        std::cout << "Successfully returned CommandValue" << std::endl;

        if (std::holds_alternative<double>(returned)) {
            std::cout << "✓ Value is: " << std::get<double>(returned) << std::endl;
        }
    }

    // Test 2: Move semantics with CommandValue
    void test2_MoveSemantics() {
        std::cout << "\n=== TEST 2: Move Semantics ===" << std::endl;

        CommandValue original = double(15.0);
        std::cout << "Created original CommandValue" << std::endl;

        CommandValue moved = std::move(original);
        std::cout << "Moved CommandValue" << std::endl;

        // original should now be in valid but unspecified state
        std::cout << "Original is monostate: " << std::holds_alternative<std::monostate>(original) << std::endl;
        std::cout << "Moved value is: " << std::get<double>(moved) << std::endl;

        // Test moving back
        original = std::move(moved);
        std::cout << "✓ Moved back successfully" << std::endl;
    }

    // Test 3: Nested function simulation (matching project pattern)
    void test3_NestedFunctionPattern() {
        std::cout << "\n=== TEST 3: Nested Function Pattern ===" << std::endl;

        // Simulate calculate() -> multiply(add(), z)
        recursionDepth_ = 0;
        CommandValue result = simulate_calculate(5, 10, 2);

        if (std::holds_alternative<double>(result)) {
            std::cout << "✓ Final result: " << std::get<double>(result) << std::endl;
        } else {
            std::cout << "✗ Result is not double!" << std::endl;
        }
    }

    // Test 4: Scope save/restore with CommandValue
    void test4_ScopeManagement() {
        std::cout << "\n=== TEST 4: Scope Save/Restore ===" << std::endl;

        // Add some variables to scope
        currentScope_["x"] = Variable("x", int32_t(5));
        currentScope_["y"] = Variable("y", int32_t(10));

        std::cout << "Initial scope size: " << currentScope_.size() << std::endl;

        // Save scope
        std::unordered_map<std::string, Variable> savedScope = currentScope_;
        std::cout << "Saved scope" << std::endl;

        // Modify scope
        currentScope_["z"] = Variable("z", int32_t(15));
        std::cout << "Modified scope size: " << currentScope_.size() << std::endl;

        // Restore scope
        currentScope_.clear();
        for (const auto& var : savedScope) {
            currentScope_.insert(var);
        }
        std::cout << "✓ Restored scope size: " << currentScope_.size() << std::endl;
    }

    // Test 5: Complex variant destruction
    void test5_ComplexVariantDestruction() {
        std::cout << "\n=== TEST 5: Complex Variant Destruction ===" << std::endl;

        {
            CommandValue stringValue = std::string("test string");
            std::cout << "Created string variant" << std::endl;
        }
        std::cout << "String variant destroyed" << std::endl;

        {
            CommandValue vectorValue = std::vector<int32_t>{1, 2, 3, 4, 5};
            std::cout << "Created vector variant" << std::endl;
        }
        std::cout << "Vector variant destroyed" << std::endl;

        {
            CommandValue nestedReturn = simulateNestedReturn();
            std::cout << "✓ Nested return with complex variant successful" << std::endl;
        }
    }

    // Test 6: Exact project pattern reproduction
    void test6_ExactProjectPattern() {
        std::cout << "\n=== TEST 6: Exact Project Pattern ===" << std::endl;

        CommandValue result = executeUserFunction("multiply", {double(15.0), double(2.0)});

        if (std::holds_alternative<double>(result)) {
            std::cout << "✓ executeUserFunction returned: " << std::get<double>(result) << std::endl;
        } else {
            std::cout << "✗ executeUserFunction failed!" << std::endl;
        }
    }

private:
    CommandValue returnCommandValue(CommandValue value) {
        return value;
    }

    CommandValue simulate_add(int x, int y) {
        recursionDepth_++;
        std::cout << "  add(" << x << ", " << y << ") depth=" << recursionDepth_ << std::endl;

        // Simulate the project's pattern
        bool savedShouldReturn = shouldReturn_;
        CommandValue originalReturnValue = std::move(returnValue_);
        shouldReturn_ = false;
        returnValue_ = std::monostate{};

        // Calculate result
        CommandValue result = double(x + y);
        std::cout << "  add() calculated: " << x + y << std::endl;

        // Restore state
        shouldReturn_ = savedShouldReturn;
        returnValue_ = std::move(originalReturnValue);

        recursionDepth_--;
        std::cout << "  add() returning, depth=" << recursionDepth_ << std::endl;
        return result;  // Potential crash point?
    }

    CommandValue simulate_multiply(CommandValue x, CommandValue y) {
        recursionDepth_++;
        std::cout << "  multiply() depth=" << recursionDepth_ << std::endl;

        // Extract values
        double xVal = std::holds_alternative<double>(x) ? std::get<double>(x) : 0.0;
        double yVal = std::holds_alternative<double>(y) ? std::get<double>(y) : 0.0;

        std::cout << "  multiply(" << xVal << ", " << yVal << ")" << std::endl;

        // Simulate the project's pattern
        bool savedShouldReturn = shouldReturn_;
        CommandValue originalReturnValue = std::move(returnValue_);
        shouldReturn_ = false;
        returnValue_ = std::monostate{};

        // Calculate result
        CommandValue result = double(xVal * yVal);
        std::cout << "  multiply() calculated: " << xVal * yVal << std::endl;

        // Restore state
        shouldReturn_ = savedShouldReturn;
        returnValue_ = std::move(originalReturnValue);

        recursionDepth_--;
        std::cout << "  multiply() returning, depth=" << recursionDepth_ << std::endl;
        return result;  // CRASH POINT IN PROJECT?
    }

    CommandValue simulate_calculate(int x, int y, int z) {
        recursionDepth_++;
        std::cout << "calculate(" << x << ", " << y << ", " << z << ") depth=" << recursionDepth_ << std::endl;

        // Nested call: multiply(add(x, y), z)
        CommandValue addResult = simulate_add(x, y);
        std::cout << "calculate() received add result" << std::endl;

        CommandValue multiplyResult = simulate_multiply(addResult, double(z));
        std::cout << "calculate() received multiply result" << std::endl;

        recursionDepth_--;
        return multiplyResult;
    }

    CommandValue simulateNestedReturn() {
        std::vector<std::string> strings = {"one", "two", "three"};
        CommandValue value = strings;

        // Simulate multiple moves
        CommandValue temp = std::move(value);
        value = std::monostate{};

        CommandValue result = std::move(temp);
        return result;
    }

    CommandValue executeUserFunction(const std::string& functionName,
                                    const std::vector<CommandValue>& args) {
        std::cout << "executeUserFunction(" << functionName << ")" << std::endl;

        // Save state (exact project pattern)
        bool savedShouldReturn = shouldReturn_;
        shouldReturn_ = false;
        CommandValue originalReturnValue = std::move(returnValue_);
        returnValue_ = std::monostate{};

        // Save scope for nested calls
        std::unordered_map<std::string, Variable> savedScope;
        bool shouldRestoreScope = (recursionDepth_ > 0);
        if (shouldRestoreScope) {
            savedScope = currentScope_;
        }

        // Simulate function execution
        CommandValue result;
        if (functionName == "multiply" && args.size() == 2) {
            double x = std::holds_alternative<double>(args[0]) ? std::get<double>(args[0]) : 0.0;
            double y = std::holds_alternative<double>(args[1]) ? std::get<double>(args[1]) : 0.0;
            result = double(x * y);
            std::cout << "  Computed: " << x << " * " << y << " = " << (x * y) << std::endl;
        } else {
            result = std::monostate{};
        }

        // Restore scope if needed
        if (shouldRestoreScope && !savedScope.empty()) {
            currentScope_.clear();
            for (const auto& var : savedScope) {
                currentScope_.insert(var);
            }
        }

        // Restore state
        shouldReturn_ = savedShouldReturn;
        returnValue_ = std::move(originalReturnValue);

        std::cout << "executeUserFunction returning" << std::endl;
        return result;  // PROJECT CRASH POINT
    }
};

// Stress test with many nested calls
void stressTest() {
    std::cout << "\n=== STRESS TEST: Deep Nesting ===" << std::endl;

    struct DeepNester {
        int depth = 0;
        CommandValue deepNest(int level) {
            if (level <= 0) {
                return double(42.0);
            }
            depth++;
            std::cout << "  Nesting level " << depth << std::endl;
            CommandValue result = deepNest(level - 1);
            depth--;
            return result;
        }
    };

    DeepNester nester;
    CommandValue result = nester.deepNest(10);
    if (std::holds_alternative<double>(result)) {
        std::cout << "✓ Deep nesting successful: " << std::get<double>(result) << std::endl;
    }
}

// Test with valgrind for memory issues
void valgrindTest() {
    std::cout << "\n=== VALGRIND TEST: Memory Safety ===" << std::endl;

    for (int i = 0; i < 100; ++i) {
        CommandValue val1 = double(i * 1.5);
        CommandValue val2 = std::string("test" + std::to_string(i));
        CommandValue val3 = std::vector<int32_t>{i, i+1, i+2};

        // Move them around
        CommandValue temp = std::move(val1);
        val1 = std::move(val2);
        val2 = std::move(val3);
        val3 = std::move(temp);
    }
    std::cout << "✓ Memory operations completed" << std::endl;
}

int main() {
    std::cout << "CommandValue Segmentation Fault Diagnostic Test\n";
    std::cout << "================================================\n";

    TestInterpreter interpreter;

    try {
        interpreter.test1_BasicReturn();
        interpreter.test2_MoveSemantics();
        interpreter.test3_NestedFunctionPattern();
        interpreter.test4_ScopeManagement();
        interpreter.test5_ComplexVariantDestruction();
        interpreter.test6_ExactProjectPattern();
        stressTest();
        valgrindTest();

        std::cout << "\n✓ ALL TESTS PASSED - No segmentation fault detected!" << std::endl;
        std::cout << "\nThis suggests the issue may be:" << std::endl;
        std::cout << "1. Interaction with other interpreter state not simulated here" << std::endl;
        std::cout << "2. Corruption from earlier in the execution" << std::endl;
        std::cout << "3. Issue with the actual AST node execution (not the return mechanism)" << std::endl;
        std::cout << "4. Memory corruption in scopeManager_ or other shared state" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "\n✗ EXCEPTION: " << e.what() << std::endl;
        return 1;
    } catch (...) {
        std::cerr << "\n✗ UNKNOWN EXCEPTION" << std::endl;
        return 2;
    }

    return 0;
}