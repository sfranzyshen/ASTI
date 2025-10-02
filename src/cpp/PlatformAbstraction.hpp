/**
 * PlatformAbstraction.hpp - Cross-platform compatibility layer
 *
 * Provides unified interface for platform-specific functionality across:
 * - Linux (host development, testing, validation)
 * - WebAssembly/Emscripten (browser deployment)
 * - ESP32-S3/Arduino (embedded hardware deployment)
 *
 * Version: 1.0.0
 * Compatible with: ASTInterpreter v16.0.0
 */

#pragma once

#include <string>

// =============================================================================
// PLATFORM DETECTION
// =============================================================================

// Detect platform at compile time
// Priority order: ARDUINO > EMSCRIPTEN > Default (Linux/Windows/Mac)

#if defined(ARDUINO_ARCH_ESP32) || defined(ESP32) || defined(ESP_PLATFORM)
    #define PLATFORM_ESP32
    #define PLATFORM_NAME "ESP32-S3"

#elif defined(__EMSCRIPTEN__)
    #define PLATFORM_WASM
    #define PLATFORM_NAME "WebAssembly"

#else
    #define PLATFORM_LINUX
    #define PLATFORM_NAME "Linux/Desktop"
#endif

// Feature detection based on platform
#ifdef PLATFORM_ESP32
    #define HAS_SERIAL 1
    #define HAS_FILESYSTEM 1  // SPIFFS/LittleFS
    #define HAS_IOSTREAM 0
    #define HAS_FSTREAM 0
    #define HAS_SSTREAM 1     // ESP32 Arduino has sstream
#elif defined(PLATFORM_WASM)
    #define HAS_SERIAL 0
    #define HAS_FILESYSTEM 0
    #define HAS_IOSTREAM 0
    #define HAS_FSTREAM 0
    #define HAS_SSTREAM 0     // Avoid sstream bloat in WASM
#else
    #define HAS_SERIAL 0
    #define HAS_FILESYSTEM 1
    #define HAS_IOSTREAM 1
    #define HAS_FSTREAM 1
    #define HAS_SSTREAM 1
#endif

// =============================================================================
// PLATFORM-SPECIFIC INCLUDES
// =============================================================================

#ifdef PLATFORM_ESP32
    // Arduino/ESP32 headers
    #include <Arduino.h>
    #if HAS_FILESYSTEM
        #include <FS.h>
        #include <SPIFFS.h>
    #endif
#endif

#ifdef PLATFORM_WASM
    // Emscripten headers
    #include <emscripten.h>
    #include <emscripten/bind.h>
#endif

#if defined(PLATFORM_LINUX)
    // Standard C++ headers (available on desktop)
    #if HAS_IOSTREAM
        #include <iostream>
    #endif
    #if HAS_FSTREAM
        #include <fstream>
    #endif
    #if HAS_SSTREAM
        #include <sstream>
    #endif
#endif

// =============================================================================
// DEBUG OUTPUT ABSTRACTION
// =============================================================================

// Conditional debug output based on ENABLE_DEBUG_OUTPUT flag
#ifndef ENABLE_DEBUG_OUTPUT
    #define ENABLE_DEBUG_OUTPUT 1  // Enabled by default
#endif

#if ENABLE_DEBUG_OUTPUT

    #ifdef PLATFORM_ESP32
        // ESP32: Use Serial for debug output
        #define DEBUG_PRINT(x) Serial.print(x)
        #define DEBUG_PRINTLN(x) Serial.println(x)
        #define DEBUG_PRINTF(fmt, ...) Serial.printf(fmt, ##__VA_ARGS__)

        // For compatibility with existing << operator patterns
        class SerialStreamProxy {
        public:
            template<typename T>
            SerialStreamProxy& operator<<(const T& value) {
                Serial.print(value);
                return *this;
            }

            SerialStreamProxy& operator<<(std::ostream& (*)(std::ostream&)) {
                Serial.println();
                return *this;
            }
        };
        #define DEBUG_STREAM (SerialStreamProxy())

    #elif defined(PLATFORM_WASM)
        // WASM: Use emscripten console output or disable
        #define DEBUG_PRINT(x) // No-op (or use EM_ASM)
        #define DEBUG_PRINTLN(x) // No-op
        #define DEBUG_PRINTF(fmt, ...) // No-op

        class NullStreamProxy {
        public:
            template<typename T>
            NullStreamProxy& operator<<(const T&) { return *this; }
            NullStreamProxy& operator<<(std::ostream& (*)(std::ostream&)) { return *this; }
        };
        #define DEBUG_STREAM (NullStreamProxy())

    #else
        // Linux: Use standard cout/cerr
        #define DEBUG_PRINT(x) std::cout << x
        #define DEBUG_PRINTLN(x) std::cout << x << std::endl
        #define DEBUG_PRINTF(fmt, ...) std::printf(fmt, ##__VA_ARGS__)
        #define DEBUG_STREAM std::cout
    #endif

