#!/bin/bash
#
# Performance Regression Detection for ASTInterpreter
# Measures test execution time and detects performance regressions
#
# Usage: ./scripts/performance_check.sh [test_range] [runs]
# Example: ./scripts/performance_check.sh 0-10 5

set -e

# Configuration
BASELINE_DIR="performance_baselines"
RESULTS_DIR="performance_results"
DEFAULT_RANGE="0-10"
DEFAULT_RUNS=3
REGRESSION_THRESHOLD=20  # 20% slower = regression

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
RANGE="${1:-$DEFAULT_RANGE}"
RUNS="${2:-$DEFAULT_RUNS}"
START_TEST=$(echo "$RANGE" | cut -d'-' -f1)
END_TEST=$(echo "$RANGE" | cut -d'-' -f2)

echo -e "${BLUE}⏱️  Performance Regression Detection${NC}"
echo "===================================="
echo "Range: Tests $START_TEST to $END_TEST"
echo "Runs per test: $RUNS"
echo "Regression threshold: ${REGRESSION_THRESHOLD}%"
echo ""

# Ensure we're in the build directory
if [ ! -f "extract_cpp_commands" ]; then
    echo -e "${RED}❌ Error: extract_cpp_commands not found${NC}"
    echo "Please run from the build/ directory"
    exit 1
fi

# Create directories
mkdir -p "$BASELINE_DIR" "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}🔄 Running performance benchmarks...${NC}"

TOTAL_TESTS=0
REGRESSIONS_FOUND=0
REGRESSION_REPORTS=()

for ((i=START_TEST; i<=END_TEST; i++)); do
    printf "Test %3d: " "$i"

    # Run multiple times and calculate average
    total_time=0
    successful_runs=0

    for ((run=1; run<=RUNS; run++)); do
        start_time=$(date +%s%N)
        if timeout 10s ./extract_cpp_commands "$i" > /dev/null 2>&1; then
            end_time=$(date +%s%N)
            execution_time=$((end_time - start_time))
            total_time=$((total_time + execution_time))
            ((successful_runs++))
        fi
    done

    if [ $successful_runs -eq 0 ]; then
        echo -e "${RED}FAILED${NC}"
        continue
    fi

    # Calculate average time in milliseconds
    avg_time_ns=$((total_time / successful_runs))
    avg_time_ms=$((avg_time_ns / 1000000))

    # Check against baseline
    baseline_file="$BASELINE_DIR/test_${i}.baseline"

    if [ -f "$baseline_file" ]; then
        baseline_time=$(cat "$baseline_file")

        # Calculate percentage change
        if [ "$baseline_time" -gt 0 ]; then
            change_percent=$(echo "scale=2; ($avg_time_ms - $baseline_time) * 100 / $baseline_time" | bc -l)

            if (( $(echo "$change_percent > $REGRESSION_THRESHOLD" | bc -l) )); then
                echo -e "${RED}REGRESSION (+${change_percent}%)${NC}"
                REGRESSION_REPORTS+=("$i:${avg_time_ms}ms:${baseline_time}ms:+${change_percent}%")
                ((REGRESSIONS_FOUND++))
            elif (( $(echo "$change_percent < -10" | bc -l) )); then
                echo -e "${GREEN}IMPROVEMENT (${change_percent}%)${NC}"
                # Update baseline for improvements
                echo "$avg_time_ms" > "$baseline_file"
            else
                echo -e "${GREEN}OK (${change_percent}%)${NC}"
            fi
        else
            echo -e "${YELLOW}BASELINE_ERROR${NC}"
        fi
    else
        echo -e "${BLUE}NEW_BASELINE${NC}"
        # Create new baseline
        echo "$avg_time_ms" > "$baseline_file"
    fi

    ((TOTAL_TESTS++))
done

echo ""
echo "📊 Performance Analysis Results:"
echo "================================"
echo "Total tests: $TOTAL_TESTS"
echo "Performance regressions: $REGRESSIONS_FOUND"

if [ $REGRESSIONS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No performance regressions detected!${NC}"

    # Create clean report
    cat > "$RESULTS_DIR/performance_clean_${TIMESTAMP}.txt" << EOF
Performance Check Report
Generated: $(date)
Range: Tests $START_TEST to $END_TEST
Runs per test: $RUNS
Total Tests: $TOTAL_TESTS
Regressions: 0
Status: CLEAN
EOF

    exit 0
else
    echo -e "${RED}⚠️  Performance regressions detected in $REGRESSIONS_FOUND tests${NC}"
    echo ""
    echo "Regression details:"

    for report in "${REGRESSION_REPORTS[@]}"; do
        IFS=':' read -r test_num current baseline change <<< "$report"
        echo "  Test $test_num: $current vs $baseline baseline ($change)"
    done

    # Create regression report
    cat > "$RESULTS_DIR/performance_regressions_${TIMESTAMP}.txt" << EOF
Performance Regression Report
Generated: $(date)
Range: Tests $START_TEST to $END_TEST
Runs per test: $RUNS
Total Tests: $TOTAL_TESTS
Regressions: $REGRESSIONS_FOUND
Threshold: $REGRESSION_THRESHOLD%
Status: REGRESSIONS_DETECTED

Regression Details:
$(for report in "${REGRESSION_REPORTS[@]}"; do
    IFS=':' read -r test_num current baseline change <<< "$report"
    echo "  Test $test_num: $current vs $baseline baseline ($change)"
done)
EOF

    echo ""
    echo -e "${YELLOW}🔧 Performance regressions may need investigation${NC}"
    exit 1
fi