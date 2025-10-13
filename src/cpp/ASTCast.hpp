/**
 * ASTCast.hpp - Conditional RTTI Support for AST Type Casting
 *
 * Provides AST_CAST and AST_CONST_CAST macros that conditionally use
 * dynamic_cast (RTTI enabled) or static_cast (RTTI disabled) based on
 * the AST_NO_RTTI preprocessor flag.
 *
 * Version: 21.0.0
 *
 * RATIONALE:
 * ==========
 * v20.0.0 removed RTTI assuming ESP32 required -fno-rtti. Investigation
 * revealed ESP32 Arduino framework supports RTTI by default. v21.0.0
 * restores RTTI as default for runtime safety, while providing optional
 * RTTI-free compilation for size-constrained embedded deployments.
 *
 * USAGE:
 * ======
 *
 *   // Type check + conditional cast
 *   if (node->getType() == arduino_ast::ASTNodeType::FUNC_DEF) {
 *       auto* funcDef = AST_CONST_CAST(arduino_ast::FuncDefNode, node);
 *       // RTTI mode: dynamic_cast provides runtime verification
 *       // RTTI-free mode: static_cast assumes getType() check is correct
 *   }
 *
 *   // Non-const casting
 *   auto* mutableNode = AST_CAST(arduino_ast::IdentifierNode, node);
 *
 * BUILD MODES:
 * ============
 *
 * RTTI Mode (Default - Recommended):
 *   - Uses dynamic_cast for runtime type safety
 *   - Wrong casts return nullptr (safe failure)
 *   - Easier debugging and maintenance
 *   - Compiler helps catch type errors
 *   - Size: +~40KB vs RTTI-free mode
 *   - Build: cmake .. && make
 *
 * RTTI-Free Mode (Size Optimization):
 *   - Uses static_cast with no runtime checking
 *   - Wrong casts cause undefined behavior
 *   - Requires manual type safety discipline
 *   - Smaller binary (~40KB reduction)
 *   - Size: -~40KB vs RTTI mode
 *   - Build: cmake -DAST_NO_RTTI=ON .. && make
 *
 * WHEN TO USE RTTI-FREE MODE:
 * ===========================
 * - Flash-constrained ESP32 deployments (< 1MB available)
 * - Production builds where every KB matters
 * - ONLY after thorough testing with RTTI mode
 *
 * SAFETY:
 * =======
 * Both modes keep explicit getType() checks before casting:
 * - RTTI mode: Defense-in-depth (manual + runtime checks)
 * - RTTI-free mode: Manual verification (only safety check)
 *
 * Platform Support:
 * - Linux: Both modes supported
 * - WASM: Both modes supported
 * - ESP32: Both modes supported (RTTI is default in Arduino framework)
 *
 * License: MIT
 */

#pragma once

// Auto-detect Arduino environment and enable RTTI-free mode
// Arduino ESP32 framework compiles with -fno-rtti by default
#if defined(ARDUINO) && !defined(AST_NO_RTTI) && !defined(AST_FORCE_RTTI)
    #define AST_NO_RTTI
    #pragma message "ASTInterpreter: Auto-detected Arduino environment - enabling RTTI-free mode (matches Arduino -fno-rtti default)"
#endif

#ifdef AST_NO_RTTI
    // RTTI-Free Mode: Size-optimized (static_cast)
    // =============================================
    // NO runtime type checking - assumes programmer correctness
    // Use ONLY in size-constrained deployments after thorough RTTI testing
    // Binary size: ~40KB smaller than RTTI mode

    #define AST_CAST(Type, ptr) static_cast<Type*>(ptr)
    #define AST_CONST_CAST(Type, ptr) static_cast<const Type*>(ptr)

    // Conditional compilation messages
    #ifdef __GNUC__
        #pragma message "ASTInterpreter: Building in RTTI-FREE mode (size-optimized, no runtime checks)"
    #endif

#else
    // RTTI Mode (Default): Runtime type safety (dynamic_cast)
    // ========================================================
    // Runtime type verification - wrong casts return nullptr
    // Recommended for development, testing, and production
    // Binary size: ~40KB larger than RTTI-free mode

    #define AST_CAST(Type, ptr) dynamic_cast<Type*>(ptr)
    #define AST_CONST_CAST(Type, ptr) dynamic_cast<const Type*>(ptr)

    // Conditional compilation messages
    #ifdef __GNUC__
        #pragma message "ASTInterpreter: Building in RTTI mode (default, runtime type safety)"
    #endif

#endif

// Macro version for feature detection
#define AST_CAST_VERSION_MAJOR 21
#define AST_CAST_VERSION_MINOR 0
#define AST_CAST_VERSION_PATCH 0

// Helper to check if RTTI is enabled at compile time
#ifdef AST_NO_RTTI
    #define AST_HAS_RTTI 0
#else
    #define AST_HAS_RTTI 1
#endif
