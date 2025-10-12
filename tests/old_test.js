// Examples Test Suite Version: 1

const oldTestFiles = [
            { name: "Test_Case_for_Array_Access.ino", content: `// Test Case for Array Access\nint myPins[] = {2, 4, 8};\n\nvoid setup() {\n  pinMode(myPins[1], OUTPUT);\n}\n\nvoid loop() {\n  // empty\n}` },
            { name: "To_test_the_Lexer_and_Parser.ino", content: `// To test the Lexer and Parser\nvoid setup() {\n  /*\n    This is the setup function.\n    It runs once at the beginning.\n  */\n  Serial.begin(9600); // Initialize serial communication\n  pinMode(13, OUTPUT); // Configure pin 13 as output for LED\n}\n\nvoid loop() {\n  // Turn the LED on\n  digitalWrite(13, HIGH);\n  delay(1000); // Wait for a second\n\n  // Turn the LED off\n  digitalWrite(13, LOW);\n  delay(1000); // Wait for another second\n}` },
            { name: "Global_variable_declarations.ino", content: `#include <Arduino.h>\n\n// Global variable declarations\nconst int ledPin = 13;\nint counter = 0;\nfloat dutyCycle = 127.5; // Test floating point\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  for (int i = 0; i < 2; i++) {\n    digitalWrite(ledPin, HIGH);\n    delay(50);\n    digitalWrite(ledPin, LOW);\n    delay(50);\n  }\n\n  if (counter >= 5 && counter < 10) {\n    // This block should not execute on the first few loops\n  }\n\n  counter += 1; // Test compound assignment\n  delay(500);\n}` },
            { name: "Test_Case_for_Operator_Precedence.ino", content: `// Test Case for Operator Precedence\nvoid setup() {\n  int a = 5;\n  int b = 10;\n  int c = 2;\n\n  if (a + b / c == 10 && b > 9) {\n    // Parser should correctly evaluate (b / c) first, then (a + ...),\n    // then (== 10), then (> 9), and finally the &&.\n  }\n}\n\nvoid loop() {\n  // empty\n}` },
            { name: "Test_Case_for_Parentheses_Precedence.ino", content: `// Test Case for Parentheses Precedence\nvoid setup() {\n  int a = 5;\n  int b = 10;\n  int c = 2;\n\n  int result = (a + b) * c; // Should evaluate (a + b) first.\n}\n\nvoid loop() {\n  // empty\n}` },
            { name: "Test_Case_for_Unary_vs_Binary_Operators.ino", content: `// Test Case for Unary vs. Binary Operators\nvoid setup() {\n  int x = 10;\n  int y = -x;      // Unary minus\n  int z = 10 - 5;  // Binary minus\n}\n\nvoid loop() {\n  // empty\n}` },
            { name: "Test_Case_for_C-Style_Initialization.ino", content: `// Test Case for C++-Style Initialization\nvoid setup() {\n  int x(10);\n}\n\nvoid loop() {\n  // empty\n}` },
            { name: "Test_Rigorous_Brackets_Parentheses.ino", content: `// Test Rigorous Brackets & Parentheses\nint myPins[] = {2, 4, 8};\n\nint getIndex() {\n  return 1;\n}\n\nvoid setup() {\n  int x = myPins[0];\n  int y = myPins[getIndex()];\n  pinMode(myPins[2], OUTPUT);\n  int z = (myPins[0] + getIndex()) * myPins[2];\n}\n\nvoid loop() {\n  // empty\n}` },
            { name: "Test_Case_for_the_return_statement.ino", content: `// Test Case for the return statement\nint getValue() {\n  return 42;\n}\n\nvoid doSomething() {\n  return;\n}\n\nvoid setup() {}\nvoid loop() {}` },
            { name: "Test_Case_for_Advanced_Numeric_Literals.ino", content: `// Test Case for Advanced Numeric Literals\nint hexValue = 0x1A;\nint octValue = 032;\nfloat sciValue = 2.6e1;\n\nvoid setup() {}\nvoid loop() {}` },
            { name: "Test_Case_for_Character_Literals.ino", content: `// Test Case for Character Literals\nchar myChar = 'C';\n\nvoid setup() {}\nvoid loop() {}` },
            { name: "Test_Case_for_the_Dangling_Else.ino", content: `// Test Case for the \"Dangling Else\"\nvoid setup() {\n  int x = 5;\n  int y = 10;\n  if (x > 0)\n    if (y > 20)\n      pinMode(1, HIGH);\n    else\n      pinMode(1, LOW);\n}\n\nvoid loop() {}` },
            { name: "Test_Case_for_Pointer_vs_Multiplication.ino", content: `// Test Case for Pointer vs. Multiplication\nvoid setup() {\n  int x = 5 * 10;\n  int* p = &x;\n}\n\nvoid loop() {}` },
            { name: "Test_Case_for_Function_Pointer_Declarations.ino", content: `// Test Case for Function Pointer Declarations\nvoid myInterruptService() {}\n\nvoid setup() {\n  void (*myFunction)() = &myInterruptService;\n}\n\nvoid loop() {}` },
            { name: "Nested_Loops_and_Variable_Scope.ino", content: `// Nested Loops and Variable Scope\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int i = 0;\n  while (i < 3) {\n    for (int j = 0; j < 3; j++) {\n      int k = 0;\n      do {\n        Serial.print("i: ");\n        Serial.print(i);\n        Serial.print(", j: ");\n        Serial.print(j);\n        Serial.print(", k: ");\n        Serial.println(k);\n        k++;\n      } while (k < 2);\n    }\n    i++;\n  }\n}` },
            { name: "Complex_Conditional_Logic.ino", content: `// Complex Conditional Logic\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = 5;\n  int y = 10;\n  int z = 15;\n\n  if ((x < y && y != z) || (x == 5 && z > 10)) {\n    if (z / x > 2 && y % 2 == 0) {\n      Serial.println("Condition 1 met.");\n    } else {\n      Serial.println("Condition 2 met.");\n    }\n  } else if (x > y || y == 10) {\n    Serial.println("Condition 3 met.");\n  } else {\n    Serial.println("No conditions met.");\n  }\n}` },
            { name: "Operator_Precedence_and_Associativity.ino", content: `// Operator Precedence and Associativity\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 20;\n  int b = 5;\n  int c = 2;\n  int d = 3;\n\n  int result1 = a + b * c - d;\n  int result2 = (a + b) * c - d;\n  int result3 = a / (b - d) + c;\n\n  Serial.print("Result 1: "); Serial.println(result1);\n  Serial.print("Result 2: "); Serial.println(result2);\n  Serial.print("Result 3: "); Serial.println(result3);\n}` },
            { name: "Function_Calls_and_Parameter_Passing.ino", content: `// Function Calls and Parameter Passing\nint add(int x, int y) {\n  return x + y;\n}\n\nint multiply(int x, int y) {\n  return x * y;\n}\n\nint calculate(int x, int y, int z) {\n  return multiply(add(x, y), z);\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 5;\n  int b = 10;\n  int c = 2;\n\n  int finalResult = calculate(a, b, c);\n\n  Serial.print("Final result: ");\n  Serial.println(finalResult);\n}` },
            { name: "Loop_Control_Statements_break_continue.ino", content: `// Loop Control Statements (break, continue)\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  for (int i = 0; i < 5; i++) {\n    for (int j = 0; j < 5; j++) {\n      if (j == 2) {\n        Serial.println("Continuing inner loop...");\n        continue;\n      }\n      if (i == 3) {\n        Serial.println("Breaking outer loop...");\n        break;\n      }\n      Serial.print("i: ");\n      Serial.print(i);\n      Serial.print(", j: ");\n      Serial.print(j);\n      Serial.println(j);\n    }\n  }\n}` },
            { name: "Ternary_Operator_and_Bitwise_Operators.ino", content: `// Ternary Operator and Bitwise Operators\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 10;\n  int b = 20;\n\n  int maxVal = (a > b) ? a : b;\n  Serial.print("Max value: "); Serial.println(maxVal);\n\n  int c = 0b1010;\n  int d = 0b0110;\n  int andResult = c & d;\n  int orResult = c | d;\n  int xorResult = c ^ d;\n  int shiftResult = c << 1;\n\n  Serial.print("AND result: "); Serial.println(andResult);\n  Serial.print("OR result: "); Serial.println(orResult);\n  Serial.print("XOR result: "); Serial.println(xorResult);\n  Serial.print("Shift result: "); Serial.println(shiftResult);\n}` },
            { name: "Floating-Point_Arithmetic_and_Mixed_Types.ino", content: `// Floating-Point Arithmetic and Mixed Types\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  float f1 = 3.14;\n  float f2 = 2.0;\n  int i1 = 5;\n\n  float result1 = f1 * f2;\n  float result2 = (f1 + i1) / f2;\n\n  if (result2 > 4.0 && i1 < 10) {\n    Serial.println("Calculation is correct.");\n  } else {\n    Serial.println("Calculation is incorrect.");\n  }\n\n  Serial.print("Result 1: "); Serial.println(result1, 4);\n  Serial.print("Result 2: "); Serial.println(result2, 4);\n}` },
            { name: "String_and_Character_Literals.ino", content: `// String and Character Literals\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  char myChar = 'A';\n  char escapedChar = '\\n';\n  const char* str1 = "Hello";\n  const char* str2 = " world!";\n\n  Serial.print(str1);\n  Serial.println(str2);\n  Serial.print("My character is: ");\n  Serial.println(myChar);\n\n  Serial.print(myChar);\n  Serial.print(escapedChar);\n}` },
            { name: "Multiple_Statements_on_a_Single_Line.ino", content: `// Multiple Statements on a Single Line\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = 10; int y = 20; if (x < y) { Serial.println("X is less than Y."); }\n  int i = 0; while (i < 3) { Serial.println(i); i++; }\n  for (int j = 0; j < 2; j++) { Serial.print("J is: "); Serial.println(j); }\n}` },
            { name: "Mixed-Type_Expressions_and_Casting.ino", content: `// Mixed-Type Expressions and Casting\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 10;\n  float b = 3.0;\n\n  float result1 = (float)(a / 3);\n  float result2 = a / b;\n  float result3 = (float)a * b + 5.5;\n\n  Serial.print("Result 1 (int div, cast): "); Serial.println(result1, 4);\n  Serial.print("Result 2 (float div): "); Serial.println(result2, 4);\n  Serial.print("Result 3 (mixed): "); Serial.println(result3, 4);\n}` },
            { name: "switch_statement_with_fall-through_and_nested_blocks.ino", content: `// switch statement with fall-through and nested blocks\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = 2;\n  switch (x) {\n    case 1:\n      Serial.println("Case 1");\n    case 2: {\n      int y = 5;\n      Serial.println("Case 2");\n      Serial.print("y is: ");\n      Serial.println(y);\n    }\n    case 3:\n      Serial.println("Case 3");\n      break;\n    default:\n      Serial.println("Default case");\n      break;\n  }\n}` },
            { name: "Complex_Preprocessor_Directives.ino", content: `// Complex Preprocessor Directives\n#define PI 3.14159\n#define CIRCLE_AREA(r) (PI * r * r)\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  #ifdef PI\n    float radius = 5.0;\n    float area = CIRCLE_AREA(radius);\n    Serial.print("Area of circle: ");\n    Serial.println(area);\n  #else\n    Serial.println("PI is not defined.");\n  #endif\n}` },
            { name: "Array_Indexing_and_Multidimensional_Arrays.ino", content: `// Array Indexing and Multidimensional Arrays\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int arr[5] = {10, 20, 30, 40, 50};\n  int matrix[2][3] = {{1, 2, 3}, {4, 5, 6}};\n  int i = 2;\n  int j = 1;\n  int k = 1;\n\n  int val1 = arr[i * 2 - 1];\n  int val2 = matrix[j][k];\n\n  Serial.print("Val 1: ");\n  Serial.println(val1);\n  Serial.print("Val 2: ");\n  Serial.println(val2);\n}` },
            { name: "Function_Pointers_and_Callbacks.ino", content: `// Function Pointers and Callbacks\nint myFunc(int a, int b) {\n  return a + b;\n}\n\nvoid callFunc(int (*funcPtr)(int, int)) {\n  Serial.print("Result: ");\n  Serial.println(funcPtr(10, 20));\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int (*ptr)(int, int);\n  ptr = &myFunc;\n  callFunc(ptr);\n}` },
            { name: "Chained_Assignments_and_Unary_Operators.ino", content: `// Chained Assignments and Unary Operators\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a, b, c;\n  a = b = c = 5;\n  int x = 10;\n  int y = ++x;\n  int z = y++;\n  Serial.print("a: "); Serial.println(a);\n  Serial.print("x: "); Serial.println(x);\n  Serial.print("y: "); Serial.println(y);\n  Serial.print("z: "); Serial.println(z);\n  int result = --x * (y++);\n  Serial.print("Final result: "); Serial.println(result);\n}` },
            { name: "Complex_for_loop_with_multiple_expressions.ino", content: `// Complex for loop with multiple expressions\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int i = 0;\n  int j = 10;\n\n  for (i = 0, j = 10; i < j; i++, j--) {\n    Serial.print("i: ");\n    Serial.print(i);\n    Serial.print(", j: ");\n    Serial.print(j);\n    Serial.println(j);\n  }\n}` },
            { name: "do-while_loop_with_a_complex_condition.ino", content: `// do-while loop with a complex condition\nbool checkCondition(int val) {\n  return val % 2 == 0;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int count = 0;\n  int val = 10;\n\n  do {\n    count++;\n    val--;\n    Serial.print("Count: ");\n    Serial.println(count);\n  } while (count < 5 && checkCondition(val) == false);\n}` },
            { name: "Structs_and_Member_Access.ino", content: `// Structs and Member Access\nstruct Point {\n  int x;\n  int y;\n};\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  struct Point p1;\n  p1.x = 10;\n  p1.y = 20;\n\n  Serial.print("Point x: ");\n  Serial.println(p1.x);\n  Serial.print("Point y: ");\n  Serial.println(p1.y);\n}` },
            { name: "Unary_Plus_and_Minus_with_Operator_Precedence.ino", content: `// Unary Plus and Minus with Operator Precedence\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 5;\n  int b = -10;\n\n  int result1 = a + -b;\n  int result2 = -a * b;\n  int result3 = 10 - +a;\n\n  Serial.print("Result 1: "); Serial.println(result1);\n  Serial.print("Result 2: "); Serial.println(result2);\n  Serial.print("Result 3: "); Serial.println(result3);\n}` },
            { name: "Empty_and_NULL_statements.ino", content: `// Empty and NULL statements\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int i = 0;\n  while (i < 5) {\n    i++;\n  } ;\n\n  for (int j = 0; j < 5; j++);\n\n  if (1 == 1) {}\n\n  Serial.println("Execution finished.");\n}` },
            { name: "Pointers_and_Pointer_Arithmetic.ino", content: `// Pointers and Pointer Arithmetic\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int arr[3] = {10, 20, 30};\n  int *ptr = arr;\n\n  Serial.print("First element: ");\n  Serial.println(*ptr);\n\n  ptr++;\n  Serial.print("Next element: ");\n  Serial.println(*ptr);\n\n  int nextVal = *(ptr + 1);\n  Serial.print("Next value with arithmetic: ");\n  Serial.println(nextVal);\n}` },
            { name: "Initializer_Lists_and_Designated_Initializers.ino", content: `// Initializer Lists and Designated Initializers\nstruct Point {\n  int x;\n  int y;\n};\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int numbers[] = {1, 2, 3};\n  struct Point p = {.x = 10, .y = 20};\n\n  Serial.print("Numbers[1]: ");\n  Serial.println(numbers[1]);\n\n  Serial.print("Point x: ");\n  Serial.println(p.x);\n\n  Serial.print("Point y: ");\n  Serial.println(p.y);\n}` },
            { name: "Type_Promotion_and_Implicit_Conversions.ino", content: `// Type Promotion and Implicit Conversions\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  char c = 'A';\n  int i = 5;\n  float f = 2.5;\n\n  int result1 = c + i;\n  float result2 = i * f;\n\n  Serial.print("Result 1: ");\n  Serial.println(result1);\n\n  Serial.print("Result 2: ");\n  Serial.println(result2);\n}` },
            { name: "typedef_and_Structs_with_Pointers.ino", content: `// typedef and Structs with Pointers\ntypedef struct {\n  int x;\n  int y;\n} MyPoint;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  MyPoint p1;\n  MyPoint *p2;\n\n  p1.x = 10;\n  p1.y = 20;\n\n  p2 = &p1;\n\n  Serial.print("Value of x using pointer: ");\n  Serial.println(p2->x);\n\n  p2->y = 30;\n  Serial.print("Modified value of y: ");\n  Serial.println(p1.y);\n}` },
            { name: "static_Variables_and_Scope.ino", content: `// static Variables and Scope\nvoid counter() {\n  static int count = 0;\n  count++;\n  Serial.print("Count is: ");\n  Serial.println(count);\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  counter();\n  delay(1000);\n}` },
            { name: "const_and_volatile_Qualifiers.ino", content: `// const and volatile Qualifiers\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  const int myConst = 100;\n  volatile int myVolatile = 50;\n\n  Serial.print("My constant: ");\n  Serial.println(myConst);\n\n  Serial.print("My volatile: ");\n  Serial.println(myVolatile);\n}` },
            { name: "Logical_Operators_with_Short-Circuiting.ino", content: `// Logical Operators with Short-Circuiting\nint myFunc() {\n  Serial.println("myFunc() was called.");\n  return 1;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = 0;\n  int y = 5;\n\n  if (x == 0 || myFunc()) {\n    Serial.println("Condition 1 is true.");\n  }\n\n  if (x == 1 && myFunc()) {\n    Serial.println("Condition 2 is true.");\n  }\n}` },
            { name: "Conditional_Operator_in_a_Loop.ino", content: `// Conditional Operator in a Loop\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = 0;\n  for (int i = 0; i < 5; i++) {\n    x = (i == 0) ? 1 : ((i % 2 == 0) ? i + 10 : i * 10);\n    Serial.print("For i=");\n    Serial.print(i);\n    Serial.print(", x is: ");\n    Serial.println(x);\n  }\n}` },
            { name: "Variable_Declarations_in_a_for_Loop.ino", content: `// Variable Declarations in a for Loop\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  for (int i = 0; i < 3; i++) {\n    Serial.print("i: ");\n    Serial.println(i);\n  }\n}` },
            { name: "Unary_sizeof_Operator.ino", content: `// Unary sizeof Operator\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 10;\n  char b = 'B';\n  float c = 3.14;\n\n  Serial.print("Size of int: ");\n  Serial.println(sizeof(a));\n\n  Serial.print("Size of char: ");\n  Serial.println(sizeof(char));\n\n  Serial.print("Size of float: ");\n  Serial.println(sizeof(c));\n}` },
            { name: "Comma_Operator_in_a_for_Loop.ino", content: `// Comma Operator in a for Loop\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 0, b = 10;\n  for (int i = 0; i < 3; i++) {\n    Serial.print("Initial a: ");\n    Serial.println(a);\n    a = (a++, b++);\n    Serial.print("Final a: ");\n    Serial.println(a);\n  }\n}` },
            { name: "Nested_for_and_if_with_break_and_continue.ino", content: `// Nested for and if with break and continue\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  for (int i = 0; i < 5; i++) {\n    for (int j = 0; j < 5; j++) {\n      if (i == 2 && j == 2) {\n        Serial.println("Skipping inner loop...");\n        continue;\n      }\n      if (i == 3) {\n        Serial.println("Breaking outer loop...");\n        break;\n      }\n      Serial.print("i: ");\n      Serial.print(i);\n      Serial.print(", j: ");\n      Serial.print(j);\n      Serial.println(j);\n    }\n    if (i == 3) {\n      break;\n    }\n  }\n}` },
            { name: "Pointer_to_Pointer.ino", content: `// Pointer to Pointer\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int x = 100;\n  int *p1 = &x;\n  int **p2 = &p1;\n\n  Serial.print("Value of x: ");\n  Serial.println(x);\n\n  Serial.print("Value of *p1: ");\n  Serial.println(*p1);\n\n  Serial.print("Value of **p2: ");\n  Serial.println(**p2);\n\n  **p2 = 200;\n  Serial.print("New value of x: ");\n  Serial.println(x);\n}` },
            { name: "Self-Referential_Structs_Linked_List_Node.ino", content: `// Self-Referential Structs (Linked List Node)\nstruct Node {\n  int data;\n  struct Node* next;\n};\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  struct Node n1, n2;\n  n1.data = 10;\n  n1.next = &n2;\n\n  n2.data = 20;\n  n2.next = NULL;\n\n  Serial.print("Data from n1: ");\n  Serial.println(n1.data);\n  Serial.print("Data from n2 via n1: ");\n  Serial.println(n1.next->data);\n}` },
            { name: "static_Global_Variable_and_Function.ino", content: `// static Global Variable and Function\nstatic int global_counter = 0;\n\nstatic void incrementCounter() {\n  global_counter++;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  incrementCounter();\n  Serial.print("Counter: ");\n  Serial.println(global_counter);\n  delay(1000);\n}` },
            { name: "Unsigned_Integer_Rollover.ino", content: `// Unsigned Integer Rollover\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  unsigned int i = 4294967295;\n  Serial.print("Initial value: ");\n  Serial.println(i);\n  i++;\n  Serial.print("After increment (rollover): ");\n  Serial.println(i);\n  i = 0;\n  i--;\n  Serial.print("After decrement (rollover): ");\n  Serial.println(i);\n}` },
            { name: "Complex_Function_Declarations.ino", content: `// Complex Function Declarations\nint applyOperation(int (*op)(int, int), int a, int b) {\n  return op(a, b);\n}\n\nint add(int x, int y) {\n  return x + y;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int result = applyOperation(add, 5, 10);\n  Serial.print("Result of applyOperation: ");\n  Serial.println(result);\n}` },
            { name: "Bit-Fields_in_Structs.ino", content: `// Bit-Fields in Structs\nstruct MyFlags {\n  unsigned int a : 1;\n  unsigned int b : 1;\n  unsigned int c : 6;\n};\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  struct MyFlags flags;\n  flags.a = 1;\n  flags.b = 0;\n  flags.c = 50;\n\n  Serial.print("Flag a: ");\n  Serial.println(flags.a);\n  Serial.print("Flag c: ");\n  Serial.println(flags.c);\n}` },
            { name: "extern_Keyword.ino", content: `// extern Keyword\nextern int externalVariable;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  externalVariable = 10;\n  Serial.print("External variable value: ");\n  Serial.println(externalVariable);\n}\n\nint externalVariable = 5;` },
            { name: "Ternary_Operator_with_Complex_Expressions.ino", content: `// Ternary Operator with Complex Expressions\nint getBigger(int x, int y) {\n  return (x > y) ? x : y;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int a = 10, b = 20, c = 30;\n\n  int result = (a < b) ? getBigger(a, c) : (a + b);\n\n  Serial.print("Final result: ");\n  Serial.println(result);\n}` }
 ];

