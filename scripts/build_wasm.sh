#!/bin/bash
# build_wasm.sh - Build ASTInterpreter for WebAssembly using Emscripten
#
# This script compiles the C++ ASTInterpreter to WebAssembly for browser deployment.
# Requires Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html
#
# Usage: ./build_wasm.sh

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
# RTTI CONFIGURATION (v21.1.0)
# =============================================================================
# WASM REQUIREMENT: Emscripten's embind binding system REQUIRES RTTI
# RTTI-free mode (-fno-rtti) is NOT SUPPORTED for WASM builds
#
# v21.1.0: RTTI is the universal default for ALL platforms (Linux, WASM, ESP32)
# WASM enforces this requirement - cannot be disabled even if requested
#
# Reason: embind uses RTTI for type information in JavaScript bindings
# This is documented in Emscripten's official documentation
#
# RTTI-free mode (explicit opt-in) is available for:
#  - Linux/native builds (cmake -DAST_NO_RTTI=ON)
#  - ESP32 builds (copy build_opt_no_rtti.h.example or use PlatformIO esp32-s3-no-rtti)

# Check if user tried to disable RTTI (not supported for WASM)
if [ "$AST_NO_RTTI" = "1" ]; then
    echo ""
    echo "❌ ERROR: RTTI-free mode is NOT SUPPORTED for WASM builds"
    echo ""
    echo "Emscripten's embind binding system requires RTTI for JavaScript interop."
    echo "RTTI cannot be disabled when using emscripten::val and embind features."
    echo ""
    echo "RTTI-free mode is only available for:"
    echo "  • Native/Linux builds: cmake -DAST_NO_RTTI=ON .."
    echo "  • ESP32 builds: Use build_opt.h or PlatformIO esp32-s3-no-rtti"
    echo ""
    echo "WASM builds always use RTTI (this is acceptable as browsers have ample memory)."
    echo ""
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  WASM Build: RTTI ENABLED (Required - Universal Default)      ║"
echo "║  • Uses dynamic_cast (runtime type verification)              ║"
echo "║  • RTTI required by Emscripten embind (cannot be disabled)    ║"
echo "║  • Consistent with v21.1.0 universal RTTI default             ║"
echo "║  • Size optimized with -O3 (gzip: 487KB → ~158KB)             ║"
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
