the extract commands tool (extract_cpp_commands) MUST be run from the root folder NO EXCEPTIONS!!
the validation tool (validate_cross_platform) MUST be run from the build folder NO EXCEPTIONS!!:
the baseline validation commands tool (run_baseline_validation.sh) MUST be run from the root folder NO EXCEPTIONS!!:

build test data or test for a single command:
cd /mnt/d/Devel/ASTInterpreter && ./build/extract_cpp_commands 20
cd /mnt/d/Devel/ASTInterpreter/build && ./validate_cross_platform 20 20
cd /mnt/d/Devel/ASTInterpreter && ./run_baseline_validation.sh 20 20

build complete test data:
cd /mnt/d/Devel/ASTInterpreter && node src/javascript/generate_test_data.js

build complete json data and test each test:
cd /mnt/d/Devel/ASTInterpreter && ./run_baseline_validation.sh

after any C++ changes you MUST rebuild all tools and all test data and test for regressions:

  PROCEDURE:
  1. Make code changes to fix issue
  2. Re-build ALL tools
  3. Re-generate ALL test data
  4. Run FULL baseline validation (Check for regressions)

cd build
make arduino_ast_interpreter extract_cpp_commands validate_cross_platform
cd /mnt/d/Devel/ASTInterpreter
node src/javascript/generate_test_data.js
./run_baseline_validation.sh

