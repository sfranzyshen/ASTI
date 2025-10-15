#!/bin/bash

# Baseline Validation Script - Individual Test Runner
# Runs validate_cross_platform 0 0 for each of 135 tests individually
# Usage: ./run_baseline_validation.sh [start_test] [end_test]
# Example: ./run_baseline_validation.sh 0 134  (run all tests)
# Example: ./run_baseline_validation.sh 10 20  (run tests 10-20)

# Default to all 135 tests (0-134) if no arguments provided
START_TEST=${1:-0}
END_TEST=${2:-134}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSING_TESTS=0
FAILING_TESTS=0

# Arrays to store results
PASSING_LIST=()
FAILING_LIST=()

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Arduino AST Interpreter Baseline Validation${NC}"
echo -e "${BLUE}Testing range: $START_TEST to $END_TEST${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to build directory (portable - works from any location)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../build"

# Check if validate_cross_platform exists
if [ ! -f "./validate_cross_platform" ]; then
    echo -e "${RED}Error: validate_cross_platform not found in build directory${NC}"
    echo "Please run 'make validate_cross_platform' first"
    exit 1
fi

# Run individual tests
for i in $(seq $START_TEST $END_TEST); do
    printf "Testing %3d: " $i

    # Run the validation (capture output and exit code)
    if ./validate_cross_platform $i $i > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSING_LIST+=($i)
        ((PASSING_TESTS++))
    else
        echo -e "${RED}FAIL${NC}"
        FAILING_LIST+=($i)
        ((FAILING_TESTS++))
    fi

    ((TOTAL_TESTS++))
done

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $PASSING_TESTS * 100 / $TOTAL_TESTS" | bc -l)
else
    SUCCESS_RATE=0.00
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}BASELINE VALIDATION RESULTS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Tests: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Passing Tests: ${GREEN}$PASSING_TESTS${NC}"
echo -e "Failing Tests: ${RED}$FAILING_TESTS${NC}"
echo -e "Success Rate: ${YELLOW}$SUCCESS_RATE%${NC}"
echo ""

# Display passing tests
if [ ${#PASSING_LIST[@]} -gt 0 ]; then
    echo -e "${GREEN}PASSING TESTS (${#PASSING_LIST[@]} total):${NC}"
    printf "${GREEN}"
    for test in "${PASSING_LIST[@]}"; do
        printf "%d " $test
    done
    printf "${NC}\n\n"
fi

# Display failing tests
if [ ${#FAILING_LIST[@]} -gt 0 ]; then
    echo -e "${RED}FAILING TESTS (${#FAILING_LIST[@]} total):${NC}"
    printf "${RED}"
    for test in "${FAILING_LIST[@]}"; do
        printf "%d " $test
    done
    printf "${NC}\n\n"
fi

# Generate summary for documentation
echo -e "${BLUE}SUMMARY FOR DOCUMENTATION:${NC}"
echo "**BASELINE ESTABLISHED** ($(date '+%B %d, %Y')):"
echo "- **Success Rate**: $SUCCESS_RATE% ($PASSING_TESTS/$TOTAL_TESTS tests)"
echo "- **Passing Tests**: $(echo "${PASSING_LIST[@]}" | tr ' ' ',')"
echo "- **Failing Tests**: $(echo "${FAILING_LIST[@]}" | tr ' ' ',')"
echo ""

# Save results to file
RESULTS_FILE="baseline_validation_results_$(date '+%Y%m%d_%H%M%S').txt"
cat > $RESULTS_FILE << EOF
Arduino AST Interpreter - Baseline Validation Results
Date: $(date '+%Y-%m-%d %H:%M:%S')
Test Range: $START_TEST to $END_TEST

SUMMARY:
Total Tests: $TOTAL_TESTS
Passing Tests: $PASSING_TESTS
Failing Tests: $FAILING_TESTS
Success Rate: $SUCCESS_RATE%

PASSING TESTS (${#PASSING_LIST[@]} total):
$(echo "${PASSING_LIST[@]}" | fold -w 80)

FAILING TESTS (${#FAILING_LIST[@]} total):
$(echo "${FAILING_LIST[@]}" | fold -w 80)

DOCUMENTATION FORMAT:
**BASELINE ESTABLISHED** ($(date '+%B %d, %Y')):
- **Success Rate**: $SUCCESS_RATE% ($PASSING_TESTS/$TOTAL_TESTS tests)
- **Passing Tests**: $(echo "${PASSING_LIST[@]}" | tr ' ' ',')
- **Failing Tests**: $(echo "${FAILING_LIST[@]}" | tr ' ' ',')
EOF

echo -e "${BLUE}Results saved to: ${YELLOW}$RESULTS_FILE${NC}"
echo ""

# Return appropriate exit code
if [ $PASSING_TESTS -eq $TOTAL_TESTS ]; then
    exit 0  # All tests passed
else
    exit 1  # Some tests failed
fi