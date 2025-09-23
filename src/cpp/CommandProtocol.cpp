/**
 * CommandProtocol.cpp - C++ Command Protocol Implementation
 * 
 * Implementation of command types and structures that match JavaScript exactly.
 * Provides cross-platform compatible command serialization and utilities.
 * 
 * Version: 1.0
 */

#include "CommandProtocol.hpp"
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <iostream>

namespace arduino_interpreter {

// =============================================================================
// COMMAND BASE IMPLEMENTATION
// =============================================================================

std::string Command::toString() const {
    std::ostringstream oss;
    oss << commandTypeToString(type);
    return oss.str();
}

// =============================================================================
// PIN OPERATION COMMAND IMPLEMENTATIONS
// =============================================================================

std::string PinModeCommand::toString() const {
    std::ostringstream oss;
    oss << "PIN_MODE(pin=" << pin << ", mode=" << pinModeToString(mode) << ")";
    return oss.str();
}

CommandValue PinModeCommand::getValue(const std::string& key) const {
    if (key == "pin") return pin;
    if (key == "mode") return pinModeToString(mode);
    return std::monostate{};
}

std::string DigitalWriteCommand::toString() const {
    std::ostringstream oss;
    oss << "DIGITAL_WRITE(pin=" << pin << ", value=" << static_cast<int>(value) << ")";
    return oss.str();
}

CommandValue DigitalWriteCommand::getValue(const std::string& key) const {
    if (key == "pin") return pin;
    if (key == "value") return static_cast<int32_t>(value);
    return std::monostate{};
}

std::string AnalogWriteCommand::toString() const {
    std::ostringstream oss;
    oss << "ANALOG_WRITE(pin=" << pin << ", value=" << value << ")";
    return oss.str();
}

CommandValue AnalogWriteCommand::getValue(const std::string& key) const {
    if (key == "pin") return pin;
    if (key == "value") return value;
    return std::monostate{};
}

// =============================================================================
// REQUEST-RESPONSE COMMAND IMPLEMENTATIONS
// =============================================================================

std::string AnalogReadRequestCommand::toString() const {
    std::ostringstream oss;
    oss << "ANALOG_READ_REQUEST(pin=" << pin << ", requestId=" << requestId.toString() << ")";
    return oss.str();
}

CommandValue AnalogReadRequestCommand::getValue(const std::string& key) const {
    if (key == "pin") return pin;
    if (key == "requestId") return requestId.toString();
    return std::monostate{};
}

std::string DigitalReadRequestCommand::toString() const {
    std::ostringstream oss;
    oss << "DIGITAL_READ_REQUEST(pin=" << pin << ", requestId=" << requestId.toString() << ")";
    return oss.str();
}

CommandValue DigitalReadRequestCommand::getValue(const std::string& key) const {
    if (key == "pin") return pin;
    if (key == "requestId") return requestId.toString();
    return std::monostate{};
}

std::string MillisRequestCommand::toString() const {
    std::ostringstream oss;
    oss << "MILLIS_REQUEST(requestId=" << requestId.toString() << ")";
    return oss.str();
}

CommandValue MillisRequestCommand::getValue(const std::string& key) const {
    if (key == "requestId") return requestId.toString();
    return std::monostate{};
}

std::string MicrosRequestCommand::toString() const {
    std::ostringstream oss;
    oss << "MICROS_REQUEST(requestId=" << requestId.toString() << ")";
    return oss.str();
}

CommandValue MicrosRequestCommand::getValue(const std::string& key) const {
    if (key == "requestId") return requestId.toString();
    return std::monostate{};
}

// =============================================================================
// TIMING COMMAND IMPLEMENTATIONS
// =============================================================================

std::string DelayCommand::toString() const {
    std::ostringstream oss;
    oss << "DELAY(duration=" << duration << "ms)";
    return oss.str();
}

CommandValue DelayCommand::getValue(const std::string& key) const {
    if (key == "duration") return static_cast<int32_t>(duration);
    return std::monostate{};
}

std::string DelayMicrosecondsCommand::toString() const {
    std::ostringstream oss;
    oss << "DELAY_MICROSECONDS(duration=" << duration << "us)";
    return oss.str();
}

CommandValue DelayMicrosecondsCommand::getValue(const std::string& key) const {
    if (key == "duration") return static_cast<int32_t>(duration);
    return std::monostate{};
}

// =============================================================================
// VARIABLE COMMAND IMPLEMENTATIONS
// =============================================================================

std::string VarSetCommand::toString() const {
    std::ostringstream oss;
    oss << "VAR_SET(name=" << name << ", value=" << commandValueToString(value) << ")";
    return oss.str();
}

CommandValue VarSetCommand::getValue(const std::string& key) const {
    if (key == "name") return name;
    if (key == "value") return value;
    return std::monostate{};
}

std::string VarGetCommand::toString() const {
    std::ostringstream oss;
    oss << "VAR_GET(name=" << name << ", result=" << commandValueToString(result) << ")";
    return oss.str();
}

CommandValue VarGetCommand::getValue(const std::string& key) const {
    if (key == "name") return name;
    if (key == "result") return result;
    return std::monostate{};
}

// =============================================================================
// FUNCTION COMMAND IMPLEMENTATIONS
// =============================================================================

std::string FunctionCallCommand::toString() const {
    std::ostringstream oss;
    oss << "FUNCTION_CALL(name=" << functionName;
    if (!argumentStrings.empty()) {
        oss << ", args=[";
        for (size_t i = 0; i < argumentStrings.size(); ++i) {
            if (i > 0) oss << ", ";
            oss << argumentStrings[i];
        }
        oss << "]";
    }
    oss << ")";
    return oss.str();
}

CommandValue FunctionCallCommand::getValue(const std::string& key) const {
    if (key == "name") return functionName;
    if (key == "function") return functionName; // JavaScript uses "function" key
    if (key == "completed") return completed;
    if (key == "iteration") return iteration;
    if (key == "message") {
        if (!customMessage.empty()) return customMessage;
        // Generate default message based on completion status
        if (completed) {
            return "Completed " + functionName + "() iteration " + std::to_string(iteration);
        } else {
            return "Executing " + functionName + "() iteration " + std::to_string(iteration);
        }
    }
    // TODO: For now, return argument count as workaround for recursive CommandValue
    if (key == "argumentCount") return static_cast<int>(argumentStrings.size());
    return std::monostate{};
}

// =============================================================================
// CONTROL FLOW COMMAND IMPLEMENTATIONS
// =============================================================================

std::string IfStatementCommand::toString() const {
    std::ostringstream oss;
    oss << "IF_STATEMENT(condition=" << commandValueToString(condition) 
        << ", result=" << (result ? "true" : "false") 
        << ", branch=" << branch << ")";
    return oss.str();
}

CommandValue IfStatementCommand::getValue(const std::string& key) const {
    if (key == "condition") return condition;
    if (key == "result") return result;
    if (key == "branch") return branch;
    return std::monostate{};
}

std::string SwitchStatementCommand::toString() const {
    std::ostringstream oss;
    oss << "SWITCH_STATEMENT(discriminant=" << commandValueToString(discriminant) << ")";
    return oss.str();
}

CommandValue SwitchStatementCommand::getValue(const std::string& key) const {
    if (key == "discriminant") return discriminant;
    return std::monostate{};
}

std::string SwitchCaseCommand::toString() const {
    std::ostringstream oss;
    oss << "SWITCH_CASE(value=" << commandValueToString(caseValue) 
        << ", matched=" << (matched ? "true" : "false") << ")";
    return oss.str();
}

CommandValue SwitchCaseCommand::getValue(const std::string& key) const {
    if (key == "caseValue") return caseValue;
    if (key == "matched") return matched;
    return std::monostate{};
}

std::string LoopStartCommand::toString() const {
    std::ostringstream oss;
    oss << "LOOP_START(type=" << loopType << ", iteration=" << iteration << ")";
    return oss.str();
}

CommandValue LoopStartCommand::getValue(const std::string& key) const {
    if (key == "loopType") return loopType;
    if (key == "iteration") return static_cast<int32_t>(iteration);
    return std::monostate{};
}

std::string LoopEndCommand::toString() const {
    std::ostringstream oss;
    oss << "LOOP_END(type=" << loopType << ", iteration=" << iteration << ")";
    return oss.str();
}

CommandValue LoopEndCommand::getValue(const std::string& key) const {
    if (key == "loopType") return loopType;
    if (key == "iteration") return static_cast<int32_t>(iteration);
    if (key == "iterations") return static_cast<int32_t>(iteration); // JavaScript uses "iterations" (plural)
    if (key == "limitReached") return true; // Always true when loop ends due to iteration limit
    if (key == "message") {
        return "Loop limit reached: completed " + std::to_string(iteration) + " iterations (max: " + std::to_string(iteration) + ")";
    }
    return std::monostate{};
}

// =============================================================================
// SYSTEM COMMAND IMPLEMENTATIONS
// =============================================================================

std::string SystemCommand::toString() const {
    std::ostringstream oss;
    oss << commandTypeToString(type) << "(message=" << message << ")";
    return oss.str();
}

CommandValue SystemCommand::getValue(const std::string& key) const {
    if (key == "message") return message;
    return std::monostate{};
}

std::string ErrorCommand::toString() const {
    std::ostringstream oss;
    oss << "ERROR(message=" << errorMessage << ", type=" << errorType << ")";
    return oss.str();
}

CommandValue ErrorCommand::getValue(const std::string& key) const {
    if (key == "message") return errorMessage;
    if (key == "type") return errorType;
    return std::monostate{};
}

// =============================================================================
// COMMAND FACTORY IMPLEMENTATION
// =============================================================================

CommandPtr CommandFactory::createPinMode(int32_t pin, PinMode mode) {
    return std::make_unique<PinModeCommand>(pin, mode);
}

CommandPtr CommandFactory::createDigitalWrite(int32_t pin, DigitalValue value) {
    return std::make_unique<DigitalWriteCommand>(pin, value);
}

CommandPtr CommandFactory::createAnalogWrite(int32_t pin, int32_t value) {
    return std::make_unique<AnalogWriteCommand>(pin, value);
}

CommandPtr CommandFactory::createAnalogReadRequest(int32_t pin) {
    return std::make_unique<AnalogReadRequestCommand>(pin);
}

CommandPtr CommandFactory::createDigitalReadRequest(int32_t pin) {
    return std::make_unique<DigitalReadRequestCommand>(pin);
}

CommandPtr CommandFactory::createMillisRequest() {
    return std::make_unique<MillisRequestCommand>();
}

CommandPtr CommandFactory::createMicrosRequest() {
    return std::make_unique<MicrosRequestCommand>();
}

CommandPtr CommandFactory::createDelay(uint32_t milliseconds) {
    return std::make_unique<DelayCommand>(milliseconds);
}

CommandPtr CommandFactory::createDelayMicroseconds(uint32_t microseconds) {
    return std::make_unique<DelayMicrosecondsCommand>(microseconds);
}

CommandPtr CommandFactory::createVarSet(const std::string& name, const CommandValue& value) {
    return std::make_unique<VarSetCommand>(name, value);
}

CommandPtr CommandFactory::createVarGet(const std::string& name) {
    return std::make_unique<VarGetCommand>(name);
}

CommandPtr CommandFactory::createFunctionCall(const std::string& name, const std::vector<std::string>& argStrings, 
                                            bool isCompleted, int32_t iter, const std::string& message) {
    return std::make_unique<FunctionCallCommand>(name, argStrings, isCompleted, iter, message);
}

CommandPtr CommandFactory::createIfStatement(const CommandValue& condition, bool result, const std::string& branch) {
    return std::make_unique<IfStatementCommand>(condition, result, branch);
}

CommandPtr CommandFactory::createSwitchStatement(const CommandValue& discriminant) {
    return std::make_unique<SwitchStatementCommand>(discriminant);
}

CommandPtr CommandFactory::createSwitchCase(const CommandValue& caseValue, bool matched) {
    return std::make_unique<SwitchCaseCommand>(caseValue, matched);
}

CommandPtr CommandFactory::createLoopStart(const std::string& type, uint32_t iteration) {
    return std::make_unique<LoopStartCommand>(type, iteration);
}

CommandPtr CommandFactory::createLoopEnd(const std::string& type, uint32_t iteration) {
    return std::make_unique<LoopEndCommand>(type, iteration);
}

CommandPtr CommandFactory::createSystemCommand(CommandType type, const std::string& message) {
    return std::make_unique<SystemCommand>(type, message);
}

CommandPtr CommandFactory::createError(const std::string& message, const std::string& type) {
    return std::make_unique<ErrorCommand>(message, type);
}

// Serial communication commands
CommandPtr CommandFactory::createSerialBegin(int32_t baudRate) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_BEGIN, "Serial.begin(" + std::to_string(baudRate) + ")");
}

