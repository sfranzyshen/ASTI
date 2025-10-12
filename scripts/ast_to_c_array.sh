#!/bin/bash
# ast_to_c_array.sh - Convert CompactAST binary to C array for Arduino sketches
#
# Usage: ./scripts/ast_to_c_array.sh <ast_file>
# Example: ./scripts/ast_to_c_array.sh test_data/test0_js.ast

if [ -z "$1" ]; then
    echo "Usage: $0 <ast_file>" >&2
    echo "Example: $0 test_data/example_001.ast" >&2
    exit 1
fi

AST_FILE="$1"

if [ ! -f "$AST_FILE" ]; then
    echo "ERROR: File not found: $AST_FILE" >&2
    exit 1
fi

# Get file size (cross-platform compatible)
FILE_SIZE=$(wc -c < "$AST_FILE" | tr -d ' ')

echo "// Generated from: $AST_FILE"
echo "// Size: $FILE_SIZE bytes"
echo "// Use this in your Arduino sketch:"
echo ""
echo "const uint8_t PROGMEM astBinary[] = {"

# Convert binary to hex array
xxd -i < "$AST_FILE" | sed 's/^/  /'

echo "};"
echo "const size_t astBinarySize = sizeof(astBinary);"
