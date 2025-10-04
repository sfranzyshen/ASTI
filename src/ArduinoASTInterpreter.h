/**
 * ArduinoASTInterpreter.h - Main Arduino Library Header
 *
 * Single include file for Arduino sketches using the ASTInterpreter library.
 * Provides cross-platform abstraction and core interpreter functionality
 * for ESP32-S3 embedded deployment.
 *
 * Usage:
 *   #include <ArduinoASTInterpreter.h>
 *
 *   const uint8_t astBinary[] = { /* CompactAST data */ };
 *   ASTInterpreter* interpreter = new ASTInterpreter(astBinary, sizeof(astBinary));
 *   interpreter->start();
 *
 * Version: 18.0.0
 * Platform: ESP32-S3 (Arduino Framework)
 * License: MIT
 * Repository: https://github.com/sfranzyshen/ASTInterpreter
 */

#pragma once

// Core interpreter components
#include "cpp/ASTInterpreter.hpp"
#include "cpp/ASTNodes.hpp"
#include "cpp/ArduinoDataTypes.hpp"
#include "cpp/PlatformAbstraction.hpp"
#include "cpp/SyncDataProvider.hpp"

// Bring interpreter namespace into scope for convenience
using arduino_interpreter::ASTInterpreter;
using arduino_interpreter::InterpreterOptions;
using arduino_interpreter::SyncDataProvider;
using arduino_interpreter::CommandValue;

// Version information
#define ARDUINO_AST_INTERPRETER_VERSION "18.0.0"
#define ARDUINO_AST_INTERPRETER_VERSION_MAJOR 18
#define ARDUINO_AST_INTERPRETER_VERSION_MINOR 0
#define ARDUINO_AST_INTERPRETER_VERSION_PATCH 0

// Library information
#define ARDUINO_AST_INTERPRETER_AUTHOR "ASTInterpreter Project"
#define ARDUINO_AST_INTERPRETER_URL "https://github.com/sfranzyshen/ASTInterpreter"

/**
 * Quick Start Guide:
 *
 * 1. Create a SyncDataProvider implementation:
 *    class MyDataProvider : public SyncDataProvider {
 *        int32_t getAnalogReadValue(int32_t pin) override {
 *            return analogRead(pin);  // Real hardware
 *        }
 *        // ... implement other methods
 *    };
 *
 * 2. Initialize interpreter in setup():
 *    MyDataProvider provider;
 *    InterpreterOptions opts;
 *    opts.syncMode = true;
 *
 *    auto* interpreter = new ASTInterpreter(astBinary, sizeof(astBinary), opts);
 *    interpreter->setSyncDataProvider(&provider);
 *    interpreter->start();
 *
 * 3. See examples/ folder for complete working sketches
 */