#else
    // Debug output completely disabled
    #define DEBUG_PRINT(x)
    #define DEBUG_PRINTLN(x)
    #define DEBUG_PRINTF(fmt, ...)

    class NullStreamProxy {
    public:
        template<typename T>
        NullStreamProxy& operator<<(const T&) { return *this; }
        NullStreamProxy& operator<<(std::ostream& (*)(std::ostream&)) { return *this; }
    };
    #define DEBUG_STREAM (NullStreamProxy())
#endif

// Error output (always enabled)
#ifdef PLATFORM_ESP32
    #define ERROR_PRINTLN(x) Serial.println(x)
#elif defined(PLATFORM_WASM)
    #define ERROR_PRINTLN(x) // Could use EM_ASM to throw JS error
#else
    #define ERROR_PRINTLN(x) std::cerr << x << std::endl
#endif

// =============================================================================
// COMMAND OUTPUT ABSTRACTION (always enabled, for emitJSON)
// =============================================================================

#ifdef PLATFORM_ESP32
    #define OUTPUT_STREAM Serial
#elif defined(PLATFORM_WASM)
    // WASM: Output to JavaScript callback or memory buffer
    // External callback function provided by WASM integration layer
    extern void jsOutputCallback(const char*);

    class WASMOutputStream {
    public:
        template<typename T>
        WASMOutputStream& operator<<(const T& value) {
            // For now, stub - will be implemented in WASM integration
            return *this;
        }
        WASMOutputStream& operator<<(std::ostream& (*)(std::ostream&)) {
            return *this; // Handle std::endl
        }
    };
    #define OUTPUT_STREAM (WASMOutputStream())
#else // PLATFORM_LINUX
    #define OUTPUT_STREAM std::cout
#endif

// =============================================================================
// STRING BUILDING ABSTRACTION
// =============================================================================

// Controls whether to use ostringstream (fast, larger) or manual (slower, smaller)
#ifndef OPTIMIZE_SIZE
    #define OPTIMIZE_SIZE 0  // Default: use sstream where available
#endif

#if HAS_SSTREAM
    // Use ostringstream for efficient string building
    // Note: Even with OPTIMIZE_SIZE=ON, we still use sstream if available
    // because the manual approach can't handle iomanip manipulators properly
    #include <sstream>

    #define STRING_BUILD_START(name) std::ostringstream name
    #define STRING_BUILD_APPEND(name, val) name << val
    #define STRING_BUILD_FINISH(name) name.str()

    // Type alias for consistency
    using StringBuildStream = std::ostringstream;

#else
    // Manual string building (smaller code size, no sstream dependency)
    #define STRING_BUILD_START(name) std::string name
    #define STRING_BUILD_APPEND(name, val) name += ::platform_helpers::toString(val)
    #define STRING_BUILD_FINISH(name) name

    // Helper functions for converting types to strings
    namespace platform_helpers {
        inline std::string toString(const std::string& s) { return s; }
        inline std::string toString(const char* s) { return std::string(s); }
        inline std::string toString(int32_t v) { return std::to_string(v); }
        inline std::string toString(uint32_t v) { return std::to_string(v); }
        inline std::string toString(int64_t v) { return std::to_string(v); }
        inline std::string toString(uint64_t v) { return std::to_string(v); }
        inline std::string toString(double v) { return std::to_string(v); }
        inline std::string toString(float v) { return std::to_string(v); }
        inline std::string toString(bool v) { return v ? "true" : "false"; }
    }

    // Forward declare for iomanip support
    #include <iosfwd>

    // Stream-compatible class for code that uses << operator
    class StringBuildStream {
        std::string data_;
        int precision_ = 6;  // Default precision for floating-point
        bool useFixed_ = false;
    public:
        template<typename T>
        StringBuildStream& operator<<(const T& val) {
            // Special handling for floating-point with precision
            if constexpr (std::is_same_v<T, double> || std::is_same_v<T, float>) {
                if (useFixed_) {
                    // Format with specified precision using snprintf
                    char buffer[64];
                    snprintf(buffer, sizeof(buffer), "%.*f", precision_, static_cast<double>(val));
                    data_ += buffer;
                    return *this;
                }
            }
            data_ += platform_helpers::toString(val);
            return *this;
        }

        // Support for std::endl and other stream manipulators
        StringBuildStream& operator<<(std::ostream& (*manip)(std::ostream&)) {
            // Handle common manipulators
            if (manip == static_cast<std::ostream& (*)(std::ostream&)>(std::endl)) {
                data_ += '\n';
            }
            // Other manipulators (std::flush, etc.) are no-ops for string building
            return *this;
        }

        // Support for std::ios_base manipulators (std::fixed, std::scientific)
        StringBuildStream& operator<<(std::ios_base& (*manip)(std::ios_base&)) {
            // Track fixed-point mode
            useFixed_ = true;  // Assume std::fixed (most common case)
            return *this;
        }

        // Support for std::setprecision - platform-specific type
        template<typename Manip>
        auto operator<<(const Manip& manip) -> typename std::enable_if<
            std::is_same<Manip, decltype(std::setprecision(0))>::value,
            StringBuildStream&
        >::type {
            // Unfortunately we can't extract the precision value from the manipulator
            // in a portable way. This is a limitation of the manual string building approach.
            // For now, we'll just ignore it and use the default precision.
            return *this;
        }

        // Alternative: provide setPrecision method for manual control
        void setPrecision(int prec) {
            precision_ = prec;
        }

        std::string str() const { return data_; }
    };
