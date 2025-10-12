# Comprehensive Unit Testing Strategy for ASTInterpreter

**Document Version**: 1.0
**Date**: October 2025
**Status**: Proposal for Development Integration

---

## 📊 CURRENT STATE ANALYSIS

### What You Have Now:

**Integration Testing Only**: 135 end-to-end tests comparing JavaScript ↔ C++ outputs
- **Strength**: Excellent for catching cross-platform interpreter differences
- **Weakness**: Tests entire system at once, hard to isolate bugs
- **Speed**: Seconds per test (relatively slow feedback)

**100% Cross-Platform Validation**:
- Validates JavaScript and C++ interpreters produce identical command streams
- Tests real-world Arduino programs (79 examples + 54 comprehensive + 2 NeoPixel)
- Currently achieving 100% success rate (135/135 tests passing)

**No Component-Level Testing**:
- Missing unit tests for individual classes/functions
- No isolated testing of AST nodes, data types, or interpreter logic
- Bug discovery requires running full integration tests

### Code Complexity Statistics:

**C++ Codebase**:
- ~11,000 lines of code total
- 9,063 lines in ASTInterpreter.cpp alone
- 1,292 lines in CompactAST.cpp
- 142 total C++ source files
- 120+ classes and structs
- 72 distinct AST node types
- 338+ public methods in ASTInterpreter.hpp

**JavaScript Codebase**:
- ~11,481 lines of code
- Parallel implementation to C++
- 9 existing test files (parser, interpreter, semantic)

**Key Components**:
- **AST Nodes**: 72 types (ProgramNode, FunctionDefNode, BinaryOpNode, etc.)
- **CompactAST**: Binary serialization/deserialization with 12.5x compression
- **ArduinoDataTypes**: 25+ classes (ArduinoString, ArduinoArray, ArduinoPointer, etc.)
- **Interpreter**: Variable scoping, execution flow, command emission
- **Parser**: Lexing, parsing, preprocessor, platform emulation

### Critical Coverage Gaps:

1. **AST Node Operations**
   - No tests for individual node construction
   - No tests for visitor pattern dispatch
   - No tests for memory management (move semantics, RAII)
   - No tests for child node attachment/detachment

2. **CompactAST Serialization**
   - No tests for binary format edge cases
   - No tests for corrupted data handling
   - No tests for version compatibility
   - No tests for maximum limits (children, nesting depth)

3. **Parser Edge Cases**
   - No tests for malformed input
   - No tests for syntax error recovery
   - No tests for preprocessor edge cases
   - No tests for complex template syntax

4. **Data Type Operations**
   - No tests for ArduinoString methods (charAt, substring, concat, etc.)
   - No tests for ArduinoArray bounds checking
   - No tests for ArduinoPointer arithmetic and dereferencing
   - No tests for type conversions

5. **Execution Flow**
   - No tests for scope manager operations
   - No tests for variable lifecycle
   - No tests for control flow logic (loops, conditionals, switch)
   - No tests for function call stack management

6. **Error Handling**
   - No tests for exception paths
   - No tests for resource cleanup on errors
   - No tests for out-of-memory conditions
   - No tests for stack overflow detection

7. **Missing C++ Features**
   - Template parameters (e.g., `vector<int>`, `map<string, int>`)
   - Nested templates (e.g., `vector<vector<int>>`)
   - Complex inheritance and virtual methods
   - Advanced operator overloading
   - Lambda expressions and closures

---

## 🎯 MULTI-LAYERED TESTING STRATEGY

### Architecture Overview:

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Regression Tests                          │
│  Purpose: Prevent fixed bugs from returning         │
│  Speed: Fast (part of CI/CD)                        │
└─────────────────────────────────────────────────────┘
                       ↑
┌─────────────────────────────────────────────────────┐
│  Layer 3: Property-Based Tests (Fuzzing)            │
│  Purpose: Find edge cases via random generation     │
│  Speed: Minutes (thousands of tests)                │
└─────────────────────────────────────────────────────┘
                       ↑
┌─────────────────────────────────────────────────────┐
│  Layer 2: Integration Tests (EXISTING)              │
│  Purpose: Cross-platform validation (JS ↔ C++)     │
│  Speed: Seconds per test                            │
└─────────────────────────────────────────────────────┘
                       ↑
┌─────────────────────────────────────────────────────┐
│  Layer 1: Unit Tests (NEW)                          │
│  Purpose: Test individual components in isolation   │
│  Speed: Milliseconds per test                       │
└─────────────────────────────────────────────────────┘
```

### Layer 1: Unit Tests (NEW - Component Level)

**Purpose**: Test individual classes/functions in isolation
**Coverage Target**: 70-80% code coverage
**Execution Speed**: Milliseconds per test
**Test Count**: 300-500 tests

**Benefits**:
- Immediate feedback during development
- Pinpoint exact failure location
- Enable confident refactoring
- Serve as executable documentation

**Example Test Categories**:
- AST node creation and manipulation
- Data type operations (string, array, pointer)
- Scope manager operations
- Binary serialization round-trips
- Parser tokenization

### Layer 2: Integration Tests (EXISTING - Keep As-Is)

**Purpose**: Cross-platform validation (JavaScript ↔ C++)
**Coverage**: 135 real-world Arduino programs
**Execution Speed**: Seconds per test
**Success Rate**: 100% (135/135 passing)

**Keep These Tests Exactly As-Is**:
- Provide end-to-end validation
- Catch cross-platform differences
- Test real-world Arduino code
- Validate complete system behavior

**No Changes Needed**: This layer is working perfectly!

### Layer 3: Property-Based Tests (NEW - Fuzzing)

**Purpose**: Generate thousands of random inputs to find edge cases
**Coverage**: Input validation, parser robustness, crash detection
**Execution Speed**: Minutes (10,000+ iterations)
**Test Count**: 5-10 test generators

**Testing Approaches**:
- Random code generation
- Mutation-based fuzzing
- Boundary value testing
- Stress testing (memory, stack depth)

**Example Fuzzing Categories**:
- Random identifier names (valid and invalid)
- Random operator sequences
- Random nesting depths
- Invalid UTF-8 sequences
- Extremely long strings/arrays
- Edge case numbers (MAX_INT, MIN_INT, NaN, Infinity)

### Layer 4: Regression Tests (NEW - Automated)

**Purpose**: Prevent fixed bugs from returning
**Coverage**: Every significant bug fix
**Execution Speed**: Part of CI/CD pipeline
**Test Count**: 1 test per major bug

**Process**:
1. Bug discovered and fixed
2. Create regression test that would have caught it
3. Add to test suite
4. Ensure test fails without fix, passes with fix
5. Integrate into CI/CD pipeline

---

## 🔧 IMPLEMENTATION PLAN

## Phase 1: C++ Unit Testing Infrastructure (Week 1)

### A. Choose Google Test Framework

**Rationale**:
- Industry standard for C++ testing
- Rich assertion library (EXPECT_EQ, ASSERT_TRUE, etc.)
- Test fixtures for setup/teardown
- Parameterized tests for data-driven testing
- Death tests for crash detection
- Excellent CMake integration
- Active maintenance and wide adoption

**Installation**:
```bash
# Ubuntu/Debian
sudo apt-get install libgtest-dev cmake

