#!/bin/bash
# build_wasm.sh - Build ASTInterpreter for WebAssembly using Emscripten
#
# This script compiles the C++ ASTInterpreter to WebAssembly for browser deployment.
# Requires Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html
#
# Usage:
#   ./build_wasm.sh                # RTTI mode (default)
#   AST_NO_RTTI=1 ./build_wasm.sh  # RTTI-free mode (size optimization)

set -e  # Exit on error

echo "🔧 Building ASTInterpreter for WebAssembly..."

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
# RTTI CONFIGURATION (v21.1.1)
# =============================================================================
# IMPORTANT DISTINCTION:
# - Compiler RTTI: Always enabled for WASM (embind requires it)
# - Code RTTI: User choice (dynamic_cast vs static_cast in our code)
#
# v21.1.1: All three platforms (Linux, WASM, ESP32) offer same choice:
#   - Default: RTTI mode (dynamic_cast, runtime type safety)
#   - Opt-in: RTTI-free mode (static_cast, size optimization)
#
# COMPILER: Emscripten always compiles with RTTI enabled (for embind)
# CODE: Our code can use RTTI (dynamic_cast) or RTTI-free (static_cast)
#
# The compiler having RTTI doesn't force our code to use it - we control
# this via the AST_NO_RTTI preprocessor flag.

# Determine RTTI mode from environment variable
RTTI_MODE="RTTI"
BUILD_FLAGS=""
CODE_BEHAVIOR="dynamic_cast (runtime type safety)"
SIZE_NOTE="Default size"

if [ "$AST_NO_RTTI" = "1" ]; then
    RTTI_MODE="RTTI-FREE"
    BUILD_FLAGS="-D AST_NO_RTTI"
    CODE_BEHAVIOR="static_cast (no runtime checks)"
    SIZE_NOTE="Size optimized"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  WASM Build: $RTTI_MODE Mode (Cross-Platform Parity)          ║"
echo "║  • Compiler: RTTI enabled (embind requirement)                ║"
echo "║  • Code: $CODE_BEHAVIOR                      ║"
echo "║  • $SIZE_NOTE with -O3 compression                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# BUILD DIRECTORY SETUP
# =============================================================================

BUILD_DIR="build/wasm"
mkdir -p "$BUILD_DIR"

echo "📁 Build directory: $BUILD_DIR"

# =============================================================================
# COMPILATION
# =============================================================================

echo "🏗️  Compiling C++ sources to WebAssembly..."

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
    -O3 \
    -D PLATFORM_WASM \
    -D __EMSCRIPTEN__ \
    -D ENABLE_DEBUG_OUTPUT=0 \
    -D ENABLE_FILE_TRACING=0 \
    $BUILD_FLAGS \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_createInterpreter","_startInterpreter","_getCommandStream","_freeString","_destroyInterpreter","_setAnalogValue","_setDigitalValue","_getInterpreterVersion","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","lengthBytesUTF8","stringToUTF8","getValue","setValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16MB \
    -s MAXIMUM_MEMORY=64MB \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createWasmModule' \
    -s ENVIRONMENT='web,worker,node' \
    -o "$BUILD_DIR/arduino_interpreter.js"

# =============================================================================
# BUILD RESULTS
# =============================================================================

echo ""
echo "✅ WASM build complete!"
echo ""
echo "📦 Build artifacts:"
ls -lh "$BUILD_DIR/arduino_interpreter.js" | awk '{print "  - " $9 ": " $5}'
ls -lh "$BUILD_DIR/arduino_interpreter.wasm" | awk '{print "  - " $9 ": " $5}'

# =============================================================================
# SIZE ANALYSIS (with gzip)
# =============================================================================

echo ""
echo "📊 Size analysis:"

# Gzip WASM for realistic transfer size
gzip -c "$BUILD_DIR/arduino_interpreter.wasm" > "$BUILD_DIR/arduino_interpreter.wasm.gz"
GZIP_SIZE=$(ls -lh "$BUILD_DIR/arduino_interpreter.wasm.gz" | awk '{print $5}')

echo "  - Gzipped WASM: $GZIP_SIZE"

# Cleanup gzip (keep original .wasm)
rm "$BUILD_DIR/arduino_interpreter.wasm.gz"

# =============================================================================
# USAGE INSTRUCTIONS
# =============================================================================

echo ""
echo "🚀 Usage:"
echo "  Browser: open playgrounds/wasm_interpreter_playground.html"
echo "  Node.js: node -e \"const {WasmASTInterpreter} = require('./src/javascript/WasmASTInterpreter.js'); ...\""
echo ""
echo "📚 See docs/WASM_DEPLOYMENT_GUIDE.md for complete deployment guide"
echo ""
