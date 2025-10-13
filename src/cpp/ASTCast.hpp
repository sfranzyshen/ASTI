/**
 * ASTCast.hpp - Conditional RTTI Support for AST Type Casting
 *
 * Provides AST_CAST and AST_CONST_CAST macros that conditionally use
 * dynamic_cast (RTTI enabled) or static_cast (RTTI disabled) based on
 * the AST_NO_RTTI preprocessor flag.
 *
 * Version: 21.1.0
 *
 * PHILOSOPHY: RTTI ENABLED BY DEFAULT (ALL PLATFORMS)
 * ===================================================
 * v21.1.0 establishes RTTI (dynamic_cast) as the universal default for
 * all platforms, providing runtime type safety during development, testing,
 * and production. RTTI-free mode (static_cast) is explicitly opt-in for
 * size-constrained embedded deployments.
 *
 * DEFAULT BEHAVIOR (NO FLAGS):
 * ============================
 * • Uses dynamic_cast (runtime type verification)
 * • Wrong casts return nullptr (safe failure)
 * • Easier debugging and maintenance
 * • ~40KB larger than RTTI-free mode
 *
 * PLATFORM-SPECIFIC BUILD REQUIREMENTS:
 * =====================================
 *
 * Linux/Native:
 * -------------
 * ✅ RTTI Mode (default): cmake .. && make
 *    No flags needed - RTTI enabled by default
 *
 * ⚙️ RTTI-Free Mode (opt-in): cmake -DAST_NO_RTTI=ON .. && make
 *    Explicit size optimization
 *
 * WASM:
 * -----
 * ✅ RTTI Mode (required): ./scripts/build_wasm.sh
 *    Emscripten embind requires RTTI - cannot be disabled
 *
 * ESP32/Arduino:
 * --------------
 * ⚠️ IMPORTANT: Arduino ESP32 uses -fno-rtti by default
 *    You MUST add -frtti to enable our RTTI default!
 *
 * ✅ RTTI Mode (default logic, requires -frtti flag):
 *    PlatformIO: [env:esp32-s3] with -frtti in build_flags
 *    Arduino IDE: Use committed build_opt.h (contains -frtti)
 *    arduino-cli: --build-property "compiler.cpp.extra_flags=-frtti"
 *    Binary: ~906KB
 *
 * ⚙️ RTTI-Free Mode (opt-in, matches Arduino default):
 *    PlatformIO: [env:esp32-s3-no-rtti] with -DAST_NO_RTTI -fno-rtti
 *    Arduino IDE: Copy build_opt_no_rtti.h.example over build_opt.h
 *    arduino-cli: --build-property "compiler.cpp.extra_flags=-DAST_NO_RTTI -fno-rtti"
 *    Binary: ~866KB (-40KB)
 *
 * USAGE IN CODE:
 * ==============
 * Always use explicit type checks + conditional cast:
 *
 *   if (node->getType() == arduino_ast::ASTNodeType::FUNC_DEF) {
 *       auto* funcDef = AST_CONST_CAST(arduino_ast::FuncDefNode, node);
 *       // RTTI mode: dynamic_cast verifies type
 *       // RTTI-free: static_cast assumes check is correct
 *   }
 *
 * WHEN TO USE RTTI-FREE MODE:
 * ===========================
 * • Production embedded deployments where every KB matters
 * • Flash-constrained ESP32 (<1MB available)
 * • ONLY after thorough testing with RTTI mode
 * • When you need ~40KB flash savings
 *
 * License: MIT
 */

#pragma once

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
        #pragma message "ASTInterpreter: RTTI-FREE mode enabled (explicit opt-in via -DAST_NO_RTTI, size-optimized, no runtime checks)"
    #endif

#else
    // RTTI Mode (Universal Default): Runtime type safety (dynamic_cast)
    // ==================================================================
    // Runtime type verification - wrong casts return nullptr
    // DEFAULT for all platforms - recommended for development and production
    // Binary size: ~40KB larger than RTTI-free mode

    #define AST_CAST(Type, ptr) dynamic_cast<Type*>(ptr)
    #define AST_CONST_CAST(Type, ptr) dynamic_cast<const Type*>(ptr)

    // Conditional compilation messages
    #ifdef __GNUC__
        #pragma message "ASTInterpreter: RTTI mode enabled (universal default, runtime type safety)"
    #endif

#endif

// Macro version for feature detection
#define AST_CAST_VERSION_MAJOR 21
#define AST_CAST_VERSION_MINOR 1
#define AST_CAST_VERSION_PATCH 0

// Helper to check if RTTI is enabled at compile time
#ifdef AST_NO_RTTI
    #define AST_HAS_RTTI 0
#else
    #define AST_HAS_RTTI 1
#endif