#endif

// =============================================================================
// FILE I/O ABSTRACTION
// =============================================================================

// Feature flag for file write support
#ifndef ENABLE_FILE_TRACING
    #define ENABLE_FILE_TRACING 1  // Enabled by default
#endif

#if ENABLE_FILE_TRACING

    #ifdef PLATFORM_ESP32
        // ESP32: Use SPIFFS/LittleFS filesystem
        class PlatformFile {
        private:
            File file_;
            bool isOpen_;
        public:
            PlatformFile() : isOpen_(false) {}

            bool open(const char* path, const char* mode = "w") {
                file_ = SPIFFS.open(path, mode);
                isOpen_ = (bool)file_;
                return isOpen_;
            }

            void write(const std::string& data) {
                if (isOpen_) {
                    file_.print(data.c_str());
                }
            }

            void write(const char* data) {
                if (isOpen_) {
                    file_.print(data);
                }
            }

            void close() {
                if (isOpen_) {
                    file_.close();
                    isOpen_ = false;
                }
            }

            bool isOpen() const { return isOpen_; }

            ~PlatformFile() {
                close();
            }
        };

    #elif defined(PLATFORM_WASM)
        // WASM: Stub implementation (could use Emscripten FS API)
        class PlatformFile {
        public:
            bool open(const char*, const char* = "w") { return false; }
            void write(const std::string&) {}
            void write(const char*) {}
            void close() {}
            bool isOpen() const { return false; }
        };

    #else
        // Linux: Use standard fstream
        #include <fstream>
        class PlatformFile {
        private:
            std::ofstream file_;
        public:
            bool open(const char* path, const char* mode = "w") {
                file_.open(path);
                return file_.is_open();
            }

            void write(const std::string& data) {
                file_ << data;
            }

            void write(const char* data) {
                file_ << data;
            }

            void close() {
                if (file_.is_open()) {
                    file_.close();
                }
            }

            bool isOpen() const { return file_.is_open(); }

            ~PlatformFile() {
                close();
            }
        };
    #endif

#else
    // File tracing disabled - stub implementation
    class PlatformFile {
    public:
        bool open(const char*, const char* = "w") { return false; }
        void write(const std::string&) {}
        void write(const char*) {}
        void close() {}
        bool isOpen() const { return false; }
    };
#endif

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
EXAMPLE 1: Debug output replacement

// BEFORE:
std::cout << "Debug message: " << value << std::endl;

// AFTER:
DEBUG_STREAM << "Debug message: " << value << std::endl;


EXAMPLE 2: String building

// BEFORE:
std::ostringstream json;
json << "{\"value\":" << num << "}";
std::string result = json.str();

// AFTER:
STRING_BUILD_START(json);
STRING_BUILD_APPEND(json, "{\"value\":");
STRING_BUILD_APPEND(json, num);
STRING_BUILD_APPEND(json, "}");
std::string result = STRING_BUILD_FINISH(json);


EXAMPLE 3: File output

// BEFORE:
std::ofstream f("output.txt");
f << "data";
f.close();

// AFTER:
PlatformFile f;
f.open("output.txt");
f.write("data");
f.close();


PLATFORM BUILD FLAGS:

Linux (default):
  cmake .. && make

ESP32 simulation:
  cmake .. -D BUILD_FOR_ESP32=ON && make

WASM:
  emcmake cmake .. -D BUILD_FOR_WASM=ON && emmake make

Size optimization:
  cmake .. -D OPTIMIZE_SIZE=ON && make

Disable debug output:
  cmake .. -D ENABLE_DEBUG_OUTPUT=OFF && make
*/