# Or build from source
git clone https://github.com/google/googletest.git
cd googletest && mkdir build && cd build
cmake .. && make && sudo make install
```

### B. Project Structure:

```
ASTInterpreter/
├── tests/
│   ├── unit/                          # NEW: Unit tests
│   │   ├── cpp/
│   │   │   ├── test_ast_nodes.cpp     # AST node creation/manipulation
│   │   │   ├── test_compact_ast.cpp   # Binary serialization tests
│   │   │   ├── test_data_types.cpp    # ArduinoDataTypes tests
│   │   │   ├── test_interpreter.cpp   # Interpreter logic tests
│   │   │   ├── test_scope_manager.cpp # Variable scoping tests
│   │   │   ├── test_visitors.cpp      # Visitor pattern tests
│   │   │   ├── test_execution_flow.cpp # Control flow tests
│   │   │   └── test_error_handling.cpp # Exception/error tests
│   │   └── js/                        # NEW: JS unit tests
│   │       ├── test_parser.spec.js
│   │       ├── test_interpreter.spec.js
│   │       ├── test_compact_ast.spec.js
│   │       └── test_data_types.spec.js
│   ├── integration/                   # EXISTING (rename from current)
│   │   ├── validate_cross_platform.cpp
│   │   ├── extract_cpp_commands.cpp
│   │   └── test_utils.hpp
│   ├── property/                      # NEW: Property-based tests
│   │   ├── test_parser_fuzzing.cpp
│   │   ├── test_ast_generation.cpp
│   │   └── test_stress.cpp
│   ├── regression/                    # NEW: Bug regression tests
│   │   ├── test_issue_78.cpp          # One file per major bug
│   │   ├── test_issue_96.cpp
│   │   └── README.md                  # Document what each test prevents
│   └── fixtures/                      # NEW: Shared test data
│       ├── sample_asts/
│       ├── corrupted_data/
│       └── edge_cases/
├── src/ (unchanged)
├── libs/ (unchanged)
└── CMakeLists.txt (updated)
```

### C. CMake Integration:

Add to `CMakeLists.txt` starting at line 281 (in the `if(BUILD_TESTS)` block):

```cmake
if(BUILD_TESTS)
    enable_testing()

    # =============================================================================
    # UNIT TESTS (Development Only)
    # =============================================================================

    option(BUILD_UNIT_TESTS "Build unit tests (development only)" ON)

    if(BUILD_UNIT_TESTS)
        # Find Google Test
        find_package(GTest REQUIRED)
        include(GoogleTest)

        # Unit test executable
        add_executable(unit_tests
            tests/unit/cpp/test_ast_nodes.cpp
            tests/unit/cpp/test_compact_ast.cpp
            tests/unit/cpp/test_data_types.cpp
            tests/unit/cpp/test_interpreter.cpp
            tests/unit/cpp/test_scope_manager.cpp
            tests/unit/cpp/test_visitors.cpp
            tests/unit/cpp/test_execution_flow.cpp
            tests/unit/cpp/test_error_handling.cpp
            tests/test_utils.hpp
        )

        target_link_libraries(unit_tests
            PRIVATE
                arduino_ast_interpreter
                GTest::gtest
                GTest::gtest_main
        )

        target_include_directories(unit_tests
            PRIVATE
                ${CMAKE_CURRENT_SOURCE_DIR}/tests
        )

        # Discover tests automatically
        gtest_discover_tests(unit_tests)

        # Property-based tests (fuzzing)
        add_executable(property_tests
            tests/property/test_parser_fuzzing.cpp
            tests/property/test_ast_generation.cpp
            tests/property/test_stress.cpp
        )

        target_link_libraries(property_tests
            PRIVATE
                arduino_ast_interpreter
                GTest::gtest
                GTest::gtest_main
        )

        gtest_discover_tests(property_tests)

        # Regression tests
        add_executable(regression_tests
            tests/regression/test_issue_78.cpp
            tests/regression/test_issue_96.cpp
        )

        target_link_libraries(regression_tests
            PRIVATE
                arduino_ast_interpreter
                GTest::gtest
                GTest::gtest_main
        )

        gtest_discover_tests(regression_tests)

        # Custom test targets
        add_custom_target(test_unit
            COMMAND ${CMAKE_CTEST_COMMAND} -R "unit_" --output-on-failure
            DEPENDS unit_tests
            COMMENT "Running unit tests"
        )

        add_custom_target(test_property
            COMMAND ${CMAKE_CTEST_COMMAND} -R "property_" --output-on-failure
            DEPENDS property_tests
            COMMENT "Running property-based tests"
        )

        add_custom_target(test_regression
            COMMAND ${CMAKE_CTEST_COMMAND} -R "regression_" --output-on-failure
            DEPENDS regression_tests
            COMMENT "Running regression tests"
        )
    endif()

    # =============================================================================
    # INTEGRATION TESTS (Always Built)
    # =============================================================================

    # Rename existing tools to integration_* for clarity
    add_executable(integration_extract_commands
        tests/integration/extract_cpp_commands.cpp
        tests/test_utils.hpp
    )

    target_link_libraries(integration_extract_commands
        PRIVATE arduino_ast_interpreter
    )

    add_executable(integration_validate
        tests/integration/validate_cross_platform.cpp
        tests/test_utils.hpp
    )

    target_link_libraries(integration_validate
        PRIVATE arduino_ast_interpreter
    )

    # Custom target for integration tests
    add_custom_target(test_integration
        COMMAND ${CMAKE_CURRENT_BINARY_DIR}/integration_validate 0 134
        DEPENDS integration_validate integration_extract_commands
        COMMENT "Running integration tests (cross-platform validation)"
    )

    # =============================================================================
    # MASTER TEST TARGETS
    # =============================================================================

    # Run all tests
    add_custom_target(test_all
        COMMAND ${CMAKE_CTEST_COMMAND} --output-on-failure
        DEPENDS unit_tests integration_validate
        COMMENT "Running all tests"
    )

    # Fast tests only (unit + regression)
    add_custom_target(test_fast
        COMMAND ${CMAKE_CTEST_COMMAND} -R "unit_|regression_" --output-on-failure
        DEPENDS unit_tests regression_tests
        COMMENT "Running fast tests"
    )
endif()
```

### D. Development-Only Build Flag:

**Production Build** (no unit tests):
```bash
cd build
cmake .. -D BUILD_UNIT_TESTS=OFF -D CMAKE_BUILD_TYPE=Release
make
```

**Development Build** (with unit tests):
```bash
cd build
cmake .. -D BUILD_UNIT_TESTS=ON -D CMAKE_BUILD_TYPE=Debug
make
make test_unit  # Run unit tests
make test_integration  # Run integration tests
make test_all  # Run everything
```

**Size Impact**:
- Unit test executables: ~2-5 MB (NOT included in production builds)
- No runtime overhead in production
- Google Test linked only in test executables

---

## Phase 2: JavaScript Unit Testing (Week 1-2)

### A. Choose Jest Framework

**Rationale**:
- Industry standard for JavaScript testing
- Built-in assertion library
- Snapshot testing for AST comparison
- Code coverage reports
- Parallel test execution
- Watch mode for TDD
- Excellent Node.js integration

**Installation**:
```bash
npm install --save-dev jest @types/jest jest-junit
```

### B. Package.json Setup (root directory):

Create or update `package.json`:

```json
{
  "name": "arduino-ast-interpreter",
  "version": "18.1.0",
  "description": "Arduino AST Interpreter with cross-platform validation",
  "private": true,
  "scripts": {
    "test:unit": "jest tests/unit/js",
    "test:unit:watch": "jest tests/unit/js --watch",
    "test:unit:coverage": "jest tests/unit/js --coverage",
    "test:integration:parser": "node tests/parser/test_parser_examples.js",
    "test:integration:interpreter": "node tests/interpreter/test_interpreter_examples.js",
    "test:integration:all": "npm run test:integration:parser && npm run test:integration:interpreter",
    "test:all": "npm run test:unit && npm run test:integration:all",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "jest-junit": "^16.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "src/javascript/**/*.js",
      "libs/**/*.js",
      "!**/node_modules/**",
      "!**/tests/**",
      "!**/examples.js",
      "!**/old_test.js",
      "!**/neopixel.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 75,
        "lines": 75,
        "statements": 75
      }
    },
    "testMatch": [
      "**/tests/unit/js/**/*.spec.js"
    ],
    "testTimeout": 10000
  }
}
```

### C. Example JavaScript Unit Tests:

**tests/unit/js/test_compact_ast.spec.js**:
```javascript
const { exportCompactAST, importCompactAST } = require('../../../libs/CompactAST/src/CompactAST.js');

