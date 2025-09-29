#!/bin/bash
# Convert C++ line-by-line JSON output to proper JSON array format

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input_file> <output_file>"
    echo "Converts C++ line-by-line JSON to JavaScript JSON array format"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

# Start JSON array
echo "[" > "$OUTPUT_FILE"

# Process each line, skip debug output, add commas
first=true
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and debug output
    if [[ -z "$line" || "$line" == *"DEBUG"* || "$line" == *"EXTRACT_DEBUG"* ]]; then
        continue
    fi

    # Skip lines that are just { or }
    if [[ "$line" == "{" || "$line" == "}" ]]; then
        continue
    fi

    # If line starts with {, it's a JSON object - capture complete object
    if [[ "$line" == "{"* ]]; then
        if [ "$first" = true ]; then
            printf "  %s" "$line" >> "$OUTPUT_FILE"
            first=false
        else
            printf ",\n  %s" "$line" >> "$OUTPUT_FILE"
        fi
    fi
done < "$INPUT_FILE"

# Close JSON array
echo "" >> "$OUTPUT_FILE"
echo "]" >> "$OUTPUT_FILE"

echo "✅ Converted $INPUT_FILE to $OUTPUT_FILE"