#pragma once

#include <unordered_map>
#include <vector>
#include <memory>
#include <string>
#include <variant>

// Core CommandValue definition (moved from CommandProtocol.hpp)
using CommandValue = std::variant<
    std::monostate,                          // void/undefined
    bool,                                    // boolean
    int32_t,                                 // integer (Arduino pins, values)
    uint32_t,                                // unsigned integer (compatibility)
    double,                                  // floating point numbers
    std::string,                             // strings and identifiers
    std::vector<int32_t>,                    // 1D integer arrays
    std::vector<double>,                     // 1D double arrays
    std::vector<std::string>,                // 1D string arrays
    std::vector<std::vector<int32_t>>,       // 2D integer arrays (NEW for Test 105)
    std::vector<std::vector<double>>         // 2D double arrays (NEW for Test 105)
>;

/**
 * Execution states matching JavaScript EXECUTION_STATE
 */
enum class ExecutionState {
    IDLE,
    RUNNING,
    PAUSED,
    STEPPING,
    ERROR,
    COMPLETE,
    WAITING_FOR_RESPONSE
};

// Forward declarations
namespace arduino_interpreter {
    class ArduinoStruct;
    class ArduinoPointer;
    class ArduinoString;
    class ArduinoArray;

    // String object wrapper for Arduino String compatibility
    struct StringObject {
        std::string value;
        StringObject() = default;
        StringObject(const std::string& s) : value(s) {}
        StringObject(const char* s) : value(s) {}
    };

    // Command system types (moved from deleted CommandProtocol.hpp)
    class Command;

    // Type aliases
    using RequestId = std::string;

    /**
     * Response handler interface for async operations
     * Handles responses from external systems (analogRead, digitalRead, etc.)
     */
    class ResponseHandler {
    public:
        virtual ~ResponseHandler() = default;
        virtual void handleResponse(const RequestId& requestId, const CommandValue& value) = 0;
        virtual bool waitForResponse(const RequestId& requestId, CommandValue& result, uint32_t timeoutMs) = 0;
    };