describe('CompactAST Serialization', () => {
    test('exports valid binary format', () => {
        const ast = {
            type: 'PROGRAM',
            children: []
        };
        const binary = exportCompactAST(ast);

        expect(binary).toBeInstanceOf(ArrayBuffer);
        expect(binary.byteLength).toBeGreaterThan(0);
    });

    test('round-trip serialization preserves structure', () => {
        const ast = {
            type: 'PROGRAM',
            children: [
                { type: 'NUMBER', value: 42 },
                { type: 'IDENTIFIER', name: 'x' }
            ]
        };

        const binary = exportCompactAST(ast);
        const restored = importCompactAST(binary);

        expect(restored.type).toBe('PROGRAM');
        expect(restored.children).toHaveLength(2);
        expect(restored.children[0].type).toBe('NUMBER');
        expect(restored.children[0].value).toBe(42);
    });

    test('handles empty AST', () => {
        const ast = { type: 'PROGRAM', children: [] };
        const binary = exportCompactAST(ast);
        const restored = importCompactAST(binary);

        expect(restored.type).toBe('PROGRAM');
        expect(restored.children).toHaveLength(0);
    });

    test('handles deep nesting', () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'FUNCTION_DEF',
                children: [{
                    type: 'COMPOUND_STMT',
                    children: [{
                        type: 'IF_STMT',
                        children: []
                    }]
                }]
            }]
        };

        const binary = exportCompactAST(ast);
        const restored = importCompactAST(binary);

        expect(restored.children[0].children[0].children[0].type).toBe('IF_STMT');
    });
});
```

**tests/unit/js/test_interpreter.spec.js**:
```javascript
const { ASTInterpreter } = require('../../../src/javascript/ASTInterpreter.js');

describe('ASTInterpreter Variable Operations', () => {
    test('declares and initializes variable', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [
                {
                    type: 'VAR_DECL',
                    name: 'x',
                    declaredType: 'int',
                    initializer: { type: 'NUMBER', value: 5 }
                }
            ]
        };

        const interpreter = new ASTInterpreter(ast, {
            maxLoopIterations: 1,
            verbose: false
        });

        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await interpreter.start();

        expect(commands).toContainEqual(
            expect.objectContaining({
                type: 'VAR_SET',
                variable: 'x',
                value: 5
            })
        );
    });

    test('handles variable assignment', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [
                { type: 'VAR_DECL', name: 'x', declaredType: 'int', initializer: { type: 'NUMBER', value: 0 } },
                {
                    type: 'ASSIGNMENT',
                    left: { type: 'IDENTIFIER', name: 'x' },
                    right: { type: 'NUMBER', value: 10 },
                    operator: '='
                }
            ]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await interpreter.start();

        const assignments = commands.filter(cmd => cmd.type === 'VAR_SET' && cmd.variable === 'x');
        expect(assignments).toHaveLength(2);
        expect(assignments[1].value).toBe(10);
    });
});

describe('ASTInterpreter Control Flow', () => {
    test('executes if statement (true condition)', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'IF_STMT',
                condition: { type: 'NUMBER', value: 1 },
                thenBranch: {
                    type: 'COMPOUND_STMT',
                    children: [
                        { type: 'VAR_DECL', name: 'result', declaredType: 'int', initializer: { type: 'NUMBER', value: 42 } }
                    ]
                }
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await interpreter.start();

        expect(commands).toContainEqual(
            expect.objectContaining({ variable: 'result', value: 42 })
        );
    });

    test('skips else branch when condition true', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'IF_STMT',
                condition: { type: 'NUMBER', value: 1 },
                thenBranch: {
                    type: 'COMPOUND_STMT',
                    children: [{ type: 'VAR_DECL', name: 'a', declaredType: 'int', initializer: { type: 'NUMBER', value: 1 } }]
                },
                elseBranch: {
                    type: 'COMPOUND_STMT',
                    children: [{ type: 'VAR_DECL', name: 'b', declaredType: 'int', initializer: { type: 'NUMBER', value: 2 } }]
                }
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await interpreter.start();

        expect(commands.some(cmd => cmd.variable === 'a')).toBe(true);
        expect(commands.some(cmd => cmd.variable === 'b')).toBe(false);
    });
});
```

### D. Running JavaScript Tests:

```bash
# Run all unit tests
npm run test:unit

# Run in watch mode (for TDD)
npm run test:unit:watch

# Run with coverage report
npm run test:unit:coverage

# Run specific test file
npx jest tests/unit/js/test_compact_ast.spec.js

# Run tests matching pattern
npx jest --testNamePattern="variable"
```

---

## Phase 3: Test Categories & Priorities

### Priority 1: Critical Path Components (Week 2)

**Target**: 150 tests covering core functionality

#### 1. AST Node Creation (50 tests)

**File**: `tests/unit/cpp/test_ast_nodes.cpp`

**Coverage**:
- Constructor tests for all 72 node types
- Child node attachment/detachment
- Move semantics and RAII
- Visitor pattern dispatch
- Node type conversion
- Memory safety (no leaks, no double-free)

**Example Tests**:
- Create each node type with valid data
- Add/remove children from composite nodes
- Test visitor pattern calls correct method
- Verify node type enum values
- Test node cloning/copying

#### 2. CompactAST Serialization (40 tests)

**File**: `tests/unit/cpp/test_compact_ast.cpp`

**Coverage**:
- Round-trip serialization (export → import → export)
- Edge cases (empty nodes, max children, deep nesting)
- Error handling (corrupted data, version mismatches)
- Binary format compatibility
- Size calculations
- Endianness handling

**Example Tests**:
- Serialize and deserialize each node type
- Test with 0, 1, 10, 100, 1000 children
- Test nesting depth limits
- Corrupt binary data and verify graceful failure
- Test with different platform byte orders
- Verify binary format version headers

#### 3. Data Type Operations (60 tests)

**File**: `tests/unit/cpp/test_data_types.cpp`

**Coverage**:
- ArduinoString operations (charAt, substring, concat, length, etc.)
- ArduinoArray operations (access, bounds, initialization, iteration)
- ArduinoPointer operations (dereference, arithmetic, null handling)
- ArduinoStruct field access
- Type conversions
- Operator overloading

**Example Tests**:
- String concatenation, comparison, modification
- Array out-of-bounds detection
- Pointer arithmetic and dereferencing
- Struct field access and nested structs
- Type casting between Arduino types
- Operator overload correctness (==, !=, <, >, etc.)

### Priority 2: Parser & Execution (Week 3)

**Target**: 150 tests covering parsing and execution logic

#### 4. Parser Edge Cases (80 tests)

**Files**:
- `tests/unit/js/test_parser.spec.js`
- `tests/unit/cpp/test_parser.cpp` (if C++ parser exists)

**Coverage**:
- Syntax error detection
- Preprocessor directive handling
- Complex expression parsing
- Nested structure parsing
- Template syntax
- Operator precedence

**Example Tests**:
- Parse invalid syntax and verify error messages
- Test #define, #ifdef, #include handling
- Parse deeply nested expressions
- Test operator precedence (*, +, <<, ==, &&, etc.)
- Parse template declarations
- Test Unicode in identifiers/strings

#### 5. Interpreter Execution (70 tests)

**Files**:
- `tests/unit/cpp/test_interpreter.cpp`
- `tests/unit/js/test_interpreter.spec.js`

**Coverage**:
- Variable scoping (global, local, block)
- Function call mechanics
- Loop execution and termination
- Operator precedence evaluation
- Type coercion
- Command emission

**Example Tests**:
- Variable shadowing in nested scopes
- Function parameter passing (by value/reference)
- Loop iteration counts and early exit
- Expression evaluation order
- Implicit type conversions
- Verify command stream output

### Priority 3: Error Handling & Performance (Week 4)

**Target**: 70 tests covering error paths and edge cases

#### 6. Error Paths (40 tests)

**File**: `tests/unit/cpp/test_error_handling.cpp`

**Coverage**:
- Out of memory conditions
- Stack overflow detection
- Division by zero
- Type mismatch errors
- Null pointer dereference
- Invalid operations

**Example Tests**:
- Allocate memory until exhaustion
- Recurse until stack limit
- Divide integer/float by zero
- Assign incompatible types
- Dereference null pointers
- Call undefined functions

#### 7. Memory Management (30 tests)

**File**: `tests/unit/cpp/test_memory.cpp`

**Coverage**:
- Memory leak detection (with Valgrind)
- RAII pattern verification
- Smart pointer usage
- Resource cleanup on exception
- Move semantics
- Copy elision

**Example Tests**:
- Create/destroy objects and verify no leaks
- Test exception safety (strong guarantee)
- Verify unique_ptr/shared_ptr usage
- Test move constructors/assignment
- Verify copy constructor deleted where appropriate

---

## Phase 4: Property-Based Testing (Week 5)

### A. Fuzzing Infrastructure

Property-based testing generates thousands of random inputs to find edge cases that manual tests miss.

**File**: `tests/property/test_parser_fuzzing.cpp`

```cpp
#include <gtest/gtest.h>
#include <random>
#include <string>
#include "ArduinoParser.hpp"

