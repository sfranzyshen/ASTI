#!/bin/bash
# validate_wasm_size.sh - Validate WASM build size against targets
#
# Checks if WASM binary meets Phase 7 size requirements:
# - Uncompressed: ≤1MB
# - Gzipped: ≤300KB
#
# Usage: ./scripts/validate_wasm_size.sh

set -e

echo "📊 WASM Size Validation"
echo "======================="
echo ""

WASM_FILE="build_wasm/arduino_interpreter.wasm"
GZIP_FILE="build_wasm/arduino_interpreter.wasm.gz"

# Check if WASM file exists
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ Error: WASM file not found: $WASM_FILE"
    echo ""
    echo "Please run ./scripts/build_wasm.sh first"
    exit 1
fi

# Get file sizes (cross-platform compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    WASM_SIZE=$(stat -f%z "$WASM_FILE")
else
    # Linux/WSL
    WASM_SIZE=$(stat -c%s "$WASM_FILE")
fi

# Create gzipped version
echo "🔧 Compressing WASM with gzip..."
gzip -c "$WASM_FILE" > "$GZIP_FILE"

if [[ "$OSTYPE" == "darwin"* ]]; then
    GZIP_SIZE=$(stat -f%z "$GZIP_FILE")
else
    GZIP_SIZE=$(stat -c%s "$GZIP_FILE")
fi

# Format sizes (human-readable)
WASM_SIZE_MB=$(echo "scale=2; $WASM_SIZE / 1024 / 1024" | bc)
GZIP_SIZE_KB=$(echo "scale=2; $GZIP_SIZE / 1024" | bc)

echo "✅ Compression complete"
echo ""

# Display results
echo "📦 File Sizes:"
echo "  - Uncompressed: ${WASM_SIZE_MB}MB ($WASM_SIZE bytes)"
echo "  - Gzipped: ${GZIP_SIZE_KB}KB ($GZIP_SIZE bytes)"
echo ""

# Phase 7 targets
TARGET_WASM=1048576   # 1MB
TARGET_GZIP=307200    # 300KB

# Validate against targets
echo "🎯 Target Validation:"

PASS_COUNT=0
FAIL_COUNT=0

# Check uncompressed size
if [ $WASM_SIZE -le $TARGET_WASM ]; then
    echo "  ✅ Uncompressed size within target (≤1MB)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    WASM_OVER=$(echo "scale=2; ($WASM_SIZE - $TARGET_WASM) / 1024 / 1024" | bc)
    echo "  ❌ Uncompressed size exceeds target: ${WASM_SIZE_MB}MB > 1MB (over by ${WASM_OVER}MB)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check gzipped size
if [ $GZIP_SIZE -le $TARGET_GZIP ]; then
    echo "  ✅ Gzipped size within target (≤300KB)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    GZIP_OVER=$(echo "scale=2; ($GZIP_SIZE - $TARGET_GZIP) / 1024" | bc)
    echo "  ❌ Gzipped size exceeds target: ${GZIP_SIZE_KB}KB > 300KB (over by ${GZIP_OVER}KB)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# Summary
if [ $FAIL_COUNT -eq 0 ]; then
    echo "🎉 SUCCESS: All size targets met!"
    echo ""
    echo "Production-ready for browser deployment."
    exit 0
else
    echo "⚠️  WARNING: $FAIL_COUNT size target(s) exceeded"
    echo ""
    echo "Consider optimization strategies:"
    echo "  - Use -Os instead of -O3 in scripts/build_wasm.sh"
    echo "  - Enable -ffunction-sections -fdata-sections"
    echo "  - Review EXPORTED_FUNCTIONS (only export necessary functions)"
    echo "  - Consider splitting into core + optional modules"
    echo ""
    exit 1
fi
