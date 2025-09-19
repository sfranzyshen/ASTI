/**
 * FlexibleCommand.hpp - Dynamic Command System for Cross-Platform Compatibility
 * 
 * Replaces the rigid inheritance-based command system with a flexible JSON-like
 * structure that can represent all 50 JavaScript command structures with
 * their unique field combinations.
 * 
 * Based on analysis of 3,028 commands from 135 test cases:
 * - 50 unique command structures
 * - 7 FUNCTION_CALL variants
 * - 4 VAR_SET variants
 * - 287 unique FUNCTION_CALL message patterns
 */

#pragma once

#include <string>
#include <map>
#include <variant>
#include <vector>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <algorithm>

namespace arduino_interpreter {

/**
 * String wrapper to indicate object format serialization
 * When serialized, becomes {"value": "content"}
 */
struct StringObject {
    std::string value;
    explicit StringObject(const std::string& v) : value(v) {}
};

/**
 * Dynamic command value that can hold any JSON-compatible type
 */
using FlexibleCommandValue = std::variant<
    std::monostate,    // null
    bool,              // boolean
    int32_t,           // integer (32-bit)
    int64_t,           // long integer (64-bit, for timestamps)
    double,            // floating point
    std::string,       // string
    StringObject,      // string object wrapper
    std::vector<std::variant<bool, int32_t, double, std::string>>  // array
>;

/**
 * Flexible command that can represent ANY JavaScript command structure
 * Uses a map-based approach to dynamically store fields
 */
class FlexibleCommand {
private:
    std::string type_;
    std::map<std::string, FlexibleCommandValue> fields_;
    uint64_t timestamp_;

public:
    /**
     * Create a new flexible command with the given type
     */
    explicit FlexibleCommand(const std::string& type) 
        : type_(type)
        , timestamp_(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count()) {
        // Always include type and timestamp
        fields_["type"] = type;
        fields_["timestamp"] = static_cast<int64_t>(timestamp_);
    }

    /**
     * Set a field value (fluent interface)
     */
    FlexibleCommand& set(const std::string& key, const FlexibleCommandValue& value) {
        fields_[key] = value;
        return *this;
    }

    /**
     * Get a field value
     */
    FlexibleCommandValue get(const std::string& key) const {
        auto it = fields_.find(key);
        if (it != fields_.end()) {
            return it->second;
        }
        return std::monostate{};
    }

    /**
     * Check if a field exists
     */
    bool has(const std::string& key) const {
        return fields_.find(key) != fields_.end();
    }

    /**
     * Get the command type
     */
    const std::string& getType() const { return type_; }

    /**
     * Get all field names
     */
    std::vector<std::string> getFieldNames() const {
        std::vector<std::string> names;
        for (const auto& [key, value] : fields_) {
            names.push_back(key);
        }
        return names;
    }

