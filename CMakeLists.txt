# CMakeLists.txt - ESP32-S3 Arduino AST Interpreter Build System
# 
# Cross-platform build system for host development and testing
# before Arduino library conversion.
#
# Version: 1.0
# Compatible with: C++17, Linux, Windows, macOS

cmake_minimum_required(VERSION 3.12)

project(ArduinoASTInterpreter
    VERSION 21.1.0
    DESCRIPTION "ESP32-S3 Arduino AST Interpreter - Host Development"
    LANGUAGES CXX)

# =============================================================================
# BUILD CONFIGURATION
# =============================================================================

# Require C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build type configuration
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Debug)
endif()

# Compiler flags with size optimization support
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    # Debug: Full symbols, no optimization
    set(CMAKE_CXX_FLAGS_DEBUG "-g -O0 -Wall -Wextra -Wpedantic")

    # Release: Speed optimization with dead code elimination
    set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -ffunction-sections -fdata-sections")
    set(CMAKE_EXE_LINKER_FLAGS_RELEASE "-Wl,--gc-sections -s")

    # MinSizeRel: Aggressive size optimization (for ESP32/WASM)
    # v20.0.0: RTTI removed - can now use -fno-rtti for embedded deployment
    set(CMAKE_CXX_FLAGS_MINSIZEREL "-Os -DNDEBUG -ffunction-sections -fdata-sections")
    set(CMAKE_EXE_LINKER_FLAGS_MINSIZEREL "-Wl,--gc-sections -s")

    # RelWithDebInfo: Optimized with debug symbols
    set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "-O2 -g -DNDEBUG -ffunction-sections -fdata-sections")
    set(CMAKE_EXE_LINKER_FLAGS_RELWITHDEBINFO "-Wl,--gc-sections")

elseif(CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
    # Debug: Full symbols, no optimization
    set(CMAKE_CXX_FLAGS_DEBUG "/Zi /Od /Wall")

    # Release: Speed optimization with link-time code generation
    set(CMAKE_CXX_FLAGS_RELEASE "/O2 /DNDEBUG /GL")
    set(CMAKE_EXE_LINKER_FLAGS_RELEASE "/LTCG /OPT:REF /OPT:ICF")

    # MinSizeRel: Size optimization
    set(CMAKE_CXX_FLAGS_MINSIZEREL "/O1 /DNDEBUG /GL")
    set(CMAKE_EXE_LINKER_FLAGS_MINSIZEREL "/LTCG /OPT:REF /OPT:ICF")

    # RelWithDebInfo: Optimized with debug symbols
    set(CMAKE_CXX_FLAGS_RELWITHDEBINFO "/O2 /Zi /DNDEBUG")
endif()

# =============================================================================
# PROJECT OPTIONS
# =============================================================================

option(BUILD_TESTS "Build test executables" ON)
option(BUILD_EXAMPLES "Build example executables" ON)
option(ENABLE_PROFILING "Enable memory and performance profiling" OFF)
option(ENABLE_COVERAGE "Enable code coverage" OFF)
option(BUILD_SHARED_LIBS "Build shared libraries" OFF)

# v21.1.0: RTTI Support Options
# ==============================
# RTTI (Run-Time Type Information) is the universal default for ALL platforms.
# Explicit opt-in to RTTI-free mode for size-constrained deployments (~40KB savings).
option(AST_NO_RTTI "Disable RTTI for size optimization (explicit opt-in, ~40KB savings)" OFF)

# ESP32-specific options (for when targeting ESP32)
option(TARGET_ESP32 "Target ESP32 platform" OFF)
option(USE_ARDUINO_FRAMEWORK "Use Arduino framework headers" OFF)

# =============================================================================
# DEPENDENCIES
# =============================================================================

# Standard library extensions
find_package(Threads REQUIRED)

# Optional dependencies
if(ENABLE_PROFILING)
    find_package(PkgConfig)
    if(PKG_CONFIG_FOUND)
        pkg_check_modules(VALGRIND valgrind)
    endif()
endif()

if(ENABLE_COVERAGE)
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU")
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} --coverage")
        set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} --coverage")
    endif()
endif()