    /**
     * Dynamic command value that can hold any JSON-compatible type
     * (moved from deleted FlexibleCommand.hpp)
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

    enum class CommandType {
        VERSION_INFO,
        PROGRAM_START,
        PROGRAM_END,
        SETUP_START,
        SETUP_END,
        LOOP_START,
        LOOP_END,
        FUNCTION_CALL,
        VAR_SET,
        DIGITAL_WRITE,
        ANALOG_READ_REQUEST,
        DELAY,
        ERROR
    };
}

// Enhanced CommandValue that will replace the basic variant
// This will include the new data model classes
using EnhancedCommandValue = std::variant<
    std::monostate,                                          // void/undefined
    bool,                                                    // boolean
    int32_t,                                                // integer
    double,                                                  // floating point
    std::string,                                            // basic string
    std::shared_ptr<arduino_interpreter::ArduinoStruct>,   // struct/object
    std::shared_ptr<arduino_interpreter::ArduinoPointer>,  // pointer
    std::shared_ptr<arduino_interpreter::ArduinoString>,   // enhanced string
    std::shared_ptr<arduino_interpreter::ArduinoArray>     // array
>;

namespace arduino_interpreter {

// =============================================================================
// ARDUINO STRUCT CLASS - For struct/object member access
// =============================================================================

class ArduinoStruct {
private:
    std::unordered_map<std::string, EnhancedCommandValue> members_;
    std::string typeName_;

public:
    explicit ArduinoStruct(const std::string& typeName = "struct");
    
    // Member access
    bool hasMember(const std::string& name) const;
    EnhancedCommandValue getMember(const std::string& name) const;
    void setMember(const std::string& name, const EnhancedCommandValue& value);
    
    // Type information
    const std::string& getTypeName() const { return typeName_; }
    void setTypeName(const std::string& typeName) { typeName_ = typeName; }
    
    // Iteration over members
    const std::unordered_map<std::string, EnhancedCommandValue>& getMembers() const { return members_; }
    
    // Debug/serialization
    std::string toString() const;
};

// =============================================================================
// ARDUINO POINTER CLASS - For pointer operations and dereferencing
// =============================================================================

class ArduinoPointer {
private:
    EnhancedCommandValue* target_;  // What this pointer points to
    std::string targetType_;        // Type of pointed-to object
    size_t pointerLevel_;          // How many levels of indirection (*, **, ***)

public:
    ArduinoPointer(EnhancedCommandValue* target = nullptr, 
                   const std::string& targetType = "", 
                   size_t level = 1);
    
    // Pointer operations
    bool isNull() const { return target_ == nullptr; }
    EnhancedCommandValue dereference() const;
    void assign(EnhancedCommandValue* newTarget);
    
    // Arithmetic operations (for array access)
    ArduinoPointer operator+(int offset) const;
    ArduinoPointer operator-(int offset) const;
    
    // Type information
    const std::string& getTargetType() const { return targetType_; }
    size_t getPointerLevel() const { return pointerLevel_; }
    
    // Debug/serialization
    std::string toString() const;
};

// =============================================================================
// ARDUINO ARRAY CLASS - For array indexing and multi-dimensional arrays
// =============================================================================

class ArduinoArray {
private:
    std::vector<EnhancedCommandValue> elements_;
    std::string elementType_;
    std::vector<size_t> dimensions_;  // For multi-dimensional arrays [3][4] = {3, 4}

public:
    ArduinoArray(const std::string& elementType = "", 
                 const std::vector<size_t>& dimensions = {});
    
    // Array access
    EnhancedCommandValue getElement(size_t index) const;
    void setElement(size_t index, const EnhancedCommandValue& value);
    
    // Multi-dimensional access
    EnhancedCommandValue getElement(const std::vector<size_t>& indices) const;
    void setElement(const std::vector<size_t>& indices, const EnhancedCommandValue& value);
    
    // Size operations
    size_t size() const { return elements_.size(); }
    const std::vector<size_t>& getDimensions() const { return dimensions_; }
    
    // Type information
    const std::string& getElementType() const { return elementType_; }
    
    // Resize operations
    void resize(size_t newSize, const EnhancedCommandValue& defaultValue = std::monostate{});
    void resizeMultiDimensional(const std::vector<size_t>& newDimensions, const EnhancedCommandValue& defaultValue = std::monostate{});
    
    // Dimension operations
    size_t getDimensionCount() const { return dimensions_.size(); }
    size_t getDimensionSize(size_t dimensionIndex) const;
    bool isValidIndices(const std::vector<size_t>& indices) const;
    size_t calculateFlatIndex(const std::vector<size_t>& indices) const;
    std::vector<size_t> calculateMultiDimensionalIndex(size_t flatIndex) const;
    
    // Debug/serialization
    std::string toString() const;
};

// =============================================================================
// ARDUINO STRING CLASS - Enhanced string operations matching JavaScript
// =============================================================================

class ArduinoString {
private:
    std::string data_;
    
public:
    explicit ArduinoString(const std::string& str = "");
    
    // String operations matching Arduino String class
    size_t length() const { return data_.length(); }
    char charAt(size_t index) const;
    void setCharAt(size_t index, char c);
    
    // Arduino String methods
    ArduinoString substring(size_t start, size_t end = std::string::npos) const;
    int indexOf(const std::string& str, size_t start = 0) const;
    int lastIndexOf(const std::string& str, size_t start = std::string::npos) const;
    bool startsWith(const std::string& str) const;
    bool endsWith(const std::string& str) const;
    
    // Case operations
    ArduinoString toLowerCase() const;
    ArduinoString toUpperCase() const;
    
    // Numeric conversions
    int toInt() const;
    double toFloat() const;
    
    // String modification
    ArduinoString trim() const;
    ArduinoString replace(const std::string& find, const std::string& replace) const;
    
    // Operators
    ArduinoString operator+(const ArduinoString& other) const;
    ArduinoString& operator+=(const ArduinoString& other);
    ArduinoString& operator+=(const std::string& other);
    bool operator==(const ArduinoString& other) const;
    bool operator!=(const ArduinoString& other) const;
    bool operator<(const ArduinoString& other) const;
    bool operator<=(const ArduinoString& other) const;
    bool operator>(const ArduinoString& other) const;
    bool operator>=(const ArduinoString& other) const;
    
    // Access to underlying string
    const std::string& c_str() const { return data_; }
    
    // Debug/serialization
    std::string toString() const { return data_; }
};

// =============================================================================
// UTILITY FUNCTIONS FOR TYPE CONVERSION AND INTEGRATION
// =============================================================================

// Convert between basic CommandValue and EnhancedCommandValue
EnhancedCommandValue upgradeCommandValue(const std::variant<std::monostate, bool, int32_t, double, std::string>& basic);
std::variant<std::monostate, bool, int32_t, double, std::string> downgradeCommandValue(const EnhancedCommandValue& enhanced);

// Forward declare extended CommandValue conversion (include will be in .cpp)
EnhancedCommandValue upgradeExtendedCommandValue(const std::variant<std::monostate, bool, int32_t, uint32_t, double, std::string, std::vector<int32_t>, std::vector<double>, std::vector<std::string>>& extended);

// Overload for full CommandValue type
EnhancedCommandValue upgradeCommandValue(const CommandValue& command);

// Extended downgrade function that returns extended CommandValue
CommandValue downgradeExtendedCommandValue(const EnhancedCommandValue& enhanced);

// Type checking utilities
bool isStructType(const EnhancedCommandValue& value);
bool isPointerType(const EnhancedCommandValue& value);
bool isArrayType(const EnhancedCommandValue& value);
bool isStringType(const EnhancedCommandValue& value);

// String representation for debugging
std::string enhancedCommandValueToString(const EnhancedCommandValue& value);

// Command value utilities (moved from deleted CommandProtocol.hpp)
std::string commandValueToString(const CommandValue& value);
bool commandValuesEqual(const CommandValue& a, const CommandValue& b);

// Factory functions for creating complex types
std::shared_ptr<ArduinoStruct> createStruct(const std::string& typeName = "struct");
std::shared_ptr<ArduinoArray> createArray(const std::string& elementType, const std::vector<size_t>& dimensions);
std::shared_ptr<ArduinoString> createString(const std::string& initialValue = "");

// =============================================================================
// CONVERT COMMANDVALUE TO FLEXIBLECOMMANDVALUE
// =============================================================================

/**
 * Helper function to convert CommandValue to FlexibleCommandValue
 * (moved from deleted FlexibleCommand.hpp)
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
        } else if constexpr (std::is_same_v<T, std::vector<std::vector<int32_t>>>) {
            // Convert 2D int array to flat mixed array (FlexibleCommandValue doesn't support nesting)
            std::vector<std::variant<bool, int32_t, double, std::string>> flatArray;
            for (const auto& row : arg) {
                for (const auto& elem : row) {
                    flatArray.emplace_back(elem);
                }
            }
            return flatArray;
        } else if constexpr (std::is_same_v<T, std::vector<std::vector<double>>>) {
            // Convert 2D double array to flat mixed array (FlexibleCommandValue doesn't support nesting)
            std::vector<std::variant<bool, int32_t, double, std::string>> flatArray;
            for (const auto& row : arg) {
                for (const auto& elem : row) {
                    flatArray.emplace_back(elem);
                }
            }
            return flatArray;
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            // Convert uint32_t to int64_t for FlexibleCommandValue
            return static_cast<int64_t>(arg);
        } else {
            // Direct conversion for basic types
            return arg;
        }
    }, oldValue);
}

} // namespace arduino_interpreter