    /**
     * Serialize to single-line JSON (matches JavaScript format exactly)
     */
    std::string toJSON() const {
        std::ostringstream oss;
        oss << "{\n";

        bool first = true;

        // JavaScript field order varies by command type
        std::vector<std::string> jsOrder;

        // Check command type and set appropriate field order
        auto typeIt = fields_.find("type");
        std::string cmdType = (typeIt != fields_.end()) ? std::get<std::string>(typeIt->second) : "";

        if (cmdType == "FUNCTION_CALL") {
            // FUNCTION_CALL: Check for specific function patterns
            auto funcIt = fields_.find("function");
            std::string functionName = (funcIt != fields_.end()) ? std::get<std::string>(funcIt->second) : "";
            
            if (functionName == "Serial.begin") {
                // Serial.begin: type, function, arguments, baudRate, timestamp, message
                jsOrder = {"type", "function", "arguments", "baudRate", "timestamp", "message"};
            } else if (functionName == "Serial.print") {
                // Serial.print: type, function, arguments, data, timestamp, message (same as JavaScript)
                jsOrder = {"type", "function", "arguments", "data", "timestamp", "message"};
            } else if (functionName == "Serial.println") {
                // Serial.println: type, function, arguments, data, timestamp, message
                jsOrder = {"type", "function", "arguments", "data", "timestamp", "message"};
            } else if (functionName == "tone" || functionName == "noTone") {
                // tone/noTone: type, function, arguments, pin, frequency, duration, timestamp, message
                jsOrder = {"type", "function", "arguments", "pin", "frequency", "duration", "timestamp", "message"};
            } else {
                // Other FUNCTION_CALL: type, function, message, iteration, completed, timestamp
                jsOrder = {"type", "function", "message", "iteration", "completed", "timestamp"};
            }
        } else if (cmdType == "VAR_SET") {
            // VAR_SET: type, variable, value, isConst, timestamp (JavaScript field order)
            jsOrder = {"type", "variable", "value", "isConst", "timestamp"};
        } else if (cmdType == "PIN_MODE") {
            // PIN_MODE: type, pin, mode, timestamp
            jsOrder = {"type", "pin", "mode", "timestamp"};
        } else if (cmdType == "DIGITAL_READ_REQUEST") {
            // DIGITAL_READ_REQUEST: type, pin, requestId, timestamp
            jsOrder = {"type", "pin", "requestId", "timestamp"};
        } else if (cmdType == "ANALOG_READ_REQUEST") {
            // ANALOG_READ_REQUEST: type, pin, requestId, timestamp (match JavaScript field order)
            jsOrder = {"type", "pin", "requestId", "timestamp"};
        } else if (cmdType == "MILLIS_REQUEST") {
            // MILLIS_REQUEST: type, requestId, timestamp (JavaScript field order)
            jsOrder = {"type", "requestId", "timestamp"};
        } else if (cmdType == "DELAY") {
            // DELAY: type, duration, actualDelay, timestamp
            jsOrder = {"type", "duration", "actualDelay", "timestamp"};
        } else if (cmdType == "ANALOG_WRITE") {
            // ANALOG_WRITE: type, pin, value, timestamp
            jsOrder = {"type", "pin", "value", "timestamp"};
        } else if (cmdType == "FOR_LOOP") {
            // FOR_LOOP: type, phase, iteration, timestamp, message (JavaScript field order)
            jsOrder = {"type", "phase", "iteration", "timestamp", "message"};
        } else if (cmdType == "WHILE_LOOP") {
            // WHILE_LOOP: type, phase, iterations, timestamp, message (JavaScript field order)
            jsOrder = {"type", "phase", "iterations", "timestamp", "message"};
        } else if (cmdType == "IF_STATEMENT") {
            // IF_STATEMENT: type, condition, result, branch, timestamp
            jsOrder = {"type", "condition", "result", "branch", "timestamp"};
        } else if (cmdType == "LOOP_LIMIT_REACHED") {
            // LOOP_LIMIT_REACHED: type, phase, iterations, timestamp, message (JavaScript field order)
            jsOrder = {"type", "phase", "iterations", "timestamp", "message"};
        } else {
            // Other commands: type, timestamp, then other fields
            jsOrder = {"type", "timestamp", "component", "version", "status", "message", "requestId", 
                       "iterations", "limitReached", "duration", "actualDelay", "data"};
        }
        
        // Output fields in JavaScript order
        for (const std::string& fieldName : jsOrder) {
            auto it = fields_.find(fieldName);
            if (it != fields_.end()) {
                if (!first) oss << ",\n";
                first = false;
                oss << "  \"" << fieldName << "\": ";
                serializeValue(oss, it->second);
            }
        }
        
        // Output any remaining fields not in the order list (should be rare)
        for (const auto& [key, value] : fields_) {
            if (std::find(jsOrder.begin(), jsOrder.end(), key) == jsOrder.end()) {
                if (!first) oss << ",\n";
                first = false;
                oss << "  \"" << key << "\": ";
                serializeValue(oss, value);
            }
        }
        
        oss << "\n}";
        return oss.str();
    }

private:
    /**
     * Format double to remove trailing zeros for JavaScript compatibility
     */
    std::string formatDouble(double value) const {
        std::ostringstream temp;
        temp << std::fixed << std::setprecision(10) << value;
        std::string result = temp.str();

        // Remove trailing zeros after decimal point
        if (result.find('.') != std::string::npos) {
            result.erase(result.find_last_not_of('0') + 1, std::string::npos);
            result.erase(result.find_last_not_of('.') + 1, std::string::npos);
        }
        return result;
    }