# =============================================================================
# RTTI CONFIGURATION (v21.1.0)
# =============================================================================
# By default, RTTI is ENABLED for ALL platforms (dynamic_cast).
# RTTI-free mode is explicit opt-in for size-constrained deployments (static_cast).

if(AST_NO_RTTI)
    message(STATUS "")
    message(STATUS "╔════════════════════════════════════════════════════════════════╗")
    message(STATUS "║  RTTI DISABLED (Explicit Opt-In)                              ║")
    message(STATUS "║  • Uses static_cast (NO runtime type checking)                ║")
    message(STATUS "║  • ~40KB smaller than RTTI mode                                ║")
    message(STATUS "║  • Use ONLY after testing with RTTI mode!                     ║")
    message(STATUS "╚════════════════════════════════════════════════════════════════╝")
    message(STATUS "")

    # Add AST_NO_RTTI preprocessor definition
    add_definitions(-DAST_NO_RTTI)

    # Add compiler flag to disable RTTI
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        add_compile_options(-fno-rtti)
    elseif(MSVC)
        add_compile_options(/GR-)  # MSVC flag to disable RTTI
    endif()
else()
    message(STATUS "")
    message(STATUS "╔════════════════════════════════════════════════════════════════╗")
    message(STATUS "║  RTTI ENABLED (Universal Default - All Platforms)             ║")
    message(STATUS "║  • Uses dynamic_cast (runtime type verification)              ║")
    message(STATUS "║  • Recommended for development and production                  ║")
    message(STATUS "║  • ~40KB larger than RTTI-free mode                            ║")
    message(STATUS "╚════════════════════════════════════════════════════════════════╝")
    message(STATUS "")
endif()

# =============================================================================
# CORE LIBRARY TARGET
# =============================================================================

# Core AST Interpreter Library
add_library(arduino_ast_interpreter
    # AST Node definitions
    src/cpp/ASTNodes.cpp
    src/cpp/ASTNodes.hpp

    # Compact AST binary format (now in libs)
    libs/CompactAST/src/CompactAST.cpp
    libs/CompactAST/src/CompactAST.hpp

    # Ultra-minimal JSON command system (no command protocol needed)
    # FlexibleCommand infrastructure completely removed

    # Main interpreter
    src/cpp/ASTInterpreter.cpp
    src/cpp/ASTInterpreter.hpp

    # Execution diagnostics
    src/cpp/ExecutionTracer.cpp
    src/cpp/ExecutionTracer.hpp

    # Data model classes
    src/cpp/ArduinoDataTypes.cpp
    src/cpp/ArduinoDataTypes.hpp

    # Enhanced interpreter
    src/cpp/EnhancedInterpreter.cpp
    src/cpp/EnhancedInterpreter.hpp

    # Arduino library registry
    src/cpp/ArduinoLibraryRegistry.cpp
    src/cpp/ArduinoLibraryRegistry.hpp

    # Template instantiations (MinSizeRel only - reduces template bloat)
    $<$<CONFIG:MinSizeRel>:src/cpp/TemplateInstantiations.cpp>
)

# Include directories
target_include_directories(arduino_ast_interpreter
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src/cpp>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/libs/CompactAST/src>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/libs/CompactAST/src
)

# Compiler features and properties
target_compile_features(arduino_ast_interpreter PUBLIC cxx_std_17)

# Link libraries
target_link_libraries(arduino_ast_interpreter
    PUBLIC
        Threads::Threads
    PRIVATE
        $<$<PLATFORM_ID:Linux>:dl>
        $<$<PLATFORM_ID:Windows>:ws2_32>
)

# Preprocessor definitions
target_compile_definitions(arduino_ast_interpreter
    PUBLIC
        $<$<CONFIG:Debug>:DEBUG>
        $<$<CONFIG:Release>:NDEBUG>
        $<$<BOOL:${TARGET_ESP32}>:TARGET_ESP32>
        $<$<BOOL:${USE_ARDUINO_FRAMEWORK}>:ARDUINO_FRAMEWORK>
    PRIVATE
        CMAKE_BUILD_TYPE="${CMAKE_BUILD_TYPE}"
        PROJECT_VERSION="${PROJECT_VERSION}"
)

# Platform-specific configurations
if(WIN32)
    target_compile_definitions(arduino_ast_interpreter PRIVATE WIN32_LEAN_AND_MEAN)
