#!/bin/bash
#
# Smart Diff Analyzer for ASTInterpreter
# Provides intelligent analysis of test failures, distinguishing
# functional differences from cosmetic formatting issues
#
# Usage: ./scripts/smart_diff_analyzer.sh <test_number>
# Example: ./scripts/smart_diff_analyzer.sh 20

set -e

# Configuration
TEST_NUMBER="$1"
ANALYSIS_DIR="diff_analysis"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Validation
if [ -z "$TEST_NUMBER" ]; then
    echo -e "${RED}❌ Error: Test number required${NC}"
    echo "Usage: $0 <test_number>"
    echo "Example: $0 20"
    exit 1
fi

echo -e "${BLUE}🔍 Smart Diff Analysis for Test $TEST_NUMBER${NC}"
echo "==============================================="

# Ensure we're in the build directory
if [ ! -f "validate_cross_platform" ]; then
    echo -e "${RED}❌ Error: validate_cross_platform not found${NC}"
    echo "Please run from the build/ directory"
    exit 1
fi

# Create analysis directory
mkdir -p "$ANALYSIS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Generate test outputs
echo -e "${YELLOW}📊 Generating test outputs...${NC}"

CPP_OUTPUT="test${TEST_NUMBER}_cpp_raw.json"
JS_REF="../test_data/example_$(printf '%03d' "$TEST_NUMBER").commands"

# Extract C++ output
if ! ./extract_cpp_commands "$TEST_NUMBER" 2>/dev/null | sed -n '/^\[/,/^\]/p' > "$CPP_OUTPUT"; then
    echo -e "${RED}❌ Failed to extract C++ output for test $TEST_NUMBER${NC}"
    exit 1
fi

# Check if JavaScript reference exists
if [ ! -f "$JS_REF" ]; then
    echo -e "${RED}❌ JavaScript reference not found: $JS_REF${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Test outputs generated${NC}"

# Perform detailed analysis
echo -e "${YELLOW}🔬 Analyzing differences...${NC}"

ANALYSIS_FILE="$ANALYSIS_DIR/smart_diff_test${TEST_NUMBER}_${TIMESTAMP}.json"