// --- Examples Harness Runner Logic ---
// This function runs the parser against all 79 examples.

function runExamples() {
    const logElement = document.getElementById('log');
    let fullLog = '';
    let testsPassed = 0;
    
    const timestamp = new Date().toLocaleString();
    fullLog += `Parser Version: ${PARSER_VERSION} | Test run at: ${timestamp}\n\n`;

    oldTestFiles.forEach(testFile => {
        fullLog += `--- Running: ${testFile.name} ---\n`;
        
        try {
            const ast = parse(testFile.content);
            
            // Properly check for ErrorNodes anywhere in the AST tree
            function hasErrors(node) {
                if (!node || typeof node !== 'object') return false;
                if (node.type === 'ErrorNode') return true;
                
                for (const key in node) {
                    if (typeof node[key] === 'object' && node[key] !== null) {
                        if (Array.isArray(node[key])) {
                            for (const item of node[key]) {
                                if (hasErrors(item)) return true;
                            }
                        } else {
                            if (hasErrors(node[key])) return true;
                        }
                    }
                }
                return false;
            }
            
            function collectErrors(node, errors = []) {
                if (!node || typeof node !== 'object') return errors;
                if (node.type === 'ErrorNode') {
                    errors.push(node.value || 'Unknown error');
                    return errors;
                }
                
                for (const key in node) {
                    if (typeof node[key] === 'object' && node[key] !== null) {
                        if (Array.isArray(node[key])) {
                            for (const item of node[key]) {
                                collectErrors(item, errors);
                            }
                        } else {
                            collectErrors(node[key], errors);
                        }
                    }
                }
                return errors;
            }
            
            if (hasErrors(ast)) {
                const errors = collectErrors(ast);
                throw new Error(`ErrorNodes found in AST: ${errors.slice(0, 3).join('; ')}`);
            }
            
            fullLog += `<span class="success">[SUCCESS]</span> Parsed successfully.\n`;
            fullLog += `--- Abstract Syntax Tree ---\n`;
            fullLog += prettyPrintAST(ast);
            fullLog += `--- End of AST ---\n\n`;
            testsPassed++;
        } catch (error) {
            fullLog += `<span class="failure">[FAILURE]</span> ${error.name}: ${error.message}\n\n`;
        }
    });

    fullLog += `--- Test Summary ---\n`;
    fullLog += `${testsPassed} / ${oldTestFiles.length} examples parsed successfully.\n`;
    logElement.innerHTML = fullLog;
}

// Universal export for Node.js and browser compatibility
if (typeof window !== 'undefined') {
    // Browser environment
    window.oldTestFiles = oldTestFiles;
    window.runExamples = runExamples;
    
    // Run the tests automatically when the page loads
    window.onload = runExamples;
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        oldTestFiles,
        runExamples
    };
}