elseif(UNIX AND NOT APPLE)
    target_compile_definitions(arduino_ast_interpreter PRIVATE _GNU_SOURCE)
endif()

# =============================================================================
# CROSS-PLATFORM BUILD OPTIONS
# =============================================================================

# Platform targeting options
option(BUILD_FOR_WASM "Build for WebAssembly/Emscripten" OFF)
option(BUILD_FOR_ESP32 "Build for ESP32 (Arduino framework simulation on host)" OFF)

# Feature control options
option(ENABLE_DEBUG_OUTPUT "Enable debug output (cout/Serial)" OFF)
option(ENABLE_FILE_TRACING "Enable ExecutionTracer file output" ON)
option(OPTIMIZE_SIZE "Optimize for code size (disable sstream, use manual string building)" OFF)

# Apply platform-specific definitions
if(BUILD_FOR_WASM)
    message(STATUS "Configuring for WebAssembly/Emscripten")
    target_compile_definitions(arduino_ast_interpreter PUBLIC
        PLATFORM_WASM
        __EMSCRIPTEN__
    )

    # Emscripten-specific flags (will be set when using emcmake)
    if(EMSCRIPTEN)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s WASM=1 -s ALLOW_MEMORY_GROWTH=1")
    endif()
endif()

if(BUILD_FOR_ESP32)
    message(STATUS "Configuring for ESP32 (simulated on host)")
    target_compile_definitions(arduino_ast_interpreter PUBLIC
        PLATFORM_ESP32
        ARDUINO_ARCH_ESP32
        ESP32
    )
endif()

# Apply feature flags
if(NOT ENABLE_DEBUG_OUTPUT)
    message(STATUS "Debug output disabled")
    target_compile_definitions(arduino_ast_interpreter PUBLIC ENABLE_DEBUG_OUTPUT=0)
else()
    target_compile_definitions(arduino_ast_interpreter PUBLIC ENABLE_DEBUG_OUTPUT=1)
endif()

if(NOT ENABLE_FILE_TRACING)
    message(STATUS "File tracing disabled")
    target_compile_definitions(arduino_ast_interpreter PUBLIC ENABLE_FILE_TRACING=0)
else()
    target_compile_definitions(arduino_ast_interpreter PUBLIC ENABLE_FILE_TRACING=1)
endif()

if(OPTIMIZE_SIZE)
    message(STATUS "Size optimization enabled")
    target_compile_definitions(arduino_ast_interpreter PUBLIC OPTIMIZE_SIZE=1)
else()
    target_compile_definitions(arduino_ast_interpreter PUBLIC OPTIMIZE_SIZE=0)
endif()

# =============================================================================
# EXECUTABLE TARGETS
# =============================================================================

if(BUILD_EXAMPLES)
    # Note: Example executables require C++ source files that may not exist
    # Commenting out until proper example files are created
    
    # # Basic interpreter example
    # add_executable(basic_interpreter_example
    #     examples/basic_interpreter.cpp
    # )
    # 
    # target_link_libraries(basic_interpreter_example
    #     PRIVATE arduino_ast_interpreter
    # )
    
    # # Minimal trace test
    # add_executable(test_minimal_trace
    #     src/cpp/test_minimal_trace.cpp
    # )
    # 
    # target_link_libraries(test_minimal_trace
    #     PRIVATE arduino_ast_interpreter
    # )
    
    # Compact AST demo (TODO: Create compact_ast_demo.cpp)
    # add_executable(compact_ast_demo
    #     examples/compact_ast_demo.cpp
    # )
    # 
    # target_link_libraries(compact_ast_demo
    #     PRIVATE arduino_ast_interpreter
    # )
endif()

# =============================================================================
# TEST TARGETS
# =============================================================================

