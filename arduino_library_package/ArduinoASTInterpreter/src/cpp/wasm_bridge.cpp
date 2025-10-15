/**
 * wasm_bridge.cpp - WebAssembly C Bridge for ASTInterpreter
 *
 * Provides C-style interface functions for Emscripten to export to JavaScript.
 * Enables the C++ ASTInterpreter to run in web browsers via WebAssembly.
 *
 * Version: 21.2.1
 * Platform: WebAssembly/Emscripten
 */

#ifdef __EMSCRIPTEN__

#include <emscripten/emscripten.h>
#include "ASTInterpreter.hpp"
#include "CompactAST.hpp"
#include "SyncDataProvider.hpp"
#include <sstream>
#include <string>
#include <cstring>

using namespace arduino_interpreter;
using namespace arduino_ast;

// =============================================================================
// GLOBAL COMMAND STREAM POINTER (For WASM Output Capture)
// =============================================================================

/**
 * Global stream pointer for WASM command output capture
 *
 * This pointer is set before interpreter execution and cleared after.
 * WASMOutputStream (in PlatformAbstraction.hpp) writes to this stream.
 * After execution, getCommandStream() reads the accumulated output.
 */
std::stringstream* g_wasmCommandStream = nullptr;

// =============================================================================
// WASM DATA PROVIDER (For Testing)
// =============================================================================

/**
 * Simple synchronous data provider for WASM environment
 * Stores mock values that can be set from JavaScript
 */
class WasmDataProvider : public SyncDataProvider {
private:
    std::unordered_map<int32_t, int32_t> analogValues_;
    std::unordered_map<int32_t, int32_t> digitalValues_;
    uint32_t millisValue_ = 0;
    uint32_t microsValue_ = 0;

public:
    int32_t getAnalogReadValue(int32_t pin) override {
        auto it = analogValues_.find(pin);
        return (it != analogValues_.end()) ? it->second : 0;
    }

    int32_t getDigitalReadValue(int32_t pin) override {
        auto it = digitalValues_.find(pin);
        return (it != digitalValues_.end()) ? it->second : 0;
    }

    uint32_t getMillisValue() override {
        return millisValue_++;
    }

    uint32_t getMicrosValue() override {
        return microsValue_++;
    }

    uint32_t getPulseInValue(int32_t pin, int32_t state, uint32_t timeout) override {
        return 1000; // Mock pulse duration
    }

    int32_t getLibrarySensorValue(const std::string& libraryName,
                                  const std::string& methodName,
                                  int32_t arg = 0) override {
        return 100; // Mock library sensor value
    }

    void setAnalogValue(int32_t pin, int32_t value) {
        analogValues_[pin] = value;
    }

    void setDigitalValue(int32_t pin, int32_t value) {
        digitalValues_[pin] = value;
    }
};

// =============================================================================
// INTERPRETER CONTEXT
// =============================================================================

/**
 * Wraps interpreter and associated resources for WASM lifecycle management
 */
struct InterpreterContext {
    ASTInterpreter* interpreter;
    WasmDataProvider* dataProvider;
    std::stringstream commandStream;

    InterpreterContext(ASTInterpreter* interp, WasmDataProvider* provider)
        : interpreter(interp), dataProvider(provider) {}

    ~InterpreterContext() {
        delete interpreter;
        delete dataProvider;
    }
};

// =============================================================================
// C BRIDGE FUNCTIONS
// =============================================================================