class ParserFuzzing : public ::testing::Test {
protected:
    std::mt19937 rng{12345}; // Fixed seed for reproducibility

    std::string generateRandomIdentifier(int length) {
        static const char chars[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
        std::uniform_int_distribution<> dist(0, sizeof(chars) - 2);
        std::string result;
        for (int i = 0; i < length; i++) {
            result += chars[dist(rng)];
        }
        return result;
    }

    std::string generateRandomCode() {
        std::string code = "void setup() {\n";

        // Add random variable declarations
        int numVars = std::uniform_int_distribution<>(1, 10)(rng);
        for (int i = 0; i < numVars; i++) {
            code += "  int " + generateRandomIdentifier(8) + " = " +
                    std::to_string(std::uniform_int_distribution<>(-1000, 1000)(rng)) + ";\n";
        }

        code += "}\nvoid loop() {}\n";
        return code;
    }
};

TEST_F(ParserFuzzing, RandomIdentifiers) {
    for (int i = 0; i < 1000; i++) {
        std::string code = generateRandomCode();

        EXPECT_NO_THROW({
            auto ast = parse(code);
            // Should either parse successfully or throw clean error
        }) << "Failed on iteration " << i << " with code:\n" << code;
    }
}

TEST_F(ParserFuzzing, RandomOperatorSequences) {
    std::vector<std::string> ops = {"+", "-", "*", "/", "%", "<<", ">>", "&", "|", "^"};

    for (int i = 0; i < 500; i++) {
        std::string expr = "int x = 1";
        int numOps = std::uniform_int_distribution<>(1, 10)(rng);

        for (int j = 0; j < numOps; j++) {
            expr += " " + ops[std::uniform_int_distribution<>(0, ops.size()-1)(rng)] + " " +
                    std::to_string(std::uniform_int_distribution<>(1, 100)(rng));
        }
        expr += ";";

        std::string code = "void setup() { " + expr + " } void loop() {}";

        EXPECT_NO_THROW({
            auto ast = parse(code);
        }) << "Failed with expression: " << expr;
    }
}

TEST_F(ParserFuzzing, DeepNesting) {
    for (int depth = 1; depth <= 100; depth++) {
        std::string code = "void setup() {";
        for (int i = 0; i < depth; i++) {
            code += " if (1) {";
        }
        code += " int x = 5;";
        for (int i = 0; i < depth; i++) {
            code += " }";
        }
        code += " } void loop() {}";

        EXPECT_NO_THROW({
            auto ast = parse(code);
        }) << "Failed at nesting depth " << depth;
    }
}

TEST_F(ParserFuzzing, LongStrings) {
    std::vector<int> lengths = {0, 1, 10, 100, 1000, 10000, 100000};

    for (int length : lengths) {
        std::string str(length, 'a');
        std::string code = "void setup() { const char* s = \"" + str + "\"; } void loop() {}";

        EXPECT_NO_THROW({
            auto ast = parse(code);
        }) << "Failed with string length " << length;
    }
}

TEST_F(ParserFuzzing, EdgeCaseNumbers) {
    std::vector<std::string> numbers = {
        "0", "-0", "2147483647", "-2147483648", // int32 limits
        "4294967295", // uint32 max
        "0.0", "-0.0", "3.14159", "1e10", "1e-10", "1.0e+38", // floats
        "0x0", "0xFF", "0xFFFFFFFF", // hex
        "0b0", "0b11111111", // binary
        "077", "0777" // octal
    };

    for (const auto& num : numbers) {
        std::string code = "void setup() { auto x = " + num + "; } void loop() {}";

        EXPECT_NO_THROW({
            auto ast = parse(code);
        }) << "Failed with number: " << num;
    }
}
```

### B. Coverage Areas:

1. **Random Identifier Names**
   - Valid identifiers (letters, numbers, underscore)
   - Invalid identifiers (starting with digit, special chars)
   - Reserved keywords
   - Unicode identifiers

2. **Random Operator Sequences**
   - All binary operators
   - Operator precedence validation
   - Parenthesization
   - Mixed types

3. **Random Nesting Depths**
   - Nested if/else
   - Nested loops
   - Nested function calls
   - Nested structs/classes

4. **Invalid UTF-8 Sequences**
   - Malformed UTF-8
   - Null bytes in strings
   - Unprintable characters
   - Byte order marks

5. **Extremely Long Strings/Arrays**
   - 0-length, 1-length, max-length strings
   - Empty arrays, single-element, large arrays
   - Memory allocation limits

6. **Edge Case Numbers**
   - INT_MIN, INT_MAX
   - UINT_MAX
   - Float precision limits
   - NaN, Infinity
   - Hex, binary, octal literals

---

## Phase 5: CI/CD Integration (Week 6)

### A. GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests-cpp:
    name: C++ Unit Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtest-dev cmake build-essential

      - name: Build C++ tests
        run: |
          mkdir -p build
          cd build
          cmake .. -D BUILD_TESTS=ON -D BUILD_UNIT_TESTS=ON -D CMAKE_BUILD_TYPE=Debug
          make -j$(nproc)

      - name: Run C++ unit tests
        run: |
          cd build
          ctest -R "unit_" --output-on-failure --verbose

      - name: Run C++ property tests
        run: |
          cd build
          ctest -R "property_" --output-on-failure --verbose

      - name: Run C++ regression tests
        run: |
          cd build
          ctest -R "regression_" --output-on-failure --verbose

  unit-tests-js:
    name: JavaScript Unit Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run JavaScript unit tests
        run: npm run test:unit

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: javascript
          name: js-coverage

  integration-tests:
    name: Integration Tests (Cross-Platform Validation)
    runs-on: ubuntu-latest
    needs: [unit-tests-cpp, unit-tests-js]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y cmake build-essential
          npm install

      - name: Generate test data
        run: node src/javascript/generate_test_data.js

      - name: Build C++ interpreter
        run: |
          mkdir -p build
          cd build
          cmake .. -D BUILD_TESTS=ON -D CMAKE_BUILD_TYPE=Release
          make -j$(nproc)

      - name: Run cross-platform validation
        run: |
          cd build
          ./validate_cross_platform 0 134

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-outputs
          path: |
            build/test*_cpp.json
            build/test*_js.json
            build/test*_cpp.arduino
            build/test*_js.arduino

  coverage-report:
    name: Generate Coverage Report
    runs-on: ubuntu-latest
    needs: [unit-tests-cpp, unit-tests-js]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtest-dev cmake build-essential lcov
          npm install

      - name: Build with coverage
        run: |
          mkdir -p build
          cd build
          cmake .. -D BUILD_TESTS=ON -D BUILD_UNIT_TESTS=ON -D ENABLE_COVERAGE=ON
          make -j$(nproc)

      - name: Run tests
        run: |
          cd build
          ctest --output-on-failure

      - name: Generate C++ coverage
        run: |
          cd build
          lcov --capture --directory . --output-file coverage.info
          lcov --remove coverage.info '/usr/*' '*/tests/*' --output-file coverage.info
          lcov --list coverage.info

      - name: Upload C++ coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./build/coverage.info
          flags: cpp
          name: cpp-coverage

      - name: Generate JS coverage
        run: npm run test:coverage

      - name: Upload combined coverage
        uses: codecov/codecov-action@v3
```

### B. Pre-commit Hooks

Create `.git/hooks/pre-commit` (or use husky for npm-managed hooks):

```bash
#!/bin/bash
# Pre-commit hook to run fast tests

echo "Running pre-commit tests..."

# Run fast C++ unit tests (if build exists)
if [ -d "build" ]; then
    echo "Running C++ unit tests..."
    cd build
    make test_fast
    if [ $? -ne 0 ]; then
        echo "❌ C++ unit tests failed. Commit aborted."
        exit 1
    fi
    cd ..
fi

# Run JavaScript unit tests
echo "Running JavaScript unit tests..."
npm run test:unit --bail
if [ $? -ne 0 ]; then
    echo "❌ JavaScript unit tests failed. Commit aborted."
    exit 1
fi

echo "✅ All pre-commit tests passed!"
exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### C. Pre-push Hooks

Create `.git/hooks/pre-push`:

```bash
#!/bin/bash
# Pre-push hook to run all tests including integration

echo "Running pre-push validation..."

# Run all C++ tests
if [ -d "build" ]; then
    echo "Running all C++ tests..."
    cd build
    make test_all
    if [ $? -ne 0 ]; then
        echo "❌ C++ tests failed. Push aborted."
        exit 1
    fi
    cd ..
fi

# Run all JavaScript tests
echo "Running all JavaScript tests..."
npm run test:all
if [ $? -ne 0 ]; then
    echo "❌ JavaScript tests failed. Push aborted."
    exit 1
fi

# Run integration tests
echo "Running integration tests..."
cd build
./validate_cross_platform 0 134
if [ $? -ne 0 ]; then
    echo "❌ Integration tests failed. Push aborted."
    exit 1
fi
cd ..

echo "✅ All pre-push tests passed!"
exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-push
```

---

## Phase 6: Example Test Files

### C++ AST Node Test (Complete Example)

**File**: `tests/unit/cpp/test_ast_nodes.cpp`

```cpp
#include <gtest/gtest.h>
#include "ASTNodes.hpp"
#include <memory>

using namespace arduino_ast;

// =============================================================================
// BASIC NODE CREATION TESTS
// =============================================================================

TEST(ASTNodes, NumberNodeCreation) {
    auto node = std::make_unique<NumberNode>(42);

    EXPECT_EQ(node->getValue(), 42);
    EXPECT_EQ(node->getType(), ASTNodeType::NUMBER);
    EXPECT_NE(node, nullptr);
}

TEST(ASTNodes, NumberNodeNegative) {
    auto node = std::make_unique<NumberNode>(-99);
    EXPECT_EQ(node->getValue(), -99);
}

TEST(ASTNodes, NumberNodeZero) {
    auto node = std::make_unique<NumberNode>(0);
    EXPECT_EQ(node->getValue(), 0);
}

TEST(ASTNodes, IdentifierNodeCreation) {
    auto node = std::make_unique<IdentifierNode>("testVariable");

    EXPECT_EQ(node->getName(), "testVariable");
    EXPECT_EQ(node->getType(), ASTNodeType::IDENTIFIER);
}

TEST(ASTNodes, IdentifierNodeEmptyName) {
    auto node = std::make_unique<IdentifierNode>("");
    EXPECT_EQ(node->getName(), "");
}

TEST(ASTNodes, StringNodeCreation) {
    auto node = std::make_unique<StringNode>("Hello, World!");

    EXPECT_EQ(node->getValue(), "Hello, World!");
    EXPECT_EQ(node->getType(), ASTNodeType::STRING);
}

// =============================================================================
// COMPOSITE NODE TESTS
// =============================================================================

TEST(ASTNodes, ProgramNodeChildren) {
    auto program = std::make_unique<ProgramNode>();

    EXPECT_EQ(program->getChildren().size(), 0);
    EXPECT_EQ(program->getType(), ASTNodeType::PROGRAM);
}

TEST(ASTNodes, ProgramNodeAddChild) {
    auto program = std::make_unique<ProgramNode>();
    auto child = std::make_unique<NumberNode>(10);

    program->addChild(std::move(child));

    EXPECT_EQ(program->getChildren().size(), 1);
    EXPECT_EQ(program->getChildren()[0]->getType(), ASTNodeType::NUMBER);
}

TEST(ASTNodes, ProgramNodeMultipleChildren) {
    auto program = std::make_unique<ProgramNode>();

    program->addChild(std::make_unique<NumberNode>(1));
    program->addChild(std::make_unique<NumberNode>(2));
    program->addChild(std::make_unique<NumberNode>(3));

    EXPECT_EQ(program->getChildren().size(), 3);
}

TEST(ASTNodes, BinaryOpNodeCreation) {
    auto left = std::make_unique<NumberNode>(5);
    auto right = std::make_unique<NumberNode>(3);
    auto binop = std::make_unique<BinaryOpNode>("+", std::move(left), std::move(right));

    EXPECT_EQ(binop->getOperator(), "+");
    EXPECT_EQ(binop->getType(), ASTNodeType::BINARY_OP);
    EXPECT_NE(binop->getLeft(), nullptr);
    EXPECT_NE(binop->getRight(), nullptr);
}

// =============================================================================
// VISITOR PATTERN TESTS
// =============================================================================

TEST(ASTNodes, VisitorPatternCounting) {
    struct CountingVisitor : public ASTVisitor {
        int numberCount = 0;
        int identifierCount = 0;

        void visit(NumberNode& n) override {
            numberCount++;
        }

        void visit(IdentifierNode& n) override {
            identifierCount++;
        }

        // Stub implementations for other node types
        void visit(ProgramNode& n) override {}
        void visit(BinaryOpNode& n) override {}
        // ... etc
    };

    auto number = std::make_unique<NumberNode>(5);
    auto identifier = std::make_unique<IdentifierNode>("x");

    CountingVisitor visitor;
    number->accept(visitor);
    identifier->accept(visitor);

    EXPECT_EQ(visitor.numberCount, 1);
    EXPECT_EQ(visitor.identifierCount, 1);
}

TEST(ASTNodes, VisitorPatternTraversal) {
    struct TraversalVisitor : public ASTVisitor {
        std::vector<ASTNodeType> visitedTypes;

        void visit(ProgramNode& n) override {
            visitedTypes.push_back(ASTNodeType::PROGRAM);
            for (auto& child : n.getChildren()) {
                child->accept(*this);
            }
        }

        void visit(NumberNode& n) override {
            visitedTypes.push_back(ASTNodeType::NUMBER);
        }

        // ... other implementations
    };

    auto program = std::make_unique<ProgramNode>();
    program->addChild(std::make_unique<NumberNode>(1));
    program->addChild(std::make_unique<NumberNode>(2));

    TraversalVisitor visitor;
    program->accept(visitor);

    EXPECT_EQ(visitor.visitedTypes.size(), 3);
    EXPECT_EQ(visitor.visitedTypes[0], ASTNodeType::PROGRAM);
    EXPECT_EQ(visitor.visitedTypes[1], ASTNodeType::NUMBER);
    EXPECT_EQ(visitor.visitedTypes[2], ASTNodeType::NUMBER);
}

// =============================================================================
// MEMORY MANAGEMENT TESTS
// =============================================================================

TEST(ASTNodes, MoveSemantics) {
    auto node1 = std::make_unique<NumberNode>(42);
    auto node2 = std::move(node1);

    EXPECT_EQ(node1, nullptr);
    EXPECT_NE(node2, nullptr);
    EXPECT_EQ(node2->getValue(), 42);
}

TEST(ASTNodes, UniqueOwnership) {
    auto parent = std::make_unique<ProgramNode>();

    {
        auto child = std::make_unique<NumberNode>(100);
        parent->addChild(std::move(child));
        // child is now nullptr, parent owns the node
    }

    EXPECT_EQ(parent->getChildren().size(), 1);
    // Node should still exist after child unique_ptr goes out of scope
}

// =============================================================================
// NODE TYPE CONVERSION TESTS
// =============================================================================

TEST(ASTNodes, NodeTypeToString) {
    EXPECT_EQ(nodeTypeToString(ASTNodeType::PROGRAM), "PROGRAM");
    EXPECT_EQ(nodeTypeToString(ASTNodeType::NUMBER), "NUMBER");
    EXPECT_EQ(nodeTypeToString(ASTNodeType::IDENTIFIER), "IDENTIFIER");
    EXPECT_EQ(nodeTypeToString(ASTNodeType::BINARY_OP), "BINARY_OP");
    EXPECT_EQ(nodeTypeToString(ASTNodeType::FUNCTION_DEF), "FUNCTION_DEF");
}

TEST(ASTNodes, AllNodeTypesHaveStrings) {
    // Verify every enum value has a string representation
    for (int i = 0; i < static_cast<int>(ASTNodeType::NODE_TYPE_COUNT); i++) {
        ASTNodeType type = static_cast<ASTNodeType>(i);
        std::string str = nodeTypeToString(type);
        EXPECT_FALSE(str.empty()) << "Node type " << i << " has no string representation";
    }
}

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

TEST(ASTNodes, LargeNumberValue) {
    auto node = std::make_unique<NumberNode>(2147483647); // INT_MAX
    EXPECT_EQ(node->getValue(), 2147483647);
}

TEST(ASTNodes, VeryLongIdentifier) {
    std::string longName(10000, 'a');
    auto node = std::make_unique<IdentifierNode>(longName);
    EXPECT_EQ(node->getName(), longName);
    EXPECT_EQ(node->getName().length(), 10000);
}

TEST(ASTNodes, ManyChildren) {
    auto program = std::make_unique<ProgramNode>();

    for (int i = 0; i < 1000; i++) {
        program->addChild(std::make_unique<NumberNode>(i));
    }

    EXPECT_EQ(program->getChildren().size(), 1000);
}

TEST(ASTNodes, DeepNesting) {
    auto root = std::make_unique<ProgramNode>();
    ASTNode* current = root.get();

    // Create deep nesting
    for (int i = 0; i < 100; i++) {
        auto child = std::make_unique<ProgramNode>();
        ASTNode* childPtr = child.get();
        current->addChild(std::move(child));
        current = childPtr;
    }

    // Should not crash and should be properly owned
    EXPECT_NE(root, nullptr);
}
```

### JavaScript Interpreter Test (Complete Example)

**File**: `tests/unit/js/test_interpreter.spec.js`

```javascript
const { ASTInterpreter } = require('../../../src/javascript/ASTInterpreter.js');

describe('ASTInterpreter - Variable Declarations', () => {
    test('declares integer variable', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [
                {
                    type: 'VAR_DECL',
                    declarations: [{
                        type: 'DECLARATOR_NODE',
                        name: 'x',
                        declaredType: 'int',
                        initializer: { type: 'NUMBER', value: 5 }
                    }]
                }
            ]
        };

        const interpreter = new ASTInterpreter(ast, {
            maxLoopIterations: 1,
            verbose: false
        });

        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise((resolve) => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        expect(commands).toContainEqual(
            expect.objectContaining({
                type: 'VAR_SET',
                variable: 'x',
                value: 5
            })
        );
    });

    test('declares string variable', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'VAR_DECL',
                declarations: [{
                    type: 'DECLARATOR_NODE',
                    name: 'message',
                    declaredType: 'String',
                    initializer: { type: 'STRING', value: 'Hello' }
                }]
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const varSet = commands.find(cmd => cmd.type === 'VAR_SET' && cmd.variable === 'message');
        expect(varSet).toBeDefined();
        expect(varSet.value).toBe('Hello');
    });

