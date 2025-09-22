#!/bin/bash
#
# Automated Impact Assessment for ASTInterpreter
# Analyzes the impact of code changes on test results
# and provides recommendations for safe deployment
#
# Usage: ./scripts/impact_assessment.sh [before_baseline] [after_range]
# Example: ./scripts/impact_assessment.sh baseline_20250920.txt 0-20

set -e

# Configuration
ASSESSMENT_DIR="impact_assessments"
DEFAULT_RANGE="0-15"
IMPACT_THRESHOLD=5  # 5% change = significant impact

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Parse arguments
BASELINE_FILE="$1"
RANGE="${2:-$DEFAULT_RANGE}"
START_TEST=$(echo "$RANGE" | cut -d'-' -f1)
END_TEST=$(echo "$RANGE" | cut -d'-' -f2)

echo -e "${BLUE}📊 Automated Impact Assessment${NC}"
echo "==============================="

if [ -n "$BASELINE_FILE" ] && [ -f "$BASELINE_FILE" ]; then
    echo "Baseline: $BASELINE_FILE"
else
    echo "No baseline provided - generating new baseline"
    BASELINE_FILE=""
fi

echo "Range: Tests $START_TEST to $END_TEST"
echo ""

# Ensure we're in the build directory
if [ ! -f "validate_cross_platform" ]; then
    echo -e "${RED}❌ Error: validate_cross_platform not found${NC}"
    echo "Please run from the build/ directory"
    exit 1
fi

# Create assessment directory
mkdir -p "$ASSESSMENT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}🔄 Running current validation...${NC}"

# Run current validation
CURRENT_RESULT="$ASSESSMENT_DIR/current_${TIMESTAMP}.txt"
./validate_cross_platform "$START_TEST" "$END_TEST" 2>&1 | tee "$CURRENT_RESULT"

# Parse current results
CURRENT_TOTAL=$(grep "Tests processed:" "$CURRENT_RESULT" | grep -o '[0-9]\+' | head -1)
CURRENT_MATCHES=$(grep "Exact matches:" "$CURRENT_RESULT" | grep -o '[0-9]\+' | head -1)
CURRENT_RATE=$(grep "Success rate:" "$CURRENT_RESULT" | grep -o '[0-9.]\+' | head -1)

echo ""
echo -e "${BLUE}📈 Current Results:${NC}"
echo "Total tests: $CURRENT_TOTAL"
echo "Exact matches: $CURRENT_MATCHES"
echo "Success rate: ${CURRENT_RATE}%"

# Compare with baseline if available
IMPACT_LEVEL="UNKNOWN"
IMPACT_DETAILS=""
RECOMMENDATIONS=()

