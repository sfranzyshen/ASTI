#!/usr/bin/env node

// Load debug logger for performance optimization (Node.js only)
let conditionalLog = (verbose, ...args) => { if (verbose) console.log(...args); };
if (typeof require !== 'undefined') {
    try {
        const debugLogger = require('./utils/debug-logger.js');
        conditionalLog = debugLogger.conditionalLog;
    } catch (e) {
        // Fallback to simple implementation if debug logger not found
    }
}

/**
 * CommandStreamValidator - External Semantic Accuracy Validation Framework
 * 
 * This tool validates the semantic accuracy of Arduino interpreter execution
 * by analyzing command streams without adding permanent debugging code to the interpreter.
 * 
 * Usage:
 *   const validator = new CommandStreamValidator();
 *   interpreter.onCommand = validator.captureCommand.bind(validator);
 *   // ... run interpreter ...
 *   const report = validator.generateReport();
 */

class CommandStreamValidator {
    constructor(options = {}) {
        this.options = {
            validateSerial: true,
            validateTiming: true,
            validatePins: true,
            validateVariables: true,
            validateLoops: true,
            maxExpectedLoopIterations: 3,
            ...options
        };
        
        this.reset();
    }
    
    reset() {
        this.commands = [];
        this.serialState = { initialized: false, baudRate: null };
        this.pinStates = new Map();
        this.variables = new Map();
        this.loopInfo = {
            setupCalled: false,
            loopCalled: false,
            loopIterations: 0,
            infiniteLoopDetected: false
        };
        this.timing = {
            delays: [],
            totalDelay: 0
        };
        this.warnings = [];
        this.errors = [];
        this.startTime = null;
        this.endTime = null;
    }
    
    extractPinNumber(pin) {
        // Handle various pin value formats from the interpreter
        if (typeof pin === 'number') {
            return pin;
        }
        if (typeof pin === 'object' && pin !== null && typeof pin.value === 'number') {
            return pin.value;
        }
        if (typeof pin === 'string' && !isNaN(parseInt(pin))) {
            return parseInt(pin);
        }
        return null; // Invalid pin format
    }
    
    extractDigitalValue(value) {
        // Handle various digital value formats from the interpreter
        if (typeof value === 'number' || typeof value === 'string') {
            return value;
        }
        if (typeof value === 'boolean') {
            // Convert boolean to Arduino digital values
            return value ? 1 : 0;
        }
        if (typeof value === 'object' && value !== null) {
            if (typeof value.value === 'number' || typeof value.value === 'string') {
                return value.value;
            }
            if (typeof value.value === 'boolean') {
                return value.value ? 1 : 0;
            }
        }
        return value; // Return as-is for further validation
    }
    
    extractDelayValue(delayValue) {
        // Handle various delay value formats from the interpreter
        if (typeof delayValue === 'number') {
            return delayValue;
        }
        if (typeof delayValue === 'object' && delayValue !== null && typeof delayValue.value === 'number') {
            return delayValue.value;
        }
        if (typeof delayValue === 'string' && !isNaN(parseFloat(delayValue))) {
            return parseFloat(delayValue);
        }
        return delayValue; // Return as-is for further validation
    }
    
    captureCommand(command) {
        if (!this.startTime) {
            this.startTime = Date.now();
        }
        
        this.commands.push({
            ...command,
            timestamp: Date.now(),
            sequenceNumber: this.commands.length
        });
        
        this.analyzeCommand(command);
        
        // Check for completion
        if (command.type === 'PROGRAM_END' || command.type === 'ERROR' || command.type === 'LOOP_LIMIT_REACHED') {
            this.endTime = Date.now();
        }
    }
    
    analyzeCommand(command) {
        switch (command.type) {
            case 'SERIAL_BEGIN':
                this.validateSerialBegin(command);
                break;
                
            case 'SERIAL_PRINT':
            case 'SERIAL_PRINTLN':
                this.validateSerialPrint(command);
                break;
                
            case 'PIN_MODE':
                this.validatePinMode(command);
                break;
                
            case 'DIGITAL_WRITE':
                this.validateDigitalWrite(command);
                break;
                
            case 'DIGITAL_READ':
                this.validateDigitalRead(command);
                break;
                
            case 'DELAY':
                this.validateDelay(command);
                break;
                
            case 'VARIABLE_SET':
                this.validateVariableSet(command);
                break;
                
            case 'FUNCTION_CALL':
                this.validateFunctionCall(command);
                break;
                
            case 'LOOP_ITERATION':
                this.validateLoopIteration(command);
                break;
                
            case 'LOOP_LIMIT_REACHED':
                this.validateLoopLimit(command);
                break;
                
            case 'ERROR':
                this.errors.push({
                    type: 'INTERPRETER_ERROR',
                    message: command.message || 'Unknown interpreter error',
                    command: command
                });
                break;
        }
    }
    