    test('declares variable without initializer', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'VAR_DECL',
                declarations: [{
                    type: 'DECLARATOR_NODE',
                    name: 'y',
                    declaredType: 'int'
                }]
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const varSet = commands.find(cmd => cmd.type === 'VAR_SET' && cmd.variable === 'y');
        expect(varSet).toBeDefined();
        expect(varSet.value).toBe(0); // Default initialization
    });
});

describe('ASTInterpreter - Assignments', () => {
    test('assigns to existing variable', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [
                {
                    type: 'VAR_DECL',
                    declarations: [{
                        type: 'DECLARATOR_NODE',
                        name: 'x',
                        declaredType: 'int',
                        initializer: { type: 'NUMBER', value: 0 }
                    }]
                },
                {
                    type: 'ASSIGNMENT',
                    left: { type: 'IDENTIFIER', name: 'x' },
                    right: { type: 'NUMBER', value: 10 },
                    operator: '='
                }
            ]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const assignments = commands.filter(cmd => cmd.type === 'VAR_SET' && cmd.variable === 'x');
        expect(assignments.length).toBeGreaterThanOrEqual(2);
        expect(assignments[assignments.length - 1].value).toBe(10);
    });

    test('compound assignment operator', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [
                {
                    type: 'VAR_DECL',
                    declarations: [{
                        type: 'DECLARATOR_NODE',
                        name: 'count',
                        declaredType: 'int',
                        initializer: { type: 'NUMBER', value: 5 }
                    }]
                },
                {
                    type: 'ASSIGNMENT',
                    left: { type: 'IDENTIFIER', name: 'count' },
                    right: { type: 'NUMBER', value: 3 },
                    operator: '+='
                }
            ]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const finalValue = commands.filter(cmd => cmd.type === 'VAR_SET' && cmd.variable === 'count').pop();
        expect(finalValue.value).toBe(8);
    });
});

