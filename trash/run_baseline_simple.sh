#!/bin/bash

# Simple Baseline Validation Script - Individual Test Runner
# Runs validate_cross_platform for each test individually
# Usage: ./run_baseline_simple.sh [start_test] [end_test]

# Default to all 135 tests (0-134) if no arguments provided
START_TEST=${1:-0}
END_TEST=${2:-134}

# Counters
TOTAL_TESTS=0
PASSING_TESTS=0
FAILING_TESTS=0

# Arrays to store results
PASSING_LIST=()
FAILING_LIST=()

echo "========================================"
echo "Arduino AST Interpreter Baseline Validation"
echo "Testing range: $START_TEST to $END_TEST"
echo "========================================"
echo ""

# Change to build directory
cd /mnt/d/Devel/ASTInterpreter/build

# Check if validate_cross_platform exists
if [ ! -f "./validate_cross_platform" ]; then
    echo "Error: validate_cross_platform not found in build directory"
    echo "Please run 'make validate_cross_platform' first"
    exit 1
fi

# Run individual tests
for i in $(seq $START_TEST $END_TEST); do
    printf "Testing %3d: " $i

    # Run the validation (capture output and exit code)
    if ./validate_cross_platform $i $i > /dev/null 2>&1; then
        echo "PASS"
        PASSING_LIST+=($i)
        ((PASSING_TESTS++))
    else
        echo "FAIL"
        FAILING_LIST+=($i)
        ((FAILING_TESTS++))
    fi

    ((TOTAL_TESTS++))
done

# Calculate success rate using bash arithmetic
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSING_TESTS * 100 / TOTAL_TESTS))
    REMAINDER=$((PASSING_TESTS * 100 % TOTAL_TESTS))
    # Simple decimal approximation
    if [ $REMAINDER -ge $((TOTAL_TESTS / 2)) ]; then
        SUCCESS_RATE=$((SUCCESS_RATE + 1))
    fi
else
    SUCCESS_RATE=0
fi

echo ""
echo "========================================"
echo "BASELINE VALIDATION RESULTS"
echo "========================================"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo "Passing Tests: $PASSING_TESTS"
echo "Failing Tests: $FAILING_TESTS"
echo "Success Rate: ~$SUCCESS_RATE%"
echo ""

# Display passing tests
if [ ${#PASSING_LIST[@]} -gt 0 ]; then
    echo "PASSING TESTS (${#PASSING_LIST[@]} total):"
    for test in "${PASSING_LIST[@]}"; do
        printf "%d " $test
    done
    echo ""
    echo ""
fi

# Display failing tests
if [ ${#FAILING_LIST[@]} -gt 0 ]; then
    echo "FAILING TESTS (${#FAILING_LIST[@]} total):"
    for test in "${FAILING_LIST[@]}"; do
        printf "%d " $test
    done
    echo ""
    echo ""
fi

# Generate summary for documentation
echo "SUMMARY FOR DOCUMENTATION:"
echo "**BASELINE ESTABLISHED** ($(date '+%B %d, %Y')):"
echo "- **Success Rate**: ~$SUCCESS_RATE% ($PASSING_TESTS/$TOTAL_TESTS tests)"
echo "- **Passing Tests**: $(echo "${PASSING_LIST[@]}" | tr ' ' ',')"
echo "- **Failing Tests**: $(echo "${FAILING_LIST[@]}" | tr ' ' ',')"
echo ""

# Save results to file
RESULTS_FILE="baseline_results_$(date '+%Y%m%d_%H%M%S').txt"
cat > $RESULTS_FILE << EOF
Arduino AST Interpreter - Baseline Validation Results
Date: $(date '+%Y-%m-%d %H:%M:%S')
Test Range: $START_TEST to $END_TEST

SUMMARY:
Total Tests: $TOTAL_TESTS
Passing Tests: $PASSING_TESTS
Failing Tests: $FAILING_TESTS
Success Rate: ~$SUCCESS_RATE%

PASSING TESTS (${#PASSING_LIST[@]} total):
$(echo "${PASSING_LIST[@]}")

FAILING TESTS (${#FAILING_LIST[@]} total):
$(echo "${FAILING_LIST[@]}")

DOCUMENTATION FORMAT:
**BASELINE ESTABLISHED** ($(date '+%B %d, %Y')):
- **Success Rate**: ~$SUCCESS_RATE% ($PASSING_TESTS/$TOTAL_TESTS tests)
- **Passing Tests**: $(echo "${PASSING_LIST[@]}" | tr ' ' ',')
- **Failing Tests**: $(echo "${FAILING_LIST[@]}" | tr ' ' ',')
EOF

echo "Results saved to: $RESULTS_FILE"
echo ""

# Return appropriate exit code
if [ $PASSING_TESTS -eq $TOTAL_TESTS ]; then
    exit 0  # All tests passed
else
    exit 1  # Some tests failed
fi