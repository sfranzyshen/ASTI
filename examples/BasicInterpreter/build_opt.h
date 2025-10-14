/**
 * build_opt.h - ESP32 Build Configuration (RTTI-Free Mode - Default)
 *
 * v21.2.0: This file enables RTTI-FREE mode (size optimization) as the default
 * for ESP32 builds, avoiding platform.txt maintenance requirements.
 *
 * 🎯 THIS IS THE DEFAULT - No Action Required
 * ============================================
 * ESP32 uses RTTI-free mode by default for practical embedded deployment.
 * Binary size: ~868KB
 *
 * ⚠️ ARDUINO IDE ONLY - arduino-cli CANNOT PARSE THIS FILE
 * ==========================================================
 * arduino-cli users: See docs/ESP32_DEPLOYMENT_GUIDE.md for instructions
 * arduino-cli cannot parse build_opt.h and will cause compilation errors.
 * Use command-line flags instead or switch to PlatformIO.
 *
 * 📊 BINARY SIZE: ~868KB (RTTI-free default)
 *
 * ✅ BENEFITS:
 * • Smaller binary size (868KB vs 896KB)
 * • No platform.txt file editing required
 * • Works immediately after installation
 * • Recommended for flash-constrained production
 *
 * ⚙️ TO ENABLE RTTI MODE (Opt-In):
 * ==================================
 *
 * **Option 1: PlatformIO (RECOMMENDED)**
 * In platformio.ini:
 * [env:esp32-s3-rtti]
 * build_flags = -frtti
 *
 * Benefits: No system file edits, project-specific, automatic framework compilation
 *
 * **Option 2: build_opt.h (Arduino IDE ONLY)**
 * cd examples/BasicInterpreter
 * cp build_opt_rtti.h.example build_opt.h
 *
 * WARNING: This only works with Arduino IDE, not arduino-cli
 *
 * **Option 3: platform.txt (ADVANCED - requires maintenance)**
 * Requires editing ESP32 core installation files.
 * See docs/ESP32_DEPLOYMENT_GUIDE.md for detailed step-by-step instructions.
 * Warning: Changes lost after ESP32 board package updates - must reapply!
 *
 * 🔄 TO RESTORE DEFAULT:
 * ======================
 * git checkout examples/BasicInterpreter/build_opt.h
 *
 * 📊 SIZE COMPARISON:
 * ===================
 * RTTI-free mode (default): ~868KB flash
 * RTTI mode (opt-in):       ~896KB flash (+28KB overhead)
 *
 * 📖 PLATFORM COMPARISON:
 * =======================
 * Linux:  RTTI default (safety-first for development)
 * WASM:   RTTI default (embind requirement + browser safety)
 * ESP32:  RTTI-free default (practical embedded deployment)
 *
 * Version: 21.2.0
 * License: MIT
 */

// Enable RTTI-free mode (default for ESP32)
-DAST_NO_RTTI

// Disable RTTI compiler feature (size optimization)
-fno-rtti
