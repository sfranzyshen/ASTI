#!/bin/bash

# analyze_failures.sh - Systematic failure categorization tool
# Automatically categorizes test failures into the 7 known patterns

echo "=== Cross-Platform Failure Analysis Tool ==="
echo "Analyzing test failures and categorizing by pattern..."
echo

# Category definitions based on FAILURE_PATTERN_ANALYSIS.md
declare -A CATEGORIES
CATEGORIES[1]="Field Ordering Issues"
CATEGORIES[2]="String Value Representation"
CATEGORIES[3]="Missing Arduino Library Functions"
CATEGORIES[4]="Array Handling Differences"
CATEGORIES[5]="Loop Structure Differences"
CATEGORIES[6]="Mock Value/Pin Differences"
CATEGORIES[7]="Extra C++ Metadata Fields"

# Initialize counters
declare -A category_counts
declare -A category_tests
for i in {1..7}; do
    category_counts[$i]=0
    category_tests[$i]=""
done

total_analyzed=0
total_passing=0
total_failing=0

echo "Analyzing individual test failures..."

# Check if we have debug files to analyze
if [ ! -f "test0_cpp_debug.json" ] || [ ! -f "test0_js_debug.json" ]; then
    echo "ERROR: Test debug files not found."
    echo "Please run: ./validate_cross_platform 0 134 first to generate debug files."
    exit 1
fi

# Analyze each test from 0 to 134
for test_num in {0..134}; do
    cpp_file="test${test_num}_cpp_debug.json"
    js_file="test${test_num}_js_debug.json"

    if [ ! -f "$cpp_file" ] || [ ! -f "$js_file" ]; then
        continue  # Skip missing test files
    fi

    total_analyzed=$((total_analyzed + 1))

    # Quick diff check - if files are identical, it's passing
    if diff -q "$cpp_file" "$js_file" > /dev/null; then
        total_passing=$((total_passing + 1))
        continue
    fi

    total_failing=$((total_failing + 1))

    # Analyze the type of difference
    diff_output=$(diff "$cpp_file" "$js_file" 2>/dev/null)

    categorized=false

    # Category 1: Field Ordering Issues
    if echo "$diff_output" | grep -q "timestamp.*isConst\|isConst.*timestamp\|pin.*timestamp\|timestamp.*pin"; then
        category_counts[1]=$((${category_counts[1]} + 1))
        category_tests[1]="${category_tests[1]} $test_num"
        categorized=true
    fi

    # Category 2: String Value Representation
    if echo "$diff_output" | grep -q '"value":.*{"value"\|"value":.*"[^"]*"\|String.*value'; then
        category_counts[2]=$((${category_counts[2]} + 1))
        category_tests[2]="${category_tests[2]} $test_num"
        categorized=true
    fi

    # Category 3: Missing Arduino Library Functions
    if echo "$diff_output" | grep -q "Unknown function.*equals\|Unknown function.*toInt\|Unknown function.*compareTo\|Unknown function.*substring"; then
        category_counts[3]=$((${category_counts[3]} + 1))
        category_tests[3]="${category_tests[3]} $test_num"
        categorized=true
    fi

    # Category 4: Array Handling Differences
    if echo "$diff_output" | grep -q "Invalid array access\|array.*null\|melody\|noteDurations"; then
        category_counts[4]=$((${category_counts[4]} + 1))
        category_tests[4]="${category_tests[4]} $test_num"
        categorized=true
    fi

    # Category 5: Loop Structure Differences
    if echo "$diff_output" | grep -q "FOR_LOOP.*phase\|LOOP_START\|LOOP_END\|iteration"; then
        category_counts[5]=$((${category_counts[5]} + 1))
        category_tests[5]="${category_tests[5]} $test_num"
        categorized=true
    fi

    # Category 6: Mock Value/Pin Differences
    if echo "$diff_output" | grep -q "inputPin.*14\|inputPin.*36\|analogPin.*A0"; then
        category_counts[6]=$((${category_counts[6]} + 1))
        category_tests[6]="${category_tests[6]} $test_num"
        categorized=true
    fi

    # Category 7: Extra C++ Metadata Fields
    if echo "$diff_output" | grep -q '"format":.*"STRING"\|"format":.*"DEC"'; then
        category_counts[7]=$((${category_counts[7]} + 1))
        category_tests[7]="${category_tests[7]} $test_num"
        categorized=true
    fi

    if [ "$categorized" = false ]; then
        echo "UNCATEGORIZED: Test $test_num (needs manual analysis)"
    fi
done

# Generate report
echo
echo "=== FAILURE CATEGORIZATION REPORT ==="
echo "Date: $(date)"
echo "Tests Analyzed: $total_analyzed"
echo "Passing Tests: $total_passing"
echo "Failing Tests: $total_failing"
echo "Success Rate: $(echo "scale=2; $total_passing * 100 / $total_analyzed" | bc -l)%"
echo

echo "FAILURE BREAKDOWN BY CATEGORY:"
echo

for i in {1..7}; do
    count=${category_counts[$i]}
    if [ $count -gt 0 ]; then
        echo "Category $i: ${CATEGORIES[$i]}"
        echo "  Affected Tests: $count"
        echo "  Test Numbers: ${category_tests[$i]}"
        echo "  Impact: $(echo "scale=1; $count * 100 / $total_failing" | bc -l)% of failures"
        echo
    fi
done

echo "=== RECOMMENDATIONS ==="
echo
for i in {1..7}; do
    count=${category_counts[$i]}
    if [ $count -gt 0 ]; then
        case $i in
            1) echo "🎯 HIGH PRIORITY: Category 1 (Field Ordering) affects $count tests - Fix FlexibleCommandFactory field order" ;;
            2) echo "🎯 MEDIUM PRIORITY: Category 2 (String Representation) affects $count tests - Normalize string serialization" ;;
            3) echo "🎯 MEDIUM PRIORITY: Category 3 (Arduino Functions) affects $count tests - Implement missing String methods" ;;
            4) echo "🔄 MEDIUM PRIORITY: Category 4 (Array Handling) affects $count tests - Fix array initialization" ;;
            5) echo "🔄 MEDIUM PRIORITY: Category 5 (Loop Structures) affects $count tests - Standardize loop commands" ;;
            6) echo "🔧 LOW PRIORITY: Category 6 (Mock Values) affects $count tests - Sync mock value seeds" ;;
            7) echo "🔧 LOW PRIORITY: Category 7 (Metadata Fields) affects $count tests - Remove extra C++ fields" ;;
        esac
    fi
done

echo
echo "=== NEXT ACTIONS ==="
echo "1. Fix highest impact category first (typically Category 1: Field Ordering)"
echo "2. Run: ./measure_fix_impact.sh to track improvement"
echo "3. Use: ./validate_cross_platform 0 10 to test fixes on small batch"
echo "4. Continue systematic fixes in priority order"