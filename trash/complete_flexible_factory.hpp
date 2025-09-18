/**
 * Complete FlexibleCommandFactory - All Missing Functions
 * Generated from analysis of 64 CommandFactory calls in ASTInterpreter.cpp
 */

// Add to FlexibleCommand.hpp after existing functions:

// === PIN & HARDWARE OPERATIONS ===

// ANALOG_WRITE: {type, timestamp, pin, value}
inline FlexibleCommand createAnalogWrite(int32_t pin, int32_t value) {
    return FlexibleCommand("ANALOG_WRITE")
        .set("pin", pin)
        .set("value", value);
}

// === TIMING OPERATIONS ===

// DELAY: {type, timestamp, duration, actualDelay}
inline FlexibleCommand createDelay(uint32_t ms) {
    return FlexibleCommand("DELAY")
        .set("duration", static_cast<int32_t>(ms))
        .set("actualDelay", static_cast<int32_t>(ms));
}

// DELAY_MICROSECONDS: {type, timestamp, duration}
inline FlexibleCommand createDelayMicroseconds(uint32_t us) {
    return FlexibleCommand("DELAY_MICROSECONDS")
        .set("duration", static_cast<int32_t>(us));
}

// === SERIAL OPERATIONS ===

// FUNCTION_CALL variant for Serial.begin with correct fields
inline FlexibleCommand createSerialBegin(int32_t baudRate) {
    return createFunctionCallSerialBegin(baudRate); // Reuse existing
}

// FUNCTION_CALL variant for Serial.print
inline FlexibleCommand createSerialPrint(const std::string& data, const std::string& format = "AUTO") {
    std::vector<std::variant<bool, int32_t, double, std::string>> args = {data};
    return FlexibleCommand("FUNCTION_CALL")
        .set("function", std::string("Serial.print"))
        .set("arguments", args)
        .set("data", data)
        .set("format", format)
        .set("message", std::string("Serial.print(") + data + ")");
}

// FUNCTION_CALL variant for Serial.println
inline FlexibleCommand createSerialPrintln(const std::string& data, const std::string& format = "AUTO") {
    if (data.empty() && format == "NEWLINE") {
        return FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("Serial.println"))
            .set("message", std::string("Serial.println()"));
    }
    return createFunctionCallSerialPrintln(data); // Reuse existing
}

// FUNCTION_CALL variant for Serial.write
inline FlexibleCommand createSerialWrite(int32_t byte) {
    std::vector<std::variant<bool, int32_t, double, std::string>> args = {byte};
    return FlexibleCommand("FUNCTION_CALL")
        .set("function", std::string("Serial.write"))
        .set("arguments", args)
        .set("message", std::string("Serial.write(") + std::to_string(byte) + ")");
}

// Serial request commands
inline FlexibleCommand createSerialRequest(const std::string& operation, const std::string& requestId) {
    return FlexibleCommand("SERIAL_REQUEST")
        .set("operation", operation)
        .set("requestId", requestId)
        .set("message", std::string("Serial.") + operation + "()");
}

inline FlexibleCommand createSerialRequestWithChar(const std::string& operation, char terminator, const std::string& requestId) {
    return FlexibleCommand("SERIAL_REQUEST")
        .set("operation", operation)
        .set("terminator", std::string(1, terminator))
        .set("requestId", requestId)
        .set("message", std::string("Serial.") + operation + "(" + terminator + ")");
}

inline FlexibleCommand createSerialTimeout(int32_t timeout) {
    return FlexibleCommand("SERIAL_TIMEOUT")
        .set("timeout", timeout)
        .set("message", std::string("Serial.setTimeout(") + std::to_string(timeout) + ")");
}

inline FlexibleCommand createSerialFlush() {
    return FlexibleCommand("FUNCTION_CALL")
        .set("function", std::string("Serial.flush"))
        .set("message", std::string("Serial.flush()"));
}

// === MULTI-SERIAL OPERATIONS ===

inline FlexibleCommand createMultiSerialBegin(const std::string& portName, int32_t baudRate) {
    return FlexibleCommand("MULTI_SERIAL_BEGIN")
        .set("port", portName)
        .set("baudRate", baudRate)
        .set("message", portName + ".begin(" + std::to_string(baudRate) + ")");
}

inline FlexibleCommand createMultiSerialPrint(const std::string& portName, const std::string& data, const std::string& format) {
    return FlexibleCommand("MULTI_SERIAL_PRINT")
        .set("port", portName)
        .set("data", data)
        .set("format", format)
        .set("message", portName + ".print(" + data + ")");
}

inline FlexibleCommand createMultiSerialPrintln(const std::string& portName, const std::string& data, const std::string& format) {
    return FlexibleCommand("MULTI_SERIAL_PRINTLN")
        .set("port", portName)
        .set("data", data)
        .set("format", format)
        .set("message", portName + ".println(" + data + ")");
}

inline FlexibleCommand createMultiSerialRequest(const std::string& portName, const std::string& operation, const std::string& requestId) {
    return FlexibleCommand("MULTI_SERIAL_REQUEST")
        .set("port", portName)
        .set("operation", operation)
        .set("requestId", requestId)
        .set("message", portName + "." + operation + "()");
}

inline FlexibleCommand createMultiSerialCommand(const std::string& portName, const std::string& methodName) {
    return FlexibleCommand("MULTI_SERIAL_COMMAND")
        .set("port", portName)
        .set("method", methodName)
        .set("message", portName + "." + methodName + "()");
}

// === TONE OPERATIONS ===

inline FlexibleCommand createTone(int32_t pin, int32_t frequency) {
    std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin, frequency};
    return FlexibleCommand("FUNCTION_CALL")
        .set("function", std::string("tone"))
        .set("arguments", args)
        .set("pin", pin)
        .set("frequency", frequency)
        .set("message", std::string("tone(") + std::to_string(pin) + ", " + std::to_string(frequency) + ")");
}

inline FlexibleCommand createToneWithDuration(int32_t pin, int32_t frequency, int32_t duration) {
    std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin, frequency, duration};
    return FlexibleCommand("FUNCTION_CALL")
        .set("function", std::string("tone"))
        .set("arguments", args)
        .set("pin", pin)
        .set("frequency", frequency)
        .set("duration", duration)
        .set("message", std::string("tone(") + std::to_string(pin) + ", " + std::to_string(frequency) + ", " + std::to_string(duration) + ")");
}

inline FlexibleCommand createNoTone(int32_t pin) {
    std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin};
    return FlexibleCommand("FUNCTION_CALL")
        .set("function", std::string("noTone"))
        .set("arguments", args)
        .set("pin", pin)
        .set("message", std::string("noTone(") + std::to_string(pin) + ")");
}

// === SYSTEM OPERATIONS ===

inline FlexibleCommand createError(const std::string& message, const std::string& type = "RuntimeError") {
    return FlexibleCommand("ERROR")
        .set("message", message)
        .set("errorType", type);
}

inline FlexibleCommand createSystemCommand(const std::string& type, const std::string& message) {
    return FlexibleCommand("SYSTEM_COMMAND")
        .set("commandType", type)
        .set("message", message);
}

// === CONVERSION HELPERS ===

// Helper to convert enum types to int32_t for JSON compatibility
inline int32_t convertPinMode(int mode) { return static_cast<int32_t>(mode); }
inline int32_t convertDigitalValue(int value) { return static_cast<int32_t>(value); }