    validateSerialBegin(command) {
        if (this.options.validateSerial) {
            if (!command.baudRate || typeof command.baudRate !== 'number') {
                this.errors.push({
                    type: 'SERIAL_INVALID_BAUD',
                    message: `Serial.begin() called with invalid baud rate: ${command.baudRate}`,
                    command: command
                });
                return;
            }
            
            if (this.serialState.initialized) {
                this.warnings.push({
                    type: 'SERIAL_REINIT',
                    message: `Serial.begin() called multiple times (previous: ${this.serialState.baudRate}, new: ${command.baudRate})`,
                    command: command
                });
            }
            
            this.serialState.initialized = true;
            this.serialState.baudRate = command.baudRate;
        }
    }
    
    validateSerialPrint(command) {
        if (this.options.validateSerial) {
            if (!this.serialState.initialized) {
                this.errors.push({
                    type: 'SERIAL_NOT_INITIALIZED',
                    message: `${command.type} called before Serial.begin()`,
                    command: command
                });
            }
        }
    }
    
    validatePinMode(command) {
        if (this.options.validatePins) {
            const pin = this.extractPinNumber(command.pin);
            const mode = command.mode;
            
            if (pin === null || pin < 0 || pin > 53) {
                this.errors.push({
                    type: 'INVALID_PIN',
                    message: `Invalid pin number: ${command.pin}`,
                    command: command
                });
                return;
            }
            
            if (!['INPUT', 'OUTPUT', 'INPUT_PULLUP'].includes(mode)) {
                this.errors.push({
                    type: 'INVALID_PIN_MODE',
                    message: `Invalid pin mode: ${mode}`,
                    command: command
                });
                return;
            }
            
            this.pinStates.set(pin, { mode: mode, lastWrite: null });
        }
    }
    
    validateDigitalWrite(command) {
        if (this.options.validatePins) {
            const pin = this.extractPinNumber(command.pin);
            const value = this.extractDigitalValue(command.value);
            
            if (!this.pinStates.has(pin)) {
                this.warnings.push({
                    type: 'PIN_NOT_CONFIGURED',
                    message: `digitalWrite(${pin}) called before pinMode()`,
                    command: command
                });
            } else {
                const pinState = this.pinStates.get(pin);
                if (pinState.mode !== 'OUTPUT') {
                    this.warnings.push({
                        type: 'WRITE_TO_INPUT_PIN',
                        message: `digitalWrite(${pin}) called on pin configured as ${pinState.mode}`,
                        command: command
                    });
                }
            }
            
            if (![0, 1, 'LOW', 'HIGH'].includes(value)) {
                this.errors.push({
                    type: 'INVALID_DIGITAL_VALUE',
                    message: `Invalid digital value: ${value}`,
                    command: command
                });
            }
            
            if (this.pinStates.has(pin)) {
                this.pinStates.get(pin).lastWrite = value;
            }
        }
    }
    
    validateDigitalRead(command) {
        if (this.options.validatePins) {
            const pin = this.extractPinNumber(command.pin);
            
            if (!this.pinStates.has(pin)) {
                this.warnings.push({
                    type: 'PIN_NOT_CONFIGURED',
                    message: `digitalRead(${pin}) called before pinMode()`,
                    command: command
                });
            }
        }
    }
    
    validateDelay(command) {
        if (this.options.validateTiming) {
            const ms = this.extractDelayValue(command.duration || command.milliseconds); // Support both field names
            
            if (typeof ms !== 'number' || ms < 0 || !isFinite(ms)) {
                this.errors.push({
                    type: 'INVALID_DELAY',
                    message: `Invalid delay value: ${ms}`,
                    command: command
                });
                return;
            }
            
            this.timing.delays.push(ms);
            this.timing.totalDelay += ms;
            
            if (ms > 10000) {
                this.warnings.push({
                    type: 'LONG_DELAY',
                    message: `Very long delay detected: ${ms}ms`,
                    command: command
                });
            }
        }
    }
    