# Create detailed analysis
cat > "$ANALYSIS_FILE" << EOF
{
  "test_number": $TEST_NUMBER,
  "timestamp": "$(date -Iseconds)",
  "analysis": {
EOF

# Count total commands
CPP_COMMANDS=$(jq length "$CPP_OUTPUT" 2>/dev/null || echo "0")
JS_COMMANDS=$(jq length "$JS_REF" 2>/dev/null || echo "0")

cat >> "$ANALYSIS_FILE" << EOF
    "command_counts": {
      "cpp": $CPP_COMMANDS,
      "js": $JS_COMMANDS,
      "difference": $((CPP_COMMANDS - JS_COMMANDS))
    },
EOF

# Analyze command types
echo -e "${CYAN}  📋 Analyzing command types...${NC}"

CPP_TYPES=$(jq -r '.[].type' "$CPP_OUTPUT" 2>/dev/null | sort | uniq -c | sort -nr || echo "Error extracting types")
JS_TYPES=$(jq -r '.[].type' "$JS_REF" 2>/dev/null | sort | uniq -c | sort -nr || echo "Error extracting types")

cat >> "$ANALYSIS_FILE" << EOF
    "command_types": {
      "cpp_distribution": $(echo "$CPP_TYPES" | jq -R -s 'split("\n") | map(select(length > 0)) | map(split(" ") | {count: .[0], type: .[1]})' 2>/dev/null || echo '[]'),
      "js_distribution": $(echo "$JS_TYPES" | jq -R -s 'split("\n") | map(select(length > 0)) | map(split(" ") | {count: .[0], type: .[1]})' 2>/dev/null || echo '[]')
    },
EOF

# Analyze timestamps
echo -e "${CYAN}  ⏰ Analyzing timestamps...${NC}"

CPP_TIMESTAMPS=$(jq -r '.[].timestamp // empty' "$CPP_OUTPUT" 2>/dev/null | sort -n || echo "")
JS_TIMESTAMPS=$(jq -r '.[].timestamp // empty' "$JS_REF" 2>/dev/null | sort -n || echo "")

TIMESTAMP_VARIANCE=""
if [ -n "$CPP_TIMESTAMPS" ] && [ -n "$JS_TIMESTAMPS" ]; then
    CPP_FIRST=$(echo "$CPP_TIMESTAMPS" | head -1)
    JS_FIRST=$(echo "$JS_TIMESTAMPS" | head -1)
    TIMESTAMP_VARIANCE=$((CPP_FIRST - JS_FIRST))
fi

cat >> "$ANALYSIS_FILE" << EOF
    "timestamps": {
      "cpp_range": "$(echo "$CPP_TIMESTAMPS" | head -1) - $(echo "$CPP_TIMESTAMPS" | tail -1)",
      "js_range": "$(echo "$JS_TIMESTAMPS" | head -1) - $(echo "$JS_TIMESTAMPS" | tail -1)",
      "variance": "$TIMESTAMP_VARIANCE"
    },
EOF

# Field comparison analysis
echo -e "${CYAN}  🔍 Analyzing field differences...${NC}"

FIELD_ANALYSIS=""
if command -v jq &> /dev/null; then
    # Compare first few commands for field differences
    FIELD_ANALYSIS=$(jq -n --argjson cpp "$(jq '.[0:3]' "$CPP_OUTPUT" 2>/dev/null || echo '[]')" --argjson js "$(jq '.[0:3]' "$JS_REF" 2>/dev/null || echo '[]')" '
    {
      "sample_cpp_fields": ($cpp | map(keys) | flatten | unique),
      "sample_js_fields": ($js | map(keys) | flatten | unique),
      "field_differences": {
        "cpp_only": (($cpp | map(keys) | flatten | unique) - ($js | map(keys) | flatten | unique)),
        "js_only": (($js | map(keys) | flatten | unique) - ($cpp | map(keys) | flatten | unique))
      }
    }' 2>/dev/null || echo '{"error": "field analysis failed"}')
fi

cat >> "$ANALYSIS_FILE" << EOF
    "field_analysis": $FIELD_ANALYSIS,
EOF

# Semantic analysis
echo -e "${CYAN}  🧠 Performing semantic analysis...${NC}"

FUNCTIONAL_DIFF="false"
COSMETIC_ONLY="true"

# Check for significant differences
if [ "$CPP_COMMANDS" != "$JS_COMMANDS" ]; then
    FUNCTIONAL_DIFF="true"
    COSMETIC_ONLY="false"
fi

# Check for type mismatches
CPP_TYPE_COUNT=$(echo "$CPP_TYPES" | wc -l)
JS_TYPE_COUNT=$(echo "$JS_TYPES" | wc -l)

if [ "$CPP_TYPE_COUNT" != "$JS_TYPE_COUNT" ]; then
    FUNCTIONAL_DIFF="true"
    COSMETIC_ONLY="false"
fi

cat >> "$ANALYSIS_FILE" << EOF
    "semantic_analysis": {
      "functional_difference": $FUNCTIONAL_DIFF,
      "cosmetic_only": $COSMETIC_ONLY,
      "confidence": "medium"
    }
  },
  "recommendations": [
EOF

# Generate recommendations
if [ "$FUNCTIONAL_DIFF" = "true" ]; then
    cat >> "$ANALYSIS_FILE" << EOF
    "Functional differences detected - requires code investigation",
    "Check command generation logic in C++ interpreter",
    "Compare execution paths between JavaScript and C++ implementations"
EOF
else
    cat >> "$ANALYSIS_FILE" << EOF
    "Differences appear cosmetic - likely formatting or timestamp issues",
    "Consider updating normalization rules in validation tool",
    "May be safe to add to normalization patterns"
EOF
fi

cat >> "$ANALYSIS_FILE" << EOF
  ],
  "files": {
    "cpp_output": "$CPP_OUTPUT",
    "js_reference": "$JS_REF",
    "analysis_report": "$ANALYSIS_FILE"
  }
}
EOF

echo -e "${GREEN}✅ Analysis complete${NC}"

# Display summary
echo ""
echo -e "${BLUE}📊 Analysis Summary:${NC}"
echo "===================="

if [ "$FUNCTIONAL_DIFF" = "true" ]; then
    echo -e "Status: ${RED}FUNCTIONAL DIFFERENCE${NC}"
    echo -e "Impact: ${RED}HIGH${NC} - Requires investigation"
else
    echo -e "Status: ${GREEN}COSMETIC DIFFERENCE${NC}"
    echo -e "Impact: ${YELLOW}LOW${NC} - Likely formatting issue"
fi

echo ""
echo "Command counts: C++=$CPP_COMMANDS, JS=$JS_COMMANDS"

if [ -n "$TIMESTAMP_VARIANCE" ] && [ "$TIMESTAMP_VARIANCE" != "0" ]; then
    echo "Timestamp variance: ${TIMESTAMP_VARIANCE}ms"
fi

echo ""
echo "📁 Detailed analysis saved to: $ANALYSIS_FILE"
echo "📁 Raw C++ output: $CPP_OUTPUT"

# Cleanup temporary files
rm -f "$CPP_OUTPUT"

exit 0