    /**
     * Serialize a CommandValue to JSON
     */
    void serializeValue(std::ostringstream& oss, const FlexibleCommandValue& value) const {
        std::visit([&oss, this](auto&& arg) {
            using T = std::decay_t<decltype(arg)>;
            if constexpr (std::is_same_v<T, std::monostate>) {
                oss << "null";
            } else if constexpr (std::is_same_v<T, bool>) {
                oss << (arg ? "true" : "false");
            } else if constexpr (std::is_same_v<T, int32_t>) {
                if (arg == -999) {
                    oss << "null";  // Convert sentinel value to null for JavaScript compatibility
                } else {
                    oss << arg;
                }
            } else if constexpr (std::is_same_v<T, int64_t>) {
                oss << arg;
            } else if constexpr (std::is_same_v<T, double>) {
                oss << this->formatDouble(arg);
            } else if constexpr (std::is_same_v<T, std::string>) {
                oss << "\"" << this->escapeString(arg) << "\"";
            } else if constexpr (std::is_same_v<T, StringObject>) {
                oss << "{\n    \"value\": \"" << this->escapeString(arg.value) << "\"\n  }";
            } else if constexpr (std::is_same_v<T, std::vector<std::variant<bool, int32_t, double, std::string>>>) {
                oss << "[\n";
                for (size_t i = 0; i < arg.size(); ++i) {
                    if (i > 0) oss << ",\n";
                    oss << "    ";
                    this->serializeArrayElement(oss, arg[i]);
                }
                oss << "\n  ]";
            }
        }, value);
    }

    /**
     * Serialize a single array element
     */
    void serializeArrayElement(std::ostringstream& oss, const std::variant<bool, int32_t, double, std::string>& elem) const {
        std::visit([&oss, this](auto&& element) {
            using ET = std::decay_t<decltype(element)>;
            if constexpr (std::is_same_v<ET, bool>) {
                oss << (element ? "true" : "false");
            } else if constexpr (std::is_same_v<ET, int32_t>) {
                if (element == -999) {
                    oss << "null";  // Convert sentinel value to null for JavaScript compatibility
                } else {
                    oss << element;
                }
            } else if constexpr (std::is_same_v<ET, double>) {
                oss << this->formatDouble(element);
            } else if constexpr (std::is_same_v<ET, std::string>) {
                oss << "\"" << this->escapeString(element) << "\"";
            }
        }, elem);
    }


    /**
     * Escape special characters in JSON strings
     */
    std::string escapeString(const std::string& str) const {
        std::string escaped;
        for (char c : str) {
            switch (c) {
                case '"': escaped += "\\\""; break;
                case '\\': escaped += "\\\\"; break;
                case '\n': escaped += "\\n"; break;
                case '\r': escaped += "\\r"; break;
                case '\t': escaped += "\\t"; break;
                default: escaped += c; break;
            }
        }
        return escaped;
    }
};

/**
 * Factory functions for creating specific command types based on JavaScript patterns
 * These match the exact field combinations found in the analysis
 */
namespace FlexibleCommandFactory {

    // VERSION_INFO: {type, timestamp, component, version, status}
    inline FlexibleCommand createVersionInfo(const std::string& component, const std::string& version, const std::string& status) {
        return FlexibleCommand("VERSION_INFO")
            .set("component", component)
            .set("version", version)
            .set("status", status);
    }

    // PROGRAM_START: {type, timestamp, message}
    inline FlexibleCommand createProgramStart() {
        return FlexibleCommand("PROGRAM_START")
            .set("message", std::string("Program execution started"));
    }

    // SETUP_START: {type, timestamp, message}
    inline FlexibleCommand createSetupStart() {
        return FlexibleCommand("SETUP_START")
            .set("message", std::string("Executing setup() function"));
    }

    // SETUP_END: {type, timestamp, message}
    inline FlexibleCommand createSetupEnd() {
        return FlexibleCommand("SETUP_END")
            .set("message", std::string("Completed setup() function"));
    }

    // LOOP_START: {type, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createLoopStart(const std::string& type, uint32_t iteration = 0) {
        std::string message;
        if (type == "main" || type == "loop") {
            if (iteration == 0) {
                message = "Starting loop() execution";
            } else {
                message = "Starting loop iteration " + std::to_string(iteration);
            }
        } else {
            message = type + " loop started";
        }
        return FlexibleCommand("LOOP_START")
            .set("message", message);
    }

