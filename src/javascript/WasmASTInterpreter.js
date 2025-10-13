/**
 * WasmASTInterpreter.js - JavaScript wrapper for C++ WASM interpreter
 *
 * Provides identical API to JavaScript ASTInterpreter.js for drop-in replacement.
 * Enables high-performance Arduino code interpretation in browsers via WebAssembly.
 *
 * Version: 21.1.1
 * Compatible with: ASTInterpreter.js v21.1.1
 *
 * Usage:
 *   const interpreter = new WasmASTInterpreter();
 *   await interpreter.init();
 *   const commands = interpreter.execute(compactASTBinary, { verbose: true });
 */

/**
 * WASM-based Arduino AST Interpreter
 *
 * Performance: 2-5x faster than JavaScript interpreter
 * Memory: 16-64MB heap (configurable)
 * Output: Identical command stream to JavaScript implementation
 */
class WasmASTInterpreter {
    constructor() {
        this.module = null;
        this.interpreterPtr = null;
        this.isReady = false;
        this.version = "21.1.1";
    }

    /**
     * Initialize WASM module
     * Must be called before execute()
     *
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isReady) {
            console.log('✅ WASM interpreter already initialized');
            return;
        }

        try {
            // Load WASM module (built by scripts/build_wasm.sh)
            const moduleUrl = typeof window !== 'undefined'
                ? '../build/wasm/arduino_interpreter.js'  // Browser
                : './build/wasm/arduino_interpreter.js';  // Node.js

            if (typeof createWasmModule === 'undefined') {
                // Dynamic import for Node.js or module script
                const modulePath = require ? require('path').resolve(moduleUrl) : moduleUrl;

                if (typeof window !== 'undefined') {
                    // Browser: load script dynamically
                    await this._loadScript(moduleUrl);
                } else {
                    // Node.js: require the module
                    global.createWasmModule = require(modulePath);
                }
            }

            this.module = await createWasmModule();
            this.isReady = true;

            const version = this.module.UTF8ToString(
                this.module._getInterpreterVersion()
            );

            console.log(`✅ WASM interpreter ready (v${version})`);

        } catch (error) {
            console.error('❌ Failed to initialize WASM module:', error);
            throw new Error(`WASM initialization failed: ${error.message}`);
        }
    }

    /**
     * Execute CompactAST binary and return command stream
     *
     * @param {Uint8Array} compactASTBinary - CompactAST binary data
     * @param {Object} options - Interpreter options
     * @param {boolean} options.verbose - Enable verbose output
     * @param {number} options.maxLoopIterations - Maximum loop iterations
     * @returns {Array<Object>} - Array of command objects
     */
    execute(compactASTBinary, options = {}) {
        if (!this.isReady) {
            throw new Error('WASM module not initialized. Call init() first.');
        }

        if (!compactASTBinary || compactASTBinary.length === 0) {
            throw new Error('Invalid CompactAST binary: empty or null');
        }

        try {
            // Allocate memory for AST binary in WASM heap
            const astSize = compactASTBinary.length;
            const astPtr = this.module._malloc(astSize);

            if (!astPtr) {
                throw new Error('Failed to allocate WASM memory for AST binary');
            }

            // Copy binary data to WASM memory
            this.module.HEAPU8.set(compactASTBinary, astPtr);

            // Create interpreter instance
            this.interpreterPtr = this.module._createInterpreter(
                astPtr,
                astSize,
                options.verbose || false
            );

            // Free AST memory (interpreter has copied it internally)
            this.module._free(astPtr);

            if (!this.interpreterPtr) {
                throw new Error('Failed to create WASM interpreter instance');
            }

            // Set mock values if provided (for testing)
            if (options.analogValues) {
                for (const [pin, value] of Object.entries(options.analogValues)) {
                    this.setAnalogValue(parseInt(pin), value);
                }
            }

            if (options.digitalValues) {
                for (const [pin, value] of Object.entries(options.digitalValues)) {
                    this.setDigitalValue(parseInt(pin), value);
                }
            }

            // Start execution
            const success = this.module._startInterpreter(this.interpreterPtr);

            if (!success) {
                this.cleanup();
                throw new Error('Interpreter execution failed');
            }

            // Get command stream JSON
            const jsonPtr = this.module._getCommandStream(this.interpreterPtr);
            const jsonStr = this.module.UTF8ToString(jsonPtr);

            // Free the string allocated by C++
            this.module._freeString(jsonPtr);

            // Parse commands
            const commands = JSON.parse(jsonStr);

            // Cleanup interpreter resources
            this.cleanup();

            return commands;

        } catch (error) {
            this.cleanup();
            throw new Error(`WASM execution failed: ${error.message}`);
        }
    }

    /**
     * Set analog value for testing
     *
     * @param {number} pin - Analog pin number (0-7)
     * @param {number} value - Analog value (0-1023)
     */
    setAnalogValue(pin, value) {
        if (!this.isReady) {
            throw new Error('WASM module not initialized');
        }

        if (this.interpreterPtr) {
            this.module._setAnalogValue(this.interpreterPtr, pin, value);
        }
    }

    /**
     * Set digital value for testing
     *
     * @param {number} pin - Digital pin number
     * @param {number} value - Digital value (0 or 1)
     */
    setDigitalValue(pin, value) {
        if (!this.isReady) {
            throw new Error('WASM module not initialized');
        }

        if (this.interpreterPtr) {
            this.module._setDigitalValue(this.interpreterPtr, pin, value);
        }
    }

    /**
     * Cleanup interpreter resources
     * Automatically called after execute(), but can be called manually if needed
     */
    cleanup() {
        if (this.interpreterPtr && this.module) {
            this.module._destroyInterpreter(this.interpreterPtr);
            this.interpreterPtr = null;
        }
    }

    /**
     * Get interpreter version
     *
     * @returns {string} - Version string
     */
    getVersion() {
        if (!this.isReady) return this.version;

        const versionPtr = this.module._getInterpreterVersion();
        return this.module.UTF8ToString(versionPtr);
    }

    /**
     * Load script dynamically (browser only)
     *
     * @param {string} src - Script URL
     * @returns {Promise<void>}
     * @private
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

// CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WasmASTInterpreter };
}

// ES6 Module
if (typeof exports !== 'undefined') {
    exports.WasmASTInterpreter = WasmASTInterpreter;
}

// Browser global
if (typeof window !== 'undefined') {
    window.WasmASTInterpreter = WasmASTInterpreter;
}