CommandPtr CommandFactory::createSerialPrint(const std::string& data, const std::string& format) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_PRINT, "Serial.print(" + data + ", " + format + ")");
}

CommandPtr CommandFactory::createSerialPrintln(const std::string& data, const std::string& format) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_PRINTLN, "Serial.println(" + data + ", " + format + ")");
}

CommandPtr CommandFactory::createSerialWrite(int32_t byte) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_WRITE, "Serial.write(" + std::to_string(byte) + ")");
}

CommandPtr CommandFactory::createSerialRequest(const std::string& operation, const std::string& requestId) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_READ_REQUEST, "Serial." + operation + " [" + requestId + "]");
}

CommandPtr CommandFactory::createSerialRequestWithChar(const std::string& operation, char terminator, const std::string& requestId) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_READ_STRING_UNTIL_REQUEST, 
        "Serial." + operation + "(" + std::to_string(static_cast<int>(terminator)) + ") [" + requestId + "]");
}

CommandPtr CommandFactory::createSerialTimeout(int32_t timeout) {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_SET_TIMEOUT, "Serial.setTimeout(" + std::to_string(timeout) + ")");
}

CommandPtr CommandFactory::createSerialFlush() {
    return std::make_unique<SystemCommand>(CommandType::SERIAL_FLUSH, "Serial.flush()");
}