describe('ASTInterpreter - Control Flow', () => {
    test('if statement with true condition executes then branch', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'IF_STMT',
                condition: { type: 'NUMBER', value: 1 },
                thenBranch: {
                    type: 'COMPOUND_STMT',
                    children: [{
                        type: 'VAR_DECL',
                        declarations: [{
                            type: 'DECLARATOR_NODE',
                            name: 'result',
                            declaredType: 'int',
                            initializer: { type: 'NUMBER', value: 42 }
                        }]
                    }]
                }
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        expect(commands).toContainEqual(
            expect.objectContaining({ variable: 'result', value: 42 })
        );
    });

    test('if statement with false condition executes else branch', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'IF_STMT',
                condition: { type: 'NUMBER', value: 0 },
                thenBranch: {
                    type: 'COMPOUND_STMT',
                    children: [{
                        type: 'VAR_DECL',
                        declarations: [{
                            type: 'DECLARATOR_NODE',
                            name: 'a',
                            declaredType: 'int',
                            initializer: { type: 'NUMBER', value: 1 }
                        }]
                    }]
                },
                elseBranch: {
                    type: 'COMPOUND_STMT',
                    children: [{
                        type: 'VAR_DECL',
                        declarations: [{
                            type: 'DECLARATOR_NODE',
                            name: 'b',
                            declaredType: 'int',
                            initializer: { type: 'NUMBER', value: 2 }
                        }]
                    }]
                }
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        expect(commands.some(cmd => cmd.variable === 'a')).toBe(false);
        expect(commands.some(cmd => cmd.variable === 'b')).toBe(true);
    });

    test('for loop executes correct number of iterations', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'FOR_STMT',
                init: {
                    type: 'VAR_DECL',
                    declarations: [{
                        type: 'DECLARATOR_NODE',
                        name: 'i',
                        declaredType: 'int',
                        initializer: { type: 'NUMBER', value: 0 }
                    }]
                },
                condition: {
                    type: 'BINARY_OP',
                    operator: '<',
                    left: { type: 'IDENTIFIER', name: 'i' },
                    right: { type: 'NUMBER', value: 3 }
                },
                increment: {
                    type: 'POSTFIX_EXPRESSION',
                    operator: '++',
                    operand: { type: 'IDENTIFIER', name: 'i' }
                },
                body: {
                    type: 'COMPOUND_STMT',
                    children: []
                }
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 10 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const iValues = commands
            .filter(cmd => cmd.type === 'VAR_SET' && cmd.variable === 'i')
            .map(cmd => cmd.value);

        expect(iValues).toContain(0);
        expect(iValues).toContain(1);
        expect(iValues).toContain(2);
        expect(iValues).toContain(3);
    });
});

