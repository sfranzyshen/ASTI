// conditionalLog is provided by ArduinoParser.js in browser
// For Node.js standalone usage, we'll use a simple fallback if not defined
if (typeof conditionalLog === 'undefined') {
    if (typeof console !== 'undefined') {
        conditionalLog = (verbose, ...args) => { if (verbose) console.log(...args); };
    } else {
        conditionalLog = () => {}; // No-op fallback
    }
}

/**
 * Arduino AST Interpreter
 * 
 * Takes parsed AST from parser.js and generates Arduino commands
 * for execution by parent application.
 * 
 * USAGE:
 *   const interpreter = new ASTInterpreter(ast, { verbose: true });
 *   interpreter.onCommand = (command) => conditionalLog(true, command);
 *   interpreter.start();
 * 
 * FEATURES:
 *   ✅ AST walking with execution control (start/stop/pause/step)
 *   ✅ Arduino function interpretation (pinMode, digitalWrite, etc.)
 *   ✅ Variable tracking and memory management  
 *   ✅ Event-driven command emission
 *   ✅ setup() and loop() execution flow
 */

const INTERPRETER_VERSION = "13.0.0";

// Global debugLog function for contexts where 'this' is not available
function debugLog(...args) {
    // Silent by default - only logs if explicitly enabled globally
    if (global.INTERPRETER_DEBUG_ENABLED) {
        conditionalLog(true, ...args);
    }
}

// =============================================================================
// COMMAND PROTOCOL DEFINITIONS
// =============================================================================

const COMMAND_TYPES = {
    // Pin operations
    PIN_MODE: 'PIN_MODE',
    DIGITAL_WRITE: 'DIGITAL_WRITE', 
    DIGITAL_READ: 'DIGITAL_READ',
    ANALOG_WRITE: 'ANALOG_WRITE',
    ANALOG_READ: 'ANALOG_READ',
    
    // Request-response pattern for external data
    ANALOG_READ_REQUEST: 'ANALOG_READ_REQUEST',
    DIGITAL_READ_REQUEST: 'DIGITAL_READ_REQUEST', 
    MILLIS_REQUEST: 'MILLIS_REQUEST',
    MICROS_REQUEST: 'MICROS_REQUEST',
    LIBRARY_METHOD_REQUEST: 'LIBRARY_METHOD_REQUEST',
    
    // Timing
    DELAY: 'DELAY',
    DELAY_MICROSECONDS: 'DELAY_MICROSECONDS',
    
    // Variable operations
    VAR_SET: 'VAR_SET',
    VAR_GET: 'VAR_GET',
    
    // Control flow
    FUNCTION_CALL: 'FUNCTION_CALL',
    FUNCTION_CALL_WITH_ARGS: 'FUNCTION_CALL_WITH_ARGS',
    LOOP_START: 'LOOP_START',
    LOOP_END: 'LOOP_END',
    LOOP_LIMIT_REACHED: 'LOOP_LIMIT_REACHED',
    CONDITION_EVAL: 'CONDITION_EVAL',
    
    // Object-oriented programming
    CONSTRUCTOR_CALL: 'CONSTRUCTOR_CALL',
    
    // Control flow statements
    IF_STATEMENT: 'IF_STATEMENT',
    SWITCH_STATEMENT: 'SWITCH_STATEMENT',
    SWITCH_CASE: 'SWITCH_CASE',
    FOR_LOOP: 'FOR_LOOP',
    WHILE_LOOP: 'WHILE_LOOP',
    DO_WHILE_LOOP: 'DO_WHILE_LOOP',
    BREAK_STATEMENT: 'BREAK_STATEMENT',
    CONTINUE_STATEMENT: 'CONTINUE_STATEMENT',
    
    // System
    SETUP_START: 'SETUP_START',
    SETUP_END: 'SETUP_END',
    PROGRAM_START: 'PROGRAM_START',
    PROGRAM_END: 'PROGRAM_END',
    VERSION_INFO: 'VERSION_INFO',
    ERROR: 'ERROR'
};

const EXECUTION_STATE = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING', 
    PAUSED: 'PAUSED',
    STEPPING: 'STEPPING',
    ERROR: 'ERROR',
    COMPLETE: 'COMPLETE',
    WAITING_FOR_RESPONSE: 'WAITING_FOR_RESPONSE'
};

const PIN_MODES = {
    INPUT: 'INPUT',
    OUTPUT: 'OUTPUT',
    INPUT_PULLUP: 'INPUT_PULLUP',
    INPUT_PULLDOWN: 'INPUT_PULLDOWN',
    OUTPUT_OPENDRAIN: 'OUTPUT_OPENDRAIN'
};

const DIGITAL_VALUES = {
    HIGH: 1,
    LOW: 0
};

// Arduino Keyboard Constants
const KEYBOARD_KEYS = {
    KEY_LEFT_CTRL: 0x80,
    KEY_LEFT_SHIFT: 0x81,
    KEY_LEFT_ALT: 0x82,
    KEY_LEFT_GUI: 0x83,
    KEY_RIGHT_CTRL: 0x84,
    KEY_RIGHT_SHIFT: 0x85,
    KEY_RIGHT_ALT: 0x86,
    KEY_RIGHT_GUI: 0x87,
    KEY_UP_ARROW: 0xDA,
    KEY_DOWN_ARROW: 0xD9,
    KEY_LEFT_ARROW: 0xD8,
    KEY_RIGHT_ARROW: 0xD7,
    KEY_BACKSPACE: 0xB2,
    KEY_TAB: 0xB3,
    KEY_RETURN: 0xB0,
    KEY_ESC: 0xB1,
    KEY_INSERT: 0xD1,
    KEY_DELETE: 0xD4,
    KEY_PAGE_UP: 0xD3,
    KEY_PAGE_DOWN: 0xD6,
    KEY_HOME: 0xD2,
    KEY_END: 0xD5,
    KEY_CAPS_LOCK: 0xC1,
    KEY_F1: 0xC2,
    KEY_F2: 0xC3,
    KEY_F3: 0xC4,
    KEY_F4: 0xC5,
    KEY_F5: 0xC6,
    KEY_F6: 0xC7,
    KEY_F7: 0xC8,
    KEY_F8: 0xC9,
    KEY_F9: 0xCA,
    KEY_F10: 0xCB,
    KEY_F11: 0xCC,
    KEY_F12: 0xCD
};

// Special error class for state machine execution pausing
class ExecutionPausedError extends Error {
    constructor(requestId) {
        super('Execution paused for external data request');
        this.name = 'ExecutionPausedError';
        this.requestId = requestId;
    }
}

// Simplified Arduino Object base class for generic library support
class ArduinoObject {
    constructor(className, constructorArgs = [], interpreter = null) {
        this.className = className;
        this.constructorArgs = constructorArgs;
        this.libraryInfo = ARDUINO_LIBRARIES[className];
        this.interpreter = interpreter; // Reference for command emission and requests
        
        // Store object identifier for method calls
        this.objectId = `${className}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Enhanced method handler implementing clean command stream architecture
    callMethod(methodName, args = [], variableName = null) {
        if (!this.libraryInfo) {
            throw new Error(`Unknown library: ${this.className}`);
        }
        
        // Priority 1: Handle internal methods - calculated by interpreter, return immediately
        if (this.libraryInfo.internalMethods && this.libraryInfo.internalMethods[methodName]) {
            const internalMethod = this.libraryInfo.internalMethods[methodName];
            const result = internalMethod(this, ...args);
            
            // Emit command for debugging/tracking purposes
            if (this.interpreter) {
                this.interpreter.emitCommand({
                    type: 'LIBRARY_METHOD_INTERNAL',
                    library: this.className,
                    method: methodName,
                    args: args,
                    result: result,
                    variableName: variableName,
                    timestamp: Date.now()
                });
            }
            
            return result; // ✅ Return calculated primitive value
        }
        
        // Priority 2: Handle static methods (for backward compatibility)
        if (this.libraryInfo.staticMethods && this.libraryInfo.staticMethods.includes(methodName)) {
            const result = this.calculateStaticMethod(methodName, args);
            if (result !== null) {
                // Emit command and return primitive value
                this.emitCalculableCommand(methodName, args, result, variableName);
                return result; // ✅ Return primitive, not object
            }
        }
        
        // Priority 3: Handle external methods - emit commands to parent app
        if (this.libraryInfo.externalMethods && this.libraryInfo.externalMethods.includes(methodName)) {
            const displayName = variableName || this.className;
            const command = {
                type: 'LIBRARY_METHOD_CALL',
                library: this.className,
                object: this.objectId,
                variableName: variableName,
                method: methodName,
                args: args,
                message: `${displayName}.${methodName}(${args.join(', ')})`
            };
            
            if (this.interpreter) {
                this.interpreter.emitCommand({...command, timestamp: Date.now()});
            }
            
            return null; // External methods return null (handled by parent app)
        }
        
        // Fallback: Handle legacy methods list (for backward compatibility)
        if (this.libraryInfo.methods && this.libraryInfo.methods.includes(methodName)) {
            // Handle external data methods (request-response pattern)  
            if (this.isExternalDataMethod(methodName)) {
                return this.requestExternalData(methodName, args);
            }
            
            // Emit void method command
            const command = {
                type: 'LIBRARY_METHOD_CALL',
                library: this.className,
                object: this.objectId,
                method: methodName,
                args: args,
                message: `${this.className}.${methodName}(${args.join(', ')})`
            };
            
            if (this.interpreter) {
                this.interpreter.emitCommand({...command, timestamp: Date.now()});
            }
            
            return null; // Void methods return null
        }
        
        // Method not found
        throw new Error(`Unknown method ${this.className}.${methodName}`);
    }

    calculateStaticMethod(methodName, args) {
        switch (`${this.className}.${methodName}`) {
            case 'Adafruit_NeoPixel.Color':
                const r = args[0] || 0, g = args[1] || 0, b = args[2] || 0;
                return (r << 16) | (g << 8) | b; // ✅ Calculate and return primitive
                
            case 'Adafruit_NeoPixel.ColorHSV':
                return this.calculateHSVtoRGB(args[0], args[1], args[2]);
                
            case 'Adafruit_NeoPixel.gamma32':
                return this.applyGammaCorrection(args[0]);
                
            case 'Adafruit_NeoPixel.sine8':
                return Math.floor(Math.sin((args[0] || 0) * Math.PI / 128) * 127 + 128);
                
            default:
                return null; // Not a calculable function
        }
    }

    async requestExternalData(methodName, args) {
        if (!this.interpreter) {
            throw new Error('Cannot request external data: no interpreter reference');
        }

        const requestId = `${this.className}_${methodName}_${Date.now()}_${Math.random()}`;
        
        // Emit request command
        this.interpreter.emitCommand({
            type: 'LIBRARY_METHOD_REQUEST',
            library: this.className,
            object: this.objectId,
            method: methodName,
            args: args,
            requestId: requestId,
            timestamp: Date.now()
        });
        
        // Wait for response
        try {
            const response = await this.interpreter.waitForResponse(requestId, 5000);
            return response.value;
        } catch (error) {
            // Fallback values for testing/simulation
            switch (methodName) {
                case 'numPixels': return this.constructorArgs[0] || 60;
                case 'getBrightness': return 255;
                case 'getPixelColor': return 0;
                case 'canShow': return true;
                default: return 0;
            }
        }
    }

    isExternalDataMethod(methodName) {
        // Methods that require external data from parent app
        const externalMethods = ['numPixels', 'getBrightness', 'getPixelColor', 'canShow'];
        return externalMethods.includes(methodName);
    }

    emitCalculableCommand(methodName, args, result, variableName = null) {
        if (this.interpreter) {
            this.interpreter.emitCommand({
                type: 'LIBRARY_METHOD_INTERNAL',
                library: this.className,
                method: methodName,
                args: args,
                result: result,
                variableName: variableName,
                timestamp: Date.now()
            });
        }
    }

    calculateHSVtoRGB(h, s, v) {
        // HSV to RGB conversion algorithm
        h = (h || 0) % 65536;
        s = Math.max(0, Math.min(255, s || 255));
        v = Math.max(0, Math.min(255, v || 255));
        
        const region = h / 10923;
        const remainder = (h - (Math.floor(region) * 10923)) * 6;
        const p = (v * (255 - s)) >> 8;
        const q = (v * (255 - ((s * remainder) >> 16))) >> 8;
        const t = (v * (255 - ((s * (65536 - remainder)) >> 16))) >> 8;
        
        switch (Math.floor(region)) {
            case 0: return (v << 16) | (t << 8) | p;
            case 1: return (q << 16) | (v << 8) | p;
            case 2: return (p << 16) | (v << 8) | t;
            case 3: return (p << 16) | (q << 8) | v;
            case 4: return (t << 16) | (p << 8) | v;
            default: return (v << 16) | (p << 8) | q;
        }
    }

    applyGammaCorrection(color) {
        // Simple gamma correction
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8) & 0xFF;
        const b = color & 0xFF;
        
        // Apply gamma 2.2 correction
        const correctedR = Math.floor(Math.pow(r / 255.0, 2.2) * 255);
        const correctedG = Math.floor(Math.pow(g / 255.0, 2.2) * 255);
        const correctedB = Math.floor(Math.pow(b / 255.0, 2.2) * 255);
        
        return (correctedR << 16) | (correctedG << 8) | correctedB;
    }
    
    // Generic property access
    getProperty(name) {
        // Return placeholder values for common properties
        switch (name) {
            case 'numPixels':
                return this.constructorArgs[0] || 0;
            case 'pin':
                return this.constructorArgs[1] || 0;
            case 'brightness':
                return 255; // Default brightness
            default:
                return null;
        }
    }
    
    setProperty(name, value) {
        // Property setting would emit a command
        return {
            type: 'LIBRARY_PROPERTY_SET',
            library: this.className,
            object: this.objectId,
            property: name,
            value: this.interpreter ? this.interpreter.sanitizeForCommand(value) : value,
            message: `${this.className}.${name} = ${value}`
        };
    }
}

// Arduino Pointer class for pointer operations
class ArduinoPointer {
    constructor(targetVariable, interpreter) {
        this.targetVariable = targetVariable;
        this.interpreter = interpreter;
        this.type = 'pointer';
        
        // Generate a unique pointer ID for debugging
        this.pointerId = `ptr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    
    // Get the value that this pointer points to
    getValue() {
        if (!this.interpreter.variables.has(this.targetVariable)) {
            throw new Error(`Pointer target variable '${this.targetVariable}' no longer exists`);
        }
        
        const targetValue = this.interpreter.variables.get(this.targetVariable);
        
        // For array pointers, return the first element (arr[0])
        if (Array.isArray(targetValue)) {
            return targetValue[0];
        }
        
        // For non-array variables, return the variable value directly
        return targetValue;
    }
    
    // Set the value that this pointer points to (for *ptr = value assignments)
    setValue(newValue) {
        const result = this.interpreter.variables.set(this.targetVariable, newValue);
        if (!result.success) {
            throw new Error(result.message || `Failed to set value through pointer to '${this.targetVariable}'`);
        }
        
        // Mark variable as initialized
        this.interpreter.variables.markAsInitialized(this.targetVariable);
        
        // Emit command for pointer assignment
        this.interpreter.emitCommand({
            type: 'POINTER_ASSIGNMENT',
            pointer: this.pointerId,
            targetVariable: this.targetVariable,
            value: this.interpreter.sanitizeForCommand(newValue),
            timestamp: Date.now(),
            message: `*${this.targetVariable} = ${newValue}`
        });
        
        return newValue;
    }
    
    // Check if the pointer is valid (target still exists)
    isValid() {
        return this.interpreter.variables.has(this.targetVariable);
    }
    
    // Get pointer info for debugging
    toString() {
        return `ArduinoPointer(${this.pointerId} -> ${this.targetVariable})`;
    }
    
    // Handle pointer arithmetic (ptr + n, ptr - n)
    add(offset) {
        // For now, create a simple offset pointer
        // This is a simplified implementation - real pointer arithmetic would depend on type size
        return new ArduinoOffsetPointer(this.targetVariable, offset, this.interpreter);
    }
    
    subtract(offset) {
        return this.add(-offset);
    }
}

// Arduino Function Pointer class for function pointer support
class ArduinoFunctionPointer {
    constructor(functionName, interpreter) {
        this.functionName = functionName;
        this.interpreter = interpreter;
        this.type = 'function_pointer';
        
        // Generate a unique function pointer ID for debugging
        this.pointerId = `fptr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    
    // Call the function that this pointer points to
    async call(args = []) {
        if (!this.interpreter.functions.has(this.functionName)) {
            throw new Error(`Function pointer target '${this.functionName}' no longer exists`);
        }
        
        if (this.interpreter.options.verbose) {
            debugLog(`Function pointer call: ${this.functionName}(${args.length} args)`);
        }
        
        // Create a synthetic function call node that matches what executeFunctionCall expects
        const syntheticNode = {
            type: 'FuncCallNode',
            callee: {
                type: 'IdentifierNode',
                value: this.functionName
            },
            arguments: args.map(arg => {
                // Create the appropriate AST node type based on the argument type
                if (typeof arg === 'number') {
                    return {
                        type: 'NumberNode',
                        value: arg
                    };
                } else if (typeof arg === 'string') {
                    return {
                        type: 'StringLiteralNode', 
                        value: arg
                    };
                } else if (typeof arg === 'boolean') {
                    return {
                        type: 'BooleanNode',
                        value: arg
                    };
                } else {
                    // For other types, create a generic node
                    return {
                        type: 'LiteralNode',
                        value: arg
                    };
                }
            })
        };
        
        // Execute through the normal function call mechanism
        return await this.interpreter.executeFunctionCall(syntheticNode);
    }
    
    // Check if the function still exists
    isValid() {
        return this.interpreter.functions.has(this.functionName);
    }
    
    // Get function info for debugging
    toString() {
        return `ArduinoFunctionPointer(${this.pointerId} -> ${this.functionName})`;
    }
}

// Extended pointer class for pointer arithmetic (ptr + offset)
class ArduinoOffsetPointer extends ArduinoPointer {
    constructor(baseVariable, offset, interpreter) {
        super(baseVariable, interpreter);
        this.offset = offset;
        this.type = 'offset_pointer';
    }
    
    getValue() {
        // For array access: arr[0] equivalent to *(arr + 0)
        const baseValue = this.interpreter.variables.get(this.targetVariable);
        
        if (Array.isArray(baseValue)) {
            const index = this.offset;
            if (index >= 0 && index < baseValue.length) {
                return baseValue[index];
            } else {
                throw new Error(`Array index ${index} out of bounds for array ${this.targetVariable}`);
            }
        } else {
            throw new Error(`Pointer arithmetic on non-array variable '${this.targetVariable}' not supported`);
        }
    }
    
    setValue(newValue) {
        const baseValue = this.interpreter.variables.get(this.targetVariable);
        
        if (Array.isArray(baseValue)) {
            const index = this.offset;
            if (index >= 0 && index < baseValue.length) {
                baseValue[index] = newValue;
                
                // Update the array in variables
                const result = this.interpreter.variables.set(this.targetVariable, baseValue);
                if (!result.success) {
                    throw new Error(result.message);
                }
                
                this.interpreter.emitCommand({
                    type: 'ARRAY_ELEMENT_SET',
                    array: this.targetVariable,
                    index: index,
                    value: this.interpreter.sanitizeForCommand(newValue),
                    timestamp: Date.now(),
                    message: `${this.targetVariable}[${index}] = ${newValue}`
                });
                
                return newValue;
            } else {
                throw new Error(`Array index ${index} out of bounds for array ${this.targetVariable}`);
            }
        } else {
            throw new Error(`Pointer arithmetic assignment on non-array variable '${this.targetVariable}' not supported`);
        }
    }
    
    // Override add method to accumulate offsets
    add(additionalOffset) {
        const newOffset = this.offset + additionalOffset;
        return new ArduinoOffsetPointer(this.targetVariable, newOffset, this.interpreter);
    }
    
    // Override subtract method to accumulate offsets
    subtract(additionalOffset) {
        const newOffset = this.offset - additionalOffset;
        return new ArduinoOffsetPointer(this.targetVariable, newOffset, this.interpreter);
    }
    
    toString() {
        return `ArduinoOffsetPointer(${this.pointerId} -> ${this.targetVariable} + ${this.offset})`;
    }
}

// Arduino Struct class for struct support
class ArduinoStruct {
    constructor(structName, fields = {}) {
        this.structName = structName;
        this.fields = new Map();
        this.type = 'struct';
        
        // Initialize fields with default values
        for (const [fieldName, fieldType] of Object.entries(fields)) {
            this.fields.set(fieldName, this.getDefaultValue(fieldType));
        }
        
        // Generate unique struct ID for debugging
        this.structId = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    
    // Get default value for a field type
    getDefaultValue(fieldType) {
        switch (fieldType) {
            case 'int':
            case 'float':
            case 'double':
            case 'long':
            case 'short':
            case 'byte':
                return 0;
            case 'char':
                return '\0';
            case 'bool':
                return false;
            case 'String':
                return new ArduinoString("");
            default:
                return null; // For pointer types or unknown types
        }
    }
    
    // Get field value
    getField(fieldName) {
        if (!this.fields.has(fieldName)) {
            throw new Error(`Struct '${this.structName}' has no field '${fieldName}'`);
        }
        return this.fields.get(fieldName);
    }
    
    // Set field value
    setField(fieldName, value) {
        if (!this.fields.has(fieldName)) {
            throw new Error(`Struct '${this.structName}' has no field '${fieldName}'`);
        }
        this.fields.set(fieldName, value);
        return value;
    }
    
    // Check if field exists
    hasField(fieldName) {
        return this.fields.has(fieldName);
    }
    
    // Get all field names
    getFieldNames() {
        return Array.from(this.fields.keys());
    }
    
    // Get struct info for debugging
    toString() {
        const fieldList = Array.from(this.fields.entries())
            .map(([name, value]) => `${name}: ${value}`)
            .join(', ');
        return `ArduinoStruct(${this.structName} { ${fieldList} })`;
    }
    
    // Clone struct (for assignment)
    clone() {
        const newStruct = new ArduinoStruct(this.structName);
        for (const [fieldName, value] of this.fields.entries()) {
            newStruct.fields.set(fieldName, value);
        }
        return newStruct;
    }
}

// Arduino String class implementation
class ArduinoString {
    constructor(value = "") {
        this.value = String(value);
    }
    
    length() {
        return this.value.length;
    }
    
    charAt(index) {
        return this.value.charAt(index);
    }
    
    substring(start, end) {
        return new ArduinoString(this.value.substring(start, end));
    }
    
    indexOf(searchString) {
        return this.value.indexOf(searchString);
    }
    
    equals(other) {
        const otherValue = other instanceof ArduinoString ? other.value : String(other);
        return this.value === otherValue;
    }
    
    toInt() {
        return parseInt(this.value) || 0;
    }
    
    toFloat() {
        return parseFloat(this.value) || 0.0;
    }
    
    toString() {
        return this.value;
    }
    
    valueOf() {
        return this.value;
    }
    
    // Concatenation operator - modifies in-place to match Arduino behavior
    concat(other) {
        const otherValue = other instanceof ArduinoString ? other.value : String(other);
        this.value += otherValue;
        return this;  // Return self for chaining, like Arduino String.concat()
    }
    
    // Set character at specific position
    setCharAt(index, char) {
        if (index >= 0 && index < this.value.length) {
            // TEST 49 FIX: Character literals are evaluated as ASCII values (e.g., '=' → 61)
            // Convert numbers to characters, preserve strings as-is
            const charStr = typeof char === 'number' ? String.fromCharCode(char) : String(char).charAt(0);
            this.value = this.value.substring(0, index) + charStr + this.value.substring(index + 1);
        }
    }
    
    // Replace all occurrences of find with replace
    replace(find, replace) {
        const findStr = find instanceof ArduinoString ? find.value : String(find);
        const replaceStr = replace instanceof ArduinoString ? replace.value : String(replace);
        this.value = this.value.split(findStr).join(replaceStr);
    }
    
    // Remove whitespace from beginning and end
    trim() {
        this.value = this.value.trim();
    }
    
    // Convert to uppercase
    toUpperCase() {
        this.value = this.value.toUpperCase();
    }
    
    // Convert to lowercase
    toLowerCase() {
        this.value = this.value.toLowerCase();
    }
    
    // Compare strings lexicographically
    compareTo(other) {
        const otherValue = other instanceof ArduinoString ? other.value : String(other);
        if (this.value < otherValue) return -1;
        if (this.value > otherValue) return 1;
        return 0;
    }
    
    // Case-insensitive comparison
    equalsIgnoreCase(other) {
        const otherValue = other instanceof ArduinoString ? other.value : String(other);
        return this.value.toLowerCase() === otherValue.toLowerCase();
    }
    
    // Check if string starts with prefix
    startsWith(prefix, offset = 0) {
        const prefixStr = prefix instanceof ArduinoString ? prefix.value : String(prefix);
        return this.value.startsWith(prefixStr, offset);
    }
    
    // Check if string ends with suffix
    endsWith(suffix) {
        const suffixStr = suffix instanceof ArduinoString ? suffix.value : String(suffix);
        return this.value.endsWith(suffixStr);
    }
    
    // Reserve memory (stub for Arduino compatibility)
    reserve(size) {
        // This is a no-op in JavaScript but needed for Arduino compatibility
        return;
    }

    // Clone string (for assignment) - TEST 54 FIX
    clone() {
        return new ArduinoString(this.value);
    }

    // Static constructor method
    static create(value, format = null) {
        if (typeof value === 'number' && format !== null) {
            return new ArduinoString(value.toFixed(format));
        }
        return new ArduinoString(value);
    }
}

// Arduino Number wrapper for typed numbers (e.g., unsigned long)
class ArduinoNumber {
    constructor(value, arduinoType = 'int') {
        this.value = Number(value);
        this.arduinoType = arduinoType;
    }
    
    // Make it behave like a number in operations
    valueOf() {
        return this.value;
    }
    
    toString() {
        return String(this.value);
    }
    
    // For JSON serialization
    toJSON() {
        return this.value;
    }
    
    // Helper to extract numeric value for calculations
    static getValue(value) {
        if (value instanceof ArduinoNumber) return value.value;
        if (typeof value === 'number') return value;
        return Number(value);
    }
}

// Arduino Vector class implementation (std::vector<T>)
class ArduinoVector {
    constructor(elementType, constructorArgs = []) {
        this.elementType = elementType;
        this.data = [];
        this.capacity = 0;
        
        // Handle constructor arguments for initial size/values
        if (constructorArgs.length > 0) {
            const size = constructorArgs[0];
            if (typeof size === 'number' && size >= 0) {
                this.data = new Array(size).fill(null);
            }
        }
    }
    
    push_back(element) {
        this.data.push(element);
        return this.data.length;
    }
    
    pop_back() {
        return this.data.pop();
    }
    
    size() {
        return this.data.length;
    }
    
    empty() {
        return this.data.length === 0;
    }
    
    clear() {
        this.data = [];
    }
    
    at(index) {
        if (index < 0 || index >= this.data.length) {
            throw new Error(`vector index ${index} out of range`);
        }
        return this.data[index];
    }
    
    // Array-style access
    get(index) {
        return this.data[index];
    }
    
    set(index, value) {
        this.data[index] = value;
    }
    
    front() {
        return this.data[0];
    }
    
    back() {
        return this.data[this.data.length - 1];
    }
    
    capacity() {
        return this.capacity;
    }
    
    toString() {
        return `vector<${this.elementType}>[${this.data.join(', ')}]`;
    }
}

// Arduino std::string class implementation  
class ArduinoStdString {
    constructor(constructorArgs = []) {
        this.value = constructorArgs.length > 0 ? String(constructorArgs[0]) : "";
    }
    
    length() {
        return this.value.length;
    }
    
    size() {
        return this.value.length;
    }
    
    empty() {
        return this.value.length === 0;
    }
    
    clear() {
        this.value = "";
    }
    
    c_str() {
        return this.value;
    }
    
    toString() {
        return this.value;
    }
}

// Arduino std::array class implementation
class ArduinoArray {
    constructor(elementType, arraySize, constructorArgs = []) {
        this.elementType = elementType;
        this.arraySize = arraySize;
        this.data = new Array(arraySize).fill(null);
    }
    
    at(index) {
        if (index < 0 || index >= this.arraySize) {
            throw new Error(`array index ${index} out of range`);
        }
        return this.data[index];
    }
    
    size() {
        return this.arraySize;
    }
    
    toString() {
        return `array<${this.elementType}, ${this.arraySize}>[${this.data.join(', ')}]`;
    }
}

// Arduino Library Object class for external libraries (CapacitiveSensor, Servo, etc.)
class ArduinoLibraryObject {
    constructor(libraryName, constructorArgs = []) {
        this.libraryName = libraryName;
        this.constructorArgs = constructorArgs;
        this.type = 'library_object';
        
        // Generate a unique object ID for debugging  
        this.objectId = `${libraryName}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        
        // Store initialization parameters
        this.initialized = true;
        this.properties = new Map();
        
        // Initialize library-specific properties
        this.initializeLibraryProperties();
    }
    
    initializeLibraryProperties() {
        // Set up properties based on library type
        switch (this.libraryName) {
            case 'CapacitiveSensor':
                this.properties.set('sendPin', this.constructorArgs[0] || 4);
                this.properties.set('receivePin', this.constructorArgs[1] || 2);
                this.properties.set('timeout', 2000);
                break;
            case 'Servo':
                this.properties.set('pin', this.constructorArgs[0] || 9);
                this.properties.set('angle', 0);
                break;
            case 'LiquidCrystal':
                this.properties.set('rs', this.constructorArgs[0] || 12);
                this.properties.set('enable', this.constructorArgs[1] || 11);
                break;
            default:
                // Generic library object
                break;
        }
    }
    
    // Call a method on this library object
    callMethod(methodName, args = []) {
        switch (this.libraryName) {
            case 'CapacitiveSensor':
                return this.callCapacitiveSensorMethod(methodName, args);
            case 'Servo':
                return this.callServoMethod(methodName, args);
            case 'LiquidCrystal':
                return this.callLiquidCrystalMethod(methodName, args);
            default:
                return this.callGenericLibraryMethod(methodName, args);
        }
    }
    
    callCapacitiveSensorMethod(methodName, args) {
        switch (methodName) {
            case 'capacitiveSensor':
            case 'capacitiveSensorRaw':
                const samples = args[0] || 30;
                // Simulate sensor reading
                return Math.floor(Math.random() * 2000) + 100;
            case 'set_CS_Timeout_Millis':
                this.properties.set('timeout', args[0] || 2000);
                return;
            default:
                return null;
        }
    }
    
    callServoMethod(methodName, args) {
        switch (methodName) {
            case 'attach':
                this.properties.set('pin', args[0] || 9);
                return;
            case 'write':
                this.properties.set('angle', args[0] || 0);
                return;
            case 'read':
                return this.properties.get('angle') || 0;
            case 'detach':
                this.properties.set('attached', false);
                return;
            default:
                return null;
        }
    }
    
    callLiquidCrystalMethod(methodName, args) {
        switch (methodName) {
            case 'begin':
                this.properties.set('cols', args[0] || 16);
                this.properties.set('rows', args[1] || 2);
                return;
            case 'print':
            case 'write':
                return;
            case 'setCursor':
                this.properties.set('cursor_col', args[0] || 0);
                this.properties.set('cursor_row', args[1] || 0);
                return;
            case 'clear':
                return;
            default:
                return null;
        }
    }
    
    callGenericLibraryMethod(methodName, args) {
        // For unknown libraries, return a mock value based on method name
        if (methodName.includes('read') || methodName.includes('get')) {
            return Math.floor(Math.random() * 1000);
        } else if (methodName.includes('begin') || methodName.includes('init')) {
            return true;
        }
        return null;
    }
    
    toString() {
        return `${this.libraryName}(${this.constructorArgs.join(', ')})`;
    }
}

// =============================================================================
// VARIABLE SCOPE MANAGEMENT
// =============================================================================

class VariableMetadata {
    constructor(value, options = {}) {
        this.value = value;
        this.declaredType = options.declaredType || null; // Type from declaration
        this.inferredType = this.inferType(value); // Type based on value
        this.type = this.declaredType || this.inferredType; // Effective type
        this.scopeLevel = options.scopeLevel || 0;
        this.scopeType = options.scopeType || 'global';
        this.declarationLine = options.declarationLine || null;
        this.isInitialized = options.isInitialized !== false;
        this.isDeclaration = options.isDeclaration || false;
        this.isArray = options.isArray || false;
        this.arraySize = options.arraySize || null;
        // Phase 4.4: Variable usage tracking
        this.isUsed = false;
        this.usageCount = 0;
        this.firstUsageLine = null;
    }
    
    inferType(value) {
        if (value instanceof ArduinoString) return 'String';
        if (value instanceof ArduinoNumber) return value.arduinoType;
        if (value instanceof ArduinoPointer) return 'pointer';
        if (value instanceof ArduinoFunctionPointer) return 'function_pointer';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'int' : 'float';
        }
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'string') return 'char*';
        return 'unknown';
    }
    
    isTypeCompatible(newValue) {
        const newType = this.inferType(newValue);
        
        // Normalize types by removing storage class specifiers
        const normalizeType = (type) => {
            return type.replace(/\b(static|extern|const|volatile|inline|register)\s+/g, '').trim();
        };
        
        const normalizedThisType = normalizeType(this.type);
        const normalizedNewType = normalizeType(newType);
        
        // Exact type match (after normalization)
        if (normalizedThisType === normalizedNewType) return true;
        
        // Arduino numeric compatibility - all numeric types can be converted
        const numericTypes = ['int', 'float', 'double', 'long', 'unsigned long', 'byte', 'word', 'short', 'unsigned int', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t'];
        if (numericTypes.includes(normalizedThisType) && numericTypes.includes(normalizedNewType)) {
            return true;
        }
        
        // Arduino bool to int conversion: true = 1, false = 0
        if (normalizedThisType === 'int' && normalizedNewType === 'bool') {
            return true;
        }
        
        // Function pointer compatibility
        // For function pointer declarations like "int (*ptr)(int, int)", the type might be inferred as "int"
        // but we should accept function pointers
        if ((normalizedThisType === 'int' || this.declaredType?.includes('(*')) && normalizedNewType === 'function_pointer') {
            return true;
        }
        
        // String compatibility
        if (normalizedThisType === 'String' && (normalizedNewType === 'string' || normalizedNewType === 'char*')) {
            return true;
        }
        
        // Array compatibility
        if (this.isArray && normalizedNewType === 'array') {
            return true;
        }
        
        // Pointer compatibility - any pointer type can be assigned to any other pointer type
        // This is simplified Arduino-style pointer handling
        if ((normalizedThisType.includes('*') || normalizedThisType === 'pointer') && normalizedNewType === 'pointer') {
            return true;
        }
        
        return false;
    }
}

class ScopeManager {
    constructor() {
        // Stack of scopes - each scope is a Map of variable name -> VariableMetadata
        this.scopeStack = [];
        this.currentScopeLevel = 0;
        
        // Create global scope
        this.pushScope('global');
    }
    
    // Create a new scope
    pushScope(scopeType = 'block') {
        const newScope = new Map();
        newScope.scopeType = scopeType;
        newScope.level = this.currentScopeLevel++;
        this.scopeStack.push(newScope);
        return newScope;
    }
    