if [ -n "$BASELINE_FILE" ] && [ -f "$BASELINE_FILE" ]; then
    echo ""
    echo -e "${YELLOW}📊 Comparing with baseline...${NC}"

    # Parse baseline (assuming it contains success rate)
    if grep -q "Success rate:" "$BASELINE_FILE"; then
        BASELINE_RATE=$(grep "Success rate:" "$BASELINE_FILE" | grep -o '[0-9.]\+' | head -1)
        BASELINE_TOTAL=$(grep "Tests processed:" "$BASELINE_FILE" | grep -o '[0-9]\+' | head -1)
        BASELINE_MATCHES=$(grep "Exact matches:" "$BASELINE_FILE" | grep -o '[0-9]\+' | head -1)

        echo "Baseline rate: ${BASELINE_RATE}%"

        # Calculate impact
        RATE_CHANGE=$(echo "scale=2; $CURRENT_RATE - $BASELINE_RATE" | bc -l)
        MATCHES_CHANGE=$((CURRENT_MATCHES - BASELINE_MATCHES))

        echo "Rate change: ${RATE_CHANGE}%"
        echo "Matches change: $MATCHES_CHANGE"

        # Determine impact level
        ABS_RATE_CHANGE=$(echo "$RATE_CHANGE" | sed 's/-//')
        if (( $(echo "$ABS_RATE_CHANGE > $IMPACT_THRESHOLD" | bc -l) )); then
            if (( $(echo "$RATE_CHANGE < 0" | bc -l) )); then
                IMPACT_LEVEL="HIGH_NEGATIVE"
                IMPACT_DETAILS="Success rate decreased by ${ABS_RATE_CHANGE}%"
                RECOMMENDATIONS+=("CRITICAL: Investigate regression before deployment")
                RECOMMENDATIONS+=("Run detailed failure analysis on affected tests")
                RECOMMENDATIONS+=("Consider reverting recent changes")
            else
                IMPACT_LEVEL="HIGH_POSITIVE"
                IMPACT_DETAILS="Success rate improved by ${RATE_CHANGE}%"
                RECOMMENDATIONS+=("POSITIVE: Significant improvement detected")
                RECOMMENDATIONS+=("Update baseline to reflect improvements")
                RECOMMENDATIONS+=("Consider this a stable improvement")
            fi
        elif (( $(echo "$ABS_RATE_CHANGE > 1" | bc -l) )); then
            IMPACT_LEVEL="MEDIUM"
            IMPACT_DETAILS="Success rate changed by ${RATE_CHANGE}%"
            RECOMMENDATIONS+=("Monitor for additional changes")
            RECOMMENDATIONS+=("Consider running extended validation")
        else
            IMPACT_LEVEL="LOW"
            IMPACT_DETAILS="Success rate changed by ${RATE_CHANGE}% (within normal variance)"
            RECOMMENDATIONS+=("Changes appear safe for deployment")
            RECOMMENDATIONS+=("Continue with normal release process")
        fi
    else
        IMPACT_LEVEL="BASELINE_ERROR"
        IMPACT_DETAILS="Could not parse baseline file"
        RECOMMENDATIONS+=("Check baseline file format")
    fi
else
    IMPACT_LEVEL="NO_BASELINE"
    IMPACT_DETAILS="No baseline available for comparison"
    RECOMMENDATIONS+=("Establish baseline for future comparisons")
    RECOMMENDATIONS+=("Run multiple validation cycles to establish variance")
fi

# Analyze failing tests if any
FAILING_TESTS=()
if grep -q "FUNCTIONAL DIFFERENCE" "$CURRENT_RESULT"; then
    FAILING_TEST=$(grep -B5 "FUNCTIONAL DIFFERENCE" "$CURRENT_RESULT" | grep "Test" | tail -1 | grep -o '[0-9]\+')
    if [ -n "$FAILING_TEST" ]; then
        FAILING_TESTS+=("$FAILING_TEST")
    fi
fi

# Generate comprehensive assessment report
ASSESSMENT_FILE="$ASSESSMENT_DIR/impact_assessment_${TIMESTAMP}.json"