// Multiple Serial ports
CommandPtr CommandFactory::createMultiSerialBegin(const std::string& portName, int32_t baudRate) {
    return std::make_unique<SystemCommand>(CommandType::MULTI_SERIAL_BEGIN, portName + ".begin(" + std::to_string(baudRate) + ")");
}

CommandPtr CommandFactory::createMultiSerialPrint(const std::string& portName, const std::string& data, const std::string& format) {
    return std::make_unique<SystemCommand>(CommandType::MULTI_SERIAL_PRINT, portName + ".print(" + data + ", " + format + ")");
}

CommandPtr CommandFactory::createMultiSerialPrintln(const std::string& portName, const std::string& data, const std::string& format) {
    return std::make_unique<SystemCommand>(CommandType::MULTI_SERIAL_PRINTLN, portName + ".println(" + data + ", " + format + ")");
}

CommandPtr CommandFactory::createMultiSerialRequest(const std::string& portName, const std::string& operation, const std::string& requestId) {
    return std::make_unique<SystemCommand>(CommandType::MULTI_SERIAL_REQUEST, portName + "." + operation + " [" + requestId + "]");
}

CommandPtr CommandFactory::createMultiSerialCommand(const std::string& portName, const std::string& methodName) {
    return std::make_unique<SystemCommand>(CommandType::MULTI_SERIAL_COMMAND, portName + "." + methodName + "()");
}