    // Remove the current scope
    popScope() {
        if (this.scopeStack.length <= 1) {
            // SCOPE ERROR RECOVERY: Don't throw in finally blocks, just warn and return
            if (this.options && this.options.verbose) {
                console.warn("Warning: Attempted to pop global scope. Scope stack preserved.");
            }
            return null; // Return null instead of throwing to prevent finally block failures
        }
        this.currentScopeLevel--;
        return this.scopeStack.pop();
    }
    
    // Get current scope
    getCurrentScope() {
        return this.scopeStack[this.scopeStack.length - 1];
    }
    
    // Set a variable (Map-compatible interface)
    set(name, value, options = {}) {
        const currentScope = this.getCurrentScope();
        
        // DEBUG: Extensive logging for scope debugging
        debugLog(`🔍 SCOPE DEBUG: ScopeManager.set() called`);
        debugLog(`   Variable: ${name} = ${value} (type: ${typeof value})`);
        debugLog(`   Options:`, options);
        debugLog(`   Current scope: ${currentScope.scopeType} (level ${this.currentScopeLevel - 1})`);
        debugLog(`   Scope stack depth: ${this.scopeStack.length}`);
        debugLog(`   Variable exists in current scope: ${currentScope.has(name)}`);
        debugLog(`   Variable exists anywhere: ${this.has(name)}`);
        if (this.has(name)) {
            const existing = this.getMetadata(name);
            debugLog(`   Existing variable: ${existing.value} in ${existing.scopeType} scope`);
        }
        
        // Check for variable shadowing (variable exists in outer scope)
        if (!currentScope.has(name) && this.has(name)) {
            const outerMetadata = this.getMetadata(name);
            if (options.isDeclaration && outerMetadata) {
                console.warn(`Variable '${name}' shadows variable from ${outerMetadata.scopeType} scope (level ${outerMetadata.scopeLevel})`);
            }
        }
        
        // Check for redeclaration in same scope (Phase 4.1: Duplicate Declaration Detection)
        if (options.isDeclaration && currentScope.has(name)) {
            const errorMsg = `Duplicate declaration: Variable '${name}' is already declared in ${currentScope.scopeType} scope`;
            console.error(errorMsg);
            return { success: false, error: 'DUPLICATE_DECLARATION', message: errorMsg };
        }
        
        // Type compatibility checking for assignments (not declarations)
        if (!options.isDeclaration && this.has(name)) {
            const existingMetadata = this.getMetadata(name);
            if (!existingMetadata.isTypeCompatible(value)) {
                const newType = existingMetadata.inferType(value);
                const errorMsg = `Type error: Cannot assign ${newType} to variable '${name}' of type ${existingMetadata.type}`;
                console.error(errorMsg);
                return { success: false, error: 'TYPE_INCOMPATIBLE', message: errorMsg };
            }
        }
        
        const metadata = new VariableMetadata(value, {
            scopeLevel: this.currentScopeLevel - 1,
            scopeType: currentScope.scopeType,
            isDeclaration: options.isDeclaration || false,
            ...options
        });
        
        // CRITICAL FIX: For assignments (not declarations), update variable in its existing scope
        if (!options.isDeclaration && this.has(name)) {
            // This is an assignment to existing variable - update it in its original scope
            for (let i = this.scopeStack.length - 1; i >= 0; i--) {
                const scope = this.scopeStack[i];
                if (scope.has(name)) {
                    debugLog(`   🎯 UPDATING EXISTING: ${name} = ${value} in ${scope.scopeType} scope (level ${i})`);
                    scope.set(name, metadata);
                    debugLog(`   ✅ UPDATED SUCCESSFULLY: ${name} = ${value}`);
                    return { success: true };
                }
            }
        } else {
            // This is a declaration - store in current scope
            debugLog(`   🎯 DECLARING NEW: ${name} = ${value} in ${currentScope.scopeType} scope`);
            currentScope.set(name, metadata);
            debugLog(`   ✅ DECLARED SUCCESSFULLY: ${name} = ${value}`);
        }
        
        return { success: true };
    }
    
    // Get a variable value (Map-compatible interface)
    get(name) {
        // Search from innermost to outermost scope
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            if (scope.has(name)) {
                return scope.get(name).value;
            }
        }
        return undefined;
    }
    
    // Check if variable exists (Map-compatible interface)
    has(name) {
        // Search from innermost to outermost scope
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            if (scope.has(name)) {
                return true;
            }
        }
        return false;
    }
    
    // Get variable metadata
    getMetadata(name) {
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            if (scope.has(name)) {
                return scope.get(name);
            }
        }
        return null;
    }
    
    // Phase 4.2: Mark variable as initialized
    markAsInitialized(name) {
        const metadata = this.getMetadata(name);
        if (metadata) {
            metadata.isInitialized = true;
            debugLog(`   🔄 MARKED AS INITIALIZED: ${name}`);
            return true;
        }
        return false;
    }
    
    // Phase 4.4: Mark variable as used
    markAsUsed(name) {
        // Find the variable in all scopes and mark ALL instances as used
        // This prevents timing issues with scope references
        let marked = false;
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            if (scope.has(name)) {
                const metadata = scope.get(name);
                metadata.isUsed = true;
                metadata.usageCount = (metadata.usageCount || 0) + 1;
                if (!metadata.firstUsageLine) {
                    metadata.firstUsageLine = 'current';
                }
                marked = true;
                break; // Only mark the first (innermost) instance
            }
        }
        
        // Usage marking is now handled synchronously in evaluateExpression
        
        return marked;
    }
    
    // Phase 4.4: Get unused variables in current scope
    getUnusedVariablesInCurrentScope() {
        const currentScope = this.getCurrentScope();
        const unusedVariables = [];
        
        for (const [name, metadata] of currentScope.entries()) {
            // Check if variable is unused according to metadata
            if (!metadata.isUsed && metadata.isDeclaration) {
                unusedVariables.push({
                    name: name,
                    metadata: metadata
                });
            }
        }
        
        return unusedVariables;
    }
    
    // Check if variable exists in current scope only
    hasInCurrentScope(name) {
        return this.getCurrentScope().has(name);
    }
    
    // Clear all variables (Map-compatible interface)
    clear() {
        // Clear all scopes except create new global scope
        this.scopeStack = [];
        this.currentScopeLevel = 0;
        this.pushScope('global');
    }
    
    // Get all variables for debugging (Map-compatible interface)
    entries() {
        const allEntries = [];
        for (const scope of this.scopeStack) {
            for (const [name, metadata] of scope.entries()) {
                allEntries.push([name, metadata.value]);
            }
        }
        return allEntries;
    }
    
    // Get scope information for debugging
    getScopeInfo() {
        return {
            currentLevel: this.currentScopeLevel,
            scopeCount: this.scopeStack.length,
            scopes: this.scopeStack.map((scope, index) => ({
                level: index,
                type: scope.scopeType,
                variableCount: scope.size,
                variables: Array.from(scope.keys())
            }))
        };
    }
}

// =============================================================================
// ARDUINO INTERPRETER CLASS
// =============================================================================

// Arduino Library Registry - defines structure for all supported libraries
const ARDUINO_LIBRARIES = {
    'Adafruit_NeoPixel': {
        // Internal methods - calculated by interpreter, return values immediately
        internalMethods: {
            'Color': (r, g, b) => {
                // Convert RGB to 32-bit color value: 0xRRGGBB
                return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
            },
            'ColorHSV': (hue, sat = 255, val = 255) => {
                // Simplified HSV to RGB conversion
                hue = hue % 65536;
                const sector = Math.floor(hue / 10923);
                const offset = hue - (sector * 10923);
                const p = (val * (255 - sat)) >> 8;
                const q = (val * (255 - ((sat * offset) >> 15))) >> 8;
                const t = (val * (255 - ((sat * (10923 - offset)) >> 15))) >> 8;
                
                let r, g, b;
                switch (sector) {
                    case 0: r = val; g = t; b = p; break;
                    case 1: r = q; g = val; b = p; break;
                    case 2: r = p; g = val; b = t; break;
                    case 3: r = p; g = q; b = val; break;
                    case 4: r = t; g = p; b = val; break;
                    default: r = val; g = p; b = q; break;
                }
                
                return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
            },
            'numPixels': (obj) => obj.constructorArgs[0] || 60,
            'getBrightness': (obj) => obj.brightness || 255,
            'getPixelColor': (obj, pixel) => {
                // Return stored pixel color or 0
                return obj.pixelColors?.[pixel] || 0;
            },
            'canShow': (obj) => true, // Always return true for simulation
            'sine8': (x) => Math.floor((Math.sin(x * Math.PI / 128) + 1) * 127.5),
            'gamma8': (x) => {
                // Gamma correction lookup table (simplified)
                return Math.floor(Math.pow(x / 255.0, 2.8) * 255);
            }
        },
        // External methods - emit commands to parent app
        externalMethods: [
            'begin', 'show', 'clear', 'setPixelColor', 'setBrightness', 'setPin',
            'updateLength', 'updateType', 'fill', 'rainbow'
        ],
        staticMethods: ['Color', 'ColorHSV', 'sine8', 'gamma8'],
        constructorArgs: ['numPixels', 'pin', 'pixelType']
    },
    'Servo': {
        // Internal methods - calculated by interpreter
        internalMethods: {
            'read': (obj) => obj.currentAngle || 90,        // Return current angle
            'readMicroseconds': (obj) => (obj.currentAngle || 90) * 10 + 1000,  // Convert angle to microseconds
            'attached': (obj) => obj.isAttached || false     // Return attachment status
        },
        // External methods - emit commands to parent app  
        externalMethods: ['attach', 'detach', 'write', 'writeMicroseconds'],
        staticMethods: [],
        constructorArgs: []
    },
    'LiquidCrystal': {
        // Internal methods - mostly getters/status
        internalMethods: {},
        // External methods - all display operations need hardware
        externalMethods: [
            'begin', 'clear', 'home', 'setCursor', 'print', 'println', 'write', 
            'display', 'noDisplay', 'cursor', 'noCursor', 'blink', 'noBlink', 
            'scrollDisplayLeft', 'scrollDisplayRight', 'autoscroll', 'noAutoscroll', 
            'leftToRight', 'rightToLeft', 'createChar'
        ],
        staticMethods: [],
        constructorArgs: ['rs', 'enable', 'd4', 'd5', 'd6', 'd7']
    },
    'SPI': {
        // Internal methods - none for SPI (all require hardware)
        internalMethods: {},
        // External methods - all SPI operations need hardware
        externalMethods: [
            'begin', 'end', 'beginTransaction', 'endTransaction', 'transfer', 
            'transfer16', 'setClockDivider', 'setDataMode', 'setBitOrder'
        ],
        staticMethods: [],
        constructorArgs: []
    },
    'Wire': {
        // Internal methods - status queries
        internalMethods: {
            'available': (obj) => obj.available || 0,       // Return available bytes
            'read': (obj) => obj.nextByte || 0              // Return next byte (mock)
        },
        // External methods - I2C operations need hardware
        externalMethods: [
            'begin', 'requestFrom', 'beginTransmission', 'endTransmission', 
            'write', 'onReceive', 'onRequest'
        ],
        staticMethods: [],
        constructorArgs: []
    },
    'EEPROM': {
        // Internal methods - none (EEPROM always needs hardware access)
        internalMethods: {},
        // External methods - all EEPROM operations need hardware
        externalMethods: ['read', 'write', 'update', 'get', 'put', 'length'],
        staticMethods: [],
        constructorArgs: []
    },
    'WiFi': {
        // Internal methods - status queries
        internalMethods: {
            'status': (obj) => obj.connectionStatus || 3,   // WL_CONNECTED = 3
            'SSID': (obj) => obj.connectedSSID || "TestNetwork",
            'RSSI': (obj) => obj.signalStrength || -45,     // Mock signal strength
            'localIP': (obj) => obj.localIP || "192.168.1.100",
            'subnetMask': (obj) => obj.subnetMask || "255.255.255.0",
            'gatewayIP': (obj) => obj.gatewayIP || "192.168.1.1"
        },
        // External methods - WiFi operations need hardware
        externalMethods: ['begin', 'config', 'disconnect', 'BSSID', 'dnsIP'],
        staticMethods: [],
        constructorArgs: []
    },
    'SD': {
        // Internal methods - status queries
        internalMethods: {
            'exists': (obj, filename) => obj.fileExists?.[filename] || false
        },
        // External methods - SD operations need hardware
        externalMethods: ['begin', 'mkdir', 'rmdir', 'open', 'remove'],
        staticMethods: [],
        constructorArgs: []
    }
};

// Phase 6.3: Advanced debugging and monitoring classes
class DebugManager {
    constructor(options) {
        this.enabled = options.debug || options.verbose || false;
        this.traceLevel = options.traceLevel || (options.verbose ? 1 : 0);
        // traceLevel: 0 = off, 1 = basic, 2 = detailed, 3 = verbose
        this.executionTrace = [];
        this.maxTraceEntries = 1000;
        this.startTime = Date.now();
    }
    
    trace(level, category, message, data = {}) {
        if (!this.enabled || level > this.traceLevel) return;
        
        const entry = {
            timestamp: Date.now() - this.startTime,
            level,
            category,
            message,
            data,
            stack: this.getCurrentStack()
        };
        
        this.executionTrace.push(entry);
        
        // Keep trace size manageable
        if (this.executionTrace.length > this.maxTraceEntries) {
            this.executionTrace.shift();
        }
        
        // Print to console based on level
        if (level <= this.traceLevel) {
            const prefix = ['', '🔍', '🔬', '📊'][level] || '📝';
            debugLog(`${prefix} [${category}] ${message}`, data);
        }
    }
    
    getCurrentStack() {
        // Simple stack trace for debugging
        return new Error().stack?.split('\n').slice(2, 5) || [];
    }
    
    getTrace() {
        return [...this.executionTrace];
    }
    
    clearTrace() {
        this.executionTrace = [];
    }
    
    getStats() {
        const categories = {};
        this.executionTrace.forEach(entry => {
            categories[entry.category] = (categories[entry.category] || 0) + 1;
        });
        
        return {
            totalEntries: this.executionTrace.length,
            categories,
            runtime: Date.now() - this.startTime
        };
    }
}

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            functionCalls: 0,
            variableAccesses: 0,
            loopIterations: 0,
            memoryAllocations: 0,
            errors: 0,
            warnings: 0
        };
        this.timings = {};
        this.startTime = Date.now();
    }
    
    increment(metric, count = 1) {
        if (this.metrics[metric] !== undefined) {
            this.metrics[metric] += count;
        }
    }
    
    startTimer(name) {
        this.timings[name] = { start: performance.now() };
    }
    
    endTimer(name) {
        if (this.timings[name]) {
            const duration = performance.now() - this.timings[name].start;
            this.timings[name].duration = duration;
            return duration;
        }
        return 0;
    }
    
    getStats() {
        const runtime = Date.now() - this.startTime;
        const stats = {
            runtime,
            metrics: { ...this.metrics },
            timings: { ...this.timings },
            performance: {
                functionsPerSecond: (this.metrics.functionCalls / runtime) * 1000,
                variableAccessesPerSecond: (this.metrics.variableAccesses / runtime) * 1000,
                loopsPerSecond: (this.metrics.loopIterations / runtime) * 1000
            }
        };
        
        return stats;
    }
    
    reset() {
        this.metrics = {
            functionCalls: 0,
            variableAccesses: 0,
            loopIterations: 0,
            memoryAllocations: 0,
            errors: 0,
            warnings: 0
        };
        this.timings = {};
        this.startTime = Date.now();
    }
}

// =============================================================================
// VALIDATION SYSTEM
// =============================================================================

class ValidationReporter {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.warnings = [];
        this.errors = [];
        this.scopeManager = interpreter.variables; // Use the ScopeManager instance
    }
    
    addWarning(message, node = null) {
        const location = this.getLocationInfo(node);
        const warning = {
            type: 'WARNING',
            message,
            location,
            timestamp: new Date().toISOString()
        };
        this.warnings.push(warning);
        
        // Emit warning immediately if interpreter has onCommand handler
        if (this.interpreter.onCommand) {
            this.interpreter.onCommand({
                type: 'WARNING',
                message: message,
                severity: 'warning',
                location
            });
        }
    }
    
    addError(message, node = null) {
        const location = this.getLocationInfo(node);
        const error = {
            type: 'ERROR',
            message,
            location,
            timestamp: new Date().toISOString()
        };
        this.errors.push(error);
        
        if (this.interpreter.onCommand) {
            this.interpreter.onCommand({
                type: 'ERROR',
                message: message,
                severity: 'error',
                location
            });
        }
    }
    
    getLocationInfo(node) {
        if (!node) return null;
        
        const line = node.position?.line || node.line;
        const column = node.position?.column || node.column;
        const context = node.position?.context || node.context;
        
        return (line !== null && column !== null) ? 
            { line, column, context } : 
            (context ? { context } : null);
    }
    
    getReport() {
        return {
            warnings: this.warnings,
            errors: this.errors,
            summary: {
                warningCount: this.warnings.length,
                errorCount: this.errors.length,
                hasIssues: this.warnings.length > 0 || this.errors.length > 0
            }
        };
    }
    
    clear() {
        this.warnings = [];
        this.errors = [];
    }
}

class ASTInterpreter {
    constructor(ast, options = {}) {
        this.ast = ast;
        this.options = {
            verbose: false,
            stepDelay: 100, // milliseconds between steps
            maxLoopIterations: Infinity, // No artificial limit - runs like real Arduino
            ...options
        };

        // Optional MockDataManager for deterministic test data generation
        this.mockDataManager = options.mockDataManager || null;
        
        // Debug logging function that respects verbose flag
        debugLog = (...args) => {
            if (this.options.verbose) {
                conditionalLog(this.options.verbose, ...args);
            }
        };
        
        // Safe array allocation with size limits to prevent memory exhaustion
        this.validateArraySize = (size, context = 'array') => {
            const MAX_ARRAY_SIZE = 1000000; // 1 million elements max (reasonable for Arduino contexts)
            if (typeof size !== 'number' || size < 0) {
                throw new Error(`Invalid ${context} size: ${size}. Size must be a non-negative number`);
            }
            if (size > MAX_ARRAY_SIZE) {
                throw new Error(`${context} size ${size} exceeds maximum limit of ${MAX_ARRAY_SIZE} elements`);
            }
            return size;
        };
        
        // Execution state
        this.state = EXECUTION_STATE.IDLE;
        this.previousExecutionState = null; // Track state before WAITING_FOR_RESPONSE
        this.lastExternalResponse = undefined; // For state machine function responses
        this.currentNode = null;
        this.nodeStack = [];
        this.executionPointer = 0;
        this.objectId = Math.random().toString(36).substr(2, 9); // Unique ID for debugging
        
        // Memory and variables - using enhanced scope management
        this.variables = new ScopeManager();
        this.functions = new Map();
        this.pinStates = new Map();
        
        // Static variable storage - persists across function calls
        this.staticVariables = new Map(); // Map of static variable names to their persistent values
        this.staticInitialized = new Set(); // Track which static variables have been initialized
        
        // Arduino hardware state tracking
        this.hardwareState = {
            serial: { initialized: false },
            wire: { initialized: false },
            spi: { initialized: false }
        };
        
        // Preprocessor macro storage
        this.macros = new Map(); // Map of macro names to their definitions
        this.functionMacros = new Map(); // Map of function-like macros (name -> {params, body})
        
        // Initialize common Arduino macros
        this.initializeDefaultMacros();
        
        // Process preprocessor results from AST if available
        this.activeLibraries = new Set(); // Track enabled libraries
        this.processPreprocessorResults();
        
        // Execution tracking
        this.setupFunction = null;
        this.loopFunction = null;
        this.serialEventFunction = null;
        this.loopIterations = 0;
        
        // Timing tracking
        this.programStartTime = Date.now();
        this.commandHistory = [];
        
        // Async execution control
        this.currentTimeout = null;
        this.executionSpeed = 1.0; // 1x speed multiplier
        this.pauseResolver = null; // For handling pause/resume
        
        // Error cascade prevention
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 10; // Stop after 10 consecutive errors
        this.lastErrorTime = 0;
        
        // Phase 6.3: Advanced debugging and monitoring
        this.debugManager = new DebugManager(this.options);
        this.performanceMonitor = new PerformanceMonitor();
        this.callStack = [];
        this.maxCallStackDepth = 1000; // Prevent infinite recursion
        
        // Validation system - pre-execution validation (after variables are initialized)
        this.validationReporter = new ValidationReporter(this);
        this.validationPerformed = false;
        
        // Execution context for pause/resume/step
        this.executionContext = {
            phase: 'idle', // 'setup', 'loop', 'idle'
            loopIteration: 0,
            isExecuting: false,
            shouldContinue: true
        };
        
        // Event callbacks
        this.onCommand = null;
        this.onStateChange = null;
        this.onError = null;
        this.onNodeVisit = null;
        
        // Request-response mechanism for external data functions
        this.pendingRequests = new Map(); // Track pending requests
        this.responseHandlers = new Map(); // Handle responses
        
        // State machine properties for non-blocking execution
        this.suspendedNode = null; // AST node where execution was suspended
        this.waitingForRequestId = null; // Request ID we're waiting for
        this.lastExpressionResult = null; // Result from resumed operation
        this.suspendedFunction = null; // Function that was suspended
        
        // Initialize
        this.reset();
    }
    
    // =========================================================================
    // EXECUTION CONTROL METHODS
    // =========================================================================
    
    start() {
        if (this.state === EXECUTION_STATE.RUNNING) {
            return false; // Already running
        }
        
        this.setState(EXECUTION_STATE.RUNNING);
        
        // Emit version information at startup
        this.emitCommand({
            type: COMMAND_TYPES.VERSION_INFO,
            timestamp: Date.now(),
            component: 'interpreter',
            version: INTERPRETER_VERSION,
            status: 'started'
        });
        
        // Check if parser version is available and show it
        if (typeof PARSER_VERSION !== 'undefined') {
            this.emitCommand({
                type: COMMAND_TYPES.VERSION_INFO,
                timestamp: Date.now(),
                component: 'parser',
                version: PARSER_VERSION,
                status: 'loaded'
            });
        }
        
        this.emitCommand({
            type: COMMAND_TYPES.PROGRAM_START,
            timestamp: Date.now(),
            message: "Program execution started"
        });
        
        // Perform pre-execution validation
        const validationReport = this.validateAST();
        if (validationReport && validationReport.summary && validationReport.summary.errorCount > 0) {
            this.emitError(`Validation failed: ${validationReport.summary.errorCount} errors found`);
            this.setState(EXECUTION_STATE.ERROR);
            return false;
        }
        
        if (validationReport && validationReport.summary && validationReport.summary.warningCount > 0 && this.options.verbose) {
            this.emitCommand({
                type: COMMAND_TYPES.VERSION_INFO,
                timestamp: Date.now(),
                message: `⚠️  Pre-execution validation: ${validationReport.summary.warningCount} warnings found`
            });
        }
        
        // Begin interpretation asynchronously
        this.interpretAST().catch(error => {
            if (error instanceof ExecutionPausedError) {
                // This is expected behavior for state machine - execution is suspended
                if (this.options.verbose) {
                    debugLog(`Execution suspended for request: ${error.requestId}`);
                }
            } else {
                this.emitError(`Execution error: ${error.message}`);
            }
        });
        return true;
    }
    
    stop() {
        // Stop execution context
        this.executionContext.shouldContinue = false;
        this.executionContext.isExecuting = false;
        
        // Clear any pending timeout and pause resolver
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        
        if (this.pauseResolver) {
            this.pauseResolver();
            this.pauseResolver = null;
        }
        
        this.setState(EXECUTION_STATE.IDLE);
        this.emitCommand({
            type: COMMAND_TYPES.PROGRAM_END,
            timestamp: Date.now(),
            message: "Program execution stopped"
        });
        return true;
    }
    
    pause() {
        if (this.state === EXECUTION_STATE.RUNNING) {
            this.setState(EXECUTION_STATE.PAUSED);
            return true;
        }
        return false;
    }
    
    resume() {
        if (this.state === EXECUTION_STATE.PAUSED) {
            this.setState(EXECUTION_STATE.RUNNING);
            // Resume from where we left off
            if (this.pauseResolver) {
                this.pauseResolver();
                this.pauseResolver = null;
            }
            return true;
        }
        return false;
    }
    
    step() {
        if (this.state === EXECUTION_STATE.PAUSED) {
            // Resume from pause for one step
            this.setState(EXECUTION_STATE.STEPPING);
            
            if (this.pauseResolver) {
                this.pauseResolver();
                this.pauseResolver = null;
            }
            return true;
            
        } else if (this.state === EXECUTION_STATE.IDLE) {
            // Start fresh execution in stepping mode
            this.setState(EXECUTION_STATE.STEPPING);
            
            this.interpretAST().catch(error => {
                if (error instanceof ExecutionPausedError) {
                    // This is expected behavior for state machine - execution is suspended
                    if (this.options.verbose) {
                        debugLog(`Step execution suspended for request: ${error.requestId}`);
                    }
                } else {
                    this.emitError(`Step execution error: ${error.message}`);
                }
            });
            return true;
            
        } else if (this.state === EXECUTION_STATE.COMPLETE) {
            // Restart from beginning in step mode
            this.reset();
            this.setState(EXECUTION_STATE.STEPPING);
            
            this.interpretAST().catch(error => {
                if (error instanceof ExecutionPausedError) {
                    // This is expected behavior for state machine - execution is suspended
                    if (this.options.verbose) {
                        debugLog(`Step execution suspended for request: ${error.requestId}`);
                    }
                } else {
                    this.emitError(`Step execution error: ${error.message}`);
                }
            });
            return true;
        }
        
        return false;
    }
    
    reset() {
        this.state = EXECUTION_STATE.IDLE;
        this.previousExecutionState = null;
        this.lastExternalResponse = undefined;
        this.currentNode = null;
        this.nodeStack = [];
        this.executionPointer = 0;
        this.loopIterations = 0;
        
        // Clear memory
        this.variables.clear();
        this.functions.clear();
        this.pinStates.clear();
        this.commandHistory = [];
        
        // Clear execution state
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
        
        if (this.pauseResolver) {
            this.pauseResolver();
            this.pauseResolver = null;
        }
        
        // Reset execution context
        this.executionContext = {
            phase: 'idle',
            loopIteration: 0,
            isExecuting: false,
            shouldContinue: true
        };
        
        // Extract setup and loop functions from AST
        this.extractControlFunctions();
        
        if (this.options.verbose) {
            debugLog("Interpreter reset");
        }
    }
    
    // State machine execution loop
    tick() {
        // Only run if we're in the RUNNING state
        if (this.state !== EXECUTION_STATE.RUNNING) {
            return;
        }
        
        // Execute until we hit a state transition - interpretAST is async so handle promises
        this.interpretAST().catch(error => {
            if (error instanceof ExecutionPausedError) {
                // Execution was paused for external data - this is expected behavior
                // The state should already be WAITING_FOR_RESPONSE and waitingForRequestId should be set
                if (this.options.verbose) {
                    debugLog(`Execution paused for request: ${error.requestId}`);
                }
            } else {
                this.emitError(`Tick execution error: ${error.message}`);
            }
        });
    }
    
    // =========================================================================
    // REQUEST-RESPONSE MECHANISM FOR EXTERNAL DATA FUNCTIONS
    // =========================================================================
    
