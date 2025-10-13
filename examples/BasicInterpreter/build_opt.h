/**
 * build_opt.h - ESP32 Build Configuration (RTTI Mode - Default)
 *
 * v21.1.0: This file enables RTTI mode (runtime type safety) by overriding
 * Arduino ESP32's -fno-rtti default with -frtti.
 *
 * 🎯 THIS IS THE DEFAULT - No Action Required
 * ============================================
 * This file is committed to git and works automatically when you compile.
 * Just open BasicInterpreter.ino in Arduino IDE and compile.
 *
 * 📊 BINARY SIZE: ~906KB
 *
 * ✅ BENEFITS:
 * • Runtime type safety via dynamic_cast
 * • Wrong casts return nullptr (safe failure)
 * • Easier debugging and development
 * • Recommended for production unless flash-constrained
 *
 * ⚙️ FOR SIZE OPTIMIZATION (Opt-In):
 * ==================================
 * If you need ~40KB flash savings (866KB binary):
 *
 * cd examples/BasicInterpreter
 * cp build_opt_no_rtti.h.example build_opt.h
 *
 * This will overwrite this file with RTTI-free configuration.
 * WARNING: Only use after thorough testing with RTTI mode!
 *
 * 🔄 TO RESTORE DEFAULT:
 * ======================
 * git checkout examples/BasicInterpreter/build_opt.h
 *
 * 📖 USAGE (Arduino IDE):
 * =======================
 * 1. Open examples/BasicInterpreter/BasicInterpreter.ino
 * 2. Compile (Arduino IDE automatically applies this build_opt.h)
 * 3. Verify binary size: Should be ~906KB
 * 4. Upload to ESP32-S3
 *
 * 🔧 ALTERNATIVE (arduino-cli):
 * =============================
 * The committed build_opt.h is automatically used:
 *
 * arduino-cli compile --fqbn esp32:esp32:esp32s3 examples/BasicInterpreter
 *
 * Version: 21.1.0
 * License: MIT
 */

// Enable RTTI (override Arduino ESP32's -fno-rtti default)
-frtti