if(BUILD_TESTS)
    enable_testing()

    # NOTE: Old unit test files removed - APIs changed, tests outdated
    # Removed: test_ast_nodes.cpp, test_compact_ast.cpp, test_command_protocol.cpp,
    #          test_cross_platform_validation.cpp, test_interpreter_integration.cpp
    # All moved to trash/ - we use extract_cpp_commands and validate_cross_platform instead

    # C++ command stream extraction tool
    add_executable(extract_cpp_commands
        tests/extract_cpp_commands.cpp
        tests/test_utils.hpp
    )
    
    target_link_libraries(extract_cpp_commands
        PRIVATE arduino_ast_interpreter
    )
    
    # Cross-platform validation tool - compares C++ and JavaScript command streams
    add_executable(validate_cross_platform
        tests/validate_cross_platform.cpp
        tests/test_utils.hpp
    )
    
    target_link_libraries(validate_cross_platform
        PRIVATE arduino_ast_interpreter
    )

    # Universal JSON to Arduino command stream converter
    add_executable(universal_json_to_arduino
        tests/universal_json_to_arduino.cpp
    )

    target_link_libraries(universal_json_to_arduino
        PRIVATE arduino_ast_interpreter
    )

    # Memory usage and performance tests
    if(ENABLE_PROFILING)
        add_executable(test_memory_performance
            tests/test_memory_performance.cpp
            tests/test_utils.hpp
        )
        
        target_link_libraries(test_memory_performance
            PRIVATE arduino_ast_interpreter
        )
        
        add_test(NAME MemoryPerformanceTest COMMAND test_memory_performance)
    endif()
endif()

# =============================================================================
# INSTALLATION
# =============================================================================

# Install library
install(TARGETS arduino_ast_interpreter
    EXPORT ArduinoASTInterpreterTargets
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
    INCLUDES DESTINATION include
)

# Install headers
install(FILES
    ASTNodes.hpp
    CompactAST.hpp
    ASTInterpreter.hpp
    ArduinoDataTypes.hpp
    EnhancedInterpreter.hpp
    ArduinoLibraryRegistry.hpp
    DESTINATION include/arduino_ast_interpreter
)

# Install CMake config files
install(EXPORT ArduinoASTInterpreterTargets
    FILE ArduinoASTInterpreterTargets.cmake
    NAMESPACE ArduinoASTInterpreter::
    DESTINATION lib/cmake/ArduinoASTInterpreter
)

# Create config file
include(CMakePackageConfigHelpers)
write_basic_package_version_file(
    ArduinoASTInterpreterConfigVersion.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY SameMajorVersion
)

configure_package_config_file(
    cmake/ArduinoASTInterpreterConfig.cmake.in
    ArduinoASTInterpreterConfig.cmake
    INSTALL_DESTINATION lib/cmake/ArduinoASTInterpreter
)

install(FILES
    "${CMAKE_CURRENT_BINARY_DIR}/ArduinoASTInterpreterConfig.cmake"
    "${CMAKE_CURRENT_BINARY_DIR}/ArduinoASTInterpreterConfigVersion.cmake"
    DESTINATION lib/cmake/ArduinoASTInterpreter
)

# =============================================================================
# ESP32-S3 MEMORY ANALYSIS
# =============================================================================

# Custom target for ESP32-S3 memory analysis (only if profiling enabled)
if(ENABLE_PROFILING)
    add_custom_target(esp32_memory_analysis
        COMMAND ${CMAKE_COMMAND} -E echo "Analyzing memory usage for ESP32-S3..."
        COMMAND $<TARGET_FILE:test_memory_performance> --esp32-analysis
        DEPENDS test_memory_performance
        COMMENT "Running ESP32-S3 memory constraint analysis"
    )
endif()

# NOTE: Removed cross_platform_validation custom target - test_cross_platform_validation.cpp deleted
# Use: ./build/validate_cross_platform 0 10 instead

# =============================================================================
# PACKAGE CONFIGURATION
# =============================================================================

# CPack configuration for distribution
include(CPack)
set(CPACK_PACKAGE_NAME "ArduinoASTInterpreter")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_DESCRIPTION_SUMMARY "${PROJECT_DESCRIPTION}")
set(CPACK_PACKAGE_VENDOR "Arduino AST Interpreter Project")
set(CPACK_RESOURCE_FILE_LICENSE "${CMAKE_CURRENT_SOURCE_DIR}/LICENSE")
set(CPACK_RESOURCE_FILE_README "${CMAKE_CURRENT_SOURCE_DIR}/README.md")

# Platform-specific package formats
if(WIN32)
    set(CPACK_GENERATOR "ZIP;NSIS")