extern "C" {

/**
 * Create interpreter from CompactAST binary
 *
 * @param astData Pointer to CompactAST binary data
 * @param astSize Size of CompactAST binary in bytes
 * @param verbose Enable verbose debug output
 * @return Opaque pointer to InterpreterContext (or nullptr on failure)
 */
EMSCRIPTEN_KEEPALIVE
void* createInterpreter(const uint8_t* astData, size_t astSize, bool verbose) {
    try {
        // Create interpreter options
        InterpreterOptions opts;
        opts.verbose = verbose;
        opts.debug = verbose;
        opts.syncMode = true;  // WASM uses synchronous mode
        opts.maxLoopIterations = 3;  // Match JavaScript playground (prevent excessive output)

        // Create interpreter from CompactAST binary
        ASTInterpreter* interpreter = new ASTInterpreter(astData, astSize, opts);

        // Create data provider
        WasmDataProvider* dataProvider = new WasmDataProvider();
        interpreter->setSyncDataProvider(dataProvider);

        // Create context
        InterpreterContext* ctx = new InterpreterContext(interpreter, dataProvider);

        return static_cast<void*>(ctx);

    } catch (const std::exception& e) {
        // Error handling
        return nullptr;
    }
}

/**
 * Start interpreter execution
 *
 * @param interpreterPtr Opaque pointer to InterpreterContext
 * @return true if execution started successfully, false otherwise
 */
EMSCRIPTEN_KEEPALIVE
bool startInterpreter(void* interpreterPtr) {
    if (!interpreterPtr) return false;

    try {
        InterpreterContext* ctx = static_cast<InterpreterContext*>(interpreterPtr);

        // Set global stream pointer for WASM command output capture
        // WASMOutputStream will write to this stream during execution
        g_wasmCommandStream = &ctx->commandStream;

        // Execute interpreter (commands written to global stream via OUTPUT_STREAM)
        bool result = ctx->interpreter->start();

        // Clear global pointer after execution (safety)
        g_wasmCommandStream = nullptr;

        return result;

    } catch (const std::exception& e) {
        // Ensure global pointer is cleared even on exception
        g_wasmCommandStream = nullptr;
        return false;
    }
}

/**
 * Get JSON command stream from interpreter
 *
 * NOTE: Caller must free the returned string using freeString()
 *
 * @param interpreterPtr Opaque pointer to InterpreterContext
 * @return JSON string of command stream (or empty string on failure)
 */
EMSCRIPTEN_KEEPALIVE
const char* getCommandStream(void* interpreterPtr) {
    if (!interpreterPtr) return strdup("[]");

    try {
        InterpreterContext* ctx = static_cast<InterpreterContext*>(interpreterPtr);

        // Get JSON from captured stream
        std::string jsonOutput = ctx->commandStream.str();

        // Duplicate string for JavaScript (caller must free)
        return strdup(jsonOutput.c_str());

    } catch (const std::exception& e) {
        return strdup("[]");
    }
}

/**
 * Free string allocated by C++ (for getCommandStream return value)
 *
 * @param str String to free
 */
EMSCRIPTEN_KEEPALIVE
void freeString(char* str) {
    if (str) {
        free(str);
    }
}

/**
 * Set analog value for testing
 *
 * @param interpreterPtr Opaque pointer to InterpreterContext
 * @param pin Analog pin number
 * @param value Analog value (0-1023)
 */
EMSCRIPTEN_KEEPALIVE
void setAnalogValue(void* interpreterPtr, int pin, int value) {
    if (!interpreterPtr) return;

    InterpreterContext* ctx = static_cast<InterpreterContext*>(interpreterPtr);
    ctx->dataProvider->setAnalogValue(pin, value);
}

/**
 * Set digital value for testing
 *
 * @param interpreterPtr Opaque pointer to InterpreterContext
 * @param pin Digital pin number
 * @param value Digital value (0 or 1)
 */
EMSCRIPTEN_KEEPALIVE
void setDigitalValue(void* interpreterPtr, int pin, int value) {
    if (!interpreterPtr) return;

    InterpreterContext* ctx = static_cast<InterpreterContext*>(interpreterPtr);
    ctx->dataProvider->setDigitalValue(pin, value);
}

/**
 * Destroy interpreter and free all resources
 *
 * @param interpreterPtr Opaque pointer to InterpreterContext
 */
EMSCRIPTEN_KEEPALIVE
void destroyInterpreter(void* interpreterPtr) {
    if (!interpreterPtr) return;

    InterpreterContext* ctx = static_cast<InterpreterContext*>(interpreterPtr);
    delete ctx;
}

/**
 * Get interpreter version
 *
 * @return Version string
 */
EMSCRIPTEN_KEEPALIVE
const char* getInterpreterVersion() {
    return "21.2.1";
}

} // extern "C"

#endif // __EMSCRIPTEN__