describe('ASTInterpreter - Arithmetic Operations', () => {
    test('addition', async () => {
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'VAR_DECL',
                declarations: [{
                    type: 'DECLARATOR_NODE',
                    name: 'sum',
                    declaredType: 'int',
                    initializer: {
                        type: 'BINARY_OP',
                        operator: '+',
                        left: { type: 'NUMBER', value: 5 },
                        right: { type: 'NUMBER', value: 3 }
                    }
                }]
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const sumVar = commands.find(cmd => cmd.variable === 'sum');
        expect(sumVar.value).toBe(8);
    });

    test('operator precedence', async () => {
        // Test: 2 + 3 * 4 = 14 (not 20)
        const ast = {
            type: 'PROGRAM',
            children: [{
                type: 'VAR_DECL',
                declarations: [{
                    type: 'DECLARATOR_NODE',
                    name: 'result',
                    declaredType: 'int',
                    initializer: {
                        type: 'BINARY_OP',
                        operator: '+',
                        left: { type: 'NUMBER', value: 2 },
                        right: {
                            type: 'BINARY_OP',
                            operator: '*',
                            left: { type: 'NUMBER', value: 3 },
                            right: { type: 'NUMBER', value: 4 }
                        }
                    }
                }]
            }]
        };

        const interpreter = new ASTInterpreter(ast, { maxLoopIterations: 1 });
        const commands = [];
        interpreter.onCommand = (cmd) => commands.push(cmd);

        await new Promise(resolve => {
            interpreter.onComplete = resolve;
            interpreter.start();
        });

        const resultVar = commands.find(cmd => cmd.variable === 'result');
        expect(resultVar.value).toBe(14);
    });
});
```

---

## 📈 COVERAGE GOALS

### Target Metrics:

**C++ Coverage**:
- **Line Coverage**: 75% minimum
- **Branch Coverage**: 70% minimum
- **Function Coverage**: 80% minimum
- **Tool**: gcov + lcov

**JavaScript Coverage**:
- **Line Coverage**: 80% minimum
- **Branch Coverage**: 75% minimum
- **Function Coverage**: 85% minimum
- **Tool**: Jest coverage (Istanbul)

**Integration Tests**:
- **Pass Rate**: 100% (135/135 tests)
- **Speed**: < 5 minutes for full suite

**Property Tests**:
- **Iterations**: 10,000+ per category
- **Crash Detection**: 0 crashes on random input
- **Speed**: < 10 minutes for full suite

**CI Build Time**:
- **Total Pipeline**: < 15 minutes
- **Unit Tests**: < 2 minutes
- **Integration Tests**: < 5 minutes
- **Property Tests**: < 8 minutes

### Coverage Tracking Commands:

**C++ Coverage (with gcov/lcov)**:
```bash
# Build with coverage instrumentation
cd build
cmake .. -D ENABLE_COVERAGE=ON -D BUILD_TESTS=ON
make

# Run tests
ctest --output-on-failure