// Audio/Tone library commands
CommandPtr CommandFactory::createTone(int32_t pin, int32_t frequency) {
    return std::make_unique<SystemCommand>(CommandType::TONE, "tone(" + std::to_string(pin) + ", " + std::to_string(frequency) + ")");
}

CommandPtr CommandFactory::createToneWithDuration(int32_t pin, int32_t frequency, int32_t duration) {
    return std::make_unique<SystemCommand>(CommandType::TONE_WITH_DURATION, 
        "tone(" + std::to_string(pin) + ", " + std::to_string(frequency) + ", " + std::to_string(duration) + ")");
}

CommandPtr CommandFactory::createNoTone(int32_t pin) {
    return std::make_unique<SystemCommand>(CommandType::NO_TONE, "noTone(" + std::to_string(pin) + ")");
}

// =============================================================================
// UTILITY FUNCTION IMPLEMENTATIONS
// =============================================================================

std::string commandTypeToString(CommandType type) {
    switch (type) {
        case CommandType::PIN_MODE: return "PIN_MODE";
        case CommandType::DIGITAL_WRITE: return "DIGITAL_WRITE";
        case CommandType::DIGITAL_READ: return "DIGITAL_READ";
        case CommandType::ANALOG_WRITE: return "ANALOG_WRITE";
        case CommandType::ANALOG_READ: return "ANALOG_READ";
        case CommandType::ANALOG_READ_REQUEST: return "ANALOG_READ_REQUEST";
        case CommandType::DIGITAL_READ_REQUEST: return "DIGITAL_READ_REQUEST";
        case CommandType::MILLIS_REQUEST: return "MILLIS_REQUEST";
        case CommandType::MICROS_REQUEST: return "MICROS_REQUEST";
        case CommandType::LIBRARY_METHOD_REQUEST: return "LIBRARY_METHOD_REQUEST";
        case CommandType::DELAY: return "DELAY";
        case CommandType::DELAY_MICROSECONDS: return "DELAY_MICROSECONDS";
        case CommandType::VAR_SET: return "VAR_SET";
        case CommandType::VAR_GET: return "VAR_GET";
        case CommandType::FUNCTION_CALL: return "FUNCTION_CALL";
        case CommandType::FUNCTION_CALL_WITH_ARGS: return "FUNCTION_CALL_WITH_ARGS";
        case CommandType::LOOP_START: return "LOOP_START";
        case CommandType::LOOP_END: return "LOOP_END";
        case CommandType::LOOP_LIMIT_REACHED: return "LOOP_LIMIT_REACHED";
        case CommandType::CONDITION_EVAL: return "CONDITION_EVAL";
        case CommandType::CONSTRUCTOR_CALL: return "CONSTRUCTOR_CALL";
        case CommandType::IF_STATEMENT: return "IF_STATEMENT";
        case CommandType::SWITCH_STATEMENT: return "SWITCH_STATEMENT";
        case CommandType::SWITCH_CASE: return "SWITCH_CASE";
        case CommandType::FOR_LOOP: return "FOR_LOOP";
        case CommandType::WHILE_LOOP: return "WHILE_LOOP";
        case CommandType::DO_WHILE_LOOP: return "DO_WHILE_LOOP";
        case CommandType::BREAK_STATEMENT: return "BREAK_STATEMENT";
        case CommandType::CONTINUE_STATEMENT: return "CONTINUE_STATEMENT";
        case CommandType::SETUP_START: return "SETUP_START";
        case CommandType::SETUP_END: return "SETUP_END";
        case CommandType::PROGRAM_START: return "PROGRAM_START";
        case CommandType::PROGRAM_END: return "PROGRAM_END";
        case CommandType::VERSION_INFO: return "VERSION_INFO";
        case CommandType::ERROR: return "ERROR";
        
        // Serial communication
        case CommandType::SERIAL_BEGIN: return "SERIAL_BEGIN";
        case CommandType::SERIAL_PRINT: return "SERIAL_PRINT";
        case CommandType::SERIAL_PRINTLN: return "SERIAL_PRINTLN";
        case CommandType::SERIAL_WRITE: return "SERIAL_WRITE";
        case CommandType::SERIAL_READ_REQUEST: return "SERIAL_READ_REQUEST";
        case CommandType::SERIAL_AVAILABLE_REQUEST: return "SERIAL_AVAILABLE_REQUEST";
        case CommandType::SERIAL_PEEK_REQUEST: return "SERIAL_PEEK_REQUEST";
        case CommandType::SERIAL_READ_STRING_REQUEST: return "SERIAL_READ_STRING_REQUEST";
        case CommandType::SERIAL_READ_STRING_UNTIL_REQUEST: return "SERIAL_READ_STRING_UNTIL_REQUEST";
        case CommandType::SERIAL_PARSE_INT_REQUEST: return "SERIAL_PARSE_INT_REQUEST";
        case CommandType::SERIAL_PARSE_FLOAT_REQUEST: return "SERIAL_PARSE_FLOAT_REQUEST";
        case CommandType::SERIAL_SET_TIMEOUT: return "SERIAL_SET_TIMEOUT";
        case CommandType::SERIAL_FLUSH: return "SERIAL_FLUSH";
        
        // Multiple Serial ports
        case CommandType::MULTI_SERIAL_BEGIN: return "MULTI_SERIAL_BEGIN";
        case CommandType::MULTI_SERIAL_PRINT: return "MULTI_SERIAL_PRINT";
        case CommandType::MULTI_SERIAL_PRINTLN: return "MULTI_SERIAL_PRINTLN";
        case CommandType::MULTI_SERIAL_REQUEST: return "MULTI_SERIAL_REQUEST";
        case CommandType::MULTI_SERIAL_COMMAND: return "MULTI_SERIAL_COMMAND";
        
        // Audio/Tone library
        case CommandType::TONE: return "TONE";
        case CommandType::TONE_WITH_DURATION: return "TONE_WITH_DURATION";
        case CommandType::NO_TONE: return "NO_TONE";
        
        default: return "UNKNOWN";
    }
}