    // FOR_LOOP phase start: {type, phase, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createForLoopStart() {
        return FlexibleCommand("FOR_LOOP")
            .set("phase", std::string("start"))
            .set("message", std::string("for loop started"));
    }

    // FOR_LOOP phase iteration: {type, phase, iteration, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createForLoopIteration(uint32_t iteration) {
        return FlexibleCommand("FOR_LOOP")
            .set("phase", std::string("iteration"))
            .set("iteration", static_cast<int32_t>(iteration))
            .set("message", std::string("for loop iteration ") + std::to_string(iteration));
    }

    // LOOP_LIMIT_REACHED: {type, phase, iterations, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createForLoopEnd(uint32_t iterations, uint32_t maxIterations) {
        std::string message = "For loop limit reached: completed " + std::to_string(iterations) +
                             " iterations (max: " + std::to_string(maxIterations) + ")";
        return FlexibleCommand("LOOP_LIMIT_REACHED")
            .set("phase", std::string("end"))
            .set("iterations", static_cast<int32_t>(iterations))
            .set("message", message);
    }

    // WHILE_LOOP phase start: {type, phase, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createWhileLoopStart() {
        return FlexibleCommand("WHILE_LOOP")
            .set("phase", std::string("start"))
            .set("message", std::string("while loop started"));
    }

    // WHILE_LOOP phase iteration: {type, phase, iteration, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createWhileLoopIteration(uint32_t iteration) {
        return FlexibleCommand("WHILE_LOOP")
            .set("phase", std::string("iteration"))
            .set("iteration", static_cast<int32_t>(iteration))
            .set("message", std::string("while loop iteration ") + std::to_string(iteration));
    }

    // WHILE_LOOP end: {type, phase, iterations, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createWhileLoopEnd(uint32_t iterations) {
        return FlexibleCommand("WHILE_LOOP")
            .set("phase", std::string("end"))
            .set("iterations", static_cast<int32_t>(iterations))
            .set("message", std::string("while loop completed"));
    }

    // DO_WHILE_LOOP phase start: {type, phase, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createDoWhileLoopStart() {
        return FlexibleCommand("DO_WHILE_LOOP")
            .set("phase", std::string("start"))
            .set("message", std::string("do-while loop started"));
    }

    // DO_WHILE_LOOP phase iteration: {type, phase, iteration, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createDoWhileLoopIteration(uint32_t iteration) {
        return FlexibleCommand("DO_WHILE_LOOP")
            .set("phase", std::string("iteration"))
            .set("iteration", static_cast<int32_t>(iteration))
            .set("message", std::string("do-while loop iteration ") + std::to_string(iteration));
    }

    // DO_WHILE_LOOP end: {type, phase, iterations, timestamp, message} - JavaScript compatible
    inline FlexibleCommand createDoWhileLoopEnd(uint32_t iterations) {
        return FlexibleCommand("DO_WHILE_LOOP")
            .set("phase", std::string("end"))
            .set("iterations", static_cast<int32_t>(iterations))
            .set("message", std::string("do-while loop completed"));
    }

    // FUNCTION_CALL variant 1: {type, timestamp, function, arguments, baudRate, message}
    inline FlexibleCommand createFunctionCallSerialBegin(int32_t baudRate) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {baudRate};
        return FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("Serial.begin"))
            .set("arguments", args)
            .set("baudRate", baudRate)
            .set("message", std::string("Serial.begin(") + std::to_string(baudRate) + ")");
    }

    // FUNCTION_CALL variant 2: {type, timestamp, function, message, iteration}
    inline FlexibleCommand createFunctionCallLoop(int32_t iteration, bool completed = false) {
        FlexibleCommand cmd("FUNCTION_CALL");
        cmd.set("function", std::string("loop"))
           .set("iteration", iteration);
        
        if (completed) {
            cmd.set("message", std::string("Completed loop() iteration ") + std::to_string(iteration))
               .set("completed", true);
        } else {
            cmd.set("message", std::string("Executing loop() iteration ") + std::to_string(iteration));
        }
        
        return cmd;
    }

    // FUNCTION_CALL variant 3: {type, timestamp, function, arguments, data, message}
    inline FlexibleCommand createFunctionCallSerialPrintln(const std::string& data) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {data};
        return FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("Serial.println"))
            .set("arguments", args)
            .set("data", data)
            .set("message", std::string("Serial.println(") + data + ")");
    }

    // FUNCTION_CALL generic: matches old CommandFactory signature
    inline FlexibleCommand createFunctionCall(const std::string& name, const std::vector<std::string>& argStrings = {}, 
                                            bool isCompleted = false, int32_t iteration = 0, const std::string& customMessage = "") {
        FlexibleCommand cmd("FUNCTION_CALL");
        cmd.set("function", name);
        
        if (!argStrings.empty()) {
            std::vector<std::variant<bool, int32_t, double, std::string>> args;
            for (const auto& arg : argStrings) {
                args.push_back(arg);
            }
            cmd.set("arguments", args);
        }
        
        if (iteration > 0) {
            cmd.set("iteration", iteration);
            if (isCompleted) {
                cmd.set("completed", true)
                   .set("message", customMessage.empty() ? 
                        ("Completed " + name + "() iteration " + std::to_string(iteration)) : customMessage);
            } else {
                cmd.set("message", customMessage.empty() ? 
                        ("Executing " + name + "() iteration " + std::to_string(iteration)) : customMessage);
            }
        } else {
            std::string message = customMessage.empty() ? 
                (name + "()") : customMessage;
            cmd.set("message", message);
        }
        
        return cmd;
    }

    // VAR_SET variant 1: {type, timestamp, variable, value}
    inline FlexibleCommand createVarSet(const std::string& variable, const FlexibleCommandValue& value) {
        return FlexibleCommand("VAR_SET")
            .set("variable", variable)
            .set("value", value);
    }

    // VAR_SET variant 2: {type, timestamp, variable, value, isConst}
    inline FlexibleCommand createVarSetConst(const std::string& variable, const FlexibleCommandValue& value) {
        return FlexibleCommand("VAR_SET")
            .set("variable", variable)
            .set("value", value)
            .set("isConst", true);
    }

    // VAR_SET variant for const strings with object wrapper (JavaScript compatibility)
    inline FlexibleCommand createVarSetConstString(const std::string& variable, const std::string& stringValue) {
        return FlexibleCommand("VAR_SET")
            .set("variable", variable)
            .set("value", StringObject(stringValue))
            .set("isConst", true);
    }

    // ANALOG_READ_REQUEST: {type, timestamp, pin, requestId}
    inline FlexibleCommand createAnalogReadRequest(int32_t pin, const std::string& requestId) {
        return FlexibleCommand("ANALOG_READ_REQUEST")
            .set("pin", pin)
            .set("requestId", requestId);
    }

    // ANALOG_READ_REQUEST: {type, timestamp, pin, requestId} - version with auto-generated ID
    inline FlexibleCommand createAnalogReadRequest(int32_t pin) {
        std::string requestId = "analogRead_" + std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count()) + "_" + std::to_string(pin);
        return createAnalogReadRequest(pin, requestId);
    }

    // DIGITAL_READ_REQUEST: {type, timestamp, pin, requestId}
    inline FlexibleCommand createDigitalReadRequest(int32_t pin) {
        std::string requestId = "digitalRead_" + std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count()) + "_" + std::to_string(pin);
        return FlexibleCommand("DIGITAL_READ_REQUEST")
            .set("pin", pin)
            .set("requestId", requestId);
    }

    // MILLIS_REQUEST: {type, timestamp, requestId}
    inline FlexibleCommand createMillisRequest() {
        std::string requestId = "millis_" + std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count());
        return FlexibleCommand("MILLIS_REQUEST")
            .set("requestId", requestId);
    }

    // MICROS_REQUEST: {type, timestamp, requestId}
    inline FlexibleCommand createMicrosRequest() {
        std::string requestId = "micros_" + std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count());
        return FlexibleCommand("MICROS_REQUEST")
            .set("requestId", requestId);
    }

    // PIN_MODE: {type, timestamp, pin, mode}
    inline FlexibleCommand createPinMode(int32_t pin, int32_t mode) {
        return FlexibleCommand("PIN_MODE")
            .set("pin", pin)
            .set("mode", mode);
    }

    // DIGITAL_WRITE: {type, timestamp, pin, value}
    inline FlexibleCommand createDigitalWrite(int32_t pin, int32_t value) {
        return FlexibleCommand("DIGITAL_WRITE")
            .set("pin", pin)
            .set("value", value);
    }

    // LOOP_END: {type, timestamp, message, iterations, limitReached}
    inline FlexibleCommand createLoopEnd(int32_t iterations, bool limitReached) {
        std::string message = limitReached ? 
            "Loop limit reached: completed " + std::to_string(iterations) + " iterations (max: " + std::to_string(iterations) + ")" :
            "Loop completed after " + std::to_string(iterations) + " iterations";
            
        return FlexibleCommand("LOOP_END")
            .set("message", message)
            .set("iterations", iterations)
            .set("limitReached", limitReached);
    }

    // LOOP_END: {type, timestamp, message, iterations, limitReached} - JavaScript compatible
    inline FlexibleCommand createLoopEnd(const std::string& type, uint32_t iterations) {
        std::string message = "Loop limit reached: completed " + std::to_string(iterations) + 
                             " iterations (max: " + std::to_string(iterations) + ")";
        return FlexibleCommand("LOOP_END")
            .set("message", message)
            .set("iterations", static_cast<int32_t>(iterations))
            .set("limitReached", true);
    }

    // IF_STATEMENT: {type, timestamp, condition, result, branch}
    inline FlexibleCommand createIfStatement(const FlexibleCommandValue& condition, bool result, const std::string& branch) {
        return FlexibleCommand("IF_STATEMENT")
            .set("condition", condition)
            .set("result", result)
            .set("branch", branch);
    }

    // PROGRAM_END: {type, timestamp, message}
    inline FlexibleCommand createProgramEnd(const std::string& message) {
        return FlexibleCommand("PROGRAM_END")
            .set("message", message);
    }

    // === ADDITIONAL MISSING FUNCTIONS ===

    // ANALOG_WRITE: {type, timestamp, pin, value}
    inline FlexibleCommand createAnalogWrite(int32_t pin, int32_t value) {
        return FlexibleCommand("ANALOG_WRITE")
            .set("pin", pin)
            .set("value", value);
    }

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

    // SERIAL OPERATIONS
    inline FlexibleCommand createSerialBegin(int32_t baudRate) {
        return createFunctionCallSerialBegin(baudRate);
    }

    inline FlexibleCommand createSerialPrint(const std::string& data, const std::string& format = "AUTO") {
        // CROSS-PLATFORM FIX: Format string arguments with quotes like JavaScript
        std::string displayArg = data;
        // If data appears to be a string literal (contains spaces or special chars), add quotes
        if (data.find(' ') != std::string::npos || data.find('\t') != std::string::npos ||
            data.find('=') != std::string::npos || data.find(',') != std::string::npos ||
            (!data.empty() && !std::isdigit(data[0]) && data != "true" && data != "false")) {
            displayArg = "\"" + data + "\"";
        }

        std::vector<std::variant<bool, int32_t, double, std::string>> args = {displayArg};
        return FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("Serial.print"))
            .set("arguments", args)
            .set("data", data)
            // CROSS-PLATFORM FIX: Remove format field to match JavaScript output
            .set("message", std::string("Serial.print(") + displayArg + ")");
    }

    inline FlexibleCommand createSerialPrintln(const std::string& data, const std::string& format = "AUTO") {
        if (data.empty() && format == "NEWLINE") {
            return FlexibleCommand("FUNCTION_CALL")
                .set("function", std::string("Serial.println"))
                .set("message", std::string("Serial.println()"));
        }
        return createFunctionCallSerialPrintln(data);
    }

    inline FlexibleCommand createSerialWrite(int32_t byte) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {byte};
        return FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("Serial.write"))
            .set("arguments", args)
            .set("message", std::string("Serial.write(") + std::to_string(byte) + ")");
    }

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

    // TONE OPERATIONS
    inline FlexibleCommand createTone(int32_t pin, int32_t frequency) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin, frequency};
        FlexibleCommand cmd = FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("tone"))
            .set("arguments", args)
            .set("pin", pin)
            .set("message", std::string("tone(") + std::to_string(pin) + ", " + (frequency == -999 ? "null" : std::to_string(frequency)) + ")");

        // Only set frequency field if it's not the null sentinel value (to match JavaScript)
        if (frequency != -999) {
            cmd.set("frequency", frequency);
        }

        return cmd;
    }

    inline FlexibleCommand createToneWithDuration(int32_t pin, int32_t frequency, int32_t duration) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin, frequency, duration};
        FlexibleCommand cmd = FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("tone"))
            .set("arguments", args)
            .set("pin", pin)
            .set("duration", duration)
            .set("message", std::string("tone(") + std::to_string(pin) + ", " + (frequency == -999 ? "null" : std::to_string(frequency)) + ", " + std::to_string(duration) + ")");

        // Only set frequency field if it's not the null sentinel value (to match JavaScript)
        if (frequency != -999) {
            cmd.set("frequency", frequency);
        }

        return cmd;
    }

    inline FlexibleCommand createNoTone(int32_t pin) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin};
        return FlexibleCommand("FUNCTION_CALL")
            .set("function", std::string("noTone"))
            .set("arguments", args)
            .set("pin", pin)
            .set("message", std::string("noTone(") + std::to_string(pin) + ")");
    }

    // PULSE OPERATIONS
    inline FlexibleCommand createPulseInRequest(int32_t pin, int32_t value, int32_t timeout, const std::string& requestId) {
        std::vector<std::variant<bool, int32_t, double, std::string>> args = {pin, value, timeout};
        return FlexibleCommand("PULSE_IN_REQUEST")
            .set("function", std::string("pulseIn"))
            .set("arguments", args)
            .set("pin", pin)
            .set("value", value)
            .set("timeout", timeout)
            .set("requestId", requestId)
            .set("message", std::string("pulseIn(") + std::to_string(pin) + ", " + std::to_string(value) + ", " + std::to_string(timeout) + ")");
    }

    // MULTI-SERIAL OPERATIONS
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

    // SYSTEM OPERATIONS
    inline FlexibleCommand createError(const std::string& message, const std::string& errorType = "RuntimeError") {
        return FlexibleCommand("ERROR")
            .set("message", message)
            .set("errorType", errorType);
    }

    inline FlexibleCommand createSystemCommand(const std::string& commandType, const std::string& message) {
        return FlexibleCommand("SYSTEM_COMMAND")
            .set("commandType", commandType)
            .set("message", message);
    }

    // =============================================================================
    // JAVASCRIPT-COMPATIBLE AST NODE COMMANDS (Added for cross-platform parity)
    // =============================================================================

    inline FlexibleCommand createEnumMember(const std::string& name, const FlexibleCommandValue& value) {
        return FlexibleCommand("enum_member")
            .set("name", name)
            .set("value", value);
    }

    inline FlexibleCommand createEnumTypeRef(const std::string& enumName, const std::string& values = "{}") {
        return FlexibleCommand("enum_type_ref")
            .set("enumName", enumName)
            .set("values", values);
    }

    inline FlexibleCommand createConstructorRegistered(const std::string& className) {
        return FlexibleCommand("constructor_registered")
            .set("className", className);
    }

    inline FlexibleCommand createLambdaFunction(const std::vector<std::string>& captures, 
                                               const std::vector<std::string>& parameters,
                                               const std::string& bodyDescription = "lambda_body") {
        std::vector<std::variant<bool, int32_t, double, std::string>> captureArray;
        for (const auto& capture : captures) {
            captureArray.push_back(capture);
        }
        std::vector<std::variant<bool, int32_t, double, std::string>> paramArray;
        for (const auto& param : parameters) {
            paramArray.push_back(param);
        }
        
        return FlexibleCommand("lambda_function")
            .set("captures", captureArray)
            .set("parameters", paramArray)
            .set("body", bodyDescription);
    }

    inline FlexibleCommand createMemberFunctionRegistered(const std::string& className, const std::string& methodName) {
        return FlexibleCommand("member_function_registered")
            .set("className", className)
            .set("methodName", methodName);
    }

    inline FlexibleCommand createDynamicArray(const std::string& elementType, int32_t size) {
        return FlexibleCommand("dynamic_array")
            .set("elementType", elementType)
            .set("size", size)
            .set("isHeapAllocated", true);
    }

    inline FlexibleCommand createObjectInstance(const std::string& className, 
                                               const std::vector<std::variant<bool, int32_t, double, std::string>>& args) {
        return FlexibleCommand("object_instance")
            .set("className", className)
            .set("arguments", args)
            .set("isHeapAllocated", true);
    }

    inline FlexibleCommand createRangeExpression(const FlexibleCommandValue& start, const FlexibleCommandValue& end) {
        return FlexibleCommand("range")
            .set("start", start)
            .set("end", end);
    }

    inline FlexibleCommand createMultipleStructMembers(const std::vector<std::string>& members, const std::string& memberType = "unknown") {
        std::vector<std::variant<bool, int32_t, double, std::string>> memberArray;
        for (const auto& member : members) {
            memberArray.push_back(member);
        }
        
        return FlexibleCommand("multiple_struct_members")
            .set("members", memberArray)
            .set("memberType", memberType);
    }

    inline FlexibleCommand createStructMember(const std::string& memberName, const std::string& memberType, int32_t size = 4) {
        return FlexibleCommand("struct_member")
            .set("memberName", memberName)
            .set("memberType", memberType)
            .set("size", size);
    }

    inline FlexibleCommand createTemplateTypeParam(const std::string& paramName, const std::string& constraint = "") {
        return FlexibleCommand("template_type_param")
            .set("paramName", paramName)
            .set("constraint", constraint);
    }

    inline FlexibleCommand createUnionDefinition(const std::string& unionName, 
                                                const std::vector<std::string>& members,
                                                const std::vector<std::string>& variables = {}) {
        std::vector<std::variant<bool, int32_t, double, std::string>> memberArray;
        for (const auto& member : members) {
            memberArray.push_back(member);
        }
        std::vector<std::variant<bool, int32_t, double, std::string>> variableArray;
        for (const auto& variable : variables) {
            variableArray.push_back(variable);
        }
        
        return FlexibleCommand("union_definition")
            .set("name", unionName)
            .set("members", memberArray)
            .set("variables", variableArray)
            .set("isUnion", true);
    }

    inline FlexibleCommand createUnionTypeRef(const std::string& unionName, int32_t size = 8) {
        return FlexibleCommand("union_type_ref")
            .set("unionName", unionName)
            .set("size", size);
    }

    inline FlexibleCommand createPreprocessorError(const std::string& directiveType, const std::string& message) {
        return FlexibleCommand("ERROR")
            .set("errorType", "PreprocessorError")
            .set("message", std::string("Unexpected PreprocessorDirective AST node: ") + directiveType + ". " + message);
    }

    // =============================================================================
    // ADDITIONAL SYSTEM COMMAND FACTORY METHODS (JavaScript Compatibility)
    // =============================================================================

    inline FlexibleCommand createVersionInfo(const std::string& version = "1.0.0", const std::string& component = "interpreter") {
        return FlexibleCommand("VERSION_INFO")
            .set("component", component)
            .set("version", version)
            .set("status", std::string("started"));
    }

    inline FlexibleCommand createLoopEndComplete(int32_t iterations, bool limitReached = false, const std::string& message = "") {
        std::string msg = message.empty() ? 
            (limitReached ? 
                ("Loop limit reached: completed " + std::to_string(iterations) + " iterations (max: " + std::to_string(iterations) + ")") :
                ("Completed " + std::to_string(iterations) + " loop iterations")
            ) : message;
        
        return FlexibleCommand("LOOP_END")
            .set("iterations", iterations)
            .set("limitReached", limitReached)
            .set("message", msg);
    }

    inline FlexibleCommand createBreakStatement() {
        return FlexibleCommand("BREAK_STATEMENT")
            .set("message", std::string("break"));
    }

    inline FlexibleCommand createContinueStatement() {
        return FlexibleCommand("CONTINUE_STATEMENT")
            .set("message", std::string("continue"));
    }

} // namespace FlexibleCommandFactory

