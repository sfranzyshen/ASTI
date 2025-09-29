#!/usr/bin/env python3
"""
Ultra-minimal FlexibleCommand to JSON converter
Systematically replaces remaining FlexibleCommand calls with direct JSON
"""

import re
import sys

# Mapping of FlexibleCommand types to JSON equivalents
COMMAND_MAPPINGS = {
    "LoopStart": {"type": "LOOP_START", "fields": ["name", "iteration"]},
    "LoopEnd": {"type": "LOOP_END", "fields": ["iterations"]},
    "LoopEndComplete": {"type": "LOOP_END", "fields": ["iterations", "completed"]},
    "FunctionCallLoop": {"type": "FUNCTION_CALL", "fields": ["iteration", "completed"]},
    "SetupEnd": {"type": "SETUP_END", "fields": ["message"]},
    "IfStatement": {"type": "IF_STATEMENT", "fields": ["condition", "branch"]},
    "WhileLoopStart": {"type": "WHILE_LOOP", "fields": ["phase"]},
    "WhileLoopIteration": {"type": "WHILE_LOOP", "fields": ["iteration"]},
    "WhileLoopEnd": {"type": "WHILE_LOOP", "fields": ["iteration"]},
    "ForLoopStart": {"type": "FOR_LOOP", "fields": ["phase"]},
    "ForLoopIteration": {"type": "FOR_LOOP", "fields": ["iteration"]},
    "ForLoopEnd": {"type": "FOR_LOOP", "fields": ["iteration", "maxIterations"]},
    "DoWhileLoopStart": {"type": "DO_WHILE_LOOP", "fields": ["phase"]},
    "DoWhileLoopIteration": {"type": "DO_WHILE_LOOP", "fields": ["iteration"]},
    "DoWhileLoopEnd": {"type": "DO_WHILE_LOOP", "fields": ["iteration"]},
    "BreakStatement": {"type": "BREAK_STATEMENT", "fields": []},
    "ContinueStatement": {"type": "CONTINUE_STATEMENT", "fields": []},
    "SwitchStatement": {"type": "SWITCH_STATEMENT", "fields": ["discriminant"]},
    "SwitchCase": {"type": "SWITCH_CASE", "fields": ["value", "shouldExecute"]},
    "ToneWithDuration": {"type": "TONE", "fields": ["pin", "frequency", "duration"]},
    "Tone": {"type": "TONE", "fields": ["pin", "frequency"]},
    "NoTone": {"type": "NO_TONE", "fields": ["pin"]},
    "PinMode": {"type": "PIN_MODE", "fields": ["pin", "mode"]},
    "AnalogWrite": {"type": "ANALOG_WRITE", "fields": ["pin", "value"]},
    "Delay": {"type": "DELAY", "fields": ["milliseconds"]},
    "DelayMicroseconds": {"type": "DELAY_MICROSECONDS", "fields": ["microseconds"]},
    "SerialBegin": {"type": "SERIAL_BEGIN", "fields": ["baudRate"]},
    "SerialPrintln": {"type": "SERIAL_PRINTLN", "fields": ["message", "format"]},
    "SerialWrite": {"type": "SERIAL_WRITE", "fields": ["data"]},
    "SerialFlush": {"type": "SERIAL_FLUSH", "fields": []},
    "SerialTimeout": {"type": "SERIAL_TIMEOUT", "fields": ["timeout"]},
}

def convert_flexiblecommand_line(line):
    """Convert a single line with FlexibleCommandFactory call to JSON equivalent"""
    # Extract FlexibleCommandFactory::createXXX pattern
    pattern = r'emitCommand\(FlexibleCommandFactory::create(\w+)\((.*?)\)\);'
    match = re.search(pattern, line)

    if not match:
        return line  # No FlexibleCommand found, return unchanged

    command_type = match.group(1)
    args = match.group(2)

    if command_type not in COMMAND_MAPPINGS:
        # Unknown command type, create generic conversion
        return line.replace(
            f'emitCommand(FlexibleCommandFactory::create{command_type}({args}));',
            f'emitJSON(buildJSON("{command_type.upper()}", {{}})); // TODO: Add fields'
        )

    mapping = COMMAND_MAPPINGS[command_type]
    json_type = mapping["type"]

    # Create basic JSON conversion (simplified - would need more complex arg parsing for full conversion)
    indent = re.match(r'(\s*)', line).group(1)

    return f'{indent}emitJSON(buildJSON("{json_type}", {{}})); // Converted from {command_type}'

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 convert_flexiblecommand.py <input_file>")
        sys.exit(1)

    filename = sys.argv[1]

    try:
        with open(filename, 'r') as f:
            lines = f.readlines()

        converted_lines = []
        conversions = 0

        for line in lines:
            new_line = convert_flexiblecommand_line(line)
            if new_line != line:
                conversions += 1
            converted_lines.append(new_line)

        # Write converted file
        output_filename = filename + ".converted"
        with open(output_filename, 'w') as f:
            f.writelines(converted_lines)

        print(f"Converted {conversions} FlexibleCommand calls")
        print(f"Output written to: {output_filename}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()