std::string executionStateToString(ExecutionState state) {
    switch (state) {
        case ExecutionState::IDLE: return "IDLE";
        case ExecutionState::RUNNING: return "RUNNING";
        case ExecutionState::PAUSED: return "PAUSED";
        case ExecutionState::STEPPING: return "STEPPING";
        case ExecutionState::ERROR: return "ERROR";
        case ExecutionState::COMPLETE: return "COMPLETE";
        default: return "UNKNOWN";
    }
}

std::string pinModeToString(PinMode mode) {
    switch (mode) {
        case PinMode::INPUT: return "INPUT";
        case PinMode::OUTPUT: return "OUTPUT";
        case PinMode::INPUT_PULLUP: return "INPUT_PULLUP";
        case PinMode::INPUT_PULLDOWN: return "INPUT_PULLDOWN";
        case PinMode::OUTPUT_OPENDRAIN: return "OUTPUT_OPENDRAIN";
        default: return "UNKNOWN";
    }
}

std::string commandValueToString(const CommandValue& value) {
    return std::visit([](const auto& v) -> std::string {
        using T = std::decay_t<decltype(v)>;
        if constexpr (std::is_same_v<T, std::monostate>) {
            return "undefined";
        } else if constexpr (std::is_same_v<T, bool>) {
            return v ? "true" : "false";
        } else if constexpr (std::is_same_v<T, int32_t>) {
            return std::to_string(v);
        } else if constexpr (std::is_same_v<T, double>) {
            return std::to_string(v);
        } else if constexpr (std::is_same_v<T, std::string>) {
            return "\"" + v + "\"";
        } else if constexpr (std::is_same_v<T, std::vector<CommandValue>>) {
            std::ostringstream oss;
            oss << "[";
            for (size_t i = 0; i < v.size(); ++i) {
                if (i > 0) oss << ", ";
                oss << commandValueToString(v[i]);
            }
            oss << "]";
            return oss.str();
        } else {
            return "unknown";
        }
    }, value);
}