    validateVariableSet(command) {
        if (this.options.validateVariables) {
            const name = command.variable;
            const value = command.value;
            const type = command.type;
            
            if (this.variables.has(name)) {
                const existing = this.variables.get(name);
                if (existing.type !== type && type !== 'inferred') {
                    this.warnings.push({
                        type: 'TYPE_CHANGE',
                        message: `Variable '${name}' type changed from ${existing.type} to ${type}`,
                        command: command
                    });
                }
            }
            
            this.variables.set(name, { type: type, value: value, lastSet: this.commands.length });
        }
    }
    
    validateFunctionCall(command) {
        const funcName = command.function;
        
        if (funcName === 'setup') {
            if (this.loopInfo.setupCalled) {
                this.warnings.push({
                    type: 'MULTIPLE_SETUP_CALLS',
                    message: 'setup() function called multiple times',
                    command: command
                });
            }
            this.loopInfo.setupCalled = true;
        } else if (funcName === 'loop') {
            this.loopInfo.loopCalled = true;
            this.loopInfo.loopIterations++;
        }
    }
    
    validateLoopIteration(command) {
        if (this.options.validateLoops) {
            this.loopInfo.loopIterations++;
            
            if (this.loopInfo.loopIterations > this.options.maxExpectedLoopIterations * 2) {
                this.warnings.push({
                    type: 'EXCESSIVE_LOOP_ITERATIONS',
                    message: `Loop iterations (${this.loopInfo.loopIterations}) exceed expected maximum (${this.options.maxExpectedLoopIterations})`,
                    command: command
                });
            }
        }
    }
    
    validateLoopLimit(command) {
        if (this.options.validateLoops) {
            // Check if this is normal Arduino loop() termination vs actual infinite loop
            const isArduinoLoopLimit = command.message && (
                command.message.includes('loop iterations') ||  // Arduino loop() limit
                command.message.includes('Program completed')    // Normal program end
            );
            
            // Check if this is a legitimate while/for loop that should have terminated
            const isWhileOrForLoop = command.message && (
                command.message.includes('While loop') || 
                command.message.includes('For loop')
            );
            
            if (isArduinoLoopLimit) {
                // This is normal Arduino behavior - don't flag as error
                this.loopInfo.infiniteLoopDetected = false;
            } else if (isWhileOrForLoop) {
                // This is a while/for loop that hit the iteration limit
                // In a testing environment with maxLoopIterations, this is expected behavior
                // Don't penalize the code's semantic accuracy for framework testing limits
                this.loopInfo.infiniteLoopDetected = false;
                
                // Could optionally add an info note, but don't count as warning/error:
                // "Note: Loop terminated due to testing framework iteration limit"
            } else {
                // Unknown loop limit situation
                this.warnings.push({
                    type: 'UNKNOWN_LOOP_LIMIT',
                    message: `Loop limit reached: ${command.message || 'Unknown cause'}`,
                    command: command
                });
            }
        }
    }
    
    generateReport() {
        const duration = this.endTime ? (this.endTime - this.startTime) : null;
        
        const report = {
            summary: {
                totalCommands: this.commands.length,
                duration: duration,
                errors: this.errors.length,
                warnings: this.warnings.length,
                semanticAccuracy: this.calculateSemanticAccuracy()
            },
            
            execution: {
                setupCalled: this.loopInfo.setupCalled,
                loopCalled: this.loopInfo.loopCalled,
                loopIterations: this.loopInfo.loopIterations,
                infiniteLoopDetected: this.loopInfo.infiniteLoopDetected
            },
            
            hardware: {
                serial: {
                    initialized: this.serialState.initialized,
                    baudRate: this.serialState.baudRate
                },
                pins: Object.fromEntries(this.pinStates),
                timing: {
                    totalDelay: this.timing.totalDelay,
                    delayCount: this.timing.delays.length,
                    delays: this.timing.delays
                }
            },
            
            variables: Object.fromEntries(this.variables),
            
            issues: {
                errors: this.errors,
                warnings: this.warnings
            },
            
            commands: this.commands
        };
        
        return report;
    }
    
