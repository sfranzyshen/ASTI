#!/bin/bash

# Test 96 Segmentation Fault Diagnostic Testing Script
# Systematically tests each diagnostic implementation to isolate crash cause

set -e

PROJECT_ROOT="/mnt/d/Devel/ASTInterpreter"
BUILD_DIR="$PROJECT_ROOT/build"
BACKUP_FILE="$PROJECT_ROOT/src/cpp/ASTInterpreter.cpp.backup_78tests"
ORIGINAL_FILE="$PROJECT_ROOT/src/cpp/ASTInterpreter.cpp"
RESULTS_FILE="$PROJECT_ROOT/segfault_test_results.txt"

echo "==================================="
echo "Test 96 Segmentation Fault Diagnosis"
echo "Date: $(date)"
echo "==================================="

# Create backup of current working implementation
echo "Creating backup of current ASTInterpreter.cpp..."
cp "$ORIGINAL_FILE" "$BACKUP_FILE"

# Initialize results file
echo "Test 96 Segmentation Fault Diagnostic Results" > "$RESULTS_FILE"
echo "Date: $(date)" >> "$RESULTS_FILE"
echo "Baseline: 78/135 tests passing (57.77%)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Function to test a specific implementation
test_implementation() {
    local test_name="$1"
    local function_name="$2"

    echo ""
    echo "=========================================="
    echo "Testing: $test_name"
    echo "Function: $function_name"
    echo "=========================================="

    # Replace executeUserFunction with the test version
    echo "Modifying ASTInterpreter.cpp for $test_name..."
    sed -i "s/executeUserFunction(/executeUserFunction_ORIGINAL(/g" "$ORIGINAL_FILE"
    sed -i "s/${function_name}(/executeUserFunction(/g" "$ORIGINAL_FILE"

    # Rebuild tools
    echo "Rebuilding tools..."
    cd "$BUILD_DIR"
    if make arduino_ast_interpreter extract_cpp_commands > /dev/null 2>&1; then
        echo "✅ Build successful"

        # Test Test 96 specifically
        echo "Testing Test 96..."
        cd "$PROJECT_ROOT"
        if timeout 10 ./build/extract_cpp_commands 96 > /dev/null 2>&1; then
            echo "✅ $test_name: SUCCESS - No segmentation fault"
            echo "$test_name: ✅ SUCCESS - No segmentation fault" >> "$RESULTS_FILE"

            # Run basic validation to ensure core functionality intact
            echo "Running basic validation check..."
            cd "$BUILD_DIR"
            if ./validate_cross_platform 0 5 > /dev/null 2>&1; then
                echo "✅ Basic validation passed"
                echo "  Basic validation: ✅ PASSED" >> "$RESULTS_FILE"
            else
                echo "⚠️  Basic validation failed - may have broken core functionality"
                echo "  Basic validation: ❌ FAILED" >> "$RESULTS_FILE"
            fi
        else
            echo "❌ $test_name: FAILED - Segmentation fault persists"
            echo "$test_name: ❌ FAILED - Segmentation fault persists" >> "$RESULTS_FILE"
        fi
    else
        echo "❌ Build failed for $test_name"
        echo "$test_name: ❌ BUILD FAILED" >> "$RESULTS_FILE"
    fi

    echo ""

    # Restore original for next test
    echo "Restoring original implementation..."
    cp "$BACKUP_FILE" "$ORIGINAL_FILE"
}

# Test baseline (current implementation)
echo "Testing baseline implementation..."
cd "$PROJECT_ROOT"
if timeout 10 ./build/extract_cpp_commands 96 > /dev/null 2>&1; then
    echo "❌ Baseline: No segmentation fault detected - issue may be fixed"
    echo "BASELINE: ❌ No segmentation fault detected" >> "$RESULTS_FILE"
    echo "Note: If baseline works, the issue may have been resolved" >> "$RESULTS_FILE"
else
    echo "✅ Baseline: Segmentation fault confirmed - proceeding with tests"
    echo "BASELINE: ✅ Segmentation fault confirmed" >> "$RESULTS_FILE"
fi

echo "" >> "$RESULTS_FILE"

# Run diagnostic tests in order of increasing complexity
test_implementation "TEST 1: Minimal (No State Management)" "executeUserFunction_Minimal"
test_implementation "TEST 2: Return State Only" "executeUserFunction_ReturnStateOnly"
test_implementation "TEST 3: Scope Management Only" "executeUserFunction_ScopeOnly"
test_implementation "TEST 4: Copy Semantics" "executeUserFunction_CopySemantics"
test_implementation "TEST 5: Heap Allocation" "executeUserFunction_HeapAllocation"

# Restore original implementation
echo ""
echo "=========================================="
echo "Restoring Original Implementation"
echo "=========================================="
cp "$BACKUP_FILE" "$ORIGINAL_FILE"

# Rebuild to restore baseline
echo "Rebuilding with original implementation..."
cd "$BUILD_DIR"
make arduino_ast_interpreter extract_cpp_commands > /dev/null 2>&1

# Final validation
echo "Final baseline validation..."
cd "$PROJECT_ROOT"
if timeout 30 ./run_baseline_validation.sh 0 10 > /dev/null 2>&1; then
    echo "✅ Baseline restored successfully"
    echo "RESTORATION: ✅ Baseline restored successfully" >> "$RESULTS_FILE"
else
    echo "⚠️  Baseline restoration may have issues"
    echo "RESTORATION: ⚠️  Potential issues detected" >> "$RESULTS_FILE"
fi

echo ""
echo "=========================================="
echo "Diagnostic Testing Complete"
echo "=========================================="
echo "Results saved to: $RESULTS_FILE"
echo ""
echo "Results Summary:"
cat "$RESULTS_FILE"

echo ""
echo "NEXT STEPS:"
echo "1. Review results in $RESULTS_FILE"
echo "2. Identify which test worked (if any)"
echo "3. Implement targeted fix based on findings"
echo "4. If all tests failed, use memory debugging tools (AddressSanitizer/Valgrind)"
echo ""
echo "Memory debugging command:"
echo "cd build && g++ -fsanitize=address -g -O0 ../src/cpp/ASTInterpreter.cpp -o test_debug"