bool commandValuesEqual(const CommandValue& a, const CommandValue& b) {
    if (a.index() != b.index()) {
        // Handle numeric type mismatches (int32_t vs double)
        bool aIsNumeric = std::holds_alternative<int32_t>(a) || std::holds_alternative<double>(a);
        bool bIsNumeric = std::holds_alternative<int32_t>(b) || std::holds_alternative<double>(b);
        
        if (aIsNumeric && bIsNumeric) {
            // Convert both to double for comparison
            double aVal = std::holds_alternative<int32_t>(a) ? static_cast<double>(std::get<int32_t>(a)) : std::get<double>(a);
            double bVal = std::holds_alternative<int32_t>(b) ? static_cast<double>(std::get<int32_t>(b)) : std::get<double>(b);
            return aVal == bVal;
        }
        
        return false; // Different non-numeric types
    }
    
    return std::visit([&a, &b](const auto& aVal) -> bool {
        using T = std::decay_t<decltype(aVal)>;
        if constexpr (std::is_same_v<T, std::vector<CommandValue>>) {
            const auto& bVal = std::get<T>(b);
            if (aVal.size() != bVal.size()) return false;
            return std::equal(aVal.begin(), aVal.end(), bVal.begin(), commandValuesEqual);
        } else {
            const auto& bVal = std::get<T>(b);
            bool result = aVal == bVal;
            return result;
        }
    }, a);
}

