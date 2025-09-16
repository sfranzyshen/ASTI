/**
 * MockDataManager - Unified Deterministic Mock Data System
 *
 * Provides consistent, reproducible mock data generation for cross-platform testing.
 * Eliminates false test failures caused by random/timestamp-based mock values.
 *
 * @version 1.0.0
 * @author Arduino AST Interpreter Project
 */

class MockDataManager {
    constructor(configPath = null) {
        // Load configuration from MockDataConfig.json
        this.config = this.loadConfig(configPath);

        // Initialize state counters for incremental values
        this.counters = {
            millis: this.config.timing_functions.millis.start_value,
            micros: this.config.timing_functions.micros.start_value,
            requestId: 0,
            random: this.config.sensor_functions.random.seed
        };

        // Track function call counts for deterministic progression
        this.callCounts = {
            millis: 0,
            micros: 0,
            digitalRead: new Map(),  // per-pin counters
            analogRead: new Map()    // per-pin counters
        };
    }

    loadConfig(configPath) {
        // Default config matching MockDataConfig.json structure
        const defaultConfig = {
            timing_functions: {
                millis: { start_value: 17807, increment_per_call: 100 },
                micros: { start_value: 17807000, increment_per_call: 100000 }
            },
            pin_functions: {
                digitalRead: { formula: "(pin % 2) == 1 ? 1 : 0" },
                analogRead: { formula: "(pin * 37 + 42) % 1024" }
            },
            sensor_functions: {
                random: {
                    seed: 12345,
                    multiplier: 1664525,
                    increment: 1013904223,
                    modulus: 4294967296
                }
            },
            request_id_generation: {
                format: "{function}_{counter:06d}"
            }
        };

        if (configPath) {
            try {
                const fs = require('fs');
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return { ...defaultConfig, ...config };
            } catch (error) {
                console.warn(`MockDataManager: Could not load config from ${configPath}, using defaults`);
            }
        }

        return defaultConfig;
    }

    /**
     * Generate deterministic millis() value with time progression
     */
    getMillisValue() {
        const value = this.counters.millis;
        this.callCounts.millis++;
        this.counters.millis += this.config.timing_functions.millis.increment_per_call;
        return value;
    }

    /**
     * Generate deterministic micros() value with time progression
     */
    getMicrosValue() {
        const value = this.counters.micros;
        this.callCounts.micros++;
        this.counters.micros += this.config.timing_functions.micros.increment_per_call;
        return value;
    }

    /**
     * Generate deterministic digitalRead() value based on pin
     */
    getDigitalReadValue(pin) {
        // Track calls per pin for future enhancement
        if (!this.callCounts.digitalRead.has(pin)) {
            this.callCounts.digitalRead.set(pin, 0);
        }
        this.callCounts.digitalRead.set(pin, this.callCounts.digitalRead.get(pin) + 1);

        // Use deterministic pin-based formula: odd pins = HIGH, even pins = LOW
        return (pin % 2) === 1 ? 1 : 0;
    }

    /**
     * Generate deterministic analogRead() value based on pin
     */
    getAnalogReadValue(pin) {
        // Track calls per pin for future enhancement
        if (!this.callCounts.analogRead.has(pin)) {
            this.callCounts.analogRead.set(pin, 0);
        }
        this.callCounts.analogRead.set(pin, this.callCounts.analogRead.get(pin) + 1);

        // Use deterministic pin-based formula matching C++ implementation
        return (pin * 37 + 42) % 1024;
    }

    /**
     * Generate deterministic random value using Linear Congruential Generator
     */
    getRandomValue(min = 0, max = 2147483647) {
        const config = this.config.sensor_functions.random;

        // LCG formula: next = (a * seed + c) % m
        this.counters.random = (config.multiplier * this.counters.random + config.increment) % config.modulus;

        // Scale to requested range
        const range = max - min + 1;
        return min + (this.counters.random % range);
    }

    /**
     * Generate deterministic request ID
     */
    getRequestId(functionName) {
        this.counters.requestId++;
        return `${functionName}_${this.counters.requestId.toString().padStart(6, '0')}`;
    }

    /**
     * Reset all counters to initial state (for test reproducibility)
     */
    reset() {
        this.counters.millis = this.config.timing_functions.millis.start_value;
        this.counters.micros = this.config.timing_functions.micros.start_value;
        this.counters.requestId = 0;
        this.counters.random = this.config.sensor_functions.random.seed;

        this.callCounts.millis = 0;
        this.callCounts.micros = 0;
        this.callCounts.digitalRead.clear();
        this.callCounts.analogRead.clear();
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            counters: { ...this.counters },
            callCounts: {
                millis: this.callCounts.millis,
                micros: this.callCounts.micros,
                digitalRead: Object.fromEntries(this.callCounts.digitalRead),
                analogRead: Object.fromEntries(this.callCounts.analogRead)
            }
        };
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockDataManager;
} else {
    window.MockDataManager = MockDataManager;
}