/**
 * Helper function to convert old CommandValue to FlexibleCommandValue
 * Needed for gradual migration from old to new command system
 * Forward declare to avoid circular includes
 */
template<typename OldCommandValue>
inline FlexibleCommandValue convertCommandValue(const OldCommandValue& oldValue) {
    return std::visit([](auto&& arg) -> FlexibleCommandValue {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::vector<int32_t>>) {
            // Convert typed int array to mixed array format
            std::vector<std::variant<bool, int32_t, double, std::string>> mixedArray;
            for (const auto& elem : arg) {
                mixedArray.emplace_back(elem);
            }
            return mixedArray;
        } else if constexpr (std::is_same_v<T, std::vector<double>>) {
            // Convert typed double array to mixed array format
            std::vector<std::variant<bool, int32_t, double, std::string>> mixedArray;
            for (const auto& elem : arg) {
                mixedArray.emplace_back(elem);
            }
            return mixedArray;
        } else if constexpr (std::is_same_v<T, std::vector<std::string>>) {
            // Convert typed string array to mixed array format
            std::vector<std::variant<bool, int32_t, double, std::string>> mixedArray;
            for (const auto& elem : arg) {
                mixedArray.emplace_back(elem);
            }
            return mixedArray;
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            // Convert uint32_t to int64_t for FlexibleCommandValue
            return static_cast<int64_t>(arg);
        } else {
            // Direct conversion for basic types
            return arg;
        }
    }, oldValue);
}

/**
 * Command listener interface for flexible commands
 */
class FlexibleCommandListener {
public:
    virtual ~FlexibleCommandListener() = default;
    virtual void onCommand(const FlexibleCommand& command) = 0;
    virtual void onError(const std::string& error) = 0;
};

} // namespace arduino_interpreter