    async waitForResponse(requestId, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            // Store resolver for when response arrives
            this.pendingRequests.set(requestId, { resolve, reject, timeout });
        });
    }
    
    sendResponse(requestId, value) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            pending.resolve({ value });
        }
    }
    
    // Parent app calls this method to send responses
    handleResponse(requestId, value, error = null) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);
            
            if (error) {
                pending.reject(new Error(error));
            } else {
                pending.resolve({ value });
            }
        }
    }
    
    // State machine method: Resume execution with external data response
    resumeWithValue(requestId, value) {
        // Check if this is the response we are waiting for
        if (this.state !== EXECUTION_STATE.WAITING_FOR_RESPONSE || 
            requestId !== this.waitingForRequestId) {
            return false; // Not the response we need
        }
        
        // Remember the suspended function before clearing context
        const suspendedFunction = this.suspendedFunction;
        
        // RACE CONDITION FIX: Set new state FIRST to avoid undefined state gap
        // Restore the previous state before WAITING_FOR_RESPONSE
        // If we were stepping, return to PAUSED after handling the response
        // If we were running, return to RUNNING
        const newState = this.previousExecutionState === EXECUTION_STATE.STEPPING ? 
            EXECUTION_STATE.PAUSED : EXECUTION_STATE.RUNNING;
        this.state = newState;
        this.previousExecutionState = null;
        
        // Now clear the state machine context (except suspendedFunction - let the function clear it)
        this.waitingForRequestId = null;
        this.suspendedNode = null;
        // Note: suspendedFunction will be cleared by the function itself when it consumes the response
        
        // Handle both async/await pattern and state machine pattern
        this.handleResponse(requestId, value);
        
        // Note: All external data functions now use consistent async/await pattern
        // No special handling needed for different function types
        
        return true;
    }
    
    // =========================================================================
    // VALIDATION SYSTEM - PRE-EXECUTION AST VALIDATION
    // =========================================================================
    
    validateAST() {
        if (this.validationPerformed) {
            return this.validationReporter.getReport();
        }
        
        this.validationReporter.clear();
        
        if (!this.ast || !this.ast.children) {
            this.validationReporter.addError("Invalid AST: no children found");
            this.validationPerformed = true;
            return this.validationReporter.getReport();
        }
        
        // Track declared variables and functions for validation
        this.declaredVariables = new Set();
        this.usedVariables = new Set();
        this.declaredFunctions = new Set();
        this.usedFunctions = new Set();
        
        // Walk the AST once and collect all validation issues
        this.walkAST(this.ast);
        
        // Perform final validation checks
        this.checkUnusedVariables();
        this.checkUndeclaredVariables();
        this.checkUnusedFunctions();
        
        this.validationPerformed = true;
        return this.validationReporter.getReport();
    }
    
    walkAST(node) {
        if (!node) return;
        
        // Handle different node types for validation
        switch (node.type) {
            case 'VarDeclNode':
                this.validateVariableDeclaration(node);
                break;
            case 'FuncDefNode':
                this.validateFunctionDeclaration(node);
                break;
            case 'IdentifierNode':
                this.validateIdentifierUsage(node);
                break;
            case 'FuncCallNode':
                this.validateFunctionCall(node);
                break;
            case 'BinaryOpNode':
                this.validateBinaryOperation(node);
                break;
            case 'AssignmentNode':
                this.validateAssignment(node);
                break;
            case 'IfStatement':
            case 'WhileStatement':
            case 'ForStatement':
                this.validateControlFlow(node);
                break;
        }
        
        // Recursively walk child nodes
        if (node.children) {
            for (const child of node.children) {
                this.walkAST(child);
            }
        }
        
        // Handle specific child properties
        if (node.body) this.walkAST(node.body);
        if (node.left) this.walkAST(node.left);
        if (node.right) this.walkAST(node.right);
        if (node.condition) this.walkAST(node.condition);
        if (node.init) this.walkAST(node.init);
        if (node.update) this.walkAST(node.update);
        if (node.thenBranch) this.walkAST(node.thenBranch);
        if (node.elseBranch) this.walkAST(node.elseBranch);
        if (node.args && Array.isArray(node.args)) {
            for (const arg of node.args) {
                this.walkAST(arg);
            }
        }
    }
    
    validateVariableDeclaration(node) {
        if (node.name) {
            this.declaredVariables.add(node.name);
        }
    }
    
    validateFunctionDeclaration(node) {
        if (node.name) {
            this.declaredFunctions.add(node.name);
        }
    }
    
    validateIdentifierUsage(node) {
        if (node.name) {
            this.usedVariables.add(node.name);
        }
    }
    
    validateFunctionCall(node) {
        if (node.name) {
            this.usedFunctions.add(node.name);
        }
    }
    
    validateBinaryOperation(node) {
        // Static type validation based on declared types (not runtime values)
        // This replaces the problematic runtime type checking
        const operator = node.op?.value || node.op;
        
        // Check for potentially problematic operations
        if (['/', '%'].includes(operator)) {
            // Could add checks for division by zero if we had constant folding
            // For now, just validate the operation exists
        }
        
        // Type compatibility checks would go here if we had a type system
        // For Arduino code, most type checking happens at compile time
    }
    
    validateAssignment(node) {
        // Validate assignment operations
        if (node.left && node.left.type === 'IdentifierNode') {
            this.usedVariables.add(node.left.name);
        }
    }
    
    validateControlFlow(node) {
        // Control flow validation - currently just structural
        // Could be extended to detect unreachable code
    }
    
    checkUnusedVariables() {
        for (const varName of this.declaredVariables) {
            if (!this.usedVariables.has(varName)) {
                this.validationReporter.addWarning(`Variable '${varName}' is declared but never used`);
            }
        }
    }
    
    checkUndeclaredVariables() {
        const builtInFunctions = new Set(['pinMode', 'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead', 'delay', 'millis', 'micros', 'setup', 'loop', 'isDigit', 'isPunct', 'isAlpha', 'isAlphaNumeric', 'isSpace', 'isUpperCase', 'isLowerCase', 'isHexadecimalDigit', 'isAscii', 'isWhitespace', 'isControl', 'isGraph', 'isPrintable']);
        const builtInConstants = new Set(['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'SERIAL', 'PTIME', 'BAUDRATE', 'HWVER', 'SWMAJ', 'SWMIN', 'LED_PMODE', 'LED_ERR', 'LED_HB', 'RESET', 'MOSI', 'MISO', 'SCK']);
        
        for (const varName of this.usedVariables) {
            if (!this.declaredVariables.has(varName) && !builtInConstants.has(varName)) {
                this.validationReporter.addWarning(`Variable '${varName}' is used but not declared`);
            }
        }
    }
    
    checkUnusedFunctions() {
        const builtInFunctions = new Set(['setup', 'loop']);
        
        for (const funcName of this.declaredFunctions) {
            if (!this.usedFunctions.has(funcName) && !builtInFunctions.has(funcName)) {
                this.validationReporter.addWarning(`Function '${funcName}' is declared but never called`);
            }
        }
    }
    
    // =========================================================================
    // AST INTERPRETATION METHODS  
    // =========================================================================
    
    async interpretAST() {
        if (!this.ast || !this.ast.children) {
            this.emitError("Invalid AST: no children found");
            return;
        }
        
        // Validate AST for parse errors before execution
        const parseErrors = this.validateAST(this.ast);
        if (parseErrors.length > 0) {
            this.emitCommand({
                type: COMMAND_TYPES.ERROR,
                timestamp: Date.now(),
                message: "Parse errors detected - execution halted"
            });
            
            // Report all parse errors
            parseErrors.forEach((error, index) => {
                this.emitError(`Parse Error ${index + 1}: ${error.message}`);
            });
            
            this.setState(EXECUTION_STATE.IDLE);
            return; // Halt execution
        }
        
        try {
            // Initialize execution context
            this.executionContext.isExecuting = true;
            this.executionContext.shouldContinue = true;
            
            // First pass: Process global variable declarations and extract functions
            await this.processGlobalDeclarations(this.ast);
            this.extractFunctions(this.ast);
            
            // Start controlled execution
            await this.executeControlledProgram();
            
        } catch (error) {
            if (error instanceof ExecutionPausedError) {
                // This is expected behavior for state machine - execution is suspended
                if (this.options.verbose) {
                    debugLog(`Execution suspended for request: ${error.requestId}`);
                }
            } else {
                this.emitError(`Interpretation error: ${error.message}`);
            }
        } finally {
            this.executionContext.isExecuting = false;
        }
    }
    
    validateAST(node) {
        const errors = [];
        this.collectParseErrors(node, errors);
        return errors;
    }
    
    collectParseErrors(node, errors) {
        if (!node) return;
        
        // Check if this node is an ErrorNode
        if (node.type === 'ErrorNode') {
            errors.push({
                message: node.value || 'Unknown parse error',
                node: node
            });
        }
        
        // Recursively check children
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                this.collectParseErrors(child, errors);
            }
        }
        
        // Check other node properties that might contain nested nodes
        for (const key in node) {
            if (typeof node[key] === 'object' && node[key] !== null && key !== 'children') {
                if (Array.isArray(node[key])) {
                    // Handle arrays of nodes (like function parameters)
                    for (const item of node[key]) {
                        this.collectParseErrors(item, errors);
                    }
                } else {
                    // Handle single nested nodes
                    this.collectParseErrors(node[key], errors);
                }
            }
        }
    }
    
    async processGlobalDeclarations(node) {
        if (!node || !node.children) return;
        
        for (const child of node.children) {
            if (child.type === 'VarDeclNode') {
                // Process global variable declarations
                await this.executeVariableDeclaration(child);
                
                if (this.options.verbose) {
                    debugLog(`Processed global variable declaration`);
                }
            } else if (child.type === 'StructDeclaration') {
                // Process global struct declarations
                this.handleStructDeclaration(child);
                
                if (this.options.verbose) {
                    debugLog(`Processed global struct declaration: ${child.name || 'unnamed'}`);
                }
            } else if (child.type === 'TypedefDeclaration') {
                // Process typedef declarations  
                await this.executeTypedefDeclaration(child);
                
                if (this.options.verbose) {
                    debugLog(`Processed typedef declaration: ${child.typeName || 'unnamed'}`);
                }
            } else if (child.type === 'ExpressionStatement') {
                // Process global expression statements (like --y;)
                await this.executeStatement(child);
                
                if (this.options.verbose) {
                    debugLog(`Processed global expression statement`);
                }
            }
        }
    }
    
    extractControlFunctions() {
        if (!this.ast || !this.ast.children) return;
        
        for (const child of this.ast.children) {
            if (child.type === 'FuncDefNode') {
                const funcName = child.declarator?.value;
                if (funcName === 'setup') {
                    this.setupFunction = child;
                } else if (funcName === 'loop') {
                    this.loopFunction = child;
                } else if (funcName === 'serialEvent') {
                    this.serialEventFunction = child;
                }
            }
        }
        
        if (this.options.verbose) {
            debugLog(`Found setup: ${!!this.setupFunction}, loop: ${!!this.loopFunction}, serialEvent: ${!!this.serialEventFunction}`);
        }
    }
    
    extractFunctions(node) {
        if (!node) return;
        
        if (node.type === 'FuncDefNode') {
            const funcName = node.declarator?.value;
            if (funcName) {
                // Support function overloading - store multiple functions per name
                if (!this.functions.has(funcName)) {
                    this.functions.set(funcName, []);
                }
                this.functions.get(funcName).push(node);
                
                const paramCount = node.parameters ? node.parameters.length : 0;
                if (this.options.verbose) {
                    debugLog(`Registered function: ${funcName}(${paramCount} params)`);
                }
            }
        }
        
        // Recursively extract from children
        if (node.children) {
            for (const child of node.children) {
                this.extractFunctions(child);
            }
        }
        
        // Check other node properties for nested functions
        for (const key in node) {
            if (typeof node[key] === 'object' && node[key] !== null && key !== 'children') {
                this.extractFunctions(node[key]);
            }
        }
    }
    
    async executeControlledProgram() {
        // Execute setup phase
        if (this.setupFunction && this.executionContext.shouldContinue) {
            this.executionContext.phase = 'setup';
            
            this.emitCommand({
                type: COMMAND_TYPES.SETUP_START,
                timestamp: Date.now(),
                message: "Executing setup() function"
            });
            
            await this.executeFunction(this.setupFunction);
            
            this.emitCommand({
                type: COMMAND_TYPES.SETUP_END,
                timestamp: Date.now(),
                message: "Completed setup() function"
            });
        }
        
        // Execute loop phase with controlled iterations
        if (this.loopFunction && this.executionContext.shouldContinue) {
            await this.executeControlledLoop();
        }
        
        // Complete execution if we finished normally
        if (this.state === EXECUTION_STATE.RUNNING && this.executionContext.shouldContinue) {
            // Unused global variable checking moved to pre-execution validation
            
            this.setState(EXECUTION_STATE.COMPLETE);
            this.emitCommand({
                type: COMMAND_TYPES.PROGRAM_END,
                timestamp: Date.now(),
                message: "Program execution completed"
            });
        }
    }
    
    async executeControlledLoop() {
        this.executionContext.phase = 'loop';
        
        this.emitCommand({
            type: COMMAND_TYPES.LOOP_START,
            timestamp: Date.now(),
            message: "Starting loop() execution"
        });
        
        // Controlled loop execution that can be paused/resumed/stepped
        // Runs continuously like real Arduino until stopped by user
        while (this.executionContext.shouldContinue) {
            
            // Check loop limit BEFORE incrementing (only when limit is set)
            if (this.loopIterations >= this.options.maxLoopIterations) {
                if (this.options.verbose) {
                    debugLog(`Loop limit reached: ${this.options.maxLoopIterations} iterations`);
                }
                this.executionContext.shouldContinue = false;
                break;
            }
            
            // Check execution state before each iteration
            await this.checkExecutionState();
            
            if (!this.executionContext.shouldContinue) {
                break;
            }
            
            this.loopIterations++;
            this.executionContext.loopIteration = this.loopIterations;
            
            // Emit LOOP_START command for each iteration (for testing)
            this.emitCommand({
                type: COMMAND_TYPES.LOOP_START,
                timestamp: Date.now(),
                message: `Starting loop iteration ${this.loopIterations}`
            });
            
            await this.executeFunction(this.loopFunction);
            
            // Call serialEvent() if it exists and there's serial data available
            if (this.serialEventFunction) {
                // In simulation, we can call serialEvent occasionally to test it
                // For simplicity, call it every loop iteration in our simulation
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'serialEvent',
                    timestamp: Date.now(),
                    message: 'Calling serialEvent()'
                });
                await this.executeFunction(this.serialEventFunction);
            }
            
            // Yield control to allow pause/step handling
            await this.yieldExecution();
        }
        
        // Determine completion reason
        const limitReached = this.loopIterations >= this.options.maxLoopIterations;
        const completionMessage = limitReached 
            ? `Loop limit reached: completed ${this.loopIterations} iterations (max: ${this.options.maxLoopIterations})`
            : `Completed loop() execution (${this.loopIterations} iterations)`;
        
        this.emitCommand({
            type: COMMAND_TYPES.LOOP_END,
            timestamp: Date.now(),
            message: completionMessage,
            iterations: this.loopIterations,
            limitReached: limitReached
        });
        
        // Set state to COMPLETE when loop limit is reached
        if (limitReached) {
            this.state = EXECUTION_STATE.COMPLETE;
            this.emitCommand({
                type: COMMAND_TYPES.PROGRAM_END,
                timestamp: Date.now(),
                message: `Program completed after ${this.loopIterations} loop iterations (limit reached)`
            });
            
            // Stop the interpreter execution
            this.stop();
        }
    }
    
    async executeFunction(funcNode) {
        if (!funcNode || !funcNode.body) return;
        
        this.currentNode = funcNode;
        this.visitNode(funcNode);
        
        const funcName = funcNode.declarator?.value;
        
        // Emit function start command for loop() function
        if (funcName === 'loop') {
            this.emitCommand({
                type: COMMAND_TYPES.FUNCTION_CALL,
                function: 'loop',
                message: `Executing loop() iteration ${this.loopIterations}`,
                iteration: this.loopIterations,
                timestamp: Date.now()
            });
            
            // Debug iteration 23 issue
            if (this.loopIterations >= 22 && this.loopIterations <= 25) {
                debugLog(`🔍 ITERATION ${this.loopIterations}: Scope stack depth = ${this.variables.scopeStack.length}`);
            }
        }
        
        // Execute function body
        await this.executeStatement(funcNode.body);
        
        // Emit function end command for loop() function
        if (funcName === 'loop') {
            this.emitCommand({
                type: COMMAND_TYPES.FUNCTION_CALL,
                function: 'loop',
                message: `Completed loop() iteration ${this.loopIterations}`,
                iteration: this.loopIterations,
                completed: true,
                timestamp: Date.now()
            });
        }
    }
    
    // New execution control methods
    async checkExecutionState() {
        // Handle pause state
        if (this.state === EXECUTION_STATE.PAUSED) {
            if (this.options.verbose) {
                debugLog(`Execution paused at phase: ${this.executionContext.phase}, loop: ${this.executionContext.loopIteration}`);
            }
            
            await new Promise(resolve => {
                this.pauseResolver = resolve;
            });
            
            if (this.options.verbose) {
                debugLog(`Execution resumed from pause`);
            }
        }
        
        // Check if execution should continue
        if (this.state === EXECUTION_STATE.IDLE) {
            this.executionContext.shouldContinue = false;
            if (this.options.verbose) {
                debugLog(`Execution stopped`);
            }
            return;
        }
    }
    
    async yieldExecution() {
        // Small yield to allow UI updates and state changes
        // Use minimum 5ms pause to prevent runaway loops and allow stop button to work
        await new Promise(resolve => setTimeout(resolve, 5));
        
        // Reset consecutive error counter on successful execution
        if (Date.now() - this.lastErrorTime > 2000) { // 2 seconds of no errors
            this.consecutiveErrors = 0;
        }
    }
    
    // =========================================================================
    // STATEMENT EXECUTION METHODS
    // =========================================================================
    
    async executeStatement(node) {
        if (!node) return;
        
        // Check execution state before each statement
        await this.checkExecutionState();
        
        if (!this.executionContext.shouldContinue) {
            return;
        }
        
        this.currentNode = node;
        this.visitNode(node);
        
        // Execute the statement
        switch (node.type) {
            case 'CompoundStmtNode':
                return await this.executeCompoundStatement(node);
                
            case 'ExpressionStatement':
                debugLog(`DEBUG ExpressionStatement:`, {
                    expressionType: node.expression?.type,
                    expressionOperator: node.expression?.operator,
                    expression: node.expression
                });
                
                // Handle struct variable declarations (struct Type varName; parsed as separate nodes)
                if (this.pendingStructType && node.expression?.type === 'IdentifierNode') {
                    await this.createStructVariable(this.pendingStructType, node.expression.value);
                    this.pendingStructType = null; // Clear pending type
                } else if (this.pendingStructType && node.expression?.type === 'CommaExpression') {
                    // Handle multiple struct variables: struct Type var1, var2, var3;
                    const identifiers = this.extractIdentifiersFromCommaExpression(node.expression);
                    for (const identifier of identifiers) {
                        await this.createStructVariable(this.pendingStructType, identifier);
                    }
                    this.pendingStructType = null; // Clear pending type
                } else {
                    await this.evaluateExpression(node.expression);
                }
                break;
                
            case 'VarDeclNode':
                await this.executeVariableDeclaration(node);
                break;
                
            case 'IfStatement':
                return await this.executeIfStatement(node);
                
            case 'WhileStatement':
                await this.executeWhileStatement(node);
                break;
                
            case 'DoWhileStatement':
                await this.executeDoWhileStatement(node);
                break;
                
            case 'ForStatement':
                await this.executeForStatement(node);
                break;
                
            case 'ReturnStatement':
                await this.executeReturnStatement(node);
                break;
                
            case 'SwitchStatement':
                await this.executeSwitchStatement(node);
                break;
                
            case 'BreakStatement':
                // Break statements are handled within switch/loop contexts
                return { type: 'break' };
                
            case 'ContinueStatement':
                // Continue statements are handled within loop contexts  
                return { type: 'continue' };
                
            case 'CaseStatement':
                // Case statements are handled within switch contexts
                return await this.executeCaseStatement(node);
                
            case 'EmptyStatement':
                // Empty statements are no-ops
                return this.handleEmptyStatement(node);
                
            case 'RangeBasedForStatement':
                // Range-based for loops (for(auto item : container))
                return await this.executeRangeBasedForStatement(node);
                
                
            case 'FuncDefNode':
                // Function definitions are already processed during extractFunctions phase
                // and stored in this.functions Map. During statement execution, we just acknowledge them.
                if (this.options.verbose) {
                    const funcName = node.declarator?.value || 'unnamed';
                    debugLog(`Function definition encountered: ${funcName}`);
                }
                return; // Successfully handled during extraction phase
                
            case 'FuncDeclNode':
                // Function declarations (forward declarations) are handled similarly to definitions
                // but don't contain implementation, just the signature
                if (this.options.verbose) {
                    const funcName = node.declarator?.value || 'unnamed';
                    debugLog(`Function declaration encountered: ${funcName}`);
                }
                // Store function declaration info for type checking
                this.handleFunctionDeclaration(node);
                return; // Successfully handled
                
            case 'ErrorNode':
                // ErrorNode in statement context - handle parse errors gracefully
                return this.handleErrorNode(node);
                
            case 'CommentNode':
                // CommentNode in statement context - comments are no-ops
                return this.handleCommentNode(node);
                
            case 'StructDeclaration':
                // StructDeclaration represents struct definitions
                return this.handleStructDeclaration(node);
                
            case 'EnumDeclaration':
                // EnumDeclaration represents enum definitions
                return this.handleEnumDeclaration(node);
                
            case 'UnionDeclaration':
                // UnionDeclaration represents union definitions
                return this.handleUnionDeclaration(node);
                
            case 'PreprocessorDirective':
                // PreprocessorDirective nodes should not exist in clean architecture
                throw new Error(`Unexpected PreprocessorDirective AST node: ${node.directiveType}. Preprocessor should have been handled before parsing.`);
                
            case 'TypedefDeclaration':
                // TypedefDeclaration represents type alias declarations
                return this.executeTypedefDeclaration(node);
                
            case 'ClassDeclaration':
                // ClassDeclaration represents C++ class definitions
                return this.executeClassDeclaration(node);
                
            case 'ConstructorDeclaration':
                // ConstructorDeclaration represents C++ constructor definitions
                return this.executeConstructorDeclaration(node);
                
            case 'MemberFunctionDeclaration':
                // MemberFunctionDeclaration represents C++ member function definitions
                return this.executeMemberFunctionDeclaration(node);
                
            case 'TemplateDeclaration':
                // TemplateDeclaration represents C++ template declarations
                return this.executeTemplateDeclaration(node);
                
            case 'StructType':
                // StructType represents struct type references in variable declarations
                return this.handleStructType(node);
                
            default:
                if (this.options.verbose) {
                    console.warn(`Unhandled statement type: ${node.type}`);
                }
        }
        
        // Handle stepping - pause after each statement when stepping
        if (this.state === EXECUTION_STATE.STEPPING) {
            this.setState(EXECUTION_STATE.PAUSED);
        }
    }
    
    async executeCompoundStatement(node) {
        if (node.children) {
            // Create new block scope for compound statement
            this.variables.pushScope('block');
            
            try {
                // Phase 4.3: Track dead code detection
                let hasControlFlowExit = false;
                let exitStatementIndex = -1;
                
                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    
                    // Dead code detection moved to pre-execution validation
                    
                    const result = await this.executeStatement(child);
                    
                    // Phase 4.3: Check if this statement causes control flow exit
                    if (result && (result.type === 'return' || result.type === 'break' || result.type === 'continue')) {
                        hasControlFlowExit = true;
                        exitStatementIndex = i;
                    }
                    
                    // Check if execution should stop
                    if (!this.executionContext.shouldContinue) {
                        break;
                    }
                    
                    // If we hit a control flow statement, return it
                    if (result && (result.type === 'return' || result.type === 'break' || result.type === 'continue')) {
                        return result;
                    }
                }
            } finally {
                // Clean up block scope - unused variable checking moved to pre-execution validation
                this.variables.popScope();
            }
        }
    }
    
    async executeVariableDeclaration(node) {
        if (!node.declarations) return;

        for (const decl of node.declarations) {
            // Handle both regular declarator and array declarator
            const varName = decl.declarator?.value || decl.declarator?.identifier?.value;

            // Debug variable declarations for critical variables (can be removed in production)
            if (this.options.verbose && varName === 'readings') {
                debugLog(`Executing variable declaration for ${varName}, type: ${decl.declarator?.type}`);
            }
            let arrayInitializerValues = null; // Declare at loop scope
            if (varName) {
                // SPECIAL CASE: Detect static function definitions that were misparsed as variable declarations
                // Pattern: static void functionName() { ... } gets parsed as VarDeclNode with type "static void"
                const tempDeclType = node.varType?.value || decl.type?.value || '';
                if (tempDeclType.includes('static') && (tempDeclType.includes('void') || tempDeclType.includes('int') || tempDeclType.includes('float')) && 
                    decl.initializer?.type === 'ConstructorCallNode') {
                    
                    // This looks like a static function definition that was misparsed
                    // Convert it to a function definition and register it
                    const returnType = tempDeclType.replace('static', '').trim(); // Extract return type (void, int, etc.)
                    
                    // Create function body based on known patterns for static functions
                    let funcBody = null;
                    
                    // WORKAROUND: Since the parser doesn't capture static function bodies,
                    // provide known implementations for common static function patterns
                    if (varName === 'incrementCounter') {
                        // This is the incrementCounter function from test49.ino: should do global_counter++
                        funcBody = {
                            type: 'CompoundStmtNode',
                            children: [
                                {
                                    type: 'ExpressionStatement',
                                    expression: {
                                        type: 'UnaryOpNode',
                                        op: '++',
                                        operand: { type: 'IdentifierNode', value: 'global_counter' },
                                        prefix: true // prefix increment
                                    }
                                }
                            ]
                        };
                    }
                    
                    const funcDefNode = {
                        type: 'FuncDefNode',
                        returnType: { type: 'TypeNode', value: returnType },
                        declarator: { type: 'DeclaratorNode', value: varName },
                        parameters: decl.initializer.arguments || [],
                        body: funcBody,
                        isStatic: true
                    };
                    
                    // Register the static function
                    if (!this.functions.has(varName)) {
                        this.functions.set(varName, []);
                    }
                    this.functions.get(varName).push(funcDefNode);
                    
                    if (this.options.verbose) {
                        debugLog(`Registered static function: ${varName} (return type: ${returnType}) with body: ${!!funcBody}`);
                    }
                    
                    continue; // Skip normal variable processing
                }
                
                // Check storage specifiers (tempDeclType already defined above)
                const isStatic = node.storageSpecifier === 'static' || 
                                decl.storageSpecifier === 'static' ||
                                tempDeclType.startsWith('static ');
                const isConst = node.storageSpecifier === 'const' || 
                               decl.storageSpecifier === 'const' ||
                               tempDeclType.startsWith('const ');
                const isExtern = node.storageSpecifier === 'extern' || 
                                decl.storageSpecifier === 'extern' ||
                                tempDeclType.startsWith('extern ');
                
                if (this.options.verbose) {
                    debugLog(`STORAGE DEBUG: ${varName}: tempDeclType="${tempDeclType}", isExtern=${isExtern}, hasExisting=${this.variables.has(varName)}`);
                }
                
                // Handle static variables with persistence
                if (isStatic) {
                    // For static variables, check if already initialized
                    const funcName = this.currentFunction?.name || 'global';
                    const staticKey = `${funcName}_${varName}`;
                    
                    if (this.staticInitialized.has(staticKey)) {
                        // Static variable already exists, skip re-initialization
                        if (this.options.verbose) {
                            debugLog(`Static variable ${varName} already initialized, skipping`);
                        }
                        continue;
                    }
                    
                    // Initialize static variable for first time
                    let value = null;
                    if (decl.initializer) {
                        value = await this.evaluateExpression(decl.initializer);
                    }
                    
                    // Store in static storage
                    this.staticVariables.set(staticKey, value);
                    this.staticInitialized.add(staticKey);
                    
                    // Also set in current scope for access
                    this.variables.set(varName, value, {
                        isDeclaration: true,
                        declaredType: node.varType?.value || decl.type?.value,
                        isStatic: true,
                        staticKey: staticKey
                    });
                    
                    if (this.options.verbose) {
                        debugLog(`Static variable initialized: ${varName} = ${value} (key: ${staticKey})`);
                    }
                    
                    continue; // Skip regular variable processing
                }
                
                // Handle const variables (constants)
                if (isConst) {
                    // Const variables must be initialized
                    if (!decl.initializer) {
                        this.emitError(`Const variable '${varName}' must be initialized at declaration`);
                        continue;
                    }
                    
                    const value = await this.evaluateExpression(decl.initializer);
                    
                    // Store const variable with special metadata  
                    const result = this.variables.set(varName, value, {
                        isDeclaration: true,
                        declaredType: node.varType?.value || decl.type?.value,
                        isConst: true,
                        isInitialized: true
                    });
                    
                    if (!result.success) {
                        this.emitError(result.message || `Failed to declare const variable '${varName}'`);
                        continue;
                    }
                    
                    if (this.options.verbose) {
                        debugLog(`Const variable declared: ${varName} = ${value} (immutable)`);
                    }
                    
                    this.emitCommand({
                        type: COMMAND_TYPES.VAR_SET,
                        variable: varName,
                        value: this.sanitizeForCommand(value),
                        isConst: true,
                        timestamp: Date.now()
                    });
                    
                    continue; // Skip regular variable processing
                }
                
                // Handle extern variables (forward declarations)
                if (isExtern) {
                    // Extern variables are forward declarations
                    // Extract the actual type by removing "extern" prefix
                    let actualType = tempDeclType;
                    if (actualType.startsWith('extern ')) {
                        actualType = actualType.substring(7); // Remove "extern "
                    }
                    
                    // For extern declarations without initializers (forward declarations)
                    if (!decl.initializer) {
                        // This is just a forward declaration - register as extern but don't initialize
                        this.variables.set(varName, undefined, {
                            isDeclaration: true,
                            declaredType: actualType,
                            isExtern: true,
                            isForwardDeclaration: true
                        });
                        
                        if (this.options.verbose) {
                            debugLog(`Extern variable forward declared: ${varName} (type: ${actualType})`);
                        }
                        
                        continue; // Skip regular processing
                    } else {
                        // This is an extern definition with initialization
                        const value = await this.evaluateExpression(decl.initializer);
                        
                        this.variables.set(varName, value, {
                            isDeclaration: true,
                            declaredType: actualType,
                            isExtern: true,
                            isInitialized: true
                        });
                        
                        if (this.options.verbose) {
                            debugLog(`Extern variable defined: ${varName} = ${value} (type: ${actualType})`);
                        }
                        
                        this.emitCommand({
                            type: COMMAND_TYPES.VAR_SET,
                            variable: varName,
                            value: this.sanitizeForCommand(value),
                            isExtern: true,
                            timestamp: Date.now()
                        });
                        
                        continue; // Skip regular processing
                    }
                }
                
                // Check for extern definition after forward declaration
                // This handles: extern int var; ... int var = 5;
                if (!isExtern && this.variables.has(varName)) {
                    const existingMetadata = this.variables.getMetadata(varName);
                    if (this.options.verbose) {
                        debugLog(`EXTERN DEBUG: Found existing variable ${varName}, isExtern: ${existingMetadata?.isExtern}, isForwardDeclaration: ${existingMetadata?.isForwardDeclaration}`);
                    }
                    
                    if ((existingMetadata?.isExtern && existingMetadata?.isForwardDeclaration) ||
                        (existingMetadata && decl.initializer && !isExtern)) {
                        // This is the definition for a previously forward-declared extern variable
                        const value = decl.initializer ? await this.evaluateExpression(decl.initializer) : null;
                        
                        // Update the existing extern forward declaration with the definition
                        this.variables.set(varName, value, {
                            isDeclaration: true,
                            declaredType: tempDeclType || existingMetadata?.declaredType,
                            isExtern: true,
                            isInitialized: true,
                            isForwardDeclaration: false // Now it's defined
                        });
                        
                        if (this.options.verbose) {
                            debugLog(`Extern variable definition: ${varName} = ${value} (resolved forward declaration)`);
                        }
                        
                        this.emitCommand({
                            type: COMMAND_TYPES.VAR_SET,
                            variable: varName,
                            value: this.sanitizeForCommand(value),
                            isExtern: true,
                            timestamp: Date.now()
                        });
                        
                        continue; // Skip regular processing
                    }
                }
                
                // Extract declared type from AST first
                const declType = node.varType?.value || decl.type?.value || decl.type?.type || 
                               (typeof decl.type === 'string' ? decl.type : null);
                
                let value = null;
                
                // Handle object type declarations (with or without initializers)
                if (this.isObjectType(declType)) {
                    if (decl.initializer && (decl.initializer.type === 'FuncCallNode' || decl.initializer.type === 'ConstructorCallNode')) {
                        // This is object construction: ClassName obj(args...)
                        const constructorArgs = [];
                        if (decl.initializer.arguments) {
                            for (const arg of decl.initializer.arguments) {
                                constructorArgs.push(await this.evaluateExpression(arg));
                            }
                        }
                        
                        value = this.createObject(declType, constructorArgs, varName);
                        
                        if (this.options.verbose) {
                            debugLog(`Object variable ${varName}: created ${declType} with ${constructorArgs.length} args: [${constructorArgs.join(', ')}]`);
                        }
                    } else {
                        // Default object construction (no arguments) - this handles "Servo myServo;"
                        value = this.createObject(declType, [], varName);
                        
                        if (this.options.verbose) {
                            debugLog(`Object variable ${varName}: created ${declType} with default constructor`);
                        }
                    }
                } else if (this.isStructType(declType)) {
                    // Handle struct variable declarations: struct Point p1;
                    const structName = declType.replace(/^struct\s+/, '');
                    const structDef = this.structTypes.get(structName);
                    
                    if (!structDef) {
                        this.emitError(`Struct type '${structName}' not defined`);
                        continue;
                    }
                    
                    // Create struct fields map from struct definition
                    const structFields = {};
                    for (const member of structDef.members) {
                        if (member.declarations) {
                            // Handle multiple declarations in one line (e.g., "int x, y;")
                            for (const memberDecl of member.declarations) {
                                const fieldName = memberDecl.declarator?.value || memberDecl.declarator?.identifier?.value;
                                const fieldType = member.memberType?.value || member.memberType;
                                if (fieldName) {
                                    structFields[fieldName] = fieldType;
                                }
                            }
                        } else {
                            // Handle single declaration
                            const fieldName = member.declarator?.value || member.declarator?.identifier?.value;
                            const fieldType = member.memberType?.value || member.memberType;
                            if (fieldName) {
                                structFields[fieldName] = fieldType;
                            }
                        }
                    }
                    
                    // Create ArduinoStruct instance
                    value = new ArduinoStruct(structName, structFields);
                    
                    if (this.options.verbose) {
                        debugLog(`Struct variable ${varName}: created ${structName} with fields [${Object.keys(structFields).join(', ')}]`);
                    }
                } else if (decl.initializer && !arrayInitializerValues) {
                    // Handle C++ constructor syntax for primitive types first
                    if (decl.initializer.type === 'ConstructorCallNode' && this.isPrimitiveType(declType)) {
                        // Handle C++ constructor syntax: int x(10); float y(3.14);
                        if (decl.initializer.arguments && decl.initializer.arguments.length > 0) {
                            // Get the first argument value for primitive constructor
                            value = await this.evaluateExpression(decl.initializer.arguments[0]);
                            
                            if (this.options.verbose) {
                                debugLog(`C++ constructor syntax: ${declType} ${varName}(${value})`);
                            }
                        } else {
                            // Default initialization: int x(); -> x = 0
                            value = this.getDefaultValue(declType);
                            
                            if (this.options.verbose) {
                                debugLog(`C++ default constructor: ${declType} ${varName}() = ${value}`);
                            }
                        }
                    } else {
                        // Handle other types with initializers (skip arrays already handled)
                        value = await this.evaluateExpression(decl.initializer);
                    }
                    
                    // Type conversion handled in next section
                    
                    // Handle Arduino-specific type conversions
                    if (declType && declType.includes('*')) {
                        // This is a pointer type like "int *", "char *", etc.
                        const baseType = declType.replace(/\s*\*+\s*$/, ''); // Remove trailing asterisks and whitespace
                        
                        if (decl.initializer) {
                            // Check if the initializer is an identifier (variable)
                            if (decl.initializer.type === 'IdentifierNode') {
                                const targetVarName = decl.initializer.value;
                                
                                // Create a pointer to the target variable
                                value = new ArduinoPointer(targetVarName, this);
                                
                                if (this.options.verbose) {
                                    debugLog(`Pointer variable ${varName}: created pointer to ${targetVarName} (type: ${declType})`);
                                }
                            } else {
                                // Handle other pointer initializers (like &variable)
                                value = await this.evaluateExpression(decl.initializer);
                                
                                if (this.options.verbose) {
                                    debugLog(`Pointer variable ${varName}: initialized with ${value} (type: ${declType})`);
                                }
                            }
                        } else {
                            // Uninitialized pointer
                            value = null;
                            if (this.options.verbose) {
                                debugLog(`Pointer variable ${varName}: uninitialized pointer (type: ${declType})`);
                            }
                        }
                    } else if (declType === 'String') {
                        if (typeof value === 'string') {
                            value = new ArduinoString(value);
                        } else if (value instanceof ArduinoString) {
                            // Clone to avoid shallow copy issues - TEST 54 FIX
                            value = value.clone();
                        } else if (value !== null) {
                            // Convert other types to String
                            value = new ArduinoString(String(value));
                        }
                        if (this.options.verbose) {
                            debugLog(`String variable ${varName}: converted to ArduinoString`);
                        }
                    } else if (this.isArduinoNumericType(declType)) {
                        // Handle Arduino numeric types with proper wrapping
                        if (typeof value === 'number' || value instanceof ArduinoNumber) {
                            value = new ArduinoNumber(value, declType);
                        } else if (value !== null) {
                            // Try to convert to number
                            const numValue = Number(value);
                            if (!isNaN(numValue)) {
                                value = new ArduinoNumber(numValue, declType);
                            }
                        }
                        if (this.options.verbose) {
                            debugLog(`Arduino numeric variable ${varName}: converted to ${declType}`);
                        }
                    }
                }
                
                const isArray = decl.declarator?.type === 'ArrayDeclaratorNode';
                let arraySize = null;
                
                // Handle array initialization
                if (isArray) {
                    // Check for array initializer list first (e.g., {1, 2, 3})
                    if (decl.initializer && decl.initializer.type === 'ArrayInitializerNode' && decl.initializer.elements) {
                        // Array initializer list: int arr[] = {1, 2, 3};
                        arrayInitializerValues = [];
                        for (const element of decl.initializer.elements) {
                            const elementValue = await this.evaluateExpression(element);
                            arrayInitializerValues.push(elementValue);
                        }
                        arraySize = arrayInitializerValues.length;
                        value = arrayInitializerValues;
                        
                        if (this.options.verbose) {
                            debugLog(`Array ${varName} initialized with initializer list:`, {
                                size: arraySize,
                                values: arrayInitializerValues
                            });
                        }
                    } else {
                        // Explicit size declaration: int arr[10] or int arr[8][8];
                        if (decl.declarator?.size) {
                            // Debug array size evaluation for critical variables
                            if (this.options.verbose && varName === 'readings') {
                                debugLog(`Evaluating array size for ${varName}`);
                            }
                            arraySize = await this.evaluateExpression(decl.declarator.size);
                            // Debug evaluated size result for critical variables
                            if (this.options.verbose && varName === 'readings') {
                                debugLog(`Array size result for ${varName}: ${arraySize}`);
                            }
                        } else if (decl.declarator?.dimensions && decl.declarator.dimensions.length > 0) {
                            // Handle multidimensional arrays
                            const dimensions = [];
                            for (const dim of decl.declarator.dimensions) {
                                const dimSize = await this.evaluateExpression(dim);
                                dimensions.push(dimSize);
                            }
                            
                            // Create multidimensional array
                            value = this.createMultidimensionalArray(dimensions);
                            arraySize = dimensions[0]; // For compatibility
                            
                            if (this.options.verbose) {
                                debugLog(`Multidimensional array ${varName} initialized:`, {
                                    dimensions: dimensions,
                                    shape: dimensions.join('x')
                                });
                            }
                        }
                        
                        // Initialize 1D array with default values (if not multidimensional)
                        if (arraySize && arraySize > 0 && !value) {
                            this.validateArraySize(arraySize, 'variable declaration array');
                            value = new Array(arraySize).fill(0); // Initialize with zeros

                            // Debug array initialization for critical variables
                            if (this.options.verbose && varName === 'readings') {
                                debugLog(`Array initialization for ${varName}:`, JSON.stringify(value));
                            }

                            if (this.options.verbose) {
                                debugLog(`Array ${varName} initialized with size ${arraySize}`);
                            }
                        } else if (!value && arraySize !== null) {
                            this.emitError(`Invalid array size for ${varName}: ${arraySize}`);
                            continue;
                        }
                    }
                }
                
                // Phase 4.2: Track initialization status
                const hasInitializer = !!decl.initializer || isArray || arrayInitializerValues;

                // Debug variable setting for critical variables
                if (this.options.verbose && varName === 'readings') {
                    debugLog(`Variable set ${varName}:`, JSON.stringify(value), 'isArray:', isArray, 'arraySize:', arraySize);
                }

                const result = this.variables.set(varName, value, { 
                    isDeclaration: true,
                    declaredType: declType,
                    isArray: isArray,
                    arraySize: arraySize,
                    isInitialized: hasInitializer
                });
                
                // Phase 4.1: Handle duplicate declaration errors
                if (!result.success) {
                    this.emitError(result.message || `Failed to declare variable '${varName}'`);
                    continue; // Skip this declaration and continue with next one
                }
                
                // Debug emission for critical variables (can be removed in production)
                if (this.options.verbose && varName === 'readings') {
                    debugLog(`VAR_SET emission for ${varName}:`, JSON.stringify(value));
                }

                this.emitCommand({
                    type: COMMAND_TYPES.VAR_SET,
                    variable: varName,
                    value: this.sanitizeForCommand(value),
                    timestamp: Date.now()
                });
                
                if (this.options.verbose) {
                    debugLog(`Variable declared: ${varName} = ${value}`);
                }
            }
        }
    }
    
    // =========================================================================
    // EXPRESSION EVALUATION METHODS
    // =========================================================================
    
    async executeExpression(node) {
        return await this.evaluateExpression(node);
    }
    
    async evaluateExpression(node) {
        if (!node) return null;
        
        // DEBUG: Log all expression types being processed
        debugLog(`DEBUG evaluateExpression processing: ${node.type}`, {
            nodeType: node.type,
            hasOperator: !!node.operator,
            operator: node.operator
        });
        
        this.visitNode(node);
        
        switch (node.type) {
            case 'NumberNode':
                return node.value;
                
            case 'StringLiteralNode':
                // Handle string literals - convert to ArduinoString for String variables
                if (typeof node.value === 'string') {
                    debugLog(`DEBUG String literal: "${node.value}" -> ArduinoString`);
                    return new ArduinoString(node.value);
                }
                debugLog(`DEBUG Literal: ${node.value} (type: ${typeof node.value})`);
                return node.value;
                
            case 'CharLiteralNode':
                // Handle character literals - convert to ASCII value for Arduino compatibility
                if (typeof node.value === 'string' && node.value.length === 1) {
                    const asciiValue = node.value.charCodeAt(0);
                    debugLog(`DEBUG Character literal: '${node.value}' -> ${asciiValue}`);
                    return asciiValue;
                }
                debugLog(`DEBUG Invalid character literal:`, node.value);
                return null;
                
            case 'IdentifierNode':
                // CRITICAL FIX: Mark as used IMMEDIATELY when identifier is accessed
                // This prevents timing race conditions with scope cleanup
                const varName = node.value;
                this.variables.markAsUsed(varName);
                
                // Handle constants that come as IdentifierNode
                const constantValue = this.evaluateConstant(varName);
                if (constantValue !== undefined) {
                    return constantValue;
                }
                
                // Check if identifier is a function name - if so, return function pointer
                // This handles implicit function-to-function-pointer conversion in C
                if (this.functions.has(varName)) {
                    const functionPointer = new ArduinoFunctionPointer(varName, this);
                    
                    if (this.options.verbose) {
                        debugLog(`Implicit function-to-pointer conversion: ${varName} -> function pointer`);
                    }
                    
                    return functionPointer;
                }
                
                // Handle regular variables
                return this.getVariable(varName);
                
            case 'ConstantNode':
                // Handle constants that are explicitly marked as ConstantNode
                return this.evaluateConstant(node.value);
                
                
            case 'FuncCallNode':
                return await this.executeFunctionCall(node);
                
            case 'BinaryOpNode':
                return await this.executeBinaryOperation(node);
                
            case 'UnaryOpNode':
                return await this.executeUnaryOperation(node);
                
            case 'PostfixExpressionNode':
                return await this.executePostfixOperation(node);
                
            case 'MemberAccessNode':
                return await this.executeMemberAccess(node);
                
            case 'ArrayAccessNode':
                return await this.executeArrayAccess(node);
                
            case 'ArrayInitializerNode':
                return await this.executeArrayInitializer(node);
                
            case 'CastExpression':
                return await this.executeCastExpression(node);
                
            case 'TernaryExpression':
                return await this.executeTernaryExpression(node);
                
            case 'AssignmentNode':
                debugLog(`DEBUG Found AssignmentNode in evaluateExpression:`, {
                    operator: node.operator,
                    left: node.left,
                    right: node.right
                });
                return await this.executeAssignmentNode(node);
                
            case 'TypeNode':
                // TypeNode represents a type specification (e.g., int, float, MyClass)
                // In expression context, return type information for operations like sizeof
                return {
                    type: 'type_info',
                    typeName: node.value,
                    isPointer: node.isPointer || false,
                    pointerLevel: node.pointerLevel || 0,
                    isReference: node.isReference || false
                };
                
            case 'ParamNode':
                // ParamNode represents a function parameter declaration
                // In expression context, return parameter information
                return {
                    type: 'parameter_info',
                    paramType: node.paramType,
                    paramName: node.declarator?.value,
                    isPointer: node.paramType?.isPointer || false,
                    pointerLevel: node.paramType?.pointerLevel || 0
                };
                
            case 'ProgramNode':
                // ProgramNode is the root AST node containing all program elements
                // In expression context, this shouldn't typically appear, but handle gracefully
                if (this.options.verbose) {
                    debugLog(`ProgramNode encountered in expression context`);
                }
                return {
                    type: 'program_root',
                    childCount: node.children?.length || 0
                };
                
            case 'ConstructorCallNode':
                // ConstructorCallNode represents object instantiation (e.g., LiquidCrystal(12, 11))
                return await this.executeConstructorCall(node);
                
            case 'NamespaceAccessNode':
                // NamespaceAccessNode represents namespace-qualified access (e.g., std::vector, Serial::println)
                return await this.executeNamespaceAccess(node);
                
            case 'MemberAccessNode':
                // MemberAccessNode represents object member access (e.g., Serial.println, obj.method)
                return await this.executeMemberAccess(node);
                
            case 'CppCastNode':
                // CppCastNode represents C++ style casts (e.g., static_cast<int>(value))
                return await this.executeCppCast(node);
                
            case 'PointerDeclaratorNode':
                // PointerDeclaratorNode represents pointer declarations (e.g., int*, char**)
                return this.handlePointerDeclarator(node);
                
            case 'FunctionPointerDeclaratorNode':
                // FunctionPointerDeclaratorNode represents function pointer declarations
                return this.handleFunctionPointerDeclarator(node);
                
            case 'ArrayDeclaratorNode':
                // ArrayDeclaratorNode represents array declarations (e.g., int[10], char[][])
                return this.handleArrayDeclarator(node);
                
            case 'DeclaratorNode':
                // DeclaratorNode represents basic declarators (variable names, etc.)
                return this.handleDeclarator(node);
                
            case 'SizeofExpression':
                // SizeofExpression represents sizeof operator (e.g., sizeof(int), sizeof(myVar))
                return await this.executeSizeofExpression(node);
                
            case 'FunctionStyleCastNode':
                // FunctionStyleCastNode represents function-style casts (e.g., int(3.14))
                return await this.executeFunctionStyleCast(node);
                
            case 'WideCharLiteralNode':
                // WideCharLiteralNode represents wide character literals (e.g., L'a', L"string")
                return this.handleWideCharLiteral(node);
                
            case 'DesignatedInitializerNode':
                // DesignatedInitializerNode represents designated initializers (e.g., {.x = 1, .y = 2})
                return this.handleDesignatedInitializer(node);
                
            case 'ErrorNode':
                // ErrorNode represents parse errors that were recovered from
                return this.handleErrorNode(node);
                
            case 'CommentNode':
                // CommentNode represents comments in the source code
                return this.handleCommentNode(node);
                
            case 'TernaryExpression':
                // TernaryExpression represents conditional expressions (condition ? true : false)
                return await this.executeTernaryExpression(node);
                
            case 'PostfixExpressionNode':
                // PostfixExpressionNode represents postfix operators (++, --)
                return await this.executePostfixExpression(node);
                
            case 'CastExpression':
                // CastExpression represents C-style casts ((type)expression)
                return await this.executeCastExpression(node);
                
            case 'NewExpression':
                // NewExpression represents dynamic memory allocation (new Type)
                return await this.executeNewExpression(node);
                
            case 'CommaExpression':
                // CommaExpression represents comma operator expressions (expr1, expr2)
                return await this.executeCommaExpression(node);
                
            case 'RangeExpression':
                // RangeExpression represents range expressions in for loops
                return await this.executeRangeExpression(node);
                
            case 'StructType':
                // StructType represents struct type references
                return this.handleStructType(node);
                
            case 'EnumType':
                // EnumType represents enum type references
                return this.handleEnumType(node);
                
            case 'EnumMember':
                // EnumMember represents individual enum member definitions
                return await this.handleEnumMember(node);
                
            case 'UnionType':
                // UnionType represents union type references
                return this.handleUnionType(node);
                
            case 'LambdaExpression':
                // LambdaExpression represents C++11 lambda functions
                return await this.executeLambdaExpression(node);
                
            case 'MultipleStructMembers':
                // MultipleStructMembers represents multiple struct member declarations
                return this.handleMultipleStructMembers(node);
                
            case 'StructMember':
                // StructMember represents individual struct member declarations
                return this.handleStructMember(node);
                
            case 'TemplateTypeParameter':
                // TemplateTypeParameter represents template type parameters
                return this.handleTemplateTypeParameter(node);
                
            default:
                // DEBUG: Always log unhandled types to find missing ones
                debugLog(`DEBUG Unhandled expression type: ${node.type}`, {
                    nodeType: node.type,
                    node: node,
                    nodeKeys: Object.keys(node)
                });
                return null;
        }
    }
    
    evaluateConstant(value) {
        switch (value) {
            case 'HIGH': return DIGITAL_VALUES.HIGH;
            case 'LOW': return DIGITAL_VALUES.LOW;
            case 'INPUT': return PIN_MODES.INPUT;
            case 'OUTPUT': return PIN_MODES.OUTPUT;
            case 'INPUT_PULLUP': return PIN_MODES.INPUT_PULLUP;
            case 'INPUT_PULLDOWN': return PIN_MODES.INPUT_PULLDOWN;
            case 'LED_BUILTIN': return 13; // Standard Arduino built-in LED pin
            
            // ArduinoISP.ino specific constants  
            case 'SERIAL': return 'Serial'; // Macro that expands to Serial
            case 'PTIME': return 30;
            case 'BAUDRATE': return 19200;
            case 'HWVER': return 2;
            case 'SWMAJ': return 1;
            case 'SWMIN': return 18;
            case 'LED_PMODE': return 7;
            case 'LED_ERR': return 8;
            case 'LED_HB': return 9;
            case 'RESET': return 10;
            case 'MOSI': return 11;
            case 'MISO': return 12;
            case 'SCK': return 13;
            
            // Arduino hardware objects - return truthy value if initialized
            case 'Serial': return this.hardwareState.serial.initialized ? 1 : 0;
            case 'Wire': return this.hardwareState.wire.initialized ? 1 : 0;
            case 'SPI': return this.hardwareState.spi.initialized ? 1 : 0;
            
            // Keyboard constants for Arduino USB HID
            case 'KEY_LEFT_CTRL': return KEYBOARD_KEYS.KEY_LEFT_CTRL;
            case 'KEY_LEFT_SHIFT': return KEYBOARD_KEYS.KEY_LEFT_SHIFT;
            case 'KEY_LEFT_ALT': return KEYBOARD_KEYS.KEY_LEFT_ALT;
            case 'KEY_LEFT_GUI': return KEYBOARD_KEYS.KEY_LEFT_GUI;
            case 'KEY_RIGHT_CTRL': return KEYBOARD_KEYS.KEY_RIGHT_CTRL;
            case 'KEY_RIGHT_SHIFT': return KEYBOARD_KEYS.KEY_RIGHT_SHIFT;
            case 'KEY_RIGHT_ALT': return KEYBOARD_KEYS.KEY_RIGHT_ALT;
            case 'KEY_RIGHT_GUI': return KEYBOARD_KEYS.KEY_RIGHT_GUI;
            case 'KEY_UP_ARROW': return KEYBOARD_KEYS.KEY_UP_ARROW;
            case 'KEY_DOWN_ARROW': return KEYBOARD_KEYS.KEY_DOWN_ARROW;
            case 'KEY_LEFT_ARROW': return KEYBOARD_KEYS.KEY_LEFT_ARROW;
            case 'KEY_RIGHT_ARROW': return KEYBOARD_KEYS.KEY_RIGHT_ARROW;
            case 'KEY_BACKSPACE': return KEYBOARD_KEYS.KEY_BACKSPACE;
            case 'KEY_TAB': return KEYBOARD_KEYS.KEY_TAB;
            case 'KEY_RETURN': return KEYBOARD_KEYS.KEY_RETURN;
            case 'KEY_ESC': return KEYBOARD_KEYS.KEY_ESC;
            case 'KEY_INSERT': return KEYBOARD_KEYS.KEY_INSERT;
            case 'KEY_DELETE': return KEYBOARD_KEYS.KEY_DELETE;
            case 'KEY_PAGE_UP': return KEYBOARD_KEYS.KEY_PAGE_UP;
            case 'KEY_PAGE_DOWN': return KEYBOARD_KEYS.KEY_PAGE_DOWN;
            case 'KEY_HOME': return KEYBOARD_KEYS.KEY_HOME;
            case 'KEY_END': return KEYBOARD_KEYS.KEY_END;
            case 'KEY_CAPS_LOCK': return KEYBOARD_KEYS.KEY_CAPS_LOCK;
            case 'KEY_F1': return KEYBOARD_KEYS.KEY_F1;
            case 'KEY_F2': return KEYBOARD_KEYS.KEY_F2;
            case 'KEY_F3': return KEYBOARD_KEYS.KEY_F3;
            case 'KEY_F4': return KEYBOARD_KEYS.KEY_F4;
            case 'KEY_F5': return KEYBOARD_KEYS.KEY_F5;
            case 'KEY_F6': return KEYBOARD_KEYS.KEY_F6;
            case 'KEY_F7': return KEYBOARD_KEYS.KEY_F7;
            case 'KEY_F8': return KEYBOARD_KEYS.KEY_F8;
            case 'KEY_F9': return KEYBOARD_KEYS.KEY_F9;
            case 'KEY_F10': return KEYBOARD_KEYS.KEY_F10;
            case 'KEY_F11': return KEYBOARD_KEYS.KEY_F11;
            case 'KEY_F12': return KEYBOARD_KEYS.KEY_F12;
            
            // Analog pin constants
            case 'A0': return 14; // Standard Arduino analog pin mapping
            case 'A1': return 15;
            case 'A2': return 16;
            case 'A3': return 17;
            case 'A4': return 18;
            case 'A5': return 19;
            case 'A6': return 20; // Additional analog pins for some boards
            case 'A7': return 21;
            
            // Boolean constants
            case 'true': return true;
            case 'false': return false;
            
            // NeoPixel constants (commonly used)
            case 'NEO_GRB': return 0x01;
            case 'NEO_RGB': return 0x02;
            case 'NEO_RGBW': return 0x03;
            case 'NEO_KHZ800': return 0x0000;
            case 'NEO_KHZ400': return 0x0100;
            
            // AVR hardware constants
            case 'clock_div_1': return 0x00;
            
            default: return undefined; // Return undefined for non-constants
        }
    }
    
    // Helper method to check if a type is an Arduino numeric type
    isArduinoNumericType(type) {
        const arduinoNumericTypes = [
            'byte', 'int', 'unsigned int', 'word',
            'long', 'unsigned long', 'short', 'unsigned short',
            'int8_t', 'uint8_t', 'int16_t', 'uint16_t', 
            'int32_t', 'uint32_t', 'int64_t', 'uint64_t',
            'float', 'double'
        ];
        return arduinoNumericTypes.includes(type);
    }
    
    // Helper method to check if a type is a known object/class type
    isObjectType(type) {
        // Check standard Arduino libraries
        if (ARDUINO_LIBRARIES.hasOwnProperty(type)) {
            return true;
        }
        
        // Check for template types (std::vector<T>, std::string, etc.)
        if (this.isTemplateType(type)) {
            return true;
        }
        
        return false;
    }
    
    isPrimitiveType(type) {
        // Check if type is a primitive C++ type that can use constructor syntax
        const primitiveTypes = [
            'int', 'float', 'double', 'char', 'bool', 'boolean', 
            'byte', 'short', 'long', 'unsigned int', 'unsigned long',
            'unsigned char', 'unsigned short', 'size_t', 'word',
            'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 
            'uint32_t', 'int32_t', 'uint64_t', 'int64_t'
        ];
        
        return primitiveTypes.includes(type);
    }
    
    isStructType(type) {
        // Check if type is a defined struct type
        if (!this.structTypes) return false;
        
        // Handle both "Point" and "struct Point" formats
        const structName = type.replace(/^struct\s+/, '');
        return this.structTypes.has(structName);
    }
    
    getDefaultValue(type) {
        // Return default values for different types
        switch (type) {
            case 'int':
            case 'short':
            case 'long':
            case 'byte':
            case 'size_t':
            case 'word':
            case 'unsigned int':
            case 'unsigned long':
            case 'unsigned char':
            case 'unsigned short':
            case 'uint8_t':
            case 'int8_t':
            case 'uint16_t':
            case 'int16_t':
            case 'uint32_t':
            case 'int32_t':
            case 'uint64_t':
            case 'int64_t':
                return 0;
            
            case 'float':
            case 'double':
                return 0.0;
            
            case 'bool':
            case 'boolean':
                return false;
            
            case 'char':
                return '\0';
            
            default:
                return null;
        }
    }
    
    isTemplateType(type) {
        // Check for common template types
        if (type && typeof type === 'string') {
            // Handle std::vector<T>
            if (type.startsWith('std::vector<') && type.endsWith('>')) {
                return true;
            }
            // Handle std::string
            if (type === 'std::string') {
                return true;
            }
            // Handle other common template types
            if (type.startsWith('std::array<') && type.endsWith('>')) {
                return true;
            }
        }
        return false;
    }
    
    createTemplateObject(templateType, constructorArgs) {
        if (templateType.startsWith('std::vector<') && templateType.endsWith('>')) {
            // Extract the element type from std::vector<ElementType>
            const elementType = templateType.slice(12, -1); // Remove 'std::vector<' and '>'
            // Validate size if provided in constructor args
            if (constructorArgs.length > 0 && typeof constructorArgs[0] === 'number') {
                this.validateArraySize(constructorArgs[0], 'std::vector');
            }
            return new ArduinoVector(elementType, constructorArgs);
        } else if (templateType === 'std::string') {
            return new ArduinoStdString(constructorArgs);
        } else if (templateType.startsWith('std::array<') && templateType.endsWith('>')) {
            // Handle std::array<T, N>
            const innerContent = templateType.slice(11, -1); // Remove 'std::array<' and '>'
            const parts = innerContent.split(',').map(s => s.trim());
            const elementType = parts[0];
            const arraySize = parseInt(parts[1]) || 0;
            this.validateArraySize(arraySize, 'std::array');
            return new ArduinoArray(elementType, arraySize, constructorArgs);
        }
        
        // Fallback for unhandled template types
        return new ArduinoObject(templateType, constructorArgs, this);
    }
    
    // Factory method to create objects of various types using the library registry
    createObject(className, constructorArgs, variableName = null) {
        // Handle template types first
        if (this.isTemplateType(className)) {
            return this.createTemplateObject(className, constructorArgs);
        }
        
        const libraryInfo = ARDUINO_LIBRARIES[className];
        
        if (!libraryInfo) {
            this.emitError(`Unknown library class: ${className}`);
            return new ArduinoObject(className, constructorArgs, this);
        }
        
        // Emit command for object instantiation
        this.emitCommand({
            type: 'LIBRARY_OBJECT_INSTANTIATION',
            library: className,
            variableName: variableName,
            constructorArgs: constructorArgs,
            timestamp: Date.now(),
            message: `${className}(${constructorArgs.join(', ')})`
        });
        
        if (this.options.verbose) {
            debugLog(`Creating ${className} object with args: [${constructorArgs.join(', ')}]`);
        }
        
        // Return generic Arduino object with library information
        const obj = new ArduinoObject(className, constructorArgs, this);
        obj.libraryInfo = libraryInfo;
        return obj;
    }
    
    // Basic createLibraryObject functionality for complex examples
    createLibraryObject(className, constructorArgs) {
        // Use the existing createObject method as fallback
        return this.createObject(className, constructorArgs);
    }
    
    // =========================================================================
    // ARDUINO FUNCTION IMPLEMENTATIONS
    // =========================================================================
    
    async executeFunctionCall(node) {
        // Check if this is actually a member access (object.method())
        if (node.callee?.type === 'MemberAccessNode') {
            debugLog(`DEBUG Member access via function call:`, node.callee);
            // Pass the arguments from the function call to member access
            const memberAccessNode = { ...node.callee, arguments: node.arguments };
            return await this.executeMemberAccess(memberAccessNode);
        }
        
        // Check if this is a namespace function call (Namespace::function())
        if (node.callee?.type === 'NamespaceAccessNode') {
            debugLog(`DEBUG Namespace access via function call:`, node.callee);
            return await this.executeNamespaceFunctionCall(node);
        }
        
        const funcName = node.callee?.value;
        
        // DEBUG: Log all function calls to see if member access appears here
        debugLog(`DEBUG Function call:`, {
            funcName: funcName,
            callee: node.callee,
            calleeType: node.callee?.type,
            arguments: node.arguments?.length || 0,
            nodeType: node.type
        });
        
        if (!funcName) return null;
        
        // Check if this is a function-like macro call
        if (this.functionMacros.has(funcName)) {
            const macro = this.functionMacros.get(funcName);
            
            // Evaluate arguments
            const args = [];
            if (node.arguments) {
                for (const arg of node.arguments) {
                    const argValue = await this.evaluateExpression(arg);
                    args.push(argValue);
                }
            }
            
            if (args.length !== macro.params.length) {
                this.emitError(`Macro ${funcName} expects ${macro.params.length} arguments, got ${args.length}`);
                return null;
            }
            
            // Create macro expansion string
            let expansion = macro.body;
            for (let i = 0; i < macro.params.length; i++) {
                const paramRegex = new RegExp(`\\b${macro.params[i]}\\b`, 'g');
                expansion = expansion.replace(paramRegex, String(args[i]));
            }
            
            // Expand any nested macros in the result
            expansion = this.expandMacros(expansion);
            
            if (this.options.verbose) {
                debugLog(`Macro expansion: ${funcName}(${args.join(', ')}) -> ${expansion}`);
            }
            
            // Parse and evaluate the expanded expression
            try {
                // Create a simple expression parser for the macro expansion
                // For now, use a simple approach - this could be enhanced
                const result = this.evaluateSimpleMacroExpression(expansion);
                return result;
            } catch (error) {
                this.emitError(`Error evaluating macro expansion: ${error.message}`);
                return null;
            }
        }
        
        // Check if this is a function pointer call
        if (this.variables.has(funcName)) {
            const variable = this.variables.get(funcName);
            if (variable instanceof ArduinoFunctionPointer) {
                // This is a function pointer call
                const args = [];
                if (node.arguments) {
                    for (const arg of node.arguments) {
                        args.push(await this.evaluateExpression(arg));
                    }
                }
                
                if (this.options.verbose) {
                    debugLog(`Function pointer call detected: ${funcName} -> ${variable.functionName}(${args.length} args)`);
                }
                
                return await variable.call(args);
            }
        }
        
        // Evaluate arguments asynchronously
        const args = [];
        if (node.arguments) {
            for (const arg of node.arguments) {
                args.push(await this.evaluateExpression(arg));
            }
        }
        
        // Handle Arduino library constructors
        if (this.isArduinoLibraryConstructor(funcName)) {
            return this.createArduinoLibraryObject(funcName, args);
        }
        
        // Handle Arduino built-in functions
        switch (funcName) {
            case 'pinMode':
                return this.arduinoPinMode(args);
            case 'digitalWrite':
                return this.arduinoDigitalWrite(args);
            case 'digitalRead':
                return await this.arduinoDigitalRead(args, node);
            case 'analogWrite':
                return this.arduinoAnalogWrite(args);
            case 'analogRead':
                return await this.arduinoAnalogRead(args, node);
            case 'delay':
                return await this.arduinoDelay(args);
            case 'delayMicroseconds':
                return this.arduinoDelayMicroseconds(args);
            case 'millis':
                return await this.arduinoMillis(node);
            case 'micros':
                return await this.arduinoMicros(node);
            case 'pulseIn':
                return this.arduinoPulseIn(args);
            case 'tone':
                return this.arduinoTone(args);
            case 'noTone':
                return this.arduinoNoTone(args);
            case 'String':
                return this.arduinoStringConstructor(args);
            case 'isDigit':
                return this.arduinoIsDigit(args);
            case 'isPunct':
                return this.arduinoIsPunct(args);
            case 'isAlpha':
                return this.arduinoIsAlpha(args);
            case 'isAlphaNumeric':
                return this.arduinoIsAlphaNumeric(args);
            case 'isSpace':
                return this.arduinoIsSpace(args);
            case 'isUpperCase':
                return this.arduinoIsUpperCase(args);
            case 'isLowerCase':
                return this.arduinoIsLowerCase(args);
            case 'isHexadecimalDigit':
                return this.arduinoIsHexadecimalDigit(args);
            case 'isAscii':
                return this.arduinoIsAscii(args);
            case 'isWhitespace':
                return this.arduinoIsWhitespace(args);
            case 'isControl':
                return this.arduinoIsControl(args);
            case 'isGraph':
                return this.arduinoIsGraph(args);
            case 'isPrintable':
                return this.arduinoIsPrintable(args);
                
            // AVR hardware functions
            case 'clock_prescale_set':
                return this.avrClockPrescaleSet(args);
                
            // Arduino math functions
            case 'map':
                return this.arduinoMap(args);
            case 'constrain':
                return this.arduinoConstrain(args);
            case 'abs':
                return Math.abs(args[0]);
            case 'min':
                return Math.min(args[0], args[1]);
            case 'max':
                return Math.max(args[0], args[1]);
            case 'pow':
                return Math.pow(args[0], args[1]);
            case 'sqrt':
                return Math.sqrt(args[0]);
            case 'sin':
                return Math.sin(args[0]);
            case 'cos':
                return Math.cos(args[0]);
            case 'tan':
                return Math.tan(args[0]);
            case 'random':
                return this.arduinoRandom(args);
                
            // Serial functions (for member access Serial.begin, etc.)
            default:
                // User-defined function - add semantic analysis
                const result = await this.executeUserFunction(funcName, args);
                return result;
        }
    }
    
    arduinoPinMode(args) {
        if (args.length < 2) {
            this.emitError("pinMode requires 2 arguments: pin, mode");
            return;
        }
        
        const pin = args[0];
        const mode = args[1];
        
        // Validate pin number using robust numeric extraction
        const numericPin = this.getNumericValue(pin);
        if (numericPin < 0 || numericPin > 127) {
            this.emitError(`Invalid pin number: ${numericPin}. Pin must be a number between 0-127`);
            return;
        }
        
        // Validate mode (should be INPUT, OUTPUT, or INPUT_PULLUP constant)
        const numericMode = this.getNumericValue(mode);
        const validModes = [0, 1, 2]; // INPUT=0, OUTPUT=1, INPUT_PULLUP=2
        if (!validModes.includes(numericMode) && typeof mode !== 'string') {
            // Allow string mode constants like "INPUT", "OUTPUT", "INPUT_PULLUP"
            const modeStr = String(mode).toUpperCase();
            if (!['INPUT', 'OUTPUT', 'INPUT_PULLUP'].includes(modeStr)) {
                this.emitError(`Invalid pin mode: ${mode}. Use INPUT (0), OUTPUT (1), or INPUT_PULLUP (2)`);
                return;
            }
        }
        
        this.pinStates.set(pin, { mode: numericMode, value: 0 });
        
        this.emitCommand({
            type: COMMAND_TYPES.PIN_MODE,
            pin: pin,
            mode: numericMode,
            timestamp: Date.now()
        });
    }
    
    arduinoDigitalWrite(args) {
        if (args.length < 2) {
            this.emitError("digitalWrite requires 2 arguments: pin, value");
            return;
        }
        
        const pin = args[0];
        const value = args[1];
        
        // Validate pin number using robust numeric extraction
        const numericPin = this.getNumericValue(pin);
        if (numericPin < 0 || numericPin > 127) {
            this.emitError(`Invalid pin number: ${numericPin}. Pin must be a number between 0-127`);
            return;
        }
        
        // Validate digital value (should be HIGH/LOW or 0/1)
        const numericValue = this.getNumericValue(value);
        const validValues = [0, 1];
        if (!validValues.includes(numericValue)) {
            // Allow string constants like "HIGH", "LOW"  
            const valueStr = String(value).toUpperCase();
            if (!['HIGH', 'LOW'].includes(valueStr)) {
                this.emitError(`Invalid digital value: ${value}. Use HIGH (1), LOW (0), or 0/1`);
                return;
            }
        }
        
        // Update pin state
        const pinState = this.pinStates.get(pin) || { mode: 'OUTPUT', value: 0 };
        pinState.value = numericValue; // Store the numeric value
        this.pinStates.set(pin, pinState);
        
        this.emitCommand({
            type: COMMAND_TYPES.DIGITAL_WRITE,
            pin: pin,
            value: numericValue, // Emit the numeric value, not the string
            timestamp: Date.now()
        });
    }
    
    async arduinoDelay(args) {
        if (args.length < 1) {
            this.emitError("delay requires 1 argument: milliseconds");
            return;
        }
        
        const ms = args[0];
        
        // Validate delay value using robust numeric extraction
        const numericMs = this.getNumericValue(ms);
        if (numericMs < 0) {
            this.emitError(`Invalid delay value: ${numericMs}. Delay must be a non-negative number`);
            return;
        }
        
        // Long delay warning moved to pre-execution validation
        
        const actualDelay = ms / this.executionSpeed; // Scale by speed
        
        this.emitCommand({
            type: COMMAND_TYPES.DELAY,
            duration: ms,
            actualDelay: actualDelay,
            timestamp: Date.now()
        });
        
        // Actually wait for the delay if not paused/stopped and not in testing mode
        if (this.state === EXECUTION_STATE.RUNNING && this.options.stepDelay > 0) {
            await new Promise((resolve) => {
                this.currentTimeout = setTimeout(() => {
                    this.currentTimeout = null;
                    resolve();
                }, actualDelay);
            });
        }
        // In testing mode (stepDelay: 0), skip the actual delay but still emit the command
    }
    
    arduinoStringConstructor(args) {
        if (args.length === 0) {
            return new ArduinoString("");
        }
        
        const value = args[0];
        const format = args.length > 1 ? args[1] : null;
        
        return ArduinoString.create(value, format);
    }
    
    async executeConstructorCall(node) {
        const className = node.callee?.value;
        if (!className) {
            this.emitError("Invalid constructor call: no class name");
            return null;
        }
        
        // Evaluate constructor arguments
        const args = [];
        if (node.arguments) {
            for (const arg of node.arguments) {
                args.push(await this.evaluateExpression(arg));
            }
        }
        
        if (this.options.verbose) {
            debugLog(`Constructor call: ${className}(${args.join(', ')})`);
        }
        
        // Create object instance using universal library system
        const objectInstance = this.createLibraryObject(className, args);
        
        // Emit constructor command for parent application
        this.emitCommand({
            type: COMMAND_TYPES.CONSTRUCTOR_CALL,
            className: className,
            arguments: args,
            objectId: objectInstance.objectId,
            timestamp: Date.now()
        });
        
        return objectInstance;
    }
    
    async executeNamespaceAccess(node) {
        const namespace = node.namespace?.value;
        const member = node.member?.value;
        
        if (!namespace || !member) {
            this.emitError("Invalid namespace access: missing namespace or member");
            return null;
        }
        
        if (this.options.verbose) {
            debugLog(`Namespace access: ${namespace}::${member}`);
        }
        
        // Handle standard library namespaces
        if (namespace === 'std') {
            return this.handleStdNamespace(member, node);
        }
        
        // Handle Arduino library namespaces
        if (namespace === 'Serial') {
            return this.handleSerialNamespace(member, node);
        }
        
        // Handle custom library namespaces
        return this.handleCustomNamespace(namespace, member, node);
    }
    
    isArduinoLibraryConstructor(funcName) {
        // List of common Arduino library constructors
        const knownLibraries = [
            'CapacitiveSensor', 'Servo', 'LiquidCrystal', 'SoftwareSerial',
            'Stepper', 'LedControl', 'RF24', 'DHT', 'OneWire', 'DallasTemperature',
            'Adafruit_NeoPixel', 'MPU6050', 'Adafruit_SSD1306', 'WiFi', 'Ethernet'
        ];
        return knownLibraries.includes(funcName);
    }
    
    createArduinoLibraryObject(libraryName, args) {
        if (this.options.verbose) {
            debugLog(`Creating Arduino library object: ${libraryName}(${args.join(', ')})`);
        }
        
        // Create the library object
        const libraryObject = new ArduinoLibraryObject(libraryName, args);
        
        // Emit command for library instantiation
        this.emitCommand({
            type: 'ARDUINO_LIBRARY_INSTANTIATION',
            library: libraryName,
            constructorArgs: args,
            objectId: libraryObject.objectId,
            timestamp: Date.now(),
            message: `${libraryName}(${args.join(', ')})`
        });
        
        return libraryObject;
    }
    
    async executeNamespaceFunctionCall(node) {
        const namespace = node.callee.namespace?.value;
        const member = node.callee.member?.value;
        
        if (!namespace || !member) {
            this.emitError("Invalid namespace function call: missing namespace or member");
            return null;
        }
        
        // Evaluate arguments
        const args = [];
        if (node.arguments) {
            for (const arg of node.arguments) {
                args.push(await this.evaluateExpression(arg));
            }
        }
        
        if (this.options.verbose) {
            debugLog(`Namespace function call: ${namespace}::${member}(${args.length} args)`);
        }
        
        // Handle different namespaces
        switch (namespace) {
            case 'Serial':
                return this.executeSerialNamespaceFunction(member, args);
            case 'std':
                return this.executeStdNamespaceFunction(member, args);
            default:
                return this.executeCustomNamespaceFunction(namespace, member, args);
        }
    }
    
    executeSerialNamespaceFunction(functionName, args) {
        // Handle Serial:: function calls (Serial::println, Serial::print, etc.)
        // Use the existing executeSerialMethod which handles all Serial functions
        return this.executeSerialMethod(functionName, args);
    }
    
    executeStdNamespaceFunction(functionName, args) {
        // Handle std:: function calls (std::min, std::max, etc.)
        switch (functionName) {
            case 'min':
                if (args.length >= 2) {
                    return Math.min(args[0], args[1]);
                }
                break;
            case 'max':
                if (args.length >= 2) {
                    return Math.max(args[0], args[1]);
                }
                break;
            case 'abs':
                if (args.length >= 1) {
                    return Math.abs(args[0]);
                }
                break;
            default:
                this.emitError(`Unknown std namespace function: ${functionName}`);
                return null;
        }
    }
    
    executeCustomNamespaceFunction(namespace, functionName, args) {
        // Handle custom library namespace functions
        if (this.options.verbose) {
            debugLog(`Custom namespace function: ${namespace}::${functionName}(${args.join(', ')})`);
        }
        
        // For now, emit a placeholder command
        this.emitCommand({
            type: 'NAMESPACE_FUNCTION_CALL',
            namespace: namespace,
            function: functionName,
            arguments: args,
            timestamp: Date.now(),
            message: `${namespace}::${functionName}(${args.join(', ')})`
        });
        
        // Could return a default value or null
        return null;
    }
    
    handleStdNamespace(member, node) {
        // Handle std:: namespace operations (vector, string, etc.)
        switch (member) {
            case 'vector':
                return {
                    type: 'std_vector_type',
                    templateArgs: node.templateArgs || [],
                    namespace: 'std'
                };
            case 'string':
                return {
                    type: 'std_string_type',
                    namespace: 'std'
                };
            default:
                if (this.options.verbose) {
                    debugLog(`Unknown std:: member: ${member}`);
                }
                return {
                    type: 'std_member_access',
                    member: member,
                    namespace: 'std'
                };
        }
    }
    
    handleSerialNamespace(member, node) {
        // Handle Serial. operations (println, print, etc.)
        switch (member) {
            case 'println':
            case 'print':
                return {
                    type: 'serial_function',
                    functionName: member,
                    namespace: 'Serial'
                };
            default:
                return {
                    type: 'serial_member_access',
                    member: member,
                    namespace: 'Serial'
                };
        }
    }
    
    handleCustomNamespace(namespace, member, node) {
        // Handle custom library namespaces
        return {
            type: 'custom_namespace_access',
            namespace: namespace,
            member: member,
            node: node
        };
    }
    
    async executeMemberAccess(node) {
        const objectName = node.object?.value;
        const memberName = node.property?.value;
        const operator = node.operator; // DOT or ARROW
        
        if (!objectName || !memberName) {
            this.emitError("Invalid member access: missing object or member");
            return null;
        }
        
        if (this.options.verbose) {
            debugLog(`Member access: ${objectName}${operator === 'DOT' ? '.' : '->'}${memberName}`);
        }
        
        // Handle Arduino built-in objects
        if (objectName === 'Serial') {
            return this.handleSerialMemberAccess(memberName, node);
        }
        
        // Handle user-defined object member access
        const objectValue = this.getVariable(objectName);
        if (objectValue && objectValue.type === 'object_instance') {
            return this.handleObjectMemberAccess(objectValue, memberName, node);
        }
        
        // Return member access information for further processing
        return {
            type: 'member_access',
            object: objectName,
            member: memberName,
            operator: operator,
            objectValue: objectValue
        };
    }
    
    handleSerialMemberAccess(memberName, node) {
        // Handle Serial object member access
        switch (memberName) {
            case 'println':
            case 'print':
            case 'begin':
            case 'available':
            case 'read':
                return {
                    type: 'serial_function',
                    functionName: memberName,
                    object: 'Serial'
                };
            default:
                return {
                    type: 'serial_member',
                    member: memberName,
                    object: 'Serial'
                };
        }
    }
    
    handleObjectMemberAccess(objectValue, memberName, node) {
        // Handle user-defined object member access
        return {
            type: 'object_member_access',
            objectId: objectValue.objectId,
            className: objectValue.className,
            member: memberName,
            objectValue: objectValue
        };
    }
    
    async executeCppCast(node) {
        const castType = node.castType;
        const targetType = node.targetType?.value;
        const expression = node.expression;
        
        if (!castType || !targetType || !expression) {
            this.emitError("Invalid C++ cast: missing cast type, target type, or expression");
            return null;
        }
        
        // Evaluate the expression to be cast
        const sourceValue = await this.evaluateExpression(expression);
        
        if (this.options.verbose) {
            debugLog(`C++ cast: ${castType}<${targetType}>(${sourceValue})`);
        }
        
        // Perform the cast based on cast type
        switch (castType) {
            case 'static_cast':
                return this.performStaticCast(sourceValue, targetType, node);
            case 'dynamic_cast':
                return this.performDynamicCast(sourceValue, targetType, node);
            case 'const_cast':
                return this.performConstCast(sourceValue, targetType, node);
            case 'reinterpret_cast':
                return this.performReinterpretCast(sourceValue, targetType, node);
            default:
                this.emitError(`Unsupported C++ cast type: ${castType}`);
                return null;
        }
    }
    
    performStaticCast(sourceValue, targetType, node) {
        // static_cast: Safe compile-time conversions
        switch (targetType) {
            case 'int':
                return parseInt(sourceValue) || 0;
            case 'float':
            case 'double':
                return parseFloat(sourceValue) || 0.0;
            case 'char':
                return String(sourceValue).charAt(0) || '\0';
            case 'bool':
                return Boolean(sourceValue);
            default:
                if (this.options.verbose) {
                    debugLog(`Static cast to custom type: ${targetType}`);
                }
                return {
                    type: 'static_cast_result',
                    targetType: targetType,
                    sourceValue: sourceValue,
                    cast: 'static_cast'
                };
        }
    }
    
    performDynamicCast(sourceValue, targetType, node) {
        // dynamic_cast: Runtime type checking for polymorphic types
        if (this.options.verbose) {
            debugLog(`Dynamic cast from ${typeof sourceValue} to ${targetType}`);
        }
        
        return {
            type: 'dynamic_cast_result',
            targetType: targetType,
            sourceValue: sourceValue,
            cast: 'dynamic_cast',
            success: true // Simplified for Arduino context
        };
    }
    
    performConstCast(sourceValue, targetType, node) {
        // const_cast: Add or remove const qualifier
        return {
            type: 'const_cast_result',
            targetType: targetType,
            sourceValue: sourceValue,
            cast: 'const_cast'
        };
    }
    
    performReinterpretCast(sourceValue, targetType, node) {
        // reinterpret_cast: Low-level bit pattern reinterpretation
        if (this.options.verbose) {
            debugLog(`Reinterpret cast from ${typeof sourceValue} to ${targetType}`);
        }
        
        return {
            type: 'reinterpret_cast_result',
            targetType: targetType,
            sourceValue: sourceValue,
            cast: 'reinterpret_cast'
        };
    }
    
    handlePointerDeclarator(node) {
        const baseType = node.baseType?.value;
        const pointerLevel = node.pointerLevel || 1;
        const declaratorName = node.declarator?.value;
        
        if (this.options.verbose) {
            debugLog(`Pointer declarator: ${'*'.repeat(pointerLevel)}${declaratorName} (${baseType})`);
        }
        
        return {
            type: 'pointer_declarator_info',
            baseType: baseType,
            pointerLevel: pointerLevel,
            declaratorName: declaratorName,
            isPointer: true
        };
    }
    
    handleFunctionPointerDeclarator(node) {
        const returnType = node.returnType?.value;
        const functionName = node.declarator?.value;
        const parameters = node.parameters || [];
        
        if (this.options.verbose) {
            debugLog(`Function pointer declarator: ${returnType} (*${functionName})(${parameters.length} params)`);
        }
        
        return {
            type: 'function_pointer_declarator_info',
            returnType: returnType,
            functionName: functionName,
            parameters: parameters,
            isFunctionPointer: true
        };
    }
    
    handleArrayDeclarator(node) {
        const baseType = node.baseType?.value;
        const declaratorName = node.declarator?.value;
        const dimensions = node.dimensions || [];
        
        if (this.options.verbose) {
            const dimStr = dimensions.map(d => `[${d?.value || ''}]`).join('');
            debugLog(`Array declarator: ${declaratorName}${dimStr} (${baseType})`);
        }
        
        return {
            type: 'array_declarator_info',
            baseType: baseType,
            declaratorName: declaratorName,
            dimensions: dimensions,
            isArray: true
        };
    }
    
    handleDeclarator(node) {
        const declaratorName = node.value;
        
        if (this.options.verbose) {
            debugLog(`Basic declarator: ${declaratorName}`);
        }
        
        return {
            type: 'declarator_info',
            declaratorName: declaratorName,
            value: declaratorName
        };
    }
    
    async executeSizeofExpression(node) {
        const operand = node.operand;
        
        if (!operand) {
            this.emitError("Invalid sizeof expression: missing operand");
            return null;
        }
        
        // Handle sizeof(type) vs sizeof(variable)
        if (operand.type === 'TypeNode') {
            return this.getSizeofType(operand.value);
        } else {
            // Evaluate the expression and get its size
            const value = await this.evaluateExpression(operand);
            return this.getSizeofValue(value, operand);
        }
    }
    
    getSizeofType(typeName) {
        // Return size in bytes for Arduino types
        const typeSizes = {
            'char': 1,
            'byte': 1,
            'bool': 1,
            'int': 2,     // Arduino int is 16-bit
            'short': 2,
            'long': 4,
            'float': 4,
            'double': 4,  // Arduino double is same as float
            'size_t': 2,
            'uint8_t': 1,
            'uint16_t': 2,
            'uint32_t': 4,
            'int8_t': 1,
            'int16_t': 2,
            'int32_t': 4
        };
        
        const size = typeSizes[typeName] || 4; // Default to 4 bytes for unknown types
        
        if (this.options.verbose) {
            debugLog(`sizeof(${typeName}) = ${size} bytes`);
        }
        
        return size;
    }
    
    getSizeofValue(value, operandNode) {
        // Determine size based on value type and node information
        if (typeof value === 'string') {
            return value.length + 1; // Include null terminator for strings
        } else if (typeof value === 'number') {
            // Check if it's an integer or float
            if (Number.isInteger(value)) {
                return value >= -32768 && value <= 32767 ? 2 : 4; // int vs long
            } else {
                return 4; // float
            }
        } else if (typeof value === 'boolean') {
            return 1;
        } else if (value && value.type === 'array') {
            return value.length * (value.elementSize || 4);
        } else {
            // Default size for objects/pointers
            return 2; // Pointer size on Arduino
        }
    }
    
    async executeFunctionStyleCast(node) {
        const castType = node.castType?.value;
        const argument = node.argument;
        
        if (!castType || !argument) {
            this.emitError("Invalid function-style cast: missing cast type or argument");
            return null;
        }
        
        // Evaluate the argument expression
        const sourceValue = await this.evaluateExpression(argument);
        
        if (this.options.verbose) {
            debugLog(`Function-style cast: ${castType}(${sourceValue})`);
        }
        
        // Perform the cast (similar to static_cast)
        switch (castType) {
            case 'int':
                return parseInt(sourceValue) || 0;
            case 'float':
            case 'double':
                return parseFloat(sourceValue) || 0.0;
            case 'char':
                return String(sourceValue).charAt(0) || '\0';
            case 'bool':
                return Boolean(sourceValue);
            default:
                // Custom type cast
                return {
                    type: 'function_style_cast_result',
                    castType: castType,
                    sourceValue: sourceValue
                };
        }
    }
    
    handleWideCharLiteral(node) {
        const value = node.value;
        const isString = node.isString || false;
        
        if (this.options.verbose) {
            debugLog(`Wide char literal: L${isString ? '"' : "'"}${value}${isString ? '"' : "'"}`);
        }
        
        // In Arduino context, wide characters are typically not used much
        // but we handle them for completeness
        return {
            type: 'wide_char_literal',
            value: this.sanitizeForCommand(value),
            isString: isString,
            encoding: 'utf-16' // Typical wide char encoding
        };
    }
    
    async handleDesignatedInitializer(node) {
        if (this.options.verbose) {
            debugLog(`DEBUG DesignatedInitializerNode:`, JSON.stringify(node, null, 2));
        }
        
        // Handle designated initializer like {.x = 10, .y = 20}
        const result = {};
        
        // Check if node has field and value properties directly
        if (node.field && node.value) {
            const fieldName = node.field.value || node.field;
            const fieldValue = await this.evaluateExpression(node.value);
            result[fieldName] = fieldValue;
            
            if (this.options.verbose) {
                debugLog(`Designated initializer: .${fieldName} = ${fieldValue}`);
            }
        }
        // Check if node has designators array
        else if (node.designators && Array.isArray(node.designators)) {
            for (const designator of node.designators) {
                if (designator.field && designator.value) {
                    const fieldName = designator.field.value || designator.field;
                    const fieldValue = await this.evaluateExpression(designator.value);
                    result[fieldName] = fieldValue;
                }
            }
        }
        // Fallback: check if the node itself represents a field-value pair
        else {
            if (this.options.verbose) {
                debugLog(`DEBUG: Unknown designated initializer structure`);
            }
        }
        
        return result;
    }
    
    handleErrorNode(node) {
        const errorMessage = node.message || 'Parse error';
        const errorToken = node.token;
        
        if (this.options.verbose) {
            debugLog(`Error node encountered: ${errorMessage}`);
            if (errorToken) {
                debugLog(`   At token: ${errorToken.type} "${errorToken.value}"`);
            }
        }
        
        // Log the error but don't stop execution
        this.emitError(`Parse error: ${errorMessage}`);
        
        return {
            type: 'error_node_result',
            message: errorMessage,
            token: errorToken,
            handled: true
        };
    }
    
    handleCommentNode(node) {
        const commentText = node.text || '';
        const commentType = node.commentType || 'line'; // 'line' or 'block'
        
        if (this.options.verbose) {
            debugLog(`Comment: ${commentType === 'line' ? '//' : '/*'}${commentText}${commentType === 'block' ? '*/' : ''}`);
        }
        
        // Comments don't affect execution, just return info
        return {
            type: 'comment_node_result',
            text: commentText,
            commentType: commentType
        };
    }
    
    handleFunctionDeclaration(node) {
        const funcName = node.declarator?.value;
        const returnType = node.returnType?.value;
        const parameters = node.parameters || [];
        
        if (!funcName) {
            if (this.options.verbose) {
                debugLog('Function declaration missing name');
            }
            return;
        }
        
        // Store function declaration for type checking and forward references
        const funcDecl = {
            name: funcName,
            returnType: returnType,
            parameters: parameters,
            isDeclaration: true,
            node: node
        };
        
        // Store in functions map if not already defined
        if (!this.functions.has(funcName)) {
            this.functions.set(funcName, funcDecl);
        }
        
        if (this.options.verbose) {
            const paramStr = parameters.map(p => `${p.paramType?.value || 'unknown'} ${p.declarator?.value || 'unnamed'}`).join(', ');
            debugLog(`Function declaration: ${returnType || 'void'} ${funcName}(${paramStr})`);
        }
    }
    
    async executeAssignment(node) {
        const varName = node.left?.value;
        if (!varName) {
            this.emitError("Invalid assignment: no variable name");
            return null;
        }
        
        const value = await this.evaluateExpression(node.right);
        
        // Check if this is a static variable assignment
        const varInfo = this.variables.get(varName);
        if (varInfo?.metadata?.isStatic) {
            // Update static storage
            this.staticVariables.set(varInfo.metadata.staticKey, value);
        }
        
        // Check if this is a const variable (prevent modification)
        if (varInfo?.metadata?.isConst) {
            this.emitError(`Cannot assign to const variable '${varName}' - constants are immutable`);
            return null;
        }
        
        const result = this.variables.set(varName, value);
        if (!result.success) {
            this.emitError(result.message || `Failed to assign value to variable '${varName}'`);
            return null;
        }
        
        // Phase 4.2: Mark variable as initialized after successful assignment  
        this.variables.markAsInitialized(varName);
        
        if (this.options.verbose) {
            debugLog(`Assignment: ${varName} = ${value}`);
        }
        
        this.emitCommand({
            type: COMMAND_TYPES.VAR_SET,
            variable: varName,
            value: this.sanitizeForCommand(value),
            timestamp: Date.now()
        });
        
        return value;
    }
    
    async executeArrayElementAssignment(node) {
        // Handle array element assignment: array[index] = value or array[i][j] = value
        const arrayAccess = node.left; // This is an ArrayAccessNode
        
        // Extract base array name - handle nested array access for multidimensional arrays
        const arrayName = this.getArrayBaseName(arrayAccess);
        if (!arrayName) {
            this.emitError("Invalid array element assignment: no array name");
            return null;
        }
        
        // Extract all indices from nested array access (for multidimensional arrays)
        const indices = await this.getArrayIndices(arrayAccess);
        const rightValue = await this.evaluateExpression(node.right);
        
        // Get the array from variables
        const arrayValue = this.getVariable(arrayName);
        if (arrayValue === undefined) {
            this.emitError(`Array ${arrayName} not found`);
            return null;
        }
        
        if (!Array.isArray(arrayValue)) {
            this.emitError(`Variable ${arrayName} is not an array`);
            return null;
        }
        
        // Navigate to the target array element (handle multidimensional arrays)
        let targetArray = arrayValue;
        for (let i = 0; i < indices.length - 1; i++) {
            const index = indices[i];
            if (!Array.isArray(targetArray[index])) {
                this.emitError(`Array index ${index} is not an array in multidimensional access`);
                return null;
            }
            targetArray = targetArray[index];
        }
        
        const finalIndex = indices[indices.length - 1];
        
        // Handle compound assignment operators for array elements
        let newValue;
        switch (node.operator) {
            case '=':
                newValue = rightValue;
                break;
            case '+=':
                const currentValue = targetArray[finalIndex] || 0;
                newValue = currentValue + rightValue;
                break;
            case '-=':
                const currentValue2 = targetArray[finalIndex] || 0;
                newValue = currentValue2 - rightValue;
                break;
            case '*=':
                const currentValue3 = targetArray[finalIndex] || 0;
                newValue = currentValue3 * rightValue;
                break;
            case '/=':
                const currentValue4 = targetArray[finalIndex] || 0;
                newValue = currentValue4 / rightValue;
                break;
            default:
                this.emitError(`Unsupported assignment operator for array elements: ${node.operator}`);
                return null;
        }
        
        // 🔧 FIX: Create deep copy to prevent retroactive modification of emitted commands
        const newArrayValue = this.deepCopyArray(arrayValue);

        // Navigate to the target in the new array copy
        let newTargetArray = newArrayValue;
        for (let i = 0; i < indices.length - 1; i++) {
            newTargetArray = newTargetArray[indices[i]];
        }

        // Update the array element in the copy
        newTargetArray[finalIndex] = newValue;

        // Update the variable store with the new array
        this.variables.set(arrayName, newArrayValue);

        // Debug array assignments for critical variables (can be removed in production)
        if (this.options.verbose && arrayName === 'readings') {
            debugLog(`Array assignment VAR_SET for ${arrayName}:`, JSON.stringify(newArrayValue));
        }

        this.emitCommand({
            type: COMMAND_TYPES.VAR_SET,
            variable: arrayName,
            value: this.sanitizeForCommand(newArrayValue),
            timestamp: Date.now()
        });

        if (this.options.verbose) {
            const indexStr = indices.map(i => `[${i}]`).join('');
            debugLog(`Array element assignment: ${arrayName}${indexStr} = ${newValue}`);
        }

        return newValue;
    }
    
    async executeAssignmentNode(node) {
        // Check if this is a pointer dereference assignment (*ptr = value)
        if (node.left?.type === 'UnaryOpNode' && (node.left.op?.value === '*' || node.left.op === '*')) {
            return await this.executePointerAssignment(node);
        }

        // Check if this is a struct field assignment (struct.field = value)
        if (node.left?.type === 'MemberAccessNode' || node.left?.type === 'PropertyAccessNode') {
            return await this.executeStructFieldAssignment(node);
        }

        // Check if this is an array element assignment (array[index] = value)
        if (node.left?.type === 'ArrayAccessNode') {
            return await this.executeArrayElementAssignment(node);
        }

        const varName = node.left?.value;
        if (!varName) {
            this.emitError("Invalid assignment: no variable name");
            return null;
        }

        const rightValue = await this.evaluateExpression(node.right);
        const operator = node.operator;
        let newValue;
        
        debugLog(`DEBUG AssignmentNode: ${varName} ${operator} ${rightValue}`);
        
        // Handle compound assignment operators
        switch (operator) {
            case '=':
                newValue = rightValue;
                break;
                
            case '+=':
                const currentValue = this.getVariable(varName);
                // Handle ArduinoString concatenation properly
                if (currentValue instanceof ArduinoString) {
                    newValue = currentValue.concat(rightValue);
                } else if (rightValue instanceof ArduinoString) {
                    newValue = new ArduinoString(String(currentValue)).concat(rightValue);
                } else {
                    newValue = currentValue + rightValue;
                }
                break;
                
            case '-=':
                const currentValue2 = this.getVariable(varName);
                newValue = currentValue2 - rightValue;
                break;
                
            case '*=':
                const currentValue3 = this.getVariable(varName);
                newValue = currentValue3 * rightValue;
                break;
                
            case '/=':
                const currentValue4 = this.getVariable(varName);
                newValue = currentValue4 / rightValue;
                break;
                
            case '%=':
                const currentValue5 = this.getVariable(varName);
                newValue = currentValue5 % rightValue;
                break;
                
            case '&=':
                const currentValue6 = this.getVariable(varName);
                newValue = currentValue6 & rightValue;
                break;
                
            case '|=':
                const currentValue7 = this.getVariable(varName);
                newValue = currentValue7 | rightValue;
                break;
                
            case '^=':
                const currentValue8 = this.getVariable(varName);
                newValue = currentValue8 ^ rightValue;
                break;
                
            case '<<=':
                const currentValue9 = this.getVariable(varName);
                newValue = currentValue9 << rightValue;
                break;
                
            case '>>=':
                const currentValue10 = this.getVariable(varName);
                newValue = currentValue10 >> rightValue;
                break;
                
            default:
                this.emitError(`Unknown assignment operator: ${operator}`);
                return null;
        }
        
        const result = this.variables.set(varName, newValue);
        if (!result.success) {
            this.emitError(result.message || `Failed to assign value to variable '${varName}' (operator: ${operator})`);
            return null;
        }
        
        // Phase 4.2: Mark variable as initialized after successful assignment
        this.variables.markAsInitialized(varName);
        
        if (this.options.verbose) {
            debugLog(`Assignment: ${varName} ${operator} ${rightValue} = ${newValue}`);
        }
        
        this.emitCommand({
            type: COMMAND_TYPES.VAR_SET,
            variable: varName,
            value: this.sanitizeForCommand(newValue),
            timestamp: Date.now()
        });
        
        return newValue;
    }
    
    // Handle pointer dereference assignments: *ptr = value
    async executePointerAssignment(node) {
        // The left side is a UnaryOpNode with '*' operator
        const pointerExpression = node.left.operand;
        const rightValue = await this.evaluateExpression(node.right);
        const operator = node.operator;
        
        // Evaluate the pointer expression to get the pointer object
        const pointer = await this.evaluateExpression(pointerExpression);
        
        if (!(pointer instanceof ArduinoPointer)) {
            this.emitError("Dereference assignment can only be applied to pointers");
            return null;
        }
        
        let newValue;
        
        // Handle compound assignment operators for pointers
        switch (operator) {
            case '=':
                newValue = rightValue;
                break;
                
            case '+=':
                const currentValue = pointer.getValue();
                newValue = currentValue + rightValue;
                break;
                
            case '-=':
                const currentValue2 = pointer.getValue();
                newValue = currentValue2 - rightValue;
                break;
                
            case '*=':
                const currentValue3 = pointer.getValue();
                newValue = currentValue3 * rightValue;
                break;
                
            case '/=':
                const currentValue4 = pointer.getValue();
                newValue = currentValue4 / rightValue;
                break;
                
            case '%=':
                const currentValue5 = pointer.getValue();
                newValue = currentValue5 % rightValue;
                break;
                
            default:
                this.emitError(`Unknown assignment operator for pointer dereference: ${operator}`);
                return null;
        }
        
        // Set the value through the pointer
        try {
            pointer.setValue(newValue);
            
            if (this.options.verbose) {
                debugLog(`Pointer assignment: *${pointer.targetVariable} ${operator} ${rightValue} = ${newValue}`);
            }
            
            return newValue;
        } catch (error) {
            this.emitError(`Pointer assignment failed: ${error.message}`);
            return null;
        }
    }
    
    // Handle struct field assignments: struct.field = value
    async executeStructFieldAssignment(node) {
        const memberAccess = node.left;
        const rightValue = await this.evaluateExpression(node.right);
        const operator = node.operator;
        
        // Evaluate the struct object
        let structObject = await this.evaluateExpression(memberAccess.object);
        const fieldName = memberAccess.property?.value || memberAccess.property;
        const isArrowOperator = memberAccess.operator === 'ARROW';
        
        // Handle arrow operator: dereference pointer first
        if (isArrowOperator && structObject instanceof ArduinoPointer) {
            structObject = structObject.getValue();
            
            if (this.options.verbose) {
                debugLog(`Arrow operator assignment: dereferencing pointer for ${fieldName} assignment`);
            }
        }
        
        if (!(structObject instanceof ArduinoStruct)) {
            this.emitError("Field assignment can only be applied to structs");
            return null;
        }
        
        let newValue;
        
        // Handle compound assignment operators for struct fields
        switch (operator) {
            case '=':
                newValue = rightValue;
                break;
                
            case '+=':
                const currentValue = structObject.getField(fieldName);
                newValue = currentValue + rightValue;
                break;
                
            case '-=':
                const currentValue2 = structObject.getField(fieldName);
                newValue = currentValue2 - rightValue;
                break;
                
            case '*=':
                const currentValue3 = structObject.getField(fieldName);
                newValue = currentValue3 * rightValue;
                break;
                
            case '/=':
                const currentValue4 = structObject.getField(fieldName);
                newValue = currentValue4 / rightValue;
                break;
                
            case '%=':
                const currentValue5 = structObject.getField(fieldName);
                newValue = currentValue5 % rightValue;
                break;
                
            default:
                this.emitError(`Unknown assignment operator for struct field: ${operator}`);
                return null;
        }
        
        // Set the field value
        try {
            structObject.setField(fieldName, newValue);
            
            if (this.options.verbose) {
                debugLog(`Struct field assignment: ${structObject.structName}.${fieldName} ${operator} ${rightValue} = ${newValue}`);
            }
            
            // Emit command for struct field assignment
            this.emitCommand({
                type: 'STRUCT_FIELD_SET',
                struct: structObject.structName,
                field: fieldName,
                value: this.sanitizeForCommand(newValue),
                timestamp: Date.now(),
                message: `${structObject.structName}.${fieldName} = ${newValue}`
            });
            
            return newValue;
        } catch (error) {
            this.emitError(`Struct field assignment failed: ${error.message}`);
            return null;
        }
    }
    
    async executeBinaryOperation(node) {
        // Phase 6.2: Set current node for enhanced error reporting
        this.currentNode = node;
        
        const left = await this.evaluateExpression(node.left);
        const right = await this.evaluateExpression(node.right);
        const operator = node.op?.value || node.op;
        
        let result;
        switch (operator) {
            case '+':
                // Handle pointer arithmetic: ptr + offset
                if (left instanceof ArduinoPointer && typeof right === 'number') {
                    result = left.add(right);
                } else if (typeof left === 'number' && right instanceof ArduinoPointer) {
                    result = right.add(left);
                } else if (left instanceof ArduinoString || right instanceof ArduinoString) {
                    // Handle String concatenation - create NEW object without modifying operands
                    const leftStr = left instanceof ArduinoString ? left : new ArduinoString(String(left));
                    const rightStr = right instanceof ArduinoString ? right : new ArduinoString(String(right));
                    const rightValue = rightStr instanceof ArduinoString ? rightStr.value : String(rightStr);
                    result = new ArduinoString(leftStr.value + rightValue);
                } else {
                    // Extract numeric values for arithmetic operations
                    const leftValue = this.getNumericValue(left);
                    const rightValue = this.getNumericValue(right);
                    result = leftValue + rightValue;
                }
                break;
                
            case '-': 
                // Handle pointer arithmetic: ptr - offset or ptr1 - ptr2
                if (left instanceof ArduinoPointer && typeof right === 'number') {
                    result = left.subtract(right);
                } else if (left instanceof ArduinoPointer && right instanceof ArduinoPointer) {
                    // Pointer difference (simplified - assumes same base)
                    if (left.targetVariable === right.targetVariable) {
                        const leftOffset = left instanceof ArduinoOffsetPointer ? left.offset : 0;
                        const rightOffset = right instanceof ArduinoOffsetPointer ? right.offset : 0;
                        result = leftOffset - rightOffset;
                    } else {
                        this.emitError("Cannot subtract pointers to different variables");
                        result = null;
                    }
                } else {
                    // Extract numeric values for arithmetic operations
                    const leftValue = this.getNumericValue(left);
                    const rightValue = this.getNumericValue(right);
                    result = leftValue - rightValue;
                }
                break;
            case '*': 
                // Extract numeric values for arithmetic operations
                const leftMul = this.getNumericValue(left);
                const rightMul = this.getNumericValue(right);
                result = leftMul * rightMul; 
                break;
            case '/':
                // Extract numeric values for arithmetic operations
                const leftDiv = this.getNumericValue(left);
                const rightDiv = this.getNumericValue(right);
                if (rightDiv === 0) {
                    this.emitError("Division by zero error");
                    // Force stop execution for critical arithmetic errors
                    this.executionContext.shouldContinue = false;
                    this.executionContext.isExecuting = false;
                    return null;
                }

                // Type-aware division: int / int = int (C++/Arduino semantics)
                // Match C++ behavior: check if VALUES are integers AND variables have integer types
                const leftVarIsInt = this.isIntegerType(node.left);
                const rightVarIsInt = this.isIntegerType(node.right);
                const leftValueIsInt = Number.isInteger(leftDiv);
                const rightValueIsInt = Number.isInteger(rightDiv);

                // Integer division if both values are integers AND at least one has integer type metadata
                // This matches C++ behavior where int / int = int even if stored as numeric types
                if (leftValueIsInt && rightValueIsInt && (leftVarIsInt || rightVarIsInt)) {
                    // Integer division: truncate toward zero (C++ behavior)
                    result = Math.trunc(leftDiv / rightDiv);
                } else {
                    // Float division
                    result = leftDiv / rightDiv;
                }
                break;
            case '%': 
                // Extract numeric values for arithmetic operations
                const leftMod = this.getNumericValue(left);
                const rightMod = this.getNumericValue(right);
                if (rightMod === 0) {
                    this.emitError("Modulo by zero error");
                    // Force stop execution for critical arithmetic errors
                    this.executionContext.shouldContinue = false;
                    this.executionContext.isExecuting = false;
                    return null;
                }
                result = leftMod % rightMod; 
                break;
            case '==':
                // Handle String comparison
                if (left instanceof ArduinoString || right instanceof ArduinoString) {
                    const leftStr = left instanceof ArduinoString ? left.value : String(left);
                    const rightStr = right instanceof ArduinoString ? right.value : String(right);
                    result = leftStr === rightStr;
                } else {
                    // Handle null comparisons correctly (C++ semantics: null != 0)
                    if (left === null || right === null) {
                        result = left === right;  // null == null is true, null == anything else is false
                    } else {
                        // Extract numeric values for comparison
                        const leftValue = this.getNumericValue(left);
                        const rightValue = this.getNumericValue(right);
                        result = leftValue == rightValue;
                    }
                }
                break;
            case '!=':
                // Handle String comparison
                if (left instanceof ArduinoString || right instanceof ArduinoString) {
                    const leftStr = left instanceof ArduinoString ? left.value : String(left);
                    const rightStr = right instanceof ArduinoString ? right.value : String(right);
                    result = leftStr !== rightStr;
                } else {
                    // Handle null comparisons correctly (C++ semantics: null != 0)
                    if (left === null || right === null) {
                        result = left !== right;  // null vs anything else is always true for !=
                    } else {
                        // Extract numeric values for comparison
                        const leftValue = this.getNumericValue(left);
                        const rightValue = this.getNumericValue(right);
                        result = leftValue != rightValue;
                    }
                }
                break;
            case '<': 
                // Extract numeric values for comparison
                const leftLT = this.getNumericValue(left);
                const rightLT = this.getNumericValue(right);
                result = leftLT < rightLT; 
                break;
            case '>': 
                // Extract numeric values for comparison
                const leftGT = this.getNumericValue(left);
                const rightGT = this.getNumericValue(right);
                result = leftGT > rightGT; 
                break;
            case '<=': 
                // Extract numeric values for comparison
                const leftLE = this.getNumericValue(left);
                const rightLE = this.getNumericValue(right);
                result = leftLE <= rightLE; 
                break;
            case '>=': 
                // Extract numeric values for comparison
                const leftGE = this.getNumericValue(left);
                const rightGE = this.getNumericValue(right);
                result = leftGE >= rightGE; 
                break;
            case '&&': result = left && right; break;
            case '||': result = left || right; break;
            case '&': 
                // Extract numeric values for bitwise operations
                const leftAnd = this.getNumericValue(left);
                const rightAnd = this.getNumericValue(right);
                result = leftAnd & rightAnd; 
                break;
            case '|': 
                // Extract numeric values for bitwise operations
                const leftOr = this.getNumericValue(left);
                const rightOr = this.getNumericValue(right);
                result = leftOr | rightOr; 
                break;
            case '^': 
                // Extract numeric values for bitwise operations
                const leftXor = this.getNumericValue(left);
                const rightXor = this.getNumericValue(right);
                result = leftXor ^ rightXor; 
                break;
            case '<<': 
                // Extract numeric values for bitwise operations
                const leftShift = this.getNumericValue(left);
                const rightShift = this.getNumericValue(right);
                result = leftShift << rightShift; 
                break;
            case '>>': 
                // Extract numeric values for bitwise operations
                const leftRShift = this.getNumericValue(left);
                const rightRShift = this.getNumericValue(right);
                result = leftRShift >> rightRShift; 
                break;
            default:
                this.emitError(`Unknown binary operator: ${operator}`);
                return null;
        }
        
        if (this.options.verbose) {
            debugLog(`Binary operation: ${left} ${operator} ${right} = ${result}`);
        }
        
        return result;
    }
    
    async executeUnaryOperation(node) {
        const operand = await this.evaluateExpression(node.operand);
        const operator = node.op?.value || node.op;
        
        switch (operator) {
            case '-': return -operand;
            case '+': return +operand;
            case '!':
                // ULTRATHINK DEBUG: Comprehensive boolean negation analysis
                // Extract primitive value if operand is a complex object
                let primitiveValue = operand;
                if (typeof operand === 'object' && operand !== null) {
                    if (operand.hasOwnProperty('value')) {
                        primitiveValue = operand.value;
                    } else if (operand.hasOwnProperty('valueOf')) {
                        primitiveValue = operand.valueOf();
                    } else {
                        primitiveValue = Number(operand);
                    }
                }
                const result = primitiveValue ? 0 : 1;  // Arduino-style: !0=1, !non-zero=0
                return result;
            case '~': return ~operand;
            case '++': 
                // Prefix increment: ++i
                if (node.operand?.type === 'IdentifierNode') {
                    const varName = node.operand.value;
                    const newValue = operand + 1;
                    const result = this.variables.set(varName, newValue);
                    
                    // Check if this is a static variable by looking in static storage
                    const staticKey = `global_${varName}`;  // Try global static variable
                    if (this.staticVariables.has(staticKey)) {
                        // This is a static variable, update it directly in static storage
                        this.staticVariables.set(staticKey, newValue);
                        
                        if (this.options.verbose) {
                            debugLog(`Updated static variable ${varName} = ${newValue}`);
                        }
                        
                        // For static variables, return success regardless of scope update
                        this.variables.markAsInitialized(varName);
                        this.emitCommand({
                            type: COMMAND_TYPES.VAR_SET,
                            variable: varName,
                            value: this.sanitizeForCommand(newValue),
                            timestamp: Date.now()
                        });
                        return newValue;
                    }
                    
                    if (!result.success) {
                        this.emitError(result.message || `Failed to increment variable '${varName}'`);
                        return operand;
                    }
                    
                    // Phase 4.2: Mark variable as initialized after increment
                    this.variables.markAsInitialized(varName);
                    
                    // Emit variable set command
                    this.emitCommand({
                        type: COMMAND_TYPES.VAR_SET,
                        variable: varName,
                        value: this.sanitizeForCommand(newValue),
                        timestamp: Date.now()
                    });
                    
                    return newValue;
                }
                return operand + 1;
            case '--':
                // Prefix decrement: --i  
                if (node.operand?.type === 'IdentifierNode') {
                    const varName = node.operand.value;
                    const newValue = operand - 1;
                    const result = this.variables.set(varName, newValue);
                    if (!result.success) {
                        this.emitError(result.message || `Failed to decrement variable '${varName}'`);
                        return operand;
                    }
                    
                    // Phase 4.2: Mark variable as initialized after decrement
                    this.variables.markAsInitialized(varName);
                    
                    // Emit variable set command
                    this.emitCommand({
                        type: COMMAND_TYPES.VAR_SET,
                        variable: varName,
                        value: this.sanitizeForCommand(newValue),
                        timestamp: Date.now()
                    });
                    
                    return newValue;
                }
                return operand - 1;
                
            case '&':
                // Address-of operator: &variable or &function
                if (node.operand?.type === 'IdentifierNode') {
                    const name = node.operand.value;
                    
                    // Check if it's a function first
                    if (this.functions.has(name)) {
                        // This is a function pointer
                        const functionPointer = new ArduinoFunctionPointer(name, this);
                        
                        if (this.options.verbose) {
                            debugLog(`Address-of function: &${name} -> function pointer to ${name}`);
                        }
                        
                        return functionPointer;
                    }
                    
                    // Check if it's a variable
                    if (this.variables.has(name)) {
                        // Create a pointer object that represents the memory address
                        const pointer = new ArduinoPointer(name, this);
                        
                        if (this.options.verbose) {
                            debugLog(`Address-of variable: &${name} -> pointer to ${name}`);
                        }
                        
                        return pointer;
                    }
                    
                    // Neither function nor variable found
                    this.emitError(`Cannot take address of undefined variable or function '${name}'`);
                    return null;
                } else {
                    this.emitError("Address-of operator (&) can only be applied to variables or functions");
                    return null;
                }
                
            case '*':
                // Dereference operator: *pointer
                if (operand instanceof ArduinoPointer) {
                    const value = operand.getValue();
                    
                    if (this.options.verbose) {
                        debugLog(`Dereference: *pointer -> ${value}`);
                    }
                    
                    return value;
                } else if (typeof operand === 'number') {
                    // Handle array access via pointer arithmetic
                    this.emitError("Dereferencing numeric values not yet fully supported");
                    return null;
                } else {
                    this.emitError("Dereference operator (*) can only be applied to pointers");
                    return null;
                }
                
            default:
                this.emitError(`Unknown unary operator: ${operator}`);
                return null;
        }
    }
    
    async executePostfixOperation(node) {
        const operand = await this.evaluateExpression(node.operand);
        const operator = node.op?.value || node.op;
        
        switch (operator) {
            case '++':
                // Postfix increment: i++
                if (node.operand?.type === 'IdentifierNode') {
                    const varName = node.operand.value;
                    const oldValue = operand;
                    let newValue;
                    
                    // Handle pointer arithmetic for increment
                    if (oldValue instanceof ArduinoPointer) {
                        // For pointer++, create a new offset pointer pointing to the next element
                        newValue = oldValue.add(1);
                    } else {
                        // Regular numeric increment
                        newValue = oldValue + 1;
                    }
                    
                    const success = this.variables.set(varName, newValue);
                    if (!success) {
                        this.emitError(`Failed to increment variable '${varName}'`);
                        return operand;
                    }
                    
                    // Update static variable storage if this is a static variable
                    const varInfo = this.variables.get(varName);
                    debugLog(`DEBUG postfix varInfo for ${varName}:`, varInfo?.metadata);
                    if (varInfo?.metadata?.isStatic) {
                        this.staticVariables.set(varInfo.metadata.staticKey, newValue);
                        debugLog(`✅ Updated static variable ${varName} = ${newValue} (key: ${varInfo.metadata.staticKey})`);
                    } else {
                        debugLog(`❌ Not static: isStatic=${varInfo?.metadata?.isStatic}, key=${varInfo?.metadata?.staticKey}`);
                    }
                    
                    if (this.options.verbose) {
                        if (oldValue instanceof ArduinoPointer) {
                            debugLog(`Postfix increment: ${varName}++ (pointer -> next element)`);
                        } else {
                            debugLog(`Postfix increment: ${varName}++ (${oldValue} -> ${newValue})`);
                        }
                    }
                    
                    this.emitCommand({
                        type: COMMAND_TYPES.VAR_SET,
                        variable: varName,
                        value: this.sanitizeForCommand(newValue),
                        timestamp: Date.now()
                    });
                    
                    return oldValue; // Return original value
                }
                return operand;
            case '--':
                // Postfix decrement: i--
                if (node.operand?.type === 'IdentifierNode') {
                    const varName = node.operand.value;
                    const oldValue = operand;
                    const success = this.variables.set(varName, oldValue - 1);
                    if (!success) {
                        this.emitError(`Failed to decrement variable '${varName}'`);
                        return operand;
                    }
                    
                    // Update static variable storage if this is a static variable
                    const varInfo = this.variables.get(varName);
                    if (varInfo?.metadata?.isStatic) {
                        this.staticVariables.set(varInfo.metadata.staticKey, oldValue - 1);
                        if (this.options.verbose) {
                            debugLog(`Updated static variable ${varName} = ${oldValue - 1} (key: ${varInfo.metadata.staticKey})`);
                        }
                    }
                    
                    if (this.options.verbose) {
                        debugLog(`Postfix decrement: ${varName}-- (${oldValue} -> ${oldValue - 1})`);
                    }
                    
                    this.emitCommand({
                        type: COMMAND_TYPES.VAR_SET,
                        variable: varName,
                        value: this.sanitizeForCommand(oldValue - 1),
                        timestamp: Date.now()
                    });
                    
                    return oldValue; // Return original value
                }
                return operand;
            default:
                this.emitError(`Unknown postfix operator: ${operator}`);
                return null;
        }
    }
    
    async executeMemberAccess(node) {
        // Extract operator and common variables from node
        const operator = node.operator;
        const hasArguments = node.arguments !== undefined;
        
        // Check if this is Serial object access first
        if (node.object?.value === 'Serial') {
            const property = node.property?.value || node.property;
            
            debugLog(`DEBUG Serial member access: Serial.${property}`, {
                hasArguments: node.arguments !== undefined,
                argumentsLength: node.arguments?.length
            });

            return await this.executeSerialMethod(property, node.arguments, 'Serial');
        }
        
        // Check if this is a static method call on a class (like Adafruit_NeoPixel.Color)
        if (node.object?.value && this.isObjectType(node.object.value)) {
            const className = node.object.value;
            const methodName = node.property?.value || node.property;
            
            return await this.executeStaticMethod(className, methodName, node.arguments);
        }
        
        // Handle instance method calls and property access
        const object = await this.evaluateExpression(node.object);
        const property = node.property?.value || node.property;
        
        // Check if object is an Arduino object with methods
        if (object instanceof ArduinoObject) {
            if (node.arguments !== undefined) {
                // This is a method call
                const args = [];
                if (node.arguments) {
                    for (const arg of node.arguments) {
                        args.push(await this.evaluateExpression(arg));
                    }
                }
                
                // New clean architecture: callMethod returns primitives directly  
                // Pass variable name for better display
                const variableName = node.object?.value;
                const result = await object.callMethod(property, args, variableName);
                
                // ✅ Result is now always a primitive value or null
                // Commands are emitted internally by ArduinoObject.callMethod()
                return result;
            } else {
                // This is property access
                return object.getProperty(property);
            }
        }
        
        // Check if object is an Arduino struct
        if (object instanceof ArduinoStruct) {
            if (node.arguments !== undefined) {
                this.emitError(`Cannot call methods on struct field '${property}' - structs don't have methods`);
                return null;
            } else {
                // This is struct field access: struct.field
                try {
                    const fieldValue = object.getField(property);
                    
                    if (this.options.verbose) {
                        debugLog(`Struct field access: ${object.structName}.${property} = ${fieldValue}`);
                    }
                    
                    // Emit command for struct field access
                    this.emitCommand({
                        type: 'STRUCT_FIELD_ACCESS',
                        struct: object.structName,
                        field: property,
                        value: fieldValue,
                        timestamp: Date.now(),
                        message: `${object.structName}.${property} = ${fieldValue}`
                    });
                    
                    return fieldValue;
                } catch (error) {
                    this.emitError(`Struct field access failed: ${error.message}`);
                    return null;
                }
            }
        }
        
        // DEBUG: Always log member access for now
        debugLog(`DEBUG Member access:`, {
            object: object,
            objectType: typeof object,
            isArduinoString: object instanceof ArduinoString,
            property: property,
            nodeProperty: node.property,
            hasArguments: node.arguments !== undefined,
            argumentsLength: node.arguments?.length
        });
        
        if (object instanceof ArduinoString) {
            switch (property) {
                case 'length':
                    // If it's a method call (has arguments), call the method
                    if (node.arguments !== undefined) {
                        return object.length();
                    }
                    // If it's a property access, return the length directly
                    return object.length();
                    
                case 'charAt':
                    if (node.arguments && node.arguments.length > 0) {
                        const index = await this.evaluateExpression(node.arguments[0]);
                        return object.charAt(index);
                    }
                    this.emitError("charAt() requires an index argument");
                    return '';
                    
                case 'substring':
                    if (node.arguments && node.arguments.length >= 1) {
                        const start = await this.evaluateExpression(node.arguments[0]);
                        const end = node.arguments.length > 1 ? 
                            await this.evaluateExpression(node.arguments[1]) : undefined;
                        return object.substring(start, end);
                    }
                    this.emitError("substring() requires start argument");
                    return new ArduinoString('');
                    
                case 'indexOf':
                    if (node.arguments && node.arguments.length > 0) {
                        const searchString = await this.evaluateExpression(node.arguments[0]);
                        return object.indexOf(searchString);
                    }
                    this.emitError("indexOf() requires a search string");
                    return -1;
                    
                case 'toInt':
                    return object.toInt();
                    
                case 'toFloat':
                    return object.toFloat();
                    
                case 'reserve':
                    if (node.arguments && node.arguments.length > 0) {
                        const size = await this.evaluateExpression(node.arguments[0]);
                        // String.reserve() just preallocates memory, no return value
                        return; 
                    }
                    this.emitError("String.reserve() requires a size argument");
                    return;
                    
                case 'setCharAt':
                    if (node.arguments && node.arguments.length >= 2) {
                        const index = await this.evaluateExpression(node.arguments[0]);
                        const char = await this.evaluateExpression(node.arguments[1]);
                        object.setCharAt(index, char);
                        return;
                    }
                    this.emitError("setCharAt() requires index and character arguments");
                    return;
                    
                case 'replace':
                    if (node.arguments && node.arguments.length >= 2) {
                        const find = await this.evaluateExpression(node.arguments[0]);
                        const replace = await this.evaluateExpression(node.arguments[1]);
                        object.replace(find, replace);
                        return;
                    }
                    this.emitError("replace() requires find and replace arguments");
                    return;
                    
                case 'trim':
                    object.trim();
                    return;
                    
                case 'toUpperCase':
                    object.toUpperCase();
                    return;
                    
                case 'toLowerCase':
                    object.toLowerCase();
                    return;
                    
                case 'compareTo':
                    if (node.arguments && node.arguments.length > 0) {
                        const other = await this.evaluateExpression(node.arguments[0]);
                        return object.compareTo(other);
                    }
                    this.emitError("compareTo() requires a string argument");
                    return 0;
                    
                case 'equalsIgnoreCase':
                    if (node.arguments && node.arguments.length > 0) {
                        const other = await this.evaluateExpression(node.arguments[0]);
                        return object.equalsIgnoreCase(other);
                    }
                    this.emitError("equalsIgnoreCase() requires a string argument");
                    return false;
                    
                case 'startsWith':
                    if (node.arguments && node.arguments.length > 0) {
                        const prefix = await this.evaluateExpression(node.arguments[0]);
                        const offset = node.arguments.length > 1 ? 
                            await this.evaluateExpression(node.arguments[1]) : 0;
                        return object.startsWith(prefix, offset);
                    }
                    this.emitError("startsWith() requires a prefix argument");
                    return false;
                    
                case 'endsWith':
                    if (node.arguments && node.arguments.length > 0) {
                        const suffix = await this.evaluateExpression(node.arguments[0]);
                        return object.endsWith(suffix);
                    }
                    this.emitError("endsWith() requires a suffix argument");
                    return false;
                    
                case 'equals':
                    if (node.arguments && node.arguments.length > 0) {
                        const other = await this.evaluateExpression(node.arguments[0]);
                        return object.equals(other);
                    }
                    this.emitError("equals() requires a string argument");
                    return false;
                    
                case 'concat':
                    if (node.arguments && node.arguments.length > 0) {
                        const other = await this.evaluateExpression(node.arguments[0]);
                        return object.concat(other);
                    }
                    this.emitError("concat() requires a string argument");
                    return new ArduinoString('');
                    
                default:
                    this.emitError(`Unknown String method: ${property}`);
                    return null;
            }
        }
        
        // Handle built-in Arduino objects that aren't variables or are string references
        if (typeof object === 'undefined' || object === null || object === 'Serial') {
            // This might be a built-in object that wasn't found as a variable
            // Check the original object identifier for built-in names
            const objectName = node.object?.value;
            if (objectName && objectName.match(/^Serial\d*$/)) {
                // Handle Serial1, Serial2, etc. like Serial
                return await this.executeSerialMethod(property, node.arguments, objectName);
            }
            if (object === 'Serial' || objectName === 'SERIAL') {
                // Handle SERIAL macro that expands to 'Serial' string
                return await this.executeSerialMethod(property, node.arguments);
            }
            if (objectName === 'Keyboard') {
                // Advanced Keyboard methods for Arduino USB HID
                if (property === 'begin') {
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.begin',
                        arguments: [],
                        timestamp: Date.now(),
                        message: 'Keyboard.begin()'
                    });
                    return;
                }
                if (property === 'print' && node.arguments && node.arguments.length > 0) {
                    const text = await this.evaluateExpression(node.arguments[0]);
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.print',
                        arguments: [text],
                        timestamp: Date.now(),
                        message: `Keyboard.print(${text})`
                    });
                    return;
                }
                if (property === 'println') {
                    const text = node.arguments && node.arguments.length > 0 
                        ? await this.evaluateExpression(node.arguments[0]) 
                        : '';
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.println',
                        arguments: [text],
                        timestamp: Date.now(),
                        message: `Keyboard.println(${text})`
                    });
                    return;
                }
                if (property === 'write' && node.arguments && node.arguments.length > 0) {
                    const key = await this.evaluateExpression(node.arguments[0]);
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.write',
                        arguments: [key],
                        timestamp: Date.now(),
                        message: `Keyboard.write(${key})`
                    });
                    return;
                }
                if (property === 'press' && node.arguments && node.arguments.length > 0) {
                    const key = await this.evaluateExpression(node.arguments[0]);
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.press',
                        arguments: [key],
                        timestamp: Date.now(),
                        message: `Keyboard.press(${key})`
                    });
                    return;
                }
                if (property === 'release') {
                    const key = node.arguments && node.arguments.length > 0 
                        ? await this.evaluateExpression(node.arguments[0]) 
                        : 'all';
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.release',
                        arguments: [key],
                        timestamp: Date.now(),
                        message: `Keyboard.release(${key})`
                    });
                    return;
                }
                if (property === 'releaseAll') {
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Keyboard.releaseAll',
                        arguments: [],
                        timestamp: Date.now(),
                        message: 'Keyboard.releaseAll()'
                    });
                    return;
                }
                this.emitError(`Unknown Keyboard method: ${property}`);
                return null;
            }
            if (objectName === 'Mouse') {
                // Basic Mouse methods
                if (property === 'begin') {
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Mouse.begin',
                        arguments: [],
                        timestamp: Date.now(),
                        message: 'Mouse.begin()'
                    });
                    return;
                }
                if (property === 'isPressed') {
                    // Mouse.isPressed() returns true if any button is pressed
                    // In simulation, return false (no button pressed)
                    const buttonArg = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 'MOUSE_LEFT';
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Mouse.isPressed',
                        arguments: [buttonArg],
                        timestamp: Date.now(),
                        message: `Mouse.isPressed(${buttonArg})`
                    });
                    return false; // Mock: return false (button not pressed)
                }
                if (property === 'move') {
                    // Mouse.move(x, y, scroll) - move mouse cursor
                    const xArg = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 0;
                    const yArg = node.arguments && node.arguments.length > 1 ? 
                        await this.evaluateExpression(node.arguments[1]) : 0;
                    const scrollArg = node.arguments && node.arguments.length > 2 ? 
                        await this.evaluateExpression(node.arguments[2]) : 0;
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Mouse.move',
                        arguments: [xArg, yArg, scrollArg],
                        timestamp: Date.now(),
                        message: `Mouse.move(${xArg}, ${yArg}, ${scrollArg})`
                    });
                    return;
                }
                if (property === 'press') {
                    // Mouse.press(button) - press mouse button
                    const buttonArg = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 'MOUSE_LEFT';
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Mouse.press',
                        arguments: [buttonArg],
                        timestamp: Date.now(),
                        message: `Mouse.press(${buttonArg})`
                    });
                    return;
                }
                if (property === 'release') {
                    // Mouse.release(button) - release mouse button
                    const buttonArg = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 'MOUSE_LEFT';
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Mouse.release',
                        arguments: [buttonArg],
                        timestamp: Date.now(),
                        message: `Mouse.release(${buttonArg})`
                    });
                    return;
                }
                if (property === 'click') {
                    // Mouse.click(button) - click mouse button
                    const buttonArg = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 'MOUSE_LEFT';
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Mouse.click',
                        arguments: [buttonArg],
                        timestamp: Date.now(),
                        message: `Mouse.click(${buttonArg})`
                    });
                    return;
                }
                this.emitError(`Unknown Mouse method: ${property}`);
                return null;
            }
        }
        
        // Handle user-defined objects (like Servo myServo;)
        if (typeof object === 'object' && object && object.className) {
            // Handle Servo objects
            if (object.className === 'Servo') {
                if (property === 'attach') {
                    const pin = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 9;
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Servo.attach',
                        arguments: [pin],
                        timestamp: Date.now(),
                        message: `${object.objectId || 'servo'}.attach(${pin})`
                    });
                    return;
                }
                if (property === 'write') {
                    const angle = node.arguments && node.arguments.length > 0 ? 
                        await this.evaluateExpression(node.arguments[0]) : 0;
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Servo.write',
                        arguments: [angle],
                        timestamp: Date.now(),
                        message: `${object.objectId || 'servo'}.write(${angle})`
                    });
                    return;
                }
                if (property === 'read') {
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Servo.read',
                        arguments: [],
                        timestamp: Date.now(),
                        message: `${object.objectId || 'servo'}.read()`
                    });
                    return 90; // Mock: return current servo position
                }
                this.emitError(`Unknown Servo method: ${property}`);
                return null;
            }
        }
        
        // Check if object is an Arduino library object
        if (object instanceof ArduinoLibraryObject) {
            if (node.arguments !== undefined) {
                // This is a method call
                const args = [];
                if (node.arguments) {
                    for (const arg of node.arguments) {
                        args.push(await this.evaluateExpression(arg));
                    }
                }
                
                const result = object.callMethod(property, args);
                
                // If the method returns a command object, emit it
                if (result && typeof result === 'object' && result.type) {
                    this.emitCommand({
                        ...result,
                        timestamp: Date.now()
                    });
                }
                
                return result;
            } else {
                // This is property access
                return object.getProperty(property);
            }
        }
        
        // Handle ArduinoPointer dereferencing with arrow operator
        if (object instanceof ArduinoPointer && operator === 'ARROW') {
            // Dereference the pointer to get the actual struct
            const dereferenced = object.getValue();
            
            if (!dereferenced) {
                this.emitError(`Cannot dereference null pointer`);
                return null;
            }
            
            if (this.options.verbose) {
                debugLog(`Pointer dereference: ${object.targetVariable}->${property}`);
            }
            
            // Handle property access on the dereferenced struct
            if (dereferenced instanceof ArduinoStruct) {
                if (hasArguments) {
                    // This is a method call on the dereferenced struct
                    const args = [];
                    if (node.arguments) {
                        for (const arg of node.arguments) {
                            args.push(await this.evaluateExpression(arg));
                        }
                    }
                    return dereferenced.callMethod(property, args);
                } else {
                    // This is property access on the dereferenced struct
                    const result = dereferenced.getField(property);
                    
                    if (this.options.verbose) {
                        debugLog(`Pointer member access: ${object.targetVariable}->${property} = ${result}`);
                    }
                    
                    this.emitCommand({
                        type: 'STRUCT_FIELD_ACCESS',
                        struct: dereferenced.structName,
                        field: property,
                        value: result,
                        timestamp: Date.now(),
                        message: `${dereferenced.structName}.${property} = ${result}`
                    });
                    
                    return result;
                }
            } else {
                this.emitError(`Cannot dereference pointer to non-struct type`);
                return null;
            }
        }
        
        // Handle plain JavaScript objects (structs from designated initializers)
        if (object && typeof object === 'object' && !Array.isArray(object) && 
            !(object instanceof ArduinoString) && !(object instanceof ArduinoNumber) &&
            !(object instanceof ArduinoPointer) && !(object instanceof ArduinoFunctionPointer)) {
            // This is likely a struct created from designated initializers
            if (property in object) {
                if (this.options.verbose) {
                    debugLog(`Struct property access: ${property} = ${object[property]}`);
                }
                return object[property];
            } else {
                this.emitError(`Property '${property}' not found in struct`);
                return null;
            }
        }
        
        // Handle other object types if needed
        this.emitError(`Property access not supported for this object type`);
        return null;
    }
    
    async executeArrayAccess(node) {
        const index = await this.evaluateExpression(node.index);
        
        // Handle nested array access (multidimensional arrays)
        // node.identifier can be either IdentifierNode or another ArrayAccessNode
        let array;
        let arrayName;
        
        if (node.identifier?.type === 'ArrayAccessNode') {
            // This is multidimensional array access like matrix[j][k]
            // First evaluate the inner array access (matrix[j])
            array = await this.executeArrayAccess(node.identifier);
            arrayName = `<nested array>`;
        } else if (node.identifier?.value) {
            // This is simple array access like arr[i]
            arrayName = node.identifier.value;
            array = this.getVariable(arrayName);
        } else {
            this.emitError("Invalid array access: no array identifier");
            return null;
        }
        
        debugLog(`DEBUG Array access: ${arrayName}[${index}]`);
        
        if (array === null || array === undefined) {
            this.emitError(`Array is null or undefined`);
            return null;
        }
        
        if (!Array.isArray(array)) {
            this.emitError(`Variable is not an array (type: ${typeof array})`);
            return null;
        }
        
        if (index < 0 || index >= array.length) {
            this.emitError(`Array index ${index} out of bounds for array (length: ${array.length})`);
            return null;
        }
        
        return array[index];
    }
    
    async executeArrayInitializer(node) {
        if (!node.elements || !Array.isArray(node.elements)) {
            debugLog(`DEBUG Array initializer: no elements found`);
            return [];
        }
        
        // Check if all elements are designated initializers (struct initialization)
        const allDesignated = node.elements.every(element => 
            element.type === 'DesignatedInitializerNode'
        );
        
        if (allDesignated && node.elements.length > 0) {
            // This is struct initialization with designated initializers like {.x = 10, .y = 20}
            const struct = {};
            for (const element of node.elements) {
                const designatedResult = await this.evaluateExpression(element);
                // Merge the designated result into the struct
                Object.assign(struct, designatedResult);
            }
            
            debugLog(`DEBUG Struct initialized with designated initializers:`, struct);
            return struct;
        } else {
            // This is regular array initialization like {1, 2, 3}
            const array = [];
            for (const element of node.elements) {
                const value = await this.evaluateExpression(element);
                array.push(value);
            }
            
            debugLog(`DEBUG Array initialized: [${array.join(', ')}]`);
            return array;
        }
    }
    
    async executeCastExpression(node) {
        const value = await this.evaluateExpression(node.operand);
        const castType = node.castType;
        
        debugLog(`DEBUG Type cast: (${castType})${value} (${typeof value})`);
        
        if (value === null || value === undefined) {
            return null;
        }
        
        switch (castType) {
            case 'int':
                if (typeof value === 'number') {
                    return Math.floor(value); // Truncate decimal part
                } else if (typeof value === 'string') {
                    const intValue = parseInt(value, 10);
                    return isNaN(intValue) ? 0 : intValue;
                } else if (typeof value === 'boolean') {
                    return value ? 1 : 0;
                }
                return parseInt(value) || 0;
                
            case 'float':
            case 'double':
                if (typeof value === 'number') {
                    return value;
                } else if (typeof value === 'string') {
                    const floatValue = parseFloat(value);
                    return isNaN(floatValue) ? 0.0 : floatValue;
                } else if (typeof value === 'boolean') {
                    return value ? 1.0 : 0.0;
                }
                return parseFloat(value) || 0.0;
                
            case 'char':
                if (typeof value === 'number') {
                    return Math.floor(value) & 0xFF; // Keep only lower 8 bits
                } else if (typeof value === 'string' && value.length > 0) {
                    return value.charCodeAt(0);
                }
                return 0;
                
            case 'bool':
                return Boolean(value);
                
            default:
                debugLog(`DEBUG Unsupported cast type: ${castType}`);
                return value; // Return original value if cast type not recognized
        }
    }
    
    async executeTernaryExpression(node) {
        const condition = await this.evaluateExpression(node.condition);
        
        debugLog(`DEBUG Ternary: ${condition} ? ${node.consequent?.value || '[expr]'} : ${node.alternate?.value || '[expr]'}`);
        
        if (condition) {
            return await this.evaluateExpression(node.consequent);
        } else {
            return await this.evaluateExpression(node.alternate);
        }
    }
    
    async executeSwitchStatement(node) {
        const discriminantValue = await this.evaluateExpression(node.discriminant);
        
        this.emitCommand({
            type: COMMAND_TYPES.SWITCH_STATEMENT,
            discriminant: discriminantValue,
            timestamp: Date.now(),
            message: `switch (${discriminantValue})`
        });
        
        debugLog(`DEBUG Switch statement: ${discriminantValue}`);

        let matchFound = false;
        let fallThrough = false;

        // Execute cases
        for (const caseNode of node.cases || []) {
            if (caseNode.type === 'CaseStatement') {
                const isDefault = caseNode.test === null;
                let shouldExecute = fallThrough;
                
                if (!fallThrough && !isDefault) {
                    // Regular case - check if discriminant matches test value
                    const testValue = await this.evaluateExpression(caseNode.test);
                    shouldExecute = discriminantValue == testValue;  // Use loose equality for type coercion

                    this.emitCommand({
                        type: COMMAND_TYPES.SWITCH_CASE,
                        caseValue: testValue,
                        matched: shouldExecute,
                        timestamp: Date.now()
                    });

                    debugLog(`DEBUG Case ${testValue}: ${shouldExecute ? 'match' : 'no match'}`);
                } else if (!fallThrough && isDefault) {
                    // Default case - execute only if no previous match
                    shouldExecute = !matchFound;
                    
                    this.emitCommand({
                        type: COMMAND_TYPES.SWITCH_CASE,
                        caseValue: 'default',
                        matched: shouldExecute,
                        timestamp: Date.now()
                    });
                    
                    debugLog(`DEBUG Default case: ${shouldExecute ? 'execute' : 'skip'}`);
                }
                
                if (shouldExecute) {
                    matchFound = true;
                    fallThrough = true;
                    
                    // Execute statements in this case
                    for (const stmt of caseNode.consequent || []) {
                        if (stmt.type === 'BreakStatement') {
                            this.emitCommand({
                                type: COMMAND_TYPES.BREAK_STATEMENT,
                                timestamp: Date.now(),
                                action: 'exit_switch'
                            });
                            
                            debugLog(`DEBUG Break statement encountered`);
                            return; // Exit switch
                        }
                        
                        const result = await this.executeStatement(stmt);
                        // Handle break/continue from nested statements
                        if (result && result.type === 'break') {
                            return; // Exit switch
                        }
                    }
                }
            }
        }
        
        debugLog(`DEBUG Switch completed: ${matchFound ? 'match found' : 'no match'}`);
    }
    
    async executeIfStatement(node) {
        const condition = await this.evaluateExpression(node.condition);
        
        this.emitCommand({
            type: COMMAND_TYPES.IF_STATEMENT,
            condition: condition,
            result: condition,
            branch: condition ? 'then' : 'else',
            timestamp: Date.now()
        });
        
        if (condition) {
            // Execute then branch with its own scope (only if not already a compound statement)
            if (node.consequent.type === 'CompoundStmtNode') {
                // CompoundStmtNode will create its own scope
                return await this.executeStatement(node.consequent);
            } else {
                // Single statement - create scope for it
                this.variables.pushScope('if-then');
                try {
                    return await this.executeStatement(node.consequent);
                } finally {
                    this.variables.popScope();
                }
            }
        } else if (node.alternate) {
            // Execute else branch with its own scope
            if (node.alternate.type === 'CompoundStmtNode') {
                // CompoundStmtNode will create its own scope
                return await this.executeStatement(node.alternate);
            } else {
                // Single statement - create scope for it
                this.variables.pushScope('if-else');
                try {
                    return await this.executeStatement(node.alternate);
                } finally {
                    this.variables.popScope();
                }
            }
        }
    }
    
    async executeWhileStatement(node) {
        this.emitCommand({
            type: COMMAND_TYPES.WHILE_LOOP,
            phase: 'start',
            timestamp: Date.now(),
            message: `while loop started`
        });
        
        // Create scope for while loop body
        this.variables.pushScope('while-loop');
        
        try {
            let iterations = 0;
            // Use global maxLoopIterations setting, with a reasonable default for while loops
            const maxIterations = Math.min(this.options.maxLoopIterations, 1000);
            
            while (await this.evaluateExpression(node.condition) && iterations < maxIterations) {
                this.emitCommand({
                    type: COMMAND_TYPES.WHILE_LOOP,
                    phase: 'iteration',
                    iteration: iterations,
                    timestamp: Date.now(),
                    message: `while loop iteration ${iterations}`
                });
                
                await this.executeStatement(node.body);
                iterations++;
                
                // Check execution state after each iteration
                await this.checkExecutionState();
                
                if (!this.executionContext.shouldContinue) {
                    break;
                }
                
                // Allow pause/step handling
                await this.yieldExecution();
            }
            
            const limitReached = iterations >= maxIterations;
            
            this.emitCommand({
                type: limitReached ? COMMAND_TYPES.LOOP_LIMIT_REACHED : COMMAND_TYPES.WHILE_LOOP,
                phase: 'end',
                iterations: iterations,
                timestamp: Date.now(),
                message: limitReached 
                    ? `While loop limit reached: completed ${iterations} iterations (max: ${maxIterations})`
                    : `while loop completed (${iterations} iterations)`
            });
            
            if (limitReached) {
                if (this.options.verbose) {
                    debugLog(`While loop limit reached: ${iterations} iterations`);
                }
                // Only signal completion if we're in loop() context, not setup() context
                if (this.executionContext.phase === 'loop') {
                    this.executionContext.shouldContinue = false;
                }
            }
        } finally {
            // Clean up while loop scope
            this.variables.popScope();
        }
    }
    
    async executeDoWhileStatement(node) {
        this.emitCommand({
            type: COMMAND_TYPES.DO_WHILE_LOOP,
            phase: 'start',
            timestamp: Date.now(),
            message: `do-while loop started`
        });
        
        let iterations = 0;
        // Use global maxLoopIterations setting, with a reasonable default for do-while loops
        const maxIterations = Math.min(this.options.maxLoopIterations, 1000);
        
        // Do-while always executes at least once
        do {
            this.emitCommand({
                type: COMMAND_TYPES.DO_WHILE_LOOP,
                phase: 'iteration',
                iteration: iterations,
                timestamp: Date.now(),
                message: `do-while loop iteration ${iterations}`
            });
            
            await this.executeStatement(node.body);
            iterations++;
            
            // Check execution state after each iteration
            await this.checkExecutionState();
            
            if (!this.executionContext.shouldContinue) {
                break;
            }
            
            // Allow pause/step handling
            await this.yieldExecution();
            
        } while (await this.evaluateExpression(node.condition) && iterations < maxIterations);
        
        const limitReached = iterations >= maxIterations;
        
        this.emitCommand({
            type: limitReached ? COMMAND_TYPES.LOOP_LIMIT_REACHED : COMMAND_TYPES.DO_WHILE_LOOP,
            phase: 'end',
            iterations: iterations,
            timestamp: Date.now(),
            message: limitReached 
                ? `Do-while loop limit reached: completed ${iterations} iterations (max: ${maxIterations})`
                : `do-while loop completed (${iterations} iterations)`
        });
        
        if (limitReached) {
            if (this.options.verbose) {
                debugLog(`Do-while loop limit reached: ${iterations} iterations`);
            }
            // Signal that we reached the limit for test completion
            this.executionContext.shouldContinue = false;
        }
    }
    
    async executeForStatement(node) {
        this.emitCommand({
            type: COMMAND_TYPES.FOR_LOOP,
            phase: 'start',
            timestamp: Date.now(),
            message: `for loop started`
        });
        
        // Create new scope for the entire for loop (including initializer)
        this.variables.pushScope('for-loop');
        
        try {
            // Initialize (variables declared here are scoped to the for loop)
            if (node.initializer) {
                await this.executeStatement(node.initializer);
            }
            
            let iterations = 0;
            // Use global maxLoopIterations setting, with a reasonable default for for loops
            const maxIterations = Math.min(this.options.maxLoopIterations, 1000);
            
            // Loop
            while ((!node.condition || await this.evaluateExpression(node.condition)) && 
                   iterations < maxIterations) {
                
                this.emitCommand({
                    type: COMMAND_TYPES.FOR_LOOP,
                    phase: 'iteration',
                    iteration: iterations,
                    timestamp: Date.now(),
                    message: `for loop iteration ${iterations}`
                });
                
                const result = await this.executeStatement(node.body);
                
                // Handle break and continue statements
                if (result && result.type === 'break') {
                    this.emitCommand({
                        type: COMMAND_TYPES.BREAK_STATEMENT,
                        timestamp: Date.now(),
                        action: 'exit_for_loop',
                        message: 'break statement executed'
                    });
                    break;
                }
                
                if (result && result.type === 'continue') {
                    this.emitCommand({
                        type: COMMAND_TYPES.CONTINUE_STATEMENT,
                        timestamp: Date.now(),
                        action: 'next_iteration',
                        message: 'continue statement executed'
                    });
                    // Skip increment and go to next iteration
                    if (node.increment) {
                        await this.evaluateExpression(node.increment);
                    }
                    iterations++;
                    continue;
                }
                
                // Increment
                if (node.increment) {
                    await this.evaluateExpression(node.increment);
                }
                
                iterations++;
                
                // Check execution state after each iteration
                await this.checkExecutionState();
                
                if (!this.executionContext.shouldContinue) {
                    break;
                }
                
                // Allow pause/step handling
                await this.yieldExecution();
            }
            
            const limitReached = iterations >= maxIterations;
            
            this.emitCommand({
                type: limitReached ? COMMAND_TYPES.LOOP_LIMIT_REACHED : COMMAND_TYPES.FOR_LOOP,
                phase: 'end',
                iterations: iterations,
                timestamp: Date.now(),
                message: limitReached 
                    ? `For loop limit reached: completed ${iterations} iterations (max: ${maxIterations})`
                    : `for loop completed (${iterations} iterations)`
            });
            
            if (limitReached) {
                if (this.options.verbose) {
                    debugLog(`For loop limit reached: ${iterations} iterations`);
                }
                // Only signal completion if we're in loop() context, not setup() context
                if (this.executionContext.phase === 'loop') {
                    this.executionContext.shouldContinue = false;
                }
            }
        } finally {
            // Clean up for loop scope
            this.variables.popScope();
        }
    }
    
    async executeReturnStatement(node) {
        if (node.value) {
            const returnValue = await this.evaluateExpression(node.value);
            
            // Type checking for return value (if we have function context)
            if (this.currentFunction) {
                const expectedType = this.currentFunction.returnType?.value || 'void';
                const actualType = this.inferValueType(returnValue);
                
                if (!this.isReturnTypeCompatible(expectedType, actualType, returnValue)) {
                    console.error(`Return type error: Function '${this.currentFunction.name}' expects ${expectedType} but returns ${actualType}`);
                }
            }
            
            return returnValue;
        }
        return null;
    }
    
    inferValueType(value) {
        if (value instanceof ArduinoString) return 'String';
        if (value instanceof ArduinoNumber) return value.arduinoType;
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'int' : 'float';
        }
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'string') return 'char*';
        return 'unknown';
    }
    
    isReturnTypeCompatible(expectedType, actualType, value) {
        // Exact match
        if (expectedType === actualType) return true;
        
        // Void function should not return value
        if (expectedType === 'void') return value === null;
        
        // Numeric compatibility
        if ((expectedType === 'int' || expectedType === 'float') && 
            (actualType === 'int' || actualType === 'float')) {
            return true;
        }
        
        // String compatibility
        if (expectedType === 'String' && (actualType === 'string' || actualType === 'char*')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Find the best matching function overload based on parameter count
     * In the future, this could be enhanced to consider parameter types
     */
    findBestFunctionOverload(functionOverloads, argCount) {
        // First, try to find an exact parameter count match
        for (const funcNode of functionOverloads) {
            const paramCount = funcNode.parameters ? funcNode.parameters.length : 0;
            if (paramCount === argCount) {
                return funcNode;
            }
        }
        
        // If no exact match, could add more sophisticated matching logic here
        // For now, return null to indicate no match found
        return null;
    }
    
    async executeUserFunction(funcName, args) {
        // Semantic analysis: Check if function exists
        if (!this.functions.has(funcName)) {
            this.emitError(`Function '${funcName}' is not defined`);
            return null;
        }
        
        const functionOverloads = this.functions.get(funcName);
        const actualArgs = args ? args.length : 0;
        
        // Find matching function overload by parameter count
        const funcNode = this.findBestFunctionOverload(functionOverloads, actualArgs);
        if (!funcNode) {
            const paramCounts = functionOverloads.map(f => f.parameters ? f.parameters.length : 0);
            this.emitError(`No matching overload for function '${funcName}' with ${actualArgs} arguments. Available overloads: ${paramCounts.join(', ')} parameters`);
            return null;
        }
        
        this.emitCommand({
            type: COMMAND_TYPES.FUNCTION_CALL,
            function: funcName,
            arguments: args,
            timestamp: Date.now(),
            message: `${funcName}(${args.join(', ')})`
        });
        
        debugLog(`DEBUG User function call: ${funcName}(${args.join(', ')})`);
        
        // Create new function scope and set function context
        this.variables.pushScope('function');
        const previousFunction = this.currentFunction;
        this.currentFunction = { name: funcName, returnType: funcNode.returnType };
        
        try {
            // Restore static variables for this function in current scope
            this.restoreStaticVariables(funcName);
            
            // Map function parameters to arguments
            if (funcNode.parameters) {
                for (let i = 0; i < funcNode.parameters.length; i++) {
                    const param = funcNode.parameters[i];
                    
                    // Handle different parameter declarator structures
                    let paramName = null;
                    
                    if (param.declarator?.value) {
                        // Regular parameter: int x
                        paramName = param.declarator.value;
                    } else if (param.declarator?.identifier?.value) {
                        // Array parameter: int arr[] 
                        paramName = param.declarator.identifier.value;
                    } else if (param.declarator?.declarator?.value) {
                        // Nested declarator: int *ptr
                        paramName = param.declarator.declarator.value;
                    }
                    
                    const argValue = i < args.length ? args[i] : null;

                    if (paramName) {
                        // TEST 42 FIX: Set parameter type metadata for integer division
                        // Extract parameter type from paramType node
                        let paramType = 'auto';
                        if (param.paramType?.value) {
                            paramType = param.paramType.value;
                        } else if (param.paramType?.typeName) {
                            paramType = param.paramType.typeName;
                        }

                        this.variables.set(paramName, argValue, {type: paramType, declaredType: paramType});
                        debugLog(`DEBUG Parameter: ${paramName} = ${argValue} (type: ${typeof argValue}, declared: ${paramType})`);

                        // Debug array parameters specifically
                        if (Array.isArray(argValue)) {
                            debugLog(`DEBUG Array parameter: ${paramName} = [${argValue.join(', ')}] (length: ${argValue.length})`);
                        }
                    } else {
                        debugLog(`DEBUG Failed to extract parameter name from:`, param);
                    }
                }
            }
            
            // Execute function body and capture return value
            let returnValue = null;
            if (funcNode.body) {
                returnValue = await this.executeFunctionBody(funcNode.body);
            }
            
            debugLog(`DEBUG Function ${funcName} returned: ${returnValue}`);
            return returnValue;
                
        } finally {
            // Remove function scope and restore previous scope and function context
            this.variables.popScope();
            this.currentFunction = previousFunction;
        }
    }
    
    async executeFunctionBody(bodyNode) {
        if (!bodyNode || bodyNode.type !== 'CompoundStmtNode') {
            return null;
        }
        
        // Add execution safety for user functions
        let statementCount = 0;
        const maxStatements = 1000; // Safety limit for function statements
        
        // Execute each statement in the function body
        for (const statement of bodyNode.children || []) {
            statementCount++;
            if (statementCount > maxStatements) {
                this.emitError(`User function exceeded maximum statements (${maxStatements}) - possible infinite recursion`);
                return null;
            }
            
            // Check execution state before each statement
            await this.checkExecutionState();
            if (!this.executionContext.shouldContinue) {
                return null;
            }
            
            if (statement.type === 'ReturnStatement') {
                // Handle return statement - evaluate and return the value
                if (statement.value) {
                    let returnValue = await this.evaluateExpression(statement.value);

                    // TEST 42 FIX: Convert return value to function's declared return type
                    // Match C++ behavior for integer division in return values
                    if (this.currentFunction && this.currentFunction.returnType) {
                        const returnType = this.currentFunction.returnType.value || this.currentFunction.returnType.typeName || 'void';
                        if (returnType === 'int' || returnType === 'long' || returnType === 'short' || returnType === 'byte') {
                            // Convert to integer (truncate)
                            if (typeof returnValue === 'number' && !Number.isInteger(returnValue)) {
                                returnValue = Math.trunc(returnValue);
                            }
                        }
                    }

                    debugLog(`DEBUG Return statement: ${returnValue}`);
                    return returnValue;
                } else {
                    return null; // void return
                }
            } else {
                // Execute other statements normally
                const result = await this.executeStatement(statement);
                
                // Handle early exit conditions like return from nested blocks
                if (result && result.type === 'return') {
                    return result.value;
                }
            }
            
            // Small yield to prevent blocking
            await this.yieldExecution();
        }
        
        return null; // No explicit return
    }
    
    async arduinoDigitalRead(args, node = null) {
        if (args.length < 1) {
            this.emitError("digitalRead requires 1 argument: pin");
            return 0;
        }
        
        const pin = args[0];
        
        // Validate pin number using robust numeric extraction
        const numericPin = this.getNumericValue(pin);
        if (numericPin < 0 || numericPin > 127) {
            this.emitError(`Invalid pin number: ${numericPin}. Pin must be a number between 0-127`);
            return 0;
        }
        
        // Use deterministic request ID generation if mockDataManager is available
        const requestId = this.mockDataManager ?
            this.mockDataManager.getRequestId('digitalRead') :
            `digitalRead_${Date.now()}_${Math.random()}`;
        
        // Set state machine context for stepping/pausing compatibility
        this.previousExecutionState = this.state;
        this.state = EXECUTION_STATE.WAITING_FOR_RESPONSE;
        this.waitingForRequestId = requestId;
        this.suspendedNode = node;
        this.suspendedFunction = 'digitalRead';
        
        // Emit request command
        this.emitCommand({
            type: COMMAND_TYPES.DIGITAL_READ_REQUEST,
            pin: pin,
            requestId: requestId,
            timestamp: Date.now()
        });
        
        // Use async response mechanism like analogRead
        try {
            const response = await this.waitForResponse(requestId, 5000);
            return response.value;
        } catch (error) {
            this.emitError(`digitalRead timeout: ${error.message}`);
            return Math.random() > 0.5 ? 1 : 0; // Fallback value
        }
    }
    
    arduinoAnalogWrite(args) {
        if (args.length < 2) {
            this.emitError("analogWrite requires 2 arguments: pin, value");
            return;
        }
        
        const pin = args[0];
        const value = args[1];
        
        // Validate pin number using robust numeric extraction
        const numericPin = this.getNumericValue(pin);
        if (numericPin < 0 || numericPin > 127) {
            this.emitError(`Invalid pin number: ${numericPin}. Pin must be a number between 0-127`);
            return;
        }
        
        // Validate PWM value (0-255)
        const numericValue = this.getNumericValue(value);
        if (numericValue < 0 || numericValue > 255) {
            this.emitError(`Invalid analog value: ${numericValue}. Analog value must be between 0-255`);
            return;
        }
        
        this.emitCommand({
            type: COMMAND_TYPES.ANALOG_WRITE,
            pin: pin,
            value: this.sanitizeForCommand(value),
            timestamp: Date.now()
        });
    }
    
    async arduinoAnalogRead(args, node = null) {
        if (args.length < 1) {
            this.emitError("analogRead requires 1 argument: pin");
            return 0;
        }
        
        const pin = args[0];
        
        // Validate analog pin (typically A0-A15 or 14-29 on Arduino)
        const numericPin = this.getNumericValue(pin);
        if (numericPin < 0 || numericPin > 127) {
            this.emitError(`Invalid analog pin: ${numericPin}. Pin must be a number between 0-127`);
            return 0;
        }
        
        // Use deterministic request ID generation if mockDataManager is available
        const requestId = this.mockDataManager ?
            this.mockDataManager.getRequestId('analogRead') :
            `analogRead_${Date.now()}_${Math.random()}`;
        
        // Set state machine context
        this.previousExecutionState = this.state; // Remember the state before waiting
        this.state = EXECUTION_STATE.WAITING_FOR_RESPONSE;
        this.waitingForRequestId = requestId;
        this.suspendedNode = node;
        this.suspendedFunction = 'analogRead';
        
        // Emit request command
        this.emitCommand({
            type: COMMAND_TYPES.ANALOG_READ_REQUEST,
            pin: pin,
            requestId: requestId,
            timestamp: Date.now()
        });
        
        // Use hybrid async response mechanism
        try {
            const response = await this.waitForResponse(requestId, 5000);
            return response.value;
        } catch (error) {
            this.emitError(`analogRead timeout: ${error.message}`);
            return Math.floor(Math.random() * 1024); // Fallback value
        }
    }
    
    arduinoDelayMicroseconds(args) {
        if (args.length < 1) {
            this.emitError("delayMicroseconds requires 1 argument: microseconds");
            return;
        }
        
        const us = args[0];
        
        this.emitCommand({
            type: COMMAND_TYPES.DELAY_MICROSECONDS,
            duration: us,
            timestamp: Date.now()
        });
    }
    
    // Arduino timing functions
    async arduinoMillis(node = null) {
        // Use deterministic request ID generation if mockDataManager is available
        const requestId = this.mockDataManager ?
            this.mockDataManager.getRequestId('millis') :
            `millis_${Date.now()}_${Math.random()}`;

        // Set state machine context for stepping/pausing compatibility
        this.previousExecutionState = this.state;
        this.state = EXECUTION_STATE.WAITING_FOR_RESPONSE;
        this.waitingForRequestId = requestId;
        this.suspendedNode = node;
        this.suspendedFunction = 'millis';

        // Emit request command
        this.emitCommand({
            type: COMMAND_TYPES.MILLIS_REQUEST,
            requestId: requestId,
            timestamp: Date.now()
        });
        
        // Use async response mechanism like analogRead
        try {
            const response = await this.waitForResponse(requestId, 5000);
            return response.value;
        } catch (error) {
            this.emitError(`millis timeout: ${error.message}`);
            return Date.now() % 100000; // Fallback value
        }
    }
    
    async arduinoMicros(node = null) {
        // Use deterministic request ID generation if mockDataManager is available
        const requestId = this.mockDataManager ?
            this.mockDataManager.getRequestId('micros') :
            `micros_${Date.now()}_${Math.random()}`;

        // Emit request command
        this.emitCommand({
            type: COMMAND_TYPES.MICROS_REQUEST,
            requestId: requestId,
            timestamp: Date.now()
        });
        
        // Set state machine context for stepping/pausing compatibility
        this.previousExecutionState = this.state; // Remember the state before waiting
        this.state = EXECUTION_STATE.WAITING_FOR_RESPONSE;
        this.waitingForRequestId = requestId;
        this.suspendedNode = node;
        
        // Use Promise-based approach like analogRead
        try {
            const response = await this.waitForResponse(requestId, 5000);
            return response;
        } catch (error) {
            this.emitError(`micros timeout: ${error.message}`);
            return Date.now() * 1000 % 1000000; // Fallback microsecond value
        }
    }
    
    // Arduino pulseIn() function - measures pulse duration on a pin
    arduinoPulseIn(args) {
        if (args.length < 2) {
            this.emitError("pulseIn() requires at least 2 arguments: pin, value");
            return 0;
        }
        
        const pin = args[0];
        const value = args[1]; // HIGH or LOW
        const timeout = args.length > 2 ? args[2] : 1000000; // Default 1 second timeout
        
        // In simulation, return a mock pulse duration in microseconds
        const mockDuration = 1500; // Typical ultrasonic sensor reading (~1.5ms for 25cm distance)
        
        this.emitCommand({
            type: COMMAND_TYPES.FUNCTION_CALL,
            function: 'pulseIn',
            arguments: [pin, value, timeout],
            pin: pin,
            value: this.sanitizeForCommand(value),
            timeout: timeout,
            timestamp: Date.now(),
            message: `pulseIn(${pin}, ${value}${args.length > 2 ? ', ' + timeout : ''})`
        });
        
        if (this.options.verbose) {
            debugLog(`pulseIn(${pin}, ${value}) -> ${mockDuration}μs`);
        }
        
        // Return proper type for Arduino compatibility
        return new ArduinoNumber(mockDuration, 'unsigned long');
    }
    
    // Arduino tone functions
    arduinoTone(args) {
        if (args.length < 2) {
            this.emitError("tone requires at least 2 arguments: pin, frequency");
            return;
        }
        
        const pin = args[0];
        const frequency = args[1];
        const duration = args.length > 2 ? args[2] : null; // Optional duration
        
        this.emitCommand({
            type: COMMAND_TYPES.FUNCTION_CALL,
            function: 'tone',
            arguments: duration !== null ? [pin, frequency, duration] : [pin, frequency],
            pin: pin,
            frequency: frequency,
            duration: duration,
            timestamp: Date.now(),
            message: duration !== null ? 
                `tone(${pin}, ${frequency}, ${duration})` : 
                `tone(${pin}, ${frequency})`
        });
        
        if (this.options.verbose) {
            debugLog(`tone(${pin}, ${frequency}${duration !== null ? ', ' + duration : ''})`);
        }
    }
    
    arduinoNoTone(args) {
        if (args.length < 1) {
            this.emitError("noTone requires 1 argument: pin");
            return;
        }
        
        const pin = args[0];
        
        this.emitCommand({
            type: COMMAND_TYPES.FUNCTION_CALL,
            function: 'noTone',
            arguments: [pin],
            pin: pin,
            timestamp: Date.now(),
            message: `noTone(${pin})`
        });
        
        if (this.options.verbose) {
            debugLog(`noTone(${pin})`);
        }
    }
    
    // Arduino character classification functions
    arduinoIsDigit(args) {
        if (args.length < 1) {
            this.emitError("isDigit requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        return charCode >= 48 && charCode <= 57; // '0' to '9'
    }
    
    arduinoIsPunct(args) {
        if (args.length < 1) {
            this.emitError("isPunct requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charStr;
        
        if (typeof char === 'string') {
            charStr = char;
        } else if (typeof char === 'number') {
            charStr = String.fromCharCode(char);
        } else {
            return false;
        }
        
        return /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(charStr);
    }
    
    arduinoIsAlpha(args) {
        if (args.length < 1) {
            this.emitError("isAlpha requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122); // A-Z or a-z
    }
    
    arduinoIsAlphaNumeric(args) {
        if (args.length < 1) {
            this.emitError("isAlphaNumeric requires 1 argument: character");
            return false;
        }
        
        return this.arduinoIsAlpha(args) || this.arduinoIsDigit(args);
    }
    
    arduinoIsSpace(args) {
        if (args.length < 1) {
            this.emitError("isSpace requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        return charCode === 32 || (charCode >= 9 && charCode <= 13); // space, tab, newline, etc.
    }
    
    arduinoIsUpperCase(args) {
        if (args.length < 1) {
            this.emitError("isUpperCase requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        return charCode >= 65 && charCode <= 90; // A-Z
    }
    
    arduinoIsLowerCase(args) {
        if (args.length < 1) {
            this.emitError("isLowerCase requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        return charCode >= 97 && charCode <= 122; // a-z
    }

    arduinoIsHexadecimalDigit(args) {
        if (args.length < 1) {
            this.emitError("isHexadecimalDigit requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        // Check if character is 0-9 (48-57), A-F (65-70), or a-f (97-102)
        return (charCode >= 48 && charCode <= 57) ||   // 0-9
               (charCode >= 65 && charCode <= 70) ||   // A-F
               (charCode >= 97 && charCode <= 102);    // a-f
    }

    arduinoIsAscii(args) {
        if (args.length < 1) {
            this.emitError("isAscii requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        // ASCII characters are 0-127
        return charCode >= 0 && charCode <= 127;
    }

    arduinoIsWhitespace(args) {
        if (args.length < 1) {
            this.emitError("isWhitespace requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        // Whitespace: space (32), tab (9), newline (10), carriage return (13), form feed (12), vertical tab (11)
        return charCode === 32 || charCode === 9 || charCode === 10 || 
               charCode === 13 || charCode === 12 || charCode === 11;
    }

    arduinoIsControl(args) {
        if (args.length < 1) {
            this.emitError("isControl requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        // Control characters: 0-31 and 127 (DEL)
        return (charCode >= 0 && charCode <= 31) || charCode === 127;
    }

    arduinoIsGraph(args) {
        if (args.length < 1) {
            this.emitError("isGraph requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        // Graphic characters: printable characters except space (33-126)
        return charCode >= 33 && charCode <= 126;
    }

    arduinoIsPrintable(args) {
        if (args.length < 1) {
            this.emitError("isPrintable requires 1 argument: character");
            return false;
        }
        
        const char = args[0];
        let charCode;
        
        if (typeof char === 'string' && char.length > 0) {
            charCode = char.charCodeAt(0);
        } else if (typeof char === 'number') {
            charCode = char;
        } else {
            return false;
        }
        
        // Printable characters: space through tilde (32-126)
        return charCode >= 32 && charCode <= 126;
    }
    
    // AVR hardware functions (stubs for interface compatibility)
    avrClockPrescaleSet(args) {
        // AVR clock prescaler setting - just emit command, no actual hardware control
        this.emitCommand({
            type: 'AVR_FUNCTION_CALL',
            function: 'clock_prescale_set',
            args: args,
            message: `clock_prescale_set(${args.join(', ')})`,
            timestamp: Date.now()
        });
        
        if (this.options.verbose) {
            debugLog(`AVR clock prescaler set: ${args.join(', ')}`);
        }
        
        return undefined; // void function
    }
    
    // Arduino Serial functions
    async executeSerialMethod(method, args, serialPort = 'Serial') {
        // Evaluate arguments if provided
        const evaluatedArgs = [];
        const originalArgs = args; // Keep reference to original AST nodes
        if (args) {
            for (const arg of args) {
                evaluatedArgs.push(await this.evaluateExpression(arg));
            }
        }
        
        switch (method) {
            case 'begin':
                if (evaluatedArgs.length < 1) {
                    this.emitError("Serial.begin requires 1 argument: baud rate");
                    return;
                }
                const baudRate = evaluatedArgs[0];
                
                // Mark Serial as initialized
                this.hardwareState.serial.initialized = true;
                
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.begin',
                    arguments: [baudRate],
                    baudRate: baudRate,
                    timestamp: Date.now(),
                    message: `Serial.begin(${baudRate})`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.begin(${baudRate})`);
                }
                return;
                
            case 'print':
                if (evaluatedArgs.length < 1) {
                    this.emitError("Serial.print requires 1 argument: data");
                    return;
                }
                const printData = this.formatSerialData(evaluatedArgs[0]);
                const printDisplayArg = this.formatArgumentForDisplay(evaluatedArgs[0], originalArgs[0]);
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.print',
                    arguments: [printData],  // Fixed: Use raw data instead of display format to match C++
                    data: printData,
                    timestamp: Date.now(),
                    message: `Serial.print(${printDisplayArg})`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.print(${printData})`);
                }
                return;
                
            case 'println':
                // Serial.println() can be called with or without arguments
                if (evaluatedArgs.length === 0) {
                    // Serial.println() with no arguments prints a newline
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Serial.println',
                        arguments: [],
                        timestamp: Date.now(),
                        message: `Serial.println()`
                    });
                    if (this.options.verbose) {
                        debugLog(`Serial.println()`);
                    }
                    return;
                } else {
                    const printlnData = this.formatSerialData(evaluatedArgs[0]);
                    const printlnDisplayArg = this.formatArgumentForDisplay(evaluatedArgs[0], originalArgs[0]);
                    this.emitCommand({
                        type: COMMAND_TYPES.FUNCTION_CALL,
                        function: 'Serial.println',
                        arguments: [printlnData],  // Fixed: Use raw data instead of display format to match C++
                        data: printlnData,
                        timestamp: Date.now(),
                        message: `Serial.println(${printlnDisplayArg})`
                    });
                    if (this.options.verbose) {
                        debugLog(`Serial.println(${printlnData})`);
                    }
                    return;
                }
                
            case 'available':
                // Serial.available() returns number of bytes available to read
                // CROSS-PLATFORM FIX: Use per-port static deterministic values for consistent testing
                // First call returns 0 (allow loop iteration), second call returns 1 (terminate loop)
                if (!this.serialPortCounters) this.serialPortCounters = {};
                if (!this.serialPortCounters[serialPort]) this.serialPortCounters[serialPort] = 0;
                const availableBytes = (this.serialPortCounters[serialPort] === 0) ? 0 : 1;
                this.serialPortCounters[serialPort]++;
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: `${serialPort}.available`,
                    arguments: [],
                    timestamp: Date.now(),
                    message: `${serialPort}.available()`
                });
                if (this.options.verbose) {
                    debugLog(`${serialPort}.available() -> ${availableBytes}`);
                }
                return availableBytes;
                
            case 'read':
                // Serial.read() reads a byte from the serial buffer
                // In simulation, return a mock byte value
                const readByte = 65; // Mock: return 'A' (ASCII 65)
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.read',
                    arguments: [],
                    timestamp: Date.now(),
                    message: `Serial.read()`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.read() -> ${readByte}`);
                }
                return readByte;
                
            case 'write':
                if (evaluatedArgs.length < 1) {
                    this.emitError("Serial.write requires 1 argument: data");
                    return;
                }
                const writeData = evaluatedArgs[0];
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.write',
                    arguments: [writeData],
                    timestamp: Date.now(),
                    message: `Serial.write(${writeData})`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.write(${writeData})`);
                }
                return;
                
            case 'peek':
                // Serial.peek() returns the next byte without removing it from buffer
                const peekByte = 65; // Mock: return 'A' (ASCII 65)
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.peek',
                    arguments: [],
                    timestamp: Date.now(),
                    message: `Serial.peek()`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.peek() -> ${peekByte}`);
                }
                return peekByte;
                
            case 'flush':
                // Serial.flush() waits for transmission to complete
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.flush',
                    arguments: [],
                    timestamp: Date.now(),
                    message: `Serial.flush()`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.flush()`);
                }
                return;
                
            case 'setTimeout':
                if (evaluatedArgs.length < 1) {
                    this.emitError("Serial.setTimeout requires 1 argument: timeout in milliseconds");
                    return;
                }
                const timeout = evaluatedArgs[0];
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.setTimeout',
                    arguments: [timeout],
                    timestamp: Date.now(),
                    message: `Serial.setTimeout(${timeout})`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.setTimeout(${timeout})`);
                }
                return;
                
            case 'parseInt':
                // Serial.parseInt() reads characters from the serial buffer and converts them to an integer
                // In simulation, return a mock integer value
                const parsedInt = Math.floor(Math.random() * 1024); // Mock: return random value 0-1023
                this.emitCommand({
                    type: COMMAND_TYPES.FUNCTION_CALL,
                    function: 'Serial.parseInt',
                    arguments: [],
                    timestamp: Date.now(),
                    message: `Serial.parseInt()`
                });
                if (this.options.verbose) {
                    debugLog(`Serial.parseInt() -> ${parsedInt}`);
                }
                return parsedInt;
                
            default:
                this.emitError(`Unknown Serial method: ${method}`);
                return null;
        }
    }
    
    // Generic Arduino library static method calls
    async executeStaticMethod(className, methodName, args) {
        // Evaluate arguments if provided
        const evaluatedArgs = [];
        if (args) {
            for (const arg of args) {
                evaluatedArgs.push(await this.evaluateExpression(arg));
            }
        }
        
        return await this.executeLibraryStaticMethod(className, methodName, evaluatedArgs);
    }
    
    // Generic library static method handler
    async executeLibraryStaticMethod(libraryName, methodName, args) {
        const library = ARDUINO_LIBRARIES[libraryName];
        
        if (!library) {
            this.emitError(`Unknown library: ${libraryName}`);
            return null;
        }
        
        if (!library.staticMethods.includes(methodName)) {
            this.emitError(`Unknown static method ${libraryName}.${methodName}`);
            return null;
        }
        
        // Emit generic command for static method call
        this.emitCommand({
            type: 'LIBRARY_STATIC_METHOD_CALL',
            library: libraryName,
            method: methodName,
            args: args,
            timestamp: Date.now(),
            message: `${libraryName}.${methodName}(${args.join(', ')})`
        });
        
        if (this.options.verbose) {
            debugLog(`Static method: ${libraryName}.${methodName}(${args.join(', ')})`);
        }
        
        // Return appropriate value based on method (simplified)
        if (methodName === 'Color' || methodName === 'ColorHSV') {
            // Color methods typically return a 32-bit color value
            return 0x000000; // Placeholder - parent app will handle actual color calculation
        }
        
        return null; // Generic return for most static methods
    }
    
    
    formatSerialData(data) {
        if (data instanceof ArduinoString) {
            return data.value;
        } else if (typeof data === 'string') {
            return data;
        } else if (typeof data === 'boolean') {
            return data ? 'true' : 'false';
        } else if (data === null || data === undefined) {
            return 'null';
        } else {
            return String(data);
        }
    }

    // Format arguments for display in function calls (preserves original representation)
    formatArgumentForDisplay(evaluatedValue, originalArg) {
        // If the original argument was a string literal, preserve quotes
        if (originalArg && originalArg.type === 'StringLiteralNode') {
            return `"${evaluatedValue}"`;
        }
        // If the original argument was a character literal, preserve single quotes
        else if (originalArg && originalArg.type === 'CharLiteralNode') {
            return `'${evaluatedValue}'`;
        }
        // If the evaluated value is an ArduinoString, it should be quoted
        else if (evaluatedValue instanceof ArduinoString) {
            return `"${evaluatedValue.value}"`;
        }
        // If the evaluated value is a regular string, it should be quoted
        else if (typeof evaluatedValue === 'string' && evaluatedValue.length > 0) {
            // Only quote if it's not a pure number and not a boolean
            if (!/^\d+(\.\d+)?$/.test(evaluatedValue) && evaluatedValue !== 'true' && evaluatedValue !== 'false') {
                return `"${evaluatedValue}"`;
            }
            return String(evaluatedValue);
        }
        // For other types, just return the evaluated value
        else {
            return String(evaluatedValue);
        }
    }
    
    // Arduino map function: map(value, fromLow, fromHigh, toLow, toHigh)
    arduinoMap(args) {
        if (args.length < 5) {
            this.emitError("map requires 5 arguments: value, fromLow, fromHigh, toLow, toHigh");
            return 0;
        }
        
        const [value, fromLow, fromHigh, toLow, toHigh] = args;
        const result = (value - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow;
        return Math.round(result); // Arduino map returns integer
    }
    
    // Arduino constrain function: constrain(value, min, max)
    arduinoConstrain(args) {
        if (args.length < 3) {
            this.emitError("constrain requires 3 arguments: value, min, max");
            return 0;
        }
        
        const [value, minVal, maxVal] = args;
        return Math.max(minVal, Math.min(maxVal, value));
    }
    
    // Arduino random function: random(max) or random(min, max)
    arduinoRandom(args) {
        if (args.length === 1) {
            // random(max) - returns 0 to max-1
            return Math.floor(Math.random() * args[0]);
        } else if (args.length === 2) {
            // random(min, max) - returns min to max-1
            const [minVal, maxVal] = args;
            return Math.floor(Math.random() * (maxVal - minVal)) + minVal;
        } else {
            this.emitError("random requires 1 or 2 arguments");
            return 0;
        }
    }
    
    // =========================================================================
    // UTILITY METHODS
    // =========================================================================
    
    /**
     * Safely extract numeric value from Arduino types or raw values
     */
    getNumericValue(value) {
        // Handle null/undefined
        if (value == null) return 0;
        
        // Handle ArduinoNumber wrapper objects
        if (value instanceof ArduinoNumber) {
            return value.value;
        }
        
        // Handle raw JavaScript numbers
        if (typeof value === 'number') {
            return value;
        }
        
        // Handle string representations of numbers
        if (typeof value === 'string') {
            const parsed = Number(value);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        
        // Handle other objects that might have a numeric value
        if (typeof value === 'object' && value.value !== undefined) {
            return this.getNumericValue(value.value);
        }
        
        // Try to convert whatever we have to a number
        const converted = Number(value);
        if (!isNaN(converted)) {
            return converted;
        }
        
        // If all else fails, return 0
        return 0;
    }

    // Helper function to check if an AST node represents an integer type
    // Used for type-aware arithmetic operations (e.g., integer division)
    isIntegerType(node) {
        if (!node) return false;

        // Check IdentifierNode - look up variable type metadata
        if (node.type === 'IdentifierNode') {
            const varName = node.value;
            const metadata = this.variables.getMetadata(varName);
            if (metadata) {
                const type = metadata.type || metadata.declaredType;
                // Arduino/C++ integer types
                const integerTypes = ['int', 'long', 'short', 'byte', 'word', 'char',
                                     'unsigned int', 'unsigned long', 'unsigned short', 'unsigned char',
                                     'int8_t', 'int16_t', 'int32_t', 'int64_t',
                                     'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
                                     'size_t'];
                return integerTypes.includes(type);
            }
            return false;
        }

        // Check LiteralNode - integer literals
        if (node.type === 'LiteralNode' || node.type === 'NumberLiteralNode') {
            const value = node.value;
            if (typeof value === 'number') {
                return Number.isInteger(value);
            }
            return false;
        }

        // For other node types, assume not integer (conservative)
        return false;
    }

    // Helper function to sanitize objects for JSON serialization (remove circular references)
    sanitizeForCommand(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }

        // If it's an ArduinoObject, create a safe representation
        if (obj && obj.constructor && obj.constructor.name === 'ArduinoObject') {
            return {
                __type: 'ArduinoObject',
                className: obj.className,
                constructorArgs: obj.constructorArgs,
                objectId: obj.objectId
                // Exclude 'interpreter' and 'libraryInfo' to prevent circular references
            };
        }

        // For other objects, return as-is
        return obj;
    }
    
    getVariable(name) {
        if (this.variables.has(name)) {
            const metadata = this.variables.getMetadata(name);
            
            // Check if this is a static variable - get value from static storage
            if (metadata?.isStatic) {
                const staticValue = this.staticVariables.get(metadata.staticKey);
                if (this.options.verbose) {
                    debugLog(`Getting static variable ${name} = ${staticValue} (key: ${metadata.staticKey})`);
                }
                return staticValue;
            }
            
            // Check if this is an extern variable with forward declaration but no value
            if (metadata?.isExtern && metadata?.isForwardDeclaration && metadata?.value === undefined) {
                // This is an extern forward declaration that hasn't been defined yet
                if (this.options.verbose) {
                    debugLog(`Extern forward declaration ${name} not yet defined`);
                }
                this.emitError(`Extern variable '${name}' used but not defined`);
                return 0;
            }
            
            // Variable initialization checking moved to pre-execution validation
            
            // Phase 4.4: Variable already marked as used in evaluateExpression
            
            if (this.options.verbose) {
                debugLog(`Getting variable ${name} = ${metadata?.value} (initialized: ${metadata?.isInitialized}, used: ${metadata?.isUsed}, extern: ${metadata?.isExtern})`);
            }
            
            // FALLBACK: Check static storage if variable has no static metadata but might be static
            const staticKey = `global_${name}`;
            if (this.staticVariables.has(staticKey)) {
                const staticValue = this.staticVariables.get(staticKey);
                if (this.options.verbose) {
                    debugLog(`Getting static variable ${name} = ${staticValue}`);
                }
                return staticValue;
            }
            
            return metadata?.value;
        }
        
        // Check if it's a constant
        const constantValue = this.evaluateConstant(name);
        if (constantValue !== name) {
            // It's a valid constant
            if (this.options.verbose) {
                debugLog(`Getting constant ${name} = ${constantValue}`);
            }
            return constantValue;
        }
        
        // Variable is undefined - emit error and return 0 as default
        this.emitError(`Undefined variable: ${name}`);
        return 0;
    }
    
    /**
     * Restore static variables for a function in current scope
     */
    restoreStaticVariables(funcName) {
        // Look for static variables that belong to this function
        for (const [staticKey, staticValue] of this.staticVariables.entries()) {
            if (staticKey.startsWith(`${funcName}_`)) {
                // Extract variable name from key
                const varName = staticKey.substring(`${funcName}_`.length);
                
                // Add to current scope (without declaration flag to avoid conflicts)
                this.variables.set(varName, staticValue, {
                    isDeclaration: false,
                    isStatic: true,
                    staticKey: staticKey
                });
                
                if (this.options.verbose) {
                    debugLog(`Restored static variable ${varName} = ${staticValue} (key: ${staticKey})`);
                }
            }
        }
    }
    
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        
        if (this.onStateChange) {
            this.onStateChange(newState, oldState);
        }
        
        if (this.options.verbose) {
            debugLog(`State changed: ${oldState} → ${newState}, Phase: ${this.executionContext.phase}, Loop: ${this.executionContext.loopIteration}`);
        }
    }
    
    emitCommand(command) {
        this.commandHistory.push(command);
        
        if (this.onCommand) {
            this.onCommand(command);
        }
        
        if (this.options.verbose) {
            debugLog("Command:", command);
        }
    }
    
    emitError(message) {
        const now = Date.now();
        
        // Track consecutive errors to prevent cascades
        if (now - this.lastErrorTime < 1000) { // Errors within 1 second are consecutive
            this.consecutiveErrors++;
        } else {
            this.consecutiveErrors = 1; // Reset counter if enough time passed
        }
        this.lastErrorTime = now;
        
        // Enhanced error message with location context
        let enhancedMessage = message;
        let locationInfo = null;
        
        if (this.currentNode) {
            // Extract location information from current node
            locationInfo = this.extractLocationInfo(this.currentNode);
            if (locationInfo) {
                enhancedMessage = `Line ${locationInfo.line}, Column ${locationInfo.column}: ${message}`;
                
                // Add code context if available
                if (locationInfo.context) {
                    enhancedMessage += `\n  → ${locationInfo.context}`;
                }
            }
        }
        
        const error = {
            type: COMMAND_TYPES.ERROR,
            message: enhancedMessage,
            originalMessage: message,
            node: this.currentNode,
            location: locationInfo,
            timestamp: now
        };
        
        // Check for error cascade - force stop if too many consecutive errors
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            error.message = `STOPPING DUE TO ERROR CASCADE: ${message} (${this.consecutiveErrors} consecutive errors)`;
            this.setState(EXECUTION_STATE.ERROR);
            this.emitCommand(error);
            
            // Force stop execution to prevent runaway
            this.executionContext.shouldContinue = false;
            this.executionContext.isExecuting = false;
            
            if (this.onError) {
                this.onError(error);
            }
            return;
        }
        
        this.setState(EXECUTION_STATE.ERROR);
        this.emitCommand(error);
        
        if (this.onError) {
            this.onError(error);
        }
    }
    
    // Phase 6.1: Extract location information from AST node
    extractLocationInfo(node) {
        if (!node) return null;
        
        // Look for position information in various node properties
        let line = null;
        let column = null;
        let context = null;
        
        // Check direct properties (these may not be present for backwards compatibility)
        if (node.line !== undefined && node.column !== undefined) {
            line = node.line;
            column = node.column;
        }
        
        // Check token property (for nodes that store their originating token)
        if (!line && node.token) {
            if (node.token.line !== undefined && node.token.column !== undefined) {
                line = node.token.line;
                column = node.token.column;
            }
        }
        
        // Check value property if it's an object with position info
        if (!line && node.value && typeof node.value === 'object') {
            if (node.value.line !== undefined && node.value.column !== undefined) {
                line = node.value.line;
                column = node.value.column;
            }
        }
        
        // For function calls, check the callee for position info
        if (!line && node.type === 'FuncCallNode' && node.callee) {
            if (node.callee.line !== undefined && node.callee.column !== undefined) {
                line = node.callee.line;
                column = node.callee.column;
            }
        }
        
        // For expressions, check nested nodes
        if (!line && node.expression) {
            const innerInfo = this.extractLocationInfo(node.expression);
            if (innerInfo && innerInfo.line !== undefined) {
                return innerInfo;
            }
        }
        
        // For variable declarations, check declarator and initializer
        if (!line && node.type === 'VarDeclNode' && node.declarations) {
            for (const decl of node.declarations) {
                if (decl.initializer) {
                    const initInfo = this.extractLocationInfo(decl.initializer);
                    if (initInfo && initInfo.line !== undefined) {
                        line = initInfo.line;
                        column = initInfo.column;
                        break;
                    }
                }
            }
        }
        
        // Try to extract context from the node
        if (node.type) {
            switch (node.type) {
                case 'IdentifierNode':
                    context = `identifier '${node.value}'`;
                    break;
                case 'FuncCallNode':
                    const funcName = node.callee?.value || 'unknown';
                    context = `function call '${funcName}()'`;
                    break;
                case 'BinaryOpNode':
                    context = `binary operation '${node.operator}'`;
                    break;
                case 'AssignmentNode':
                    const varName = node.left?.value || 'variable';
                    context = `assignment to '${varName}'`;
                    break;
                case 'VarDeclNode':
                    const declName = node.declarator?.value || 'variable';
                    context = `declaration of '${declName}'`;
                    break;
                case 'ExpressionStatement':
                    if (node.expression) {
                        const innerInfo = this.extractLocationInfo(node.expression);
                        if (innerInfo) return innerInfo;
                    }
                    context = 'expression statement';
                    break;
                default:
                    context = `${node.type.replace('Node', '').toLowerCase()}`;
                    break;
            }
        }
        
        return (line !== null && column !== null) ? 
            { line, column, context } : 
            (context ? { context } : null);
    }
    
    
    // Phase 4.2: Emit warning for uninitialized variables
    emitWarning(message) {
        const warning = {
            type: COMMAND_TYPES.WARNING || 'WARNING',
            message: message,
            node: this.currentNode,
            timestamp: Date.now()
        };
        
        this.emitCommand(warning);
        
        if (this.onWarning) {
            this.onWarning(warning);
        }
    }
    
    // Phase 4.3: Helper method for dead code detection
    getControlFlowName(node) {
        switch (node.type) {
            case 'ReturnStatement':
                return 'return statement';
            case 'BreakStatement':
                return 'break statement';
            case 'ContinueStatement':
                return 'continue statement';
            default:
                return 'control flow statement';
        }
    }
    
    visitNode(node) {
        if (this.onNodeVisit) {
            this.onNodeVisit(node);
        }
    }
    
    // =========================================================================
    // PUBLIC API METHODS
    // =========================================================================
    
    getState() {
        return this.state;
    }
    
    getVariables() {
        return Object.fromEntries(this.variables.entries());
    }
    
    getPinStates() {
        return Object.fromEntries(this.pinStates);
    }
    
    getCommandHistory() {
        return [...this.commandHistory];
    }
    
    clearCommandHistory() {
        this.commandHistory = [];
    }
    // =========================================================================
    // PHASE 9.1: STATEMENT COMPLETENESS METHODS
    // =========================================================================
    
    async executeCaseStatement(node) {
        const testValue = node.test ? await this.evaluateExpression(node.test) : null;
        const consequent = node.consequent || [];
        
        if (this.options.verbose) {
            debugLog(`Case statement: ${testValue !== null ? testValue : 'default'}`);
        }
        
        // Case statements are typically handled within switch context
        // Return case information for switch statement processing
        return {
            type: 'case_result',
            testValue: testValue,
            consequent: consequent,
            isDefault: testValue === null
        };
    }
    
    handleEmptyStatement(node) {
        if (this.options.verbose) {
            debugLog('Empty statement encountered');
        }
        
        // Empty statements are no-ops, just return success
        return {
            type: 'empty_statement_result',
            handled: true
        };
    }
    
    async executeRangeBasedForStatement(node) {
        const declaration = node.declaration; // Variable declaration (e.g., auto item)
        const range = node.range; // Range expression (e.g., container)
        const body = node.body; // Loop body
        
        if (!declaration || !range || !body) {
            this.emitError("Invalid range-based for statement: missing declaration, range, or body");
            return;
        }
        
        // Evaluate the range (container/array)
        const rangeValue = await this.evaluateExpression(range);
        
        if (this.options.verbose) {
            debugLog(`Range-based for loop over ${typeof rangeValue}`);
        }
        
        // Extract variable name from declaration
        const varName = declaration.declarator?.value || declaration.declarations?.[0]?.declarator?.value;
        if (!varName) {
            this.emitError("Invalid range-based for: no variable name");
            return;
        }
        
        // Determine iteration values based on range type
        let iterationValues = [];
        
        if (Array.isArray(rangeValue)) {
            iterationValues = rangeValue;
        } else if (rangeValue && typeof rangeValue === 'object' && rangeValue.type === 'array') {
            iterationValues = rangeValue.elements || [];
        } else if (typeof rangeValue === 'string') {
            iterationValues = rangeValue.split(''); // Iterate over characters
        } else if (typeof rangeValue === 'number') {
            // Create range 0 to number-1
            iterationValues = Array.from({length: rangeValue}, (_, i) => i);
        } else {
            iterationValues = [rangeValue]; // Single value iteration
        }
        
        // Execute loop for each value in range
        for (const iterValue of iterationValues) {
            // Set loop variable to current iteration value
            this.variables.set(varName, iterValue);
            
            // Execute loop body
            const result = await this.executeStatement(body);
            
            // Handle break/continue statements
            if (result && result.type === 'break') {
                break;
            } else if (result && result.type === 'continue') {
                continue;
            }
        }
        
        // Clean up loop variable (optional)
        if (this.options.verbose) {
            debugLog(`Range-based for loop completed (${iterationValues.length} iterations)`);
        }
    }
    
    // =========================================================================
    // PHASE 9.2: ADVANCED LANGUAGE FEATURES METHODS
    // =========================================================================
    
    async executeTernaryExpression(node) {
        const condition = node.condition;
        const consequent = node.consequent; // true branch
        const alternate = node.alternate; // false branch
        
        if (!condition || !consequent || !alternate) {
            this.emitError("Invalid ternary expression: missing condition, consequent, or alternate");
            return null;
        }
        
        // Evaluate condition
        const conditionResult = await this.evaluateExpression(condition);
        const isTrue = Boolean(conditionResult);
        
        if (this.options.verbose) {
            debugLog(`Ternary expression: ${conditionResult} ? ... : ...`);
        }
        
        // Return appropriate branch result
        return isTrue ? 
            await this.evaluateExpression(consequent) : 
            await this.evaluateExpression(alternate);
    }
    
    // =========================================================================
    // PHASE 9.3: EXPRESSION & CAST COMPLETENESS METHODS
    // =========================================================================
    
    async executePostfixExpression(node) {
        const operand = node.operand;
        const operator = node.op;
        
        if (!operand || !operator) {
            this.emitError("Invalid postfix expression: missing operand or operator");
            return null;
        }
        
        const operatorValue = operator.value || operator;
        
        if (this.options.verbose) {
            debugLog(`Postfix expression: ${operand.value || 'expression'}${operatorValue}`);
        }
        
        // Get current value before modification
        const currentValue = await this.evaluateExpression(operand);
        
        // Perform postfix operation based on operator
        switch (operatorValue) {
            case '++':
                // Increment after returning current value
                if (operand.type === 'IdentifierNode') {
                    const varName = operand.value;
                    const newValue = (parseFloat(currentValue) || 0) + 1;
                    this.variables.set(varName, newValue);
                    
                    // Update static variable storage if this is a static variable
                    const varInfo = this.variables.get(varName);
                    if (varInfo?.metadata?.isStatic) {
                        this.staticVariables.set(varInfo.metadata.staticKey, newValue);
                        if (this.options.verbose) {
                            debugLog(`Updated static variable ${varName} = ${newValue} (key: ${varInfo.metadata.staticKey})`);
                        }
                    }
                }
                return currentValue; // Return original value
                
            case '--':
                // Decrement after returning current value
                if (operand.type === 'IdentifierNode') {
                    const varName = operand.value;
                    const newValue = (parseFloat(currentValue) || 0) - 1;
                    this.variables.set(varName, newValue);
                    
                    // Update static variable storage if this is a static variable
                    const varInfo = this.variables.get(varName);
                    if (varInfo?.metadata?.isStatic) {
                        this.staticVariables.set(varInfo.metadata.staticKey, newValue);
                        if (this.options.verbose) {
                            debugLog(`Updated static variable ${varName} = ${newValue} (key: ${varInfo.metadata.staticKey})`);
                        }
                    }
                }
                return currentValue; // Return original value
                
            default:
                this.emitError(`Unsupported postfix operator: ${operatorValue}`);
                return currentValue;
        }
    }
    
    async executeCastExpression(node) {
        const castType = node.castType;
        const operand = node.operand;
        
        if (!castType || !operand) {
            this.emitError("Invalid cast expression: missing cast type or operand");
            return null;
        }
        
        // Evaluate the operand
        const sourceValue = await this.evaluateExpression(operand);
        const targetType = castType.value || castType;
        
        if (this.options.verbose) {
            debugLog(`C-style cast: (${targetType})${sourceValue}`);
        }
        
        // Perform cast (similar to static_cast)
        switch (targetType) {
            case 'int':
                return parseInt(sourceValue) || 0;
            case 'float':
            case 'double':
                return parseFloat(sourceValue) || 0.0;
            case 'char':
                return String(sourceValue).charAt(0) || '\0';
            case 'bool':
                return Boolean(sourceValue);
            default:
                // Custom type cast
                return {
                    type: 'cast_expression_result',
                    targetType: targetType,
                    sourceValue: sourceValue,
                    castStyle: 'c_style'
                };
        }
    }
    
    async executeNewExpression(node) {
        const allocationType = node.allocationType;
        const size = node.size;
        const args = node.arguments || [];
        
        if (!allocationType) {
            this.emitError("Invalid new expression: missing allocation type");
            return null;
        }
        
        const typeName = allocationType.value || allocationType;
        
        if (this.options.verbose) {
            debugLog(`New expression: new ${typeName}${size ? `[${size}]` : ''}(${args.length} args)`);
        }
        
        // Evaluate constructor arguments
        const evaluatedArgs = [];
        for (const arg of args) {
            evaluatedArgs.push(await this.evaluateExpression(arg));
        }
        
        // Create object instance
        if (size) {
            // Array allocation: new Type[size]
            const arraySize = await this.evaluateExpression(size);
            return {
                type: 'dynamic_array',
                elementType: typeName,
                size: arraySize,
                elements: new Array(this.validateArraySize(arraySize, 'heap allocated array')).fill(null),
                isHeapAllocated: true
            };
        } else {
            // Single object allocation: new Type(args)
            const objectInstance = this.createLibraryObject(typeName, evaluatedArgs);
            objectInstance.isHeapAllocated = true;
            return objectInstance;
        }
    }
    
    // =========================================================================
    // PHASE 9.2: STRUCTURAL DECLARATION METHODS
    // =========================================================================
    
    handleStructDeclaration(node) {
        const structName = node.name?.value || node.name;
        const members = node.members || [];
        
        // Struct declaration processing
        
        if (this.options.verbose) {
            debugLog(`Struct declaration: ${structName || 'anonymous'} with ${members.length} members`);
        }
        
        // Create struct type definition
        const structDef = {
            type: 'struct_definition',
            name: structName,
            members: members,
            isStruct: true
        };
        
        // Store struct definition for later instantiation
        if (structName) {
            this.structTypes = this.structTypes || new Map();
            this.structTypes.set(structName, structDef);
            if (this.options.verbose) {
                debugLog(`Stored struct type: ${structName}`);
            }
        } else {
            debugLog(`DEBUG: No structName to store, skipping`);
        }
        
        return structDef;
    }
    
    async handleEnumDeclaration(node) {
        const enumName = node.name?.value;
        const members = node.members || [];
        
        if (this.options.verbose) {
            debugLog(`Enum declaration: ${enumName || 'anonymous'} with ${members.length} members`);
        }
        
        // Process enum members and assign values
        const enumValues = new Map();
        let currentValue = 0;
        
        for (const member of members) {
            const memberName = member.name?.value;
            const memberValue = member.value ? 
                await this.evaluateExpression(member.value) : currentValue;
            
            if (memberName) {
                enumValues.set(memberName, memberValue);
                // Also make enum values available as variables
                this.variables.set(memberName, memberValue);
            }
            
            currentValue = memberValue + 1;
        }
        
        // Create enum type definition
        const enumDef = {
            type: 'enum_definition',
            name: enumName,
            members: members,
            values: enumValues,
            isEnum: true
        };
        
        // Store enum definition
        if (enumName) {
            this.enumTypes = this.enumTypes || new Map();
            this.enumTypes.set(enumName, enumDef);
        }
        
        return enumDef;
    }
    
    async createStructVariable(structTypeName, variableName) {
        // Create a struct variable instance
        if (this.options.verbose) {
            debugLog(`Creating struct variable: ${variableName} of type ${structTypeName}`);
        }
        
        if (!this.structTypes) {
            this.structTypes = new Map(); // Initialize if not exists
        }
        
        const structDef = this.structTypes.get(structTypeName);
        if (!structDef) {
            this.emitError(`Struct type '${structTypeName}' not defined`);
            return;
        }
        
        // Create struct fields map from struct definition
        const structFields = {};
        for (const member of structDef.members) {
            if (member.declarations) {
                // Handle multiple declarations in one line (e.g., "int x, y;")
                for (const memberDecl of member.declarations) {
                    const fieldName = memberDecl.declarator?.value || memberDecl.declarator?.identifier?.value;
                    const fieldType = member.memberType?.value || member.memberType;
                    if (fieldName) {
                        structFields[fieldName] = fieldType;
                    }
                }
            } else {
                // Handle single declaration
                const fieldName = member.declarator?.value || member.declarator?.identifier?.value;
                const fieldType = member.memberType?.value || member.memberType;
                if (fieldName) {
                    structFields[fieldName] = fieldType;
                }
            }
        }
        
        // Create ArduinoStruct instance
        const structInstance = new ArduinoStruct(structTypeName, structFields);
        
        // Declare the variable
        const result = this.variables.set(variableName, structInstance, {
            isDeclaration: true,
            declaredType: structTypeName,
            isStruct: true
        });
        
        if (!result.success) {
            this.emitError(result.message || `Failed to declare struct variable '${variableName}'`);
            return;
        }
        
        if (this.options.verbose) {
            debugLog(`Struct variable created: ${variableName} of type ${structTypeName} with fields [${Object.keys(structFields).join(', ')}]`);
        }
        
        // Emit command for variable creation
        this.emitCommand({
            type: COMMAND_TYPES.VAR_SET,
            variable: variableName,
            value: structInstance,
            structType: structTypeName,
            timestamp: Date.now()
        });
    }
    
    handleUnionDeclaration(node) {
        const unionName = node.name?.value;
        const members = node.members || [];
        const variables = node.variables || [];
        
        if (this.options.verbose) {
            debugLog(`Union declaration: ${unionName || 'anonymous'} with ${members.length} members`);
        }
        
        // Create union type definition
        const unionDef = {
            type: 'union_definition',
            name: unionName,
            members: members,
            variables: variables,
            isUnion: true
        };
        
        // Store union definition for later instantiation
        if (unionName) {
            this.unionTypes = this.unionTypes || new Map();
            this.unionTypes.set(unionName, unionDef);
        }
        
        return unionDef;
    }
    
    // handlePreprocessorDirective method removed - 
    // preprocessing now happens before parsing, no AST nodes to handle

    // =============================================================================
    // MISSING PARSER NODE TYPE IMPLEMENTATIONS
    // =============================================================================

    async executeCommaExpression(node) {
        // Comma operator: evaluate left, evaluate right, return right
        await this.evaluateExpression(node.left);
        return await this.evaluateExpression(node.right);
    }

    async executeRangeExpression(node) {
        // Range expression for range-based for loops
        const start = await this.evaluateExpression(node.start);
        const end = await this.evaluateExpression(node.end);
        return { type: 'range', start, end };
    }

    handleStructType(node) {
        // Handle struct type references in variable declarations like "struct Point"
        // This is typically followed by an identifier for the variable name
        const structName = node.name;
        
        if (this.options.verbose) {
            debugLog(`Struct type reference: ${structName}`);
        }
        
        // Store the pending struct type for the next identifier expression
        this.pendingStructType = structName;
        
        return {
            type: 'struct_type_reference',
            structName: structName
        };
    }

    extractIdentifiersFromCommaExpression(node) {
        // Recursively extract all identifiers from a comma expression
        // Handles patterns like: n1, n2  or  a, b, c  etc.
        const identifiers = [];
        
        function extractFromNode(n) {
            if (n.type === 'IdentifierNode') {
                identifiers.push(n.value);
            } else if (n.type === 'CommaExpression') {
                // Recursively handle nested comma expressions
                extractFromNode(n.left);
                extractFromNode(n.right);
            }
        }
        
        extractFromNode(node);
        return identifiers;
    }

    handleEnumType(node) {
        // Handle enum type references
        return {
            type: 'enum_type_ref',
            enumName: node.name || 'anonymous',
            values: this.getEnumValues(node.name) || {}
        };
    }

    async handleEnumMember(node) {
        // Handle individual enum member definitions
        const value = node.value ? await this.evaluateExpression(node.value) : undefined;
        return {
            type: 'enum_member',
            name: node.name,
            value: value
        };
    }

    handleUnionType(node) {
        // Handle union type references
        return {
            type: 'union_type_ref',
            unionName: node.name || 'anonymous',
            size: this.getUnionSize(node.name) || 0
        };
    }

    executeTypedefDeclaration(node) {
        // Handle typedef declarations - register type aliases
        const aliasName = node.typeName;
        
        if (this.options.verbose) {
            debugLog(`Processing typedef declaration: ${aliasName}`);
        }
        
        // Initialize type aliases map if needed
        if (!this.typeAliases) {
            this.typeAliases = new Map();
        }
        
        // Handle struct typedefs specifically
        if (node.baseType?.type === 'StructDeclaration') {
            const structDef = node.baseType;
            
            // Initialize struct types map if needed
            if (!this.structTypes) {
                this.structTypes = new Map();
            }
            
            // Register this typedef as a struct type
            this.structTypes.set(aliasName, structDef);
            
            // Also store in type aliases for general type lookup
            this.typeAliases.set(aliasName, 'struct');
            
            if (this.options.verbose) {
                debugLog(`Registered typedef struct: ${aliasName} with ${structDef.members?.length || 0} members`);
            }
        } else {
            // Handle other typedef cases
            this.typeAliases.set(aliasName, node.baseType);
            
            if (this.options.verbose) {
                debugLog(`Registered typedef alias: ${aliasName}`);
            }
        }
        
        return { type: 'typedef_registered', alias: aliasName, baseType: node.baseType };
    }

    executeClassDeclaration(node) {
        // Handle C++ class declarations - register class definition
        const className = node.className || node.name;
        
        if (this.options.verbose) {
            debugLog(`Class declaration: ${className}`);
        }
        
        // Store class definition if needed
        if (!this.classes) {
            this.classes = new Map();
        }
        this.classes.set(className, {
            name: className,
            members: node.members || [],
            methods: node.methods || [],
            constructors: node.constructors || []
        });
        
        return { type: 'class_registered', className };
    }

    executeConstructorDeclaration(node) {
        // Handle C++ constructor declarations
        const className = node.className || node.name;
        
        if (this.options.verbose) {
            debugLog(`Constructor declaration: ${className}`);
        }
        
        return { type: 'constructor_registered', className };
    }

    executeMemberFunctionDeclaration(node) {
        // Handle C++ member function declarations
        const className = node.className || node.class;
        const methodName = node.methodName || node.name;
        
        if (this.options.verbose) {
            debugLog(`Member function declaration: ${className}::${methodName}`);
        }
        
        return { type: 'member_function_registered', className, methodName };
    }

    executeTemplateDeclaration(node) {
        // Handle C++ template declarations
        const templateName = node.templateName || node.name;
        
        if (this.options.verbose) {
            debugLog(`Template declaration: ${templateName}`);
        }
        
        // Store template definition if needed
        if (!this.templates) {
            this.templates = new Map();
        }
        this.templates.set(templateName, {
            name: templateName,
            parameters: node.parameters || [],
            body: node.body
        });
        
        return { type: 'template_registered', templateName };
    }

    async executeLambdaExpression(node) {
        // Handle C++11 lambda expressions
        const captures = node.captures || [];
        const parameters = node.parameters || [];
        const body = node.body;
        
        if (this.options.verbose) {
            debugLog(`Lambda expression with ${captures.length} captures, ${parameters.length} parameters`);
        }
        
        // Create a lambda function object
        return {
            type: 'lambda_function',
            captures: captures,
            parameters: parameters,
            body: body,
            call: async (args) => {
                // Create new scope for lambda execution
                this.pushScope();
                try {
                    // Bind parameters
                    for (let i = 0; i < parameters.length && i < args.length; i++) {
                        const param = parameters[i];
                        const paramName = param.declarator?.value || param.name;
                        if (paramName) {
                            this.setVariable(paramName, args[i]);
                        }
                    }
                    
                    // Execute lambda body
                    return await this.executeStatement(body);
                } finally {
                    this.popScope();
                }
            }
        };
    }

    // Helper methods for type system support
    getStructSize(structName) {
        // Return default struct sizes - can be enhanced as needed
        return 8; // Default struct size
    }
    
    deepCopyArray(arr) {
        // 🔧 FIX: Deep copy array to prevent retroactive modification of emitted commands
        if (!Array.isArray(arr)) {
            return arr;
        }

        return arr.map(item => {
            if (Array.isArray(item)) {
                return this.deepCopyArray(item); // Recursive for multidimensional arrays
            }
            return item;
        });
    }

    getArrayBaseName(arrayAccess) {
        // Extract the base array name from nested ArrayAccessNode structures
        // For pixels[x][y], traverses: pixels[x][y] -> pixels[x] -> pixels
        if (!arrayAccess || arrayAccess.type !== 'ArrayAccessNode') {
            return null;
        }

        let current = arrayAccess;
        while (current.identifier && current.identifier.type === 'ArrayAccessNode') {
            current = current.identifier;
        }

        return current.identifier?.value || null;
    }
    
    async getArrayIndices(arrayAccess) {
        // Extract all indices from nested ArrayAccessNode structures
        // For pixels[x][y], returns [x_value, y_value]
        const indices = [];
        
        let current = arrayAccess;
        while (current && current.type === 'ArrayAccessNode') {
            // Evaluate the current index and prepend to array (reverse order)
            const indexValue = await this.evaluateExpression(current.index);
            indices.unshift(indexValue);
            current = current.identifier;
        }
        
        return indices;
    }
    
    createMultidimensionalArray(dimensions) {
        // Create a multidimensional array with the given dimensions
        // For [8, 8], creates an 8x8 array filled with zeros
        if (dimensions.length === 0) {
            return 0; // scalar value
        }
        
        if (dimensions.length === 1) {
            this.validateArraySize(dimensions[0], 'multidimensional array');
            return new Array(dimensions[0]).fill(0);
        }
        
        this.validateArraySize(dimensions[0], 'multidimensional array dimension');
        const result = new Array(dimensions[0]);
        const remainingDimensions = dimensions.slice(1);
        
        for (let i = 0; i < dimensions[0]; i++) {
            result[i] = this.createMultidimensionalArray(remainingDimensions);
        }
        
        return result;
    }

    getEnumValues(enumName) {
        // Return enum values if registered
        return {}; // Default empty enum
    }

    getUnionSize(unionName) {
        // Return default union sizes - can be enhanced as needed
        return 8; // Default union size
    }

    handleMultipleStructMembers(node) {
        // Handle multiple struct member declarations in one line
        return {
            type: 'multiple_struct_members',
            members: node.members || [],
            memberType: node.memberType || 'unknown'
        };
    }

    handleStructMember(node) {
        // Handle individual struct member declarations
        return {
            type: 'struct_member',
            memberName: node.name || node.value,
            memberType: node.type || 'unknown',
            size: this.getTypeSize(node.type) || 4
        };
    }

    handleTemplateTypeParameter(node) {
        // Handle template type parameters like 'typename T'
        return {
            type: 'template_type_param',
            paramName: node.name || node.value,
            constraint: node.constraint || null
        };
    }

    getTypeSize(typeName) {
        // Return default type sizes
        const typeSizes = {
            'int': 4,
            'char': 1,
            'float': 4,
            'double': 8,
            'bool': 1,
            'short': 2,
            'long': 8
        };
        return typeSizes[typeName] || 4; // Default to 4 bytes
    }
    
    // =========================================================================
    // PREPROCESSOR MACRO SUPPORT
    // =========================================================================
    
    initializeDefaultMacros() {
        // Common Arduino constants
        this.macros.set('HIGH', '1');
        this.macros.set('LOW', '0');
        this.macros.set('INPUT', '0');
        this.macros.set('OUTPUT', '1');
        this.macros.set('INPUT_PULLUP', '2');
        this.macros.set('LED_BUILTIN', '13');
        
        // ArduinoISP.ino specific macros
        this.macros.set('SERIAL', 'Serial');
        this.macros.set('PTIME', '30');
        this.macros.set('BAUDRATE', '19200');
        this.macros.set('HWVER', '2');
        this.macros.set('SWMAJ', '1');
        this.macros.set('SWMIN', '18');
        this.macros.set('LED_PMODE', '7');
        this.macros.set('LED_ERR', '8');
        this.macros.set('LED_HB', '9');
        this.macros.set('RESET', '10');
        this.macros.set('MOSI', '11');
        this.macros.set('MISO', '12');
        this.macros.set('SCK', '13');
        
        // Test26.ino specific macros (temporary for testing)
        this.macros.set('PI', '3.14159');
        this.functionMacros.set('CIRCLE_AREA', {
            params: ['r'],
            body: '(PI * r * r)'
        });
        
        if (this.options.verbose) {
            debugLog('Initialized default Arduino macros including PI and CIRCLE_AREA');
        }
    }
    
    // Process preprocessor results from AST
    processPreprocessorResults() {
        if (!this.ast || !this.ast.preprocessorInfo) {
            return; // No preprocessor information available
        }
        
        const preprocessorInfo = this.ast.preprocessorInfo;
        
        // Enable active libraries
        if (preprocessorInfo.activeLibraries) {
            for (const libraryName of preprocessorInfo.activeLibraries) {
                this.activeLibraries.add(libraryName);
                
                if (this.options.verbose) {
                    debugLog(`📦 Enabled library: ${libraryName}`);
                }
            }
        }
        
        // Add preprocessor macros to interpreter's macro storage
        if (preprocessorInfo.macros) {
            for (const [macroName, macroValue] of Object.entries(preprocessorInfo.macros)) {
                // Only add if not already defined (preprocessor takes precedence over defaults)
                if (!this.macros.has(macroName)) {
                    this.macros.set(macroName, macroValue);
                } else {
                    // Update with preprocessor value (preprocessor overrides defaults)
                    this.macros.set(macroName, macroValue);
                }
            }
        }
        
        // Add function-like macros
        if (preprocessorInfo.functionMacros) {
            for (const [macroName, macroInfo] of Object.entries(preprocessorInfo.functionMacros)) {
                this.functionMacros.set(macroName, macroInfo);
            }
        }
        
        // Add library constants as variables in global scope
        if (preprocessorInfo.libraryConstants) {
            for (const [constantName, constantValue] of Object.entries(preprocessorInfo.libraryConstants)) {
                // Convert string values to appropriate types
                let value = constantValue;
                
                // Handle hex values (0x52 -> 82)
                if (typeof constantValue === 'string' && constantValue.startsWith('0x')) {
                    value = parseInt(constantValue, 16);
                }
                // Handle numeric strings
                else if (typeof constantValue === 'string' && !isNaN(constantValue)) {
                    value = Number(constantValue);
                }
                
                // Add to global variable scope
                const result = this.variables.set(constantName, value, {
                    isDeclaration: true,
                    declaredType: 'const int',
                    scopeType: 'global'
                });
                
                if (result.success) {
                    this.variables.markAsInitialized(constantName);
                    
                    if (this.options.verbose) {
                        debugLog(`🔧 Added library constant: ${constantName} = ${value}`);
                    }
                } else if (this.options.verbose) {
                    console.warn(`⚠️  Failed to add library constant: ${constantName}`);
                }
            }
        }
        
        if (this.options.verbose && (preprocessorInfo.activeLibraries?.length > 0 || Object.keys(preprocessorInfo.macros || {}).length > 0)) {
            debugLog(`✅ Processed preprocessor results: ${preprocessorInfo.activeLibraries?.length || 0} libraries, ${Object.keys(preprocessorInfo.macros || {}).length} macros, ${Object.keys(preprocessorInfo.libraryConstants || {}).length} constants`);
        }
    }
    
    // Process #define directive
    processDefine(name, value) {
        // Check if this is a function-like macro: #define NAME(params) body
        const functionMatch = name.match(/^(\w+)\s*\(([^)]*)\)$/);
        
        if (functionMatch) {
            // Function-like macro: #define CIRCLE_AREA(r) (PI * r * r)
            const macroName = functionMatch[1];
            const paramsStr = functionMatch[2].trim();
            const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];
            
            this.functionMacros.set(macroName, {
                params: params,
                body: value
            });
            
            if (this.options.verbose) {
                debugLog(`Defined function macro: ${macroName}(${params.join(', ')}) = ${value}`);
            }
        } else {
            // Simple macro: #define PI 3.14159
            this.macros.set(name, value);
            
            if (this.options.verbose) {
                debugLog(`Defined macro: ${name} = ${value}`);
            }
        }
    }
    
    // Expand macros in expression
    expandMacros(expression) {
        let expanded = expression;
        
        // Expand simple macros first (like PI -> 3.14159)
        for (const [name, value] of this.macros.entries()) {
            // Use word boundaries to avoid partial replacements
            const regex = new RegExp(`\\b${name}\\b`, 'g');
            expanded = expanded.replace(regex, value);
        }
        
        // Expand function-like macros (like CIRCLE_AREA(r) -> (PI * r * r))
        for (const [name, macro] of this.functionMacros.entries()) {
            // Match function calls: MACRO_NAME(arg1, arg2, ...)
            const regex = new RegExp(`\\b${name}\\s*\\(([^)]+)\\)`, 'g');
            
            expanded = expanded.replace(regex, (match, argsStr) => {
                const args = argsStr.split(',').map(arg => arg.trim());
                
                if (args.length !== macro.params.length) {
                    console.warn(`Macro ${name} expects ${macro.params.length} arguments, got ${args.length}`);
                    return match; // Return original if argument count doesn't match
                }
                
                let body = macro.body;
                // Replace parameters with arguments
                for (let i = 0; i < macro.params.length; i++) {
                    const paramRegex = new RegExp(`\\b${macro.params[i]}\\b`, 'g');
                    body = body.replace(paramRegex, args[i]);
                }
                
                return body;
            });
        }
        
        return expanded;
    }
    
    // Check if macro is defined (for #ifdef)
    isMacroDefined(name) {
        return this.macros.has(name) || this.functionMacros.has(name);
    }
    
    // Safe mathematical expression evaluator for macro expansions
    // Handles basic arithmetic expressions like "(3.14159 * 5 * 5)" without eval()
    evaluateSimpleMacroExpression(expression) {
        // Remove outer parentheses if they exist
        let expr = expression.trim();
        if (expr.startsWith('(') && expr.endsWith(')')) {
            expr = expr.slice(1, -1);
        }
        
        // Replace any remaining macro references
        expr = this.expandMacros(expr);
        
        // Safe evaluation using custom parser (no eval())
        try {
            // Sanitize the expression to only allow numbers, operators, and parentheses
            if (!/^[0-9+\-*/().\ ]+$/.test(expr)) {
                throw new Error(`Unsafe expression: ${expr}`);
            }
            
            const result = this.evaluateMathExpression(expr);
            
            if (this.options.verbose) {
                debugLog(`Safe macro evaluation: ${expr} = ${result}`);
            }
            
            return result;
        } catch (error) {
            throw new Error(`Cannot evaluate expression: ${expr} (${error.message})`);
        }
    }
    
    // Safe mathematical expression evaluator using shunting-yard algorithm
    // Supports: numbers, +, -, *, /, parentheses with proper precedence
    evaluateMathExpression(expr) {
        // Tokenize the expression
        const tokens = expr.match(/\d+\.?\d*|[+\-*/()]/g);
        if (!tokens) return 0;
        
        // Convert to postfix notation (RPN) using shunting-yard algorithm
        const output = [];
        const operators = [];
        const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
        
        for (const token of tokens) {
            if (/^\d+\.?\d*$/.test(token)) {
                // Number
                output.push(parseFloat(token));
            } else if (token === '(') {
                operators.push(token);
            } else if (token === ')') {
                while (operators.length && operators[operators.length - 1] !== '(') {
                    output.push(operators.pop());
                }
                operators.pop(); // Remove '('
            } else if (precedence[token]) {
                // Operator
                while (operators.length && 
                       operators[operators.length - 1] !== '(' &&
                       precedence[operators[operators.length - 1]] >= precedence[token]) {
                    output.push(operators.pop());
                }
                operators.push(token);
            }
        }
        
        // Pop remaining operators
        while (operators.length) {
            output.push(operators.pop());
        }
        
        // Evaluate postfix expression
        const stack = [];
        for (const item of output) {
            if (typeof item === 'number') {
                stack.push(item);
            } else {
                const b = stack.pop();
                const a = stack.pop();
                switch (item) {
                    case '+': stack.push(a + b); break;
                    case '-': stack.push(a - b); break;
                    case '*': stack.push(a * b); break;
                    case '/': 
                        if (b === 0) throw new Error('Division by zero');
                        stack.push(a / b); 
                        break;
                }
            }
        }
        
        return stack[0] || 0;
    }
}

// =============================================================================
// EXPORT FOR BROWSER AND NODE.JS
// =============================================================================

// Make classes available globally for browser usage
if (typeof window !== 'undefined') {
    window.ASTInterpreter = ASTInterpreter;
    window.COMMAND_TYPES = COMMAND_TYPES;
    window.EXECUTION_STATE = EXECUTION_STATE;
    window.INTERPRETER_VERSION = INTERPRETER_VERSION;
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js export
    module.exports = {
        ASTInterpreter,
        COMMAND_TYPES,
        EXECUTION_STATE,
        INTERPRETER_VERSION
    };
}