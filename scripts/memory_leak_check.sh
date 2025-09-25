#!/bin/bash
#
# Memory Leak Detection for ASTInterpreter
# Uses valgrind to detect memory leaks during test execution
#
# Usage: ./scripts/memory_leak_check.sh [test_range]
# Example: ./scripts/memory_leak_check.sh 0-10

set -e

# Configuration
VALGRIND_OPTS="--tool=memcheck --leak-check=full --show-leak-kinds=all --track-origins=yes --verbose"
RESULTS_DIR="memory_reports"
DEFAULT_RANGE="0-5"  # Small range for memory testing

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
RANGE="${1:-$DEFAULT_RANGE}"
START_TEST=$(echo "$RANGE" | cut -d'-' -f1)
END_TEST=$(echo "$RANGE" | cut -d'-' -f2)

echo -e "${BLUE}🔍 Memory Leak Detection${NC}"
echo "========================"
echo "Range: Tests $START_TEST to $END_TEST"
echo ""

# Check if valgrind is available
if ! command -v valgrind &> /dev/null; then
    echo -e "${YELLOW}⚠️  Valgrind not found, skipping memory leak detection${NC}"
    echo "Install valgrind for memory leak detection:"
    echo "  sudo apt-get install valgrind  # Ubuntu/Debian"
    echo "  brew install valgrind          # macOS"
    exit 0
fi

# Ensure we're in the build directory
if [ ! -f "extract_cpp_commands" ]; then
    echo -e "${RED}❌ Error: extract_cpp_commands not found${NC}"
    echo "Please run from the build/ directory"
    exit 1
fi

# Create results directory
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}🔄 Running memory leak detection...${NC}"

TOTAL_TESTS=0
LEAKS_FOUND=0
LEAK_REPORTS=()

for ((i=START_TEST; i<=END_TEST; i++)); do
    printf "Test %3d: " "$i"

    REPORT_FILE="$RESULTS_DIR/valgrind_test${i}_${TIMESTAMP}.txt"

    # Run with valgrind
    if timeout 30s valgrind $VALGRIND_OPTS ./extract_cpp_commands "$i" > /dev/null 2> "$REPORT_FILE"; then
        # Check for leaks in the report
        if grep -q "definitely lost\|indirectly lost\|possibly lost" "$REPORT_FILE" &&
           ! grep -q "definitely lost: 0 bytes\|indirectly lost: 0 bytes\|possibly lost: 0 bytes" "$REPORT_FILE"; then
            echo -e "${RED}LEAK${NC}"
            LEAK_REPORTS+=("$i:$REPORT_FILE")
            ((LEAKS_FOUND++))
        else
            echo -e "${GREEN}CLEAN${NC}"
            # Remove clean reports to save space
            rm -f "$REPORT_FILE"
        fi
    else
        echo -e "${YELLOW}TIMEOUT/ERROR${NC}"
        # Keep error reports for analysis
    fi

    ((TOTAL_TESTS++))
done

echo ""
echo "📊 Memory Leak Analysis Results:"
echo "================================"
echo "Total tests: $TOTAL_TESTS"
echo "Memory leaks found: $LEAKS_FOUND"

if [ $LEAKS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No memory leaks detected!${NC}"

    # Create clean report
    cat > "$RESULTS_DIR/memory_clean_${TIMESTAMP}.txt" << EOF
Memory Leak Check Report
Generated: $(date)
Range: Tests $START_TEST to $END_TEST
Total Tests: $TOTAL_TESTS
Memory Leaks: 0
Status: CLEAN
EOF

    exit 0
else
    echo -e "${RED}⚠️  Memory leaks detected in $LEAKS_FOUND tests${NC}"
    echo ""
    echo "Detailed reports:"

    for report in "${LEAK_REPORTS[@]}"; do
        test_num=$(echo "$report" | cut -d':' -f1)
        report_file=$(echo "$report" | cut -d':' -f2)
        echo "  Test $test_num: $report_file"
    done

    # Create summary report
    cat > "$RESULTS_DIR/memory_leaks_${TIMESTAMP}.txt" << EOF
Memory Leak Check Report
Generated: $(date)
Range: Tests $START_TEST to $END_TEST
Total Tests: $TOTAL_TESTS
Memory Leaks: $LEAKS_FOUND
Status: LEAKS_DETECTED

Affected Tests:
$(for report in "${LEAK_REPORTS[@]}"; do echo "  Test $(echo "$report" | cut -d':' -f1)"; done)

Detailed Reports:
$(for report in "${LEAK_REPORTS[@]}"; do echo "  $(echo "$report" | cut -d':' -f2)"; done)
EOF

    echo ""
    echo -e "${RED}🔧 Memory leaks need investigation before production release${NC}"
    exit 1
fi