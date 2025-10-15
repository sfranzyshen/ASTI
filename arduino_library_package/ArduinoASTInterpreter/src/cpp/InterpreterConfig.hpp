#pragma once

#include <cstdint>

namespace arduino_interpreter {

/**
 * Configuration constants for Arduino AST Interpreter
 *
 * This file centralizes all configurable parameters to avoid hard-coded
 * values scattered throughout the codebase.
 */
namespace Config {

    // =============================================================================
    // EXECUTION LIMITS
    // =============================================================================

    /** Default maximum number of loop iterations to prevent infinite loops */
    constexpr uint32_t DEFAULT_MAX_LOOP_ITERATIONS = 1000;

    /** Test mode loop iterations (matching JavaScript test data) */
    constexpr uint32_t TEST_MAX_LOOP_ITERATIONS = 1;

    // =============================================================================
    // MEMORY LIMITS
    // =============================================================================

    /** Default memory limit: 8MB PSRAM + 512KB RAM (Arduino ESP32 configuration) */
    constexpr size_t DEFAULT_MEMORY_LIMIT = 8 * 1024 * 1024 + 512 * 1024;

    /** PSRAM size component */
    constexpr size_t PSRAM_SIZE = 8 * 1024 * 1024;

    /** RAM size component */
    constexpr size_t RAM_SIZE = 512 * 1024;

    // =============================================================================
    // TIMEOUT SETTINGS
    // =============================================================================

    /** Default timeout for operations (in milliseconds) */
    constexpr uint32_t DEFAULT_TIMEOUT_MS = 5000;

    /** Test timeout for quick operations (in milliseconds) */
    constexpr uint32_t TEST_TIMEOUT_MS = 1000;

    // =============================================================================
    // DEBUG AND LOGGING
    // =============================================================================

    /** Enable verbose output in debug builds */
    constexpr bool DEFAULT_VERBOSE = false;

    /** Enable debug output in debug builds */
    constexpr bool DEFAULT_DEBUG = false;

} // namespace Config
} // namespace arduino_interpreter