std::string serializeCommand(const Command& command) {
    std::ostringstream oss;
    oss << "{";
    oss << "\"type\":\"" << commandTypeToString(command.type) << "\",";
    
    // Convert timestamp to milliseconds since epoch to match JavaScript format
    auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    oss << "\"timestamp\":" << now << ",";
    
    // Add type-specific fields to match JavaScript structure exactly
    switch (command.type) {
        case CommandType::VERSION_INFO:
            oss << "\"component\":\"interpreter\",";
            oss << "\"version\":\"8.0.0\",";
            oss << "\"status\":\"started\"";
            break;
            
        case CommandType::PROGRAM_START:
            oss << "\"message\":\"Program execution started\"";
            break;
            
        case CommandType::SETUP_START:
            oss << "\"message\":\"Executing setup() function\"";
            break;
            
        case CommandType::SETUP_END:
            oss << "\"message\":\"Completed setup() function\"";
            break;
            
        case CommandType::PROGRAM_END:
            oss << "\"message\":\"Program execution stopped\"";
            break;
            
        case CommandType::LOOP_START:
            {
                const auto* loopCmd = dynamic_cast<const LoopStartCommand*>(&command);
                if (loopCmd) {
                    if (loopCmd->loopType == "main" && loopCmd->iteration == 0) {
                        oss << "\"message\":\"Starting loop() execution\"";
                    } else if (loopCmd->loopType == "loop" && loopCmd->iteration > 0) {
                        oss << "\"message\":\"Starting loop iteration " << loopCmd->iteration << "\"";
                    } else {
                        oss << "\"message\":\"Starting loop() execution\"";
                    }
                } else {
                    oss << "\"message\":\"Starting loop() execution\"";
                }
            }
            break;
            
        case CommandType::LOOP_END:
            {
                const auto* loopCmd = dynamic_cast<const LoopEndCommand*>(&command);
                if (loopCmd) {
                    oss << "\"message\":\"Loop limit reached: completed " << loopCmd->iteration 
                        << " iterations (max: " << loopCmd->iteration << ")\",";
                    oss << "\"iterations\":" << loopCmd->iteration << ",";
                    oss << "\"limitReached\":true";
                } else {
                    oss << "\"message\":\"Loop ended\"";
                }
            }
            break;
            
        case CommandType::FUNCTION_CALL:
            {
                const auto* funcCmd = dynamic_cast<const FunctionCallCommand*>(&command);
                if (funcCmd) {
                    oss << "\"function\":\"" << funcCmd->functionName << "\",";
                    
                    if (funcCmd->completed) {
                        oss << "\"message\":\"Completed " << funcCmd->functionName << "() iteration " << funcCmd->iteration << "\",";
                        oss << "\"iteration\":" << funcCmd->iteration << ",";
                        oss << "\"completed\":true";
                    } else {
                        oss << "\"message\":\"Executing " << funcCmd->functionName << "() iteration " << funcCmd->iteration << "\",";
                        oss << "\"iteration\":" << funcCmd->iteration;
                    }
                } else {
                    oss << "\"message\":\"Function call\"";
                }
            }
            break;
            
        case CommandType::PIN_MODE:
            {
                const auto* pinCmd = dynamic_cast<const PinModeCommand*>(&command);
                if (pinCmd) {
                    oss << "  \"pin\": " << pinCmd->pin << ",\n";
                    oss << "  \"mode\": \"" << pinModeToString(pinCmd->mode) << "\"\n";
                } else {
                    oss << "  \"message\": \"Pin mode command\"\n";
                }
            }
            break;
            
        case CommandType::DIGITAL_WRITE:
            {
                const auto* writeCmd = dynamic_cast<const DigitalWriteCommand*>(&command);
                if (writeCmd) {
                    oss << "  \"pin\": " << writeCmd->pin << ",\n";
                    oss << "  \"value\": " << static_cast<int>(writeCmd->value) << "\n";
                } else {
                    oss << "  \"message\": \"Digital write command\"\n";
                }
            }
            break;
            
        case CommandType::ANALOG_READ_REQUEST:
            {
                const auto* readCmd = dynamic_cast<const AnalogReadRequestCommand*>(&command);
                if (readCmd) {
                    oss << "  \"pin\": " << readCmd->pin << ",\n";
                    oss << "  \"requestId\": \"" << readCmd->requestId.toString() << "\"\n";
                } else {
                    oss << "  \"message\": \"Analog read request\"\n";
                }
            }
            break;
            
        case CommandType::DELAY:
            {
                const auto* delayCmd = dynamic_cast<const DelayCommand*>(&command);
                if (delayCmd) {
                    oss << "  \"duration\": " << delayCmd->duration << "\n";
                } else {
                    oss << "  \"message\": \"Delay command\"\n";
                }
            }
            break;
            
        default:
            oss << "\"message\":\"" << command.toString() << "\"";
            break;
    }
    
    oss << "}";
    return oss.str();
}

} // namespace arduino_interpreter