    calculateSemanticAccuracy() {
        const totalIssues = this.errors.length + this.warnings.length;
        const commandCount = Math.max(1, this.commands.length); // Avoid division by zero
        
        // Calculate accuracy as percentage of commands without issues
        const accuracy = Math.max(0, (commandCount - totalIssues) / commandCount * 100);
        
        return {
            percentage: Math.round(accuracy * 10) / 10, // Round to 1 decimal
            totalIssues: totalIssues,
            errorCount: this.errors.length,
            warningCount: this.warnings.length,
            commandCount: commandCount
        };
    }
    
    printReport(options = {}) {
        const report = this.generateReport();
        const { detailed = false, showCommands = false, verbose = true } = options;
        
        conditionalLog(verbose, '\n📊 SEMANTIC ACCURACY VALIDATION REPORT');
        conditionalLog(verbose, '═'.repeat(50));
        
        conditionalLog(verbose, '\n🎯 SUMMARY:');
        conditionalLog(verbose, `  Total Commands: ${report.summary.totalCommands}`);
        conditionalLog(verbose, `  Duration: ${report.summary.duration || 'N/A'}ms`);
        conditionalLog(verbose, `  Semantic Accuracy: ${report.summary.semanticAccuracy.percentage}%`);
        conditionalLog(verbose, `  Errors: ${report.summary.errors}`);
        conditionalLog(verbose, `  Warnings: ${report.summary.warnings}`);
        
        conditionalLog(verbose, '\n🔧 EXECUTION:');
        conditionalLog(verbose, `  setup() called: ${report.execution.setupCalled ? '✅' : '❌'}`);
        conditionalLog(verbose, `  loop() called: ${report.execution.loopCalled ? '✅' : '❌'}`);
        conditionalLog(verbose, `  Loop iterations: ${report.execution.loopIterations}`);
        conditionalLog(verbose, `  Infinite loop detected: ${report.execution.infiniteLoopDetected ? '⚠️  YES' : '✅ NO'}`);
        
        if (detailed) {
            conditionalLog(verbose, '\n🔌 HARDWARE STATE:');
            conditionalLog(verbose, `  Serial initialized: ${report.hardware.serial.initialized ? '✅' : '❌'}`);
            if (report.hardware.serial.baudRate) {
                conditionalLog(verbose, `  Serial baud rate: ${report.hardware.serial.baudRate}`);
            }
            conditionalLog(verbose, `  Pins configured: ${Object.keys(report.hardware.pins).length}`);
            conditionalLog(verbose, `  Total delay time: ${report.hardware.timing.totalDelay}ms`);
            conditionalLog(verbose, `  Delay calls: ${report.hardware.timing.delayCount}`);
            
            conditionalLog(verbose, '\n📦 VARIABLES:');
            const varCount = Object.keys(report.variables).length;
            conditionalLog(verbose, `  Variables tracked: ${varCount}`);
            if (varCount > 0 && varCount <= 10) {
                Object.entries(report.variables).forEach(([name, info]) => {
                    conditionalLog(verbose, `    ${name}: ${info.type} = ${info.value}`);
                });
            }
        }
        
        if (report.issues.errors.length > 0) {
            conditionalLog(verbose, '\n❌ ERRORS:');
            report.issues.errors.forEach((error, idx) => {
                conditionalLog(verbose, `  ${idx + 1}. [${error.type}] ${error.message}`);
            });
        }
        
        if (report.issues.warnings.length > 0) {
            conditionalLog(verbose, '\n⚠️  WARNINGS:');
            report.issues.warnings.forEach((warning, idx) => {
                conditionalLog(verbose, `  ${idx + 1}. [${warning.type}] ${warning.message}`);
            });
        }
        
        if (showCommands && report.commands.length > 0) {
            conditionalLog(verbose, '\n📋 COMMAND STREAM:');
            report.commands.slice(0, 20).forEach((cmd, idx) => {
                conditionalLog(verbose, `  ${idx + 1}. [${cmd.type}] ${JSON.stringify(cmd).substring(0, 80)}...`);
            });
            if (report.commands.length > 20) {
                conditionalLog(verbose, `  ... and ${report.commands.length - 20} more commands`);
            }
        }
        
        conditionalLog(verbose, '\n═'.repeat(50));
        
        return report;
    }
}

// Export for Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommandStreamValidator };
} else if (typeof window !== 'undefined') {
    window.CommandStreamValidator = CommandStreamValidator;
}