# Generate coverage report
lcov --capture --directory . --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/tests/*' '*/trash/*' --output-file coverage.info
lcov --list coverage.info

# Generate HTML report
genhtml coverage.info --output-directory coverage_report
# Open coverage_report/index.html in browser
```

**JavaScript Coverage (with Jest)**:
```bash
# Run tests with coverage
npm run test:coverage

# Coverage report automatically generated in coverage/
# Open coverage/lcov-report/index.html in browser

# Check coverage thresholds
npm run test:coverage -- --coverage --coverageReporters=text

# Generate JSON report for CI
npm run test:coverage -- --coverage --coverageReporters=json
```

**Combined Coverage Report**:
```bash
# Use Codecov or similar service to merge C++ and JS coverage
# Upload both coverage.info (C++) and coverage/coverage-final.json (JS)
codecov -f build/coverage.info -f coverage/coverage-final.json
```

---

## 🚀 ROLLOUT STRATEGY

### Week 1: Infrastructure Setup
- [ ] Install Google Test and Jest
- [ ] Create test directory structure (`tests/unit/`, `tests/property/`, `tests/regression/`)
- [ ] Update CMakeLists.txt with test targets
- [ ] Update package.json with test scripts
- [ ] Add development-only build flags (BUILD_UNIT_TESTS)
- [ ] Verify build system works with sample test

### Week 2: Priority 1 Tests (Critical Path)
- [ ] Write 50 AST node tests
- [ ] Write 40 CompactAST serialization tests
- [ ] Write 60 data type operation tests
- [ ] Achieve 50% code coverage
- [ ] Fix any bugs discovered by tests
- [ ] Document test patterns for team

### Week 3: Priority 2 Tests (Parser & Execution)
- [ ] Write 80 parser edge case tests
- [ ] Write 70 interpreter execution tests
- [ ] Achieve 65% code coverage
- [ ] Add regression tests for any bugs found
- [ ] Update documentation with findings

### Week 4: Priority 3 Tests (Error Handling)
- [ ] Write 40 error path tests
- [ ] Write 30 memory management tests
- [ ] Achieve 75% code coverage
- [ ] Run Valgrind on all tests
- [ ] Document all error conditions

### Week 5: Property-Based Testing (Fuzzing)
- [ ] Implement fuzzing infrastructure
- [ ] Add 5-10 property test generators
- [ ] Run 10,000+ iterations per category
- [ ] Fix any crashes discovered
- [ ] Document fuzzing findings

### Week 6: CI/CD Integration
- [ ] Set up GitHub Actions workflow
- [ ] Add pre-commit hooks
- [ ] Add pre-push hooks
- [ ] Configure Codecov integration
- [ ] Document testing procedures for contributors
- [ ] Create testing guidelines (CONTRIBUTING_TESTING.md)

### Week 7: Documentation & Training
- [ ] Write comprehensive testing documentation
- [ ] Create video walkthrough of testing workflow
- [ ] Document common test patterns
- [ ] Create troubleshooting guide
- [ ] Add testing section to main README

---

## 💡 KEY BENEFITS

### 1. Catch Bugs Earlier
- Unit tests run in milliseconds
- Instant feedback during development
- Find issues before integration testing
- Debug failures in isolation

### 2. Refactoring Confidence
- Change code knowing tests will catch breakage
- Refactor without fear
- Improve architecture safely
- Optimize without introducing bugs

### 3. Documentation
- Tests serve as executable examples
- Show how to use each component
- Demonstrate expected behavior
- Provide usage patterns

### 4. Regression Prevention
- Fixed bugs stay fixed
- Every bug gets a test
- Build regression test suite over time
- Prevent repeat failures

### 5. Coverage Visibility
- Know exactly what code is tested
- Identify untested code paths
- Track coverage trends over time
- Set coverage requirements

### 6. Development Speed
- Faster than debugging integration test failures
- Immediate pinpointing of failures
- Reduce debugging time significantly
- Enable test-driven development (TDD)

### 7. Production Safety
- Unit tests never ship (BUILD_UNIT_TESTS=OFF)
- No runtime overhead
- No size increase in production binaries
- Development-only tooling

### 8. Team Collaboration
- Tests communicate intent
- Onboard new developers faster
- Enable parallel development
- Reduce code review time

### 9. Quality Metrics
- Measurable code quality
- Track quality over time
- Set quality gates
- Demonstrate quality to stakeholders

### 10. Cross-Platform Confidence
- Test each platform independently
- Combine with integration tests
- Ensure component-level correctness
- Validate platform abstractions

---

## 📝 NEXT IMMEDIATE STEPS

### Step 1: Install Testing Frameworks

**C++ (Google Test)**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libgtest-dev cmake build-essential

# Verify installation
dpkg -l | grep libgtest
```

**JavaScript (Jest)**:
```bash
# Install Jest and dependencies
npm install --save-dev jest @types/jest jest-junit

# Verify installation
npx jest --version
```

### Step 2: Create Directory Structure

```bash
# Create unit test directories
mkdir -p tests/unit/cpp
mkdir -p tests/unit/js

# Create property test directory
mkdir -p tests/property

# Create regression test directory
mkdir -p tests/regression

# Rename existing tests to integration
mkdir -p tests/integration
# (Move existing test files to tests/integration/)

# Create fixtures directory
mkdir -p tests/fixtures
```

### Step 3: Update CMakeLists.txt

Add the unit testing infrastructure to CMakeLists.txt as shown in Phase 1, Section C.

### Step 4: Create package.json (if not exists)

Add the Jest configuration as shown in Phase 2, Section B.

### Step 5: Write First 10 Tests (Proof of Concept)

Create `tests/unit/cpp/test_ast_nodes.cpp` with first 10 tests from the example above.

Create `tests/unit/js/test_interpreter.spec.js` with first 5 tests from the example above.

### Step 6: Build and Run Tests

```bash
# Build C++ tests
cd build
cmake .. -D BUILD_TESTS=ON -D BUILD_UNIT_TESTS=ON
make
make test_unit

# Run JavaScript tests
npm run test:unit
```

### Step 7: Verify Infrastructure

- [ ] C++ tests build successfully
- [ ] C++ tests run and pass
- [ ] JavaScript tests run and pass
- [ ] Coverage reports generate
- [ ] No errors in build output

### Step 8: Commit Initial Infrastructure

```bash
git add tests/ CMakeLists.txt package.json
git commit -m "Add unit testing infrastructure with Google Test and Jest"
```

### Step 9: Start Writing Tests

Begin writing tests according to the priority schedule:
- Week 2: Critical path (AST nodes, CompactAST, data types)
- Week 3: Parser and execution
- Week 4: Error handling

### Step 10: Document Process

Create `docs/TESTING_GUIDE.md` with:
- How to run tests
- How to write new tests
- Test patterns and best practices
- Troubleshooting guide

---

## 🎯 SUCCESS CRITERIA

This unit testing strategy is considered successful when:

1. **Coverage**: 75%+ C++ coverage, 80%+ JavaScript coverage
2. **Speed**: Unit tests run in < 2 minutes
3. **Reliability**: 0% flaky tests, consistent results
4. **Integration**: CI/CD pipeline running all tests on every commit
5. **Adoption**: All new code includes unit tests
6. **Quality**: Bugs caught by tests before production
7. **Documentation**: Comprehensive testing guide available
8. **Maintenance**: Tests maintained alongside code

---

## 📚 REFERENCES

**Google Test Documentation**:
- https://google.github.io/googletest/

**Jest Documentation**:
- https://jestjs.io/docs/getting-started

**C++ Testing Best Practices**:
- https://github.com/google/googletest/blob/main/docs/primer.md

**Property-Based Testing**:
- https://hypothesis.works/articles/what-is-property-based-testing/

**Coverage Tools**:
- gcov: https://gcc.gnu.org/onlinedocs/gcc/Gcov.html
- lcov: https://github.com/linux-test-project/lcov
- Jest Coverage: https://jestjs.io/docs/cli#--coverageboolean

---

## 🔄 MAINTENANCE & EVOLUTION

### Ongoing Maintenance

**Weekly**:
- Review test failures in CI/CD
- Update tests for API changes
- Add tests for new features

**Monthly**:
- Review coverage reports
- Identify untested code
- Add tests for low-coverage areas
- Remove obsolete tests

**Quarterly**:
- Audit test suite health
- Remove flaky tests
- Optimize slow tests
- Update testing documentation

### Evolution Path

**Phase 7** (Month 3+): **Advanced Testing**
- Performance benchmarking tests
- Load testing
- Concurrency tests
- Platform-specific tests (ESP32, WASM)

**Phase 8** (Month 6+): **Mutation Testing**
- Use mutation testing to verify test quality
- Identify weak tests that don't catch bugs
- Improve test assertions

**Phase 9** (Month 9+): **Contract Testing**
- Verify API contracts between components
- Ensure backward compatibility
- Test upgrade paths

---

## ✅ CONCLUSION

This comprehensive unit testing strategy transforms your testing infrastructure from **integration-only** to a **multi-layered testing pyramid**:

```
      ▲
     /│\       Property Tests (Fuzzing)
    / │ \      10,000+ iterations
   /  │  \
  /   │   \    Regression Tests
 /    │    \   Every fixed bug
/     │     \
------│------  Integration Tests (EXISTING)
      │        135 cross-platform tests
      │
━━━━━━━━━━━━━  Unit Tests (NEW)
              300-500 component tests
              Millisecond execution
```

**Result**: **Faster development**, **higher quality**, **confident refactoring**, and **production-grade reliability**.

**Status**: Ready for implementation. Begin with Week 1 infrastructure setup!