cat > "$ASSESSMENT_FILE" << EOF
{
  "assessment": {
    "timestamp": "$(date -Iseconds)",
    "test_range": "$START_TEST-$END_TEST",
    "baseline_file": "$BASELINE_FILE"
  },
  "current_results": {
    "total_tests": $CURRENT_TOTAL,
    "exact_matches": $CURRENT_MATCHES,
    "success_rate": $CURRENT_RATE,
    "failing_tests": [$(IFS=','; echo "${FAILING_TESTS[*]}")],
    "result_file": "$CURRENT_RESULT"
  },
EOF

if [ -n "$BASELINE_FILE" ] && [ -f "$BASELINE_FILE" ] && [ -n "$BASELINE_RATE" ]; then
    cat >> "$ASSESSMENT_FILE" << EOF
  "baseline_comparison": {
    "baseline_rate": $BASELINE_RATE,
    "rate_change": $RATE_CHANGE,
    "matches_change": $MATCHES_CHANGE,
    "impact_level": "$IMPACT_LEVEL",
    "impact_details": "$IMPACT_DETAILS"
  },
EOF
else
    cat >> "$ASSESSMENT_FILE" << EOF
  "baseline_comparison": null,
EOF
fi

# Convert recommendations array to JSON
RECOMMENDATIONS_JSON="["
for i in "${!RECOMMENDATIONS[@]}"; do
    if [ $i -gt 0 ]; then
        RECOMMENDATIONS_JSON+=","
    fi
    RECOMMENDATIONS_JSON+="\"${RECOMMENDATIONS[i]}\""
done
RECOMMENDATIONS_JSON+="]"

cat >> "$ASSESSMENT_FILE" << EOF
  "recommendations": $RECOMMENDATIONS_JSON,
  "deployment_readiness": {
EOF

# Determine deployment readiness
case "$IMPACT_LEVEL" in
    "HIGH_NEGATIVE")
        cat >> "$ASSESSMENT_FILE" << EOF
    "status": "BLOCKED",
    "confidence": "high",
    "reason": "Significant regression detected"
EOF
        ;;
    "HIGH_POSITIVE")
        cat >> "$ASSESSMENT_FILE" << EOF
    "status": "RECOMMENDED",
    "confidence": "high",
    "reason": "Significant improvement detected"
EOF
        ;;
    "MEDIUM")
        cat >> "$ASSESSMENT_FILE" << EOF
    "status": "CAUTION",
    "confidence": "medium",
    "reason": "Moderate changes detected - additional testing recommended"
EOF
        ;;
    "LOW"|"NO_BASELINE")
        cat >> "$ASSESSMENT_FILE" << EOF
    "status": "APPROVED",
    "confidence": "medium",
    "reason": "Changes within acceptable range"
EOF
        ;;
    *)
        cat >> "$ASSESSMENT_FILE" << EOF
    "status": "UNKNOWN",
    "confidence": "low",
    "reason": "Unable to assess impact"
EOF
        ;;
esac

cat >> "$ASSESSMENT_FILE" << EOF
  }
}
EOF

# Display final assessment
echo ""
echo -e "${PURPLE}🎯 Impact Assessment Summary:${NC}"
echo "============================"

case "$IMPACT_LEVEL" in
    "HIGH_NEGATIVE")
        echo -e "Impact Level: ${RED}HIGH NEGATIVE${NC}"
        echo -e "Deployment: ${RED}🚫 BLOCKED${NC}"
        ;;
    "HIGH_POSITIVE")
        echo -e "Impact Level: ${GREEN}HIGH POSITIVE${NC}"
        echo -e "Deployment: ${GREEN}✅ RECOMMENDED${NC}"
        ;;
    "MEDIUM")
        echo -e "Impact Level: ${YELLOW}MEDIUM${NC}"
        echo -e "Deployment: ${YELLOW}⚠️  CAUTION${NC}"
        ;;
    "LOW")
        echo -e "Impact Level: ${GREEN}LOW${NC}"
        echo -e "Deployment: ${GREEN}✅ APPROVED${NC}"
        ;;
    "NO_BASELINE")
        echo -e "Impact Level: ${BLUE}NO BASELINE${NC}"
        echo -e "Deployment: ${BLUE}✅ APPROVED (NEW)${NC}"
        ;;
    *)
        echo -e "Impact Level: ${YELLOW}UNKNOWN${NC}"
        echo -e "Deployment: ${YELLOW}❓ MANUAL REVIEW${NC}"
        ;;
esac

echo ""
echo "Details: $IMPACT_DETAILS"

if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
    echo ""
    echo "Recommendations:"
    for rec in "${RECOMMENDATIONS[@]}"; do
        echo "  • $rec"
    done
fi

echo ""
echo "📁 Full assessment: $ASSESSMENT_FILE"

# Set exit code based on deployment readiness
case "$IMPACT_LEVEL" in
    "HIGH_NEGATIVE") exit 1 ;;
    "MEDIUM") exit 2 ;;
    *) exit 0 ;;
esac