elseif(APPLE)
    set(CPACK_GENERATOR "ZIP;DragNDrop")
else()
    set(CPACK_GENERATOR "TGZ;DEB;RPM")
endif()

# =============================================================================
# DEVELOPMENT UTILITIES
# =============================================================================

# Custom target for code formatting (if clang-format is available)
find_program(CLANG_FORMAT clang-format)
if(CLANG_FORMAT)
    file(GLOB_RECURSE SOURCE_FILES
        "*.cpp" "*.hpp" "*.c" "*.h"
        "tests/*.cpp" "tests/*.hpp"
        "examples/*.cpp" "examples/*.hpp"
    )
    
    add_custom_target(format
        COMMAND ${CLANG_FORMAT} -i ${SOURCE_FILES}
        COMMENT "Formatting source code with clang-format"
    )
endif()

# Custom target for static analysis (if cppcheck is available)
find_program(CPPCHECK cppcheck)
if(CPPCHECK)
    add_custom_target(static_analysis
        COMMAND ${CPPCHECK}
            --enable=all
            --std=c++17
            --verbose
            --quiet
            --error-exitcode=1
            ${CMAKE_CURRENT_SOURCE_DIR}
        COMMENT "Running static analysis with cppcheck"
    )
endif()

# =============================================================================
# SIZE OPTIMIZATION UTILITIES
# =============================================================================

# Custom target for stripping symbols (further size reduction)
find_program(STRIP_TOOL strip)
if(STRIP_TOOL)
    add_custom_target(strip_library
        COMMAND ${STRIP_TOOL} --strip-all ${CMAKE_CURRENT_BINARY_DIR}/libarduino_ast_interpreter.a
        DEPENDS arduino_ast_interpreter
        COMMENT "Stripping symbols from library for minimal size"
    )

    add_custom_target(strip_tools
        COMMAND ${STRIP_TOOL} --strip-all ${CMAKE_CURRENT_BINARY_DIR}/extract_cpp_commands
        COMMAND ${STRIP_TOOL} --strip-all ${CMAKE_CURRENT_BINARY_DIR}/validate_cross_platform
        DEPENDS extract_cpp_commands validate_cross_platform
        COMMENT "Stripping symbols from executable tools"
    )

    add_custom_target(strip_all
        DEPENDS strip_library strip_tools
        COMMENT "Strip all binaries for minimal deployment size"
    )
endif()

# Size reporting target
add_custom_target(size_report
    COMMAND ${CMAKE_COMMAND} -E echo "=== Size Report ==="
    COMMAND ls -lh ${CMAKE_CURRENT_BINARY_DIR}/libarduino_ast_interpreter.a
    COMMAND ls -lh ${CMAKE_CURRENT_BINARY_DIR}/extract_cpp_commands 2>/dev/null || true
    COMMAND ls -lh ${CMAKE_CURRENT_BINARY_DIR}/validate_cross_platform 2>/dev/null || true
    COMMENT "Reporting build artifact sizes"
)

# =============================================================================
# BUILD INFORMATION
# =============================================================================

# Print build configuration
message(STATUS "=== Arduino AST Interpreter Build Configuration ===")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "Compiler: ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "Build tests: ${BUILD_TESTS}")
message(STATUS "Build examples: ${BUILD_EXAMPLES}")
message(STATUS "Enable profiling: ${ENABLE_PROFILING}")
message(STATUS "Enable coverage: ${ENABLE_COVERAGE}")
message(STATUS "Target ESP32: ${TARGET_ESP32}")
message(STATUS "Use Arduino framework: ${USE_ARDUINO_FRAMEWORK}")
message(STATUS "Install prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "================================================")
message(STATUS "=== Cross-Platform Configuration ===")
message(STATUS "Platform: " ${PLATFORM_NAME})
message(STATUS "WASM build: ${BUILD_FOR_WASM}")
message(STATUS "ESP32 simulation: ${BUILD_FOR_ESP32}")
message(STATUS "Debug output: ${ENABLE_DEBUG_OUTPUT}")
message(STATUS "File tracing: ${ENABLE_FILE_TRACING}")
message(STATUS "Size optimization: ${OPTIMIZE_SIZE}")
message(STATUS "================================================")