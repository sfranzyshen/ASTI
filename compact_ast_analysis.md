# CompactAST CastExpression Serialization Bug Analysis

## Problem Statement
JavaScript writes CastExpression nodes with flags=0x03 (HAS_CHILDREN | HAS_VALUE) to the binary file.
C++ reads the same nodes as flags=0x00, dataSize=0x00.

## Evidence from Hexdump
File: test_data/example_102.ast

Found CastExpression nodes in hexdump:
- Offset 0x1b7: `36 03 05 00 0c 08` - NodeType=0x36, Flags=0x03, DataSize=0x0005
- Offset 0x237: `36 03 05 00 0c 08` - NodeType=0x36, Flags=0x03, DataSize=0x0005

The binary file DOES contain correct flags=0x03!

## Header Analysis
```
00000000: 4153 5450 0001 0000 5400 0000 d000 0000
          ^magic ^ver ^flg  ^nodeCount ^strTabSize
          ASTP   v1   0     84 nodes   208 bytes
```

## Question for Analysis
Why would C++ parseNode() read flags=0x00, dataSize=0x00 when the file clearly contains flags=0x03, dataSize=0x05?

Possible causes:
1. Node index mismatch - C++ counting nodes differently than JavaScript
2. Offset calculation error in C++ reader
3. Nodes being read in wrong order
4. Some nodes being skipped during parsing

Files to analyze:
- libs/CompactAST/src/CompactAST.cpp (C++ reader)
- libs/CompactAST/src/CompactAST.js (JavaScript writer)
