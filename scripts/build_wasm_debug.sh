#!/bin/bash
# build_wasm_debug.sh - Build ASTInterpreter for WebAssembly with DEBUG symbols
#
# This script compiles with maximum debugging information to identify runtime errors
# Requires Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html
#
# Usage:
#   ./build_wasm_debug.sh

set -e  # Exit on error

echo "🔧 Building ASTInterpreter for WebAssembly (DEBUG MODE)..."

# =============================================================================
# PREREQUISITES CHECK
# =============================================================================

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "❌ Error: Emscripten not found"
    echo ""
    echo "Please install Emscripten SDK:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    echo ""
    exit 1
fi

echo "✅ Emscripten found: $(emcc --version | head -n 1)"

# =============================================================================
# DEBUG BUILD CONFIGURATION
# =============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  WASM DEBUG Build (Enhanced Error Messages)                   ║"
echo "║  • Optimization: -O1 (easier debugging)                       ║"
echo "║  • Debug symbols: -g3 (full source mapping)                   ║"
echo "║  • Assertions: LEVEL 2 (detailed error messages)              ║"
echo "║  • Memory safety: SAFE_HEAP + STACK_OVERFLOW_CHECK            ║"
echo "║  • Bulk copy: writeArrayToMemory exported                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# BUILD DIRECTORY SETUP
# =============================================================================

BUILD_DIR="build_wasm"
mkdir -p "$BUILD_DIR"

echo "📁 Build directory: $BUILD_DIR"
echo "   Output: arduino_interpreter_debug.js"

# =============================================================================
# COMPILATION WITH DEBUG FLAGS
# =============================================================================

echo ""
echo "🏗️  Compiling C++ sources to WebAssembly with debug symbols..."

emcc \
    src/cpp/ASTInterpreter.cpp \
    src/cpp/ASTNodes.cpp \
    src/cpp/ArduinoDataTypes.cpp \
    src/cpp/ArduinoLibraryRegistry.cpp \
    src/cpp/EnhancedInterpreter.cpp \
    src/cpp/ExecutionTracer.cpp \
    src/cpp/wasm_bridge.cpp \
    libs/CompactAST/src/CompactAST.cpp \
    -I src/cpp \
    -I libs/CompactAST/src \
    -std=c++17 \
    -O1 \
    -g3 \
    -D PLATFORM_WASM \
    -D __EMSCRIPTEN__ \
    -D ENABLE_DEBUG_OUTPUT=0 \
    -D ENABLE_FILE_TRACING=0 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_createInterpreter","_startInterpreter","_getCommandStream","_freeString","_destroyInterpreter","_setAnalogValue","_setDigitalValue","_getInterpreterVersion","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","lengthBytesUTF8","stringToUTF8","getValue","setValue","writeArrayToMemory"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16MB \
    -s MAXIMUM_MEMORY=256MB \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createWasmModule' \
    -s ENVIRONMENT='web,worker,node' \
    -s ASSERTIONS=2 \
    -s SAFE_HEAP=1 \
    -s STACK_OVERFLOW_CHECK=2 \
    -o "$BUILD_DIR/arduino_interpreter_debug.js"

# =============================================================================
# BUILD RESULTS
# =============================================================================

echo ""
echo "✅ WASM DEBUG build complete!"
echo ""
echo "📦 Build artifacts:"
ls -lh "$BUILD_DIR/arduino_interpreter_debug.js" | awk '{print "  - " $9 ": " $5}'
ls -lh "$BUILD_DIR/arduino_interpreter_debug.wasm" | awk '{print "  - " $9 ": " $5}'

# =============================================================================
# SIZE COMPARISON
# =============================================================================

echo ""
echo "📊 Size comparison:"

if [ -f "$BUILD_DIR/arduino_interpreter.wasm" ]; then
    PROD_SIZE=$(ls -lh "$BUILD_DIR/arduino_interpreter.wasm" | awk '{print $5}')
    DEBUG_SIZE=$(ls -lh "$BUILD_DIR/arduino_interpreter_debug.wasm" | awk '{print $5}')
    echo "  - Production: $PROD_SIZE"
    echo "  - Debug:      $DEBUG_SIZE"
else
    DEBUG_SIZE=$(ls -lh "$BUILD_DIR/arduino_interpreter_debug.wasm" | awk '{print $5}')
    echo "  - Debug: $DEBUG_SIZE"
fi

# =============================================================================
# USAGE INSTRUCTIONS
# =============================================================================

echo ""
echo "🚀 Usage:"
echo "  1. Update playground HTML to load arduino_interpreter_debug.js"
echo "  2. Hard refresh browser (Ctrl+Shift+R)"
echo "  3. Open console to see detailed error messages"
echo ""
echo "📝 Debug features enabled:"
echo "  - ASSERTIONS=2: Detailed assertion failures with source locations"
echo "  - SAFE_HEAP=1: Detects out-of-bounds memory access"
echo "  - STACK_OVERFLOW_CHECK=2: Catches stack corruption"
echo "  - -g3: Full debug symbols for stack traces"
echo "  - writeArrayToMemory: Bulk memory copy available"
echo "  - Note: DEMANGLE_SUPPORT removed (deprecated in Emscripten 4.x)"
echo ""
echo "⚠️  Note: This is a DEBUG build - larger size and slower execution"
echo "    Use for troubleshooting only, not production!"
echo ""
