#!/bin/bash

# GDB Analysis Script for Test 96 Segmentation Fault
# This script automates debugging of the Test 96 crash

echo "=== GDB Analysis for Test 96 Segmentation Fault ==="
echo "Analyzing nested function call crash: multiply(add(5,10), 2)"
echo ""

# Create GDB commands file
cat > /tmp/gdb_commands.txt << 'EOF'
# Set up for debugging
set pagination off
set print pretty on
set print object on
set print vtbl on

# Breakpoints at critical locations
break executeUserFunction
break ASTInterpreter.cpp:2648 if functionName == "multiply"
break ASTInterpreter.cpp:2635
break ASTInterpreter.cpp:2637

# Catch the crash
catch throw
catch signal SIGSEGV

# Run Test 96
run 96

# When we hit executeUserFunction for multiply
commands 1
  echo === Entering executeUserFunction ===\n
  print functionName
  print recursionDepth_
  print args
  continue
end

# When about to return from multiply
commands 2
  echo === About to return from multiply ===\n
  print result
  print savedShouldReturn
  print originalReturnValue
  info locals
  backtrace 5
  continue
end

# When restoring return value
commands 3
  echo === Before restore return value ===\n
  print returnValue_
  print originalReturnValue
  continue
end

commands 4
  echo === After restore return value ===\n
  print returnValue_
  continue
end

# When crash happens
catch signal SIGSEGV
commands
  echo === SEGMENTATION FAULT CAUGHT ===\n
  backtrace
  info registers
  info frame
  print returnValue_
  print shouldReturn_
  disassemble $pc-32,$pc+32
  x/10x $sp
end

# Run and get crash info
continue
quit
EOF

echo "Running GDB analysis on extract_cpp_commands with Test 96..."
echo ""

# Run GDB with the commands
cd /mnt/d/Devel/ASTInterpreter
gdb -batch -x /tmp/gdb_commands.txt ./build/extract_cpp_commands 2>&1 | tee gdb_test96_output.txt

echo ""
echo "=== Analysis Complete ==="
echo "Full output saved to: gdb_test96_output.txt"
echo ""
echo "Key areas to check:"
echo "1. Stack trace at crash point"
echo "2. State of returnValue_ and originalReturnValue"
echo "3. Local variables in executeUserFunction"
echo "4. Assembly code at crash location"