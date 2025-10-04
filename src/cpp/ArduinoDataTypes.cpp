#include "ArduinoDataTypes.hpp"
#include "PlatformAbstraction.hpp"
#include "ASTInterpreter.hpp"  // For ArduinoPointer scope access
#include <stdexcept>
#include <chrono>
#include <cstdlib>  // For rand()

namespace arduino_interpreter {

// =============================================================================
// ARDUINO STRUCT IMPLEMENTATION
// =============================================================================

ArduinoStruct::ArduinoStruct(const std::string& typeName) : typeName_(typeName) {
}

bool ArduinoStruct::hasMember(const std::string& name) const {
    return members_.find(name) != members_.end();
}

EnhancedCommandValue ArduinoStruct::getMember(const std::string& name) const {
    auto it = members_.find(name);
    if (it != members_.end()) {
        return it->second;
    }
    return std::monostate{}; // Return undefined for non-existent members
}

void ArduinoStruct::setMember(const std::string& name, const EnhancedCommandValue& value) {
    members_[name] = value;
}

std::string ArduinoStruct::toString() const {
    StringBuildStream oss;
    oss << typeName_ << " { ";
    bool first = true;
    for (const auto& [name, value] : members_) {
        if (!first) oss << ", ";
        oss << name << ": " << enhancedCommandValueToString(value);
        first = false;
    }
    oss << " }";
    return oss.str();
}

// =============================================================================
// ARDUINO POINTER IMPLEMENTATION - Scope-based (JavaScript-compatible)
// =============================================================================

ArduinoPointer::ArduinoPointer(const std::string& targetVar,
                               ASTInterpreter* interpreter,
                               int offset,
                               const std::string& targetType)
    : targetVariable_(targetVar),
      offset_(offset),
      interpreter_(interpreter),
      targetType_(targetType) {

    // Generate unique pointer ID (matching JavaScript pattern)
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();

    // Simple random string generation (6 characters)
    std::string randomStr;
    const char* chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (int i = 0; i < 6; i++) {
        randomStr += chars[rand() % 36];
    }

    pointerId_ = "ptr_" + std::to_string(ms) + "_" + randomStr;
}

bool ArduinoPointer::isNull() const {
    return interpreter_ == nullptr || targetVariable_.empty();
}

CommandValue ArduinoPointer::getValue() const {
    if (isNull()) {
        throw std::runtime_error("Cannot dereference null pointer");
    }

    // Look up target variable using public method
    CommandValue targetValue = interpreter_->getVariableValue(targetVariable_);

    // Index into array (handles both offset_==0 for first element and offset_>0 for other elements)
    if (std::holds_alternative<std::vector<int32_t>>(targetValue)) {
        const auto& arr = std::get<std::vector<int32_t>>(targetValue);
        if (offset_ >= 0 && static_cast<size_t>(offset_) < arr.size()) {
            return arr[offset_];
        } else {
            throw std::runtime_error("Pointer offset out of bounds");
        }
    } else if (std::holds_alternative<std::vector<double>>(targetValue)) {
        const auto& arr = std::get<std::vector<double>>(targetValue);
        if (offset_ >= 0 && static_cast<size_t>(offset_) < arr.size()) {
            return arr[offset_];
        } else {
            throw std::runtime_error("Pointer offset out of bounds");
        }
    }

    // Non-array variable: only offset 0 is valid
    if (offset_ == 0) {
        return targetValue;  // Return the value itself for non-array pointers
    }

    // Non-array variable with offset > 0 is an error
    throw std::runtime_error("Cannot apply offset to non-array variable");
}

void ArduinoPointer::setValue(const CommandValue& value) {
    if (isNull()) {
        throw std::runtime_error("Cannot assign through null pointer");
    }

    // If offset is 0, assign to variable directly
    if (offset_ == 0) {
        interpreter_->setVariableValue(targetVariable_, value);
        return;
    }

    // If offset > 0, assign to array element
    CommandValue targetValue = interpreter_->getVariableValue(targetVariable_);

    if (std::holds_alternative<std::vector<int32_t>>(targetValue)) {
        auto arr = std::get<std::vector<int32_t>>(targetValue);
        if (offset_ >= 0 && static_cast<size_t>(offset_) < arr.size()) {
            // Convert value to int32_t if possible
            if (std::holds_alternative<int32_t>(value)) {
                arr[offset_] = std::get<int32_t>(value);
            } else if (std::holds_alternative<double>(value)) {
                arr[offset_] = static_cast<int32_t>(std::get<double>(value));
            } else {
                throw std::runtime_error("Cannot assign non-numeric value to int array");
            }
            // Update the array in the variable
            interpreter_->setVariableValue(targetVariable_, arr);
        } else {
            throw std::runtime_error("Pointer offset out of bounds");
        }
    } else if (std::holds_alternative<std::vector<double>>(targetValue)) {
        auto arr = std::get<std::vector<double>>(targetValue);
        if (offset_ >= 0 && static_cast<size_t>(offset_) < arr.size()) {
            // Convert value to double if possible
            if (std::holds_alternative<double>(value)) {
                arr[offset_] = std::get<double>(value);
            } else if (std::holds_alternative<int32_t>(value)) {
                arr[offset_] = static_cast<double>(std::get<int32_t>(value));
            } else {
                throw std::runtime_error("Cannot assign non-numeric value to double array");
            }
            // Update the array in the variable
            interpreter_->setVariableValue(targetVariable_, arr);
        } else {
            throw std::runtime_error("Pointer offset out of bounds");
        }
    } else {
        throw std::runtime_error("Cannot apply offset to non-array variable");
    }
}

std::shared_ptr<ArduinoPointer> ArduinoPointer::add(int offsetDelta) const {
    return std::make_shared<ArduinoPointer>(
        targetVariable_,
        interpreter_,
        offset_ + offsetDelta,
        targetType_
    );
}

std::shared_ptr<ArduinoPointer> ArduinoPointer::subtract(int offsetDelta) const {
    return std::make_shared<ArduinoPointer>(
        targetVariable_,
        interpreter_,
        offset_ - offsetDelta,
        targetType_
    );
}

std::string ArduinoPointer::toJsonString() const {
    StringBuildStream oss;
    oss << "{";
    oss << "\"type\":\"offset_pointer\",";
    oss << "\"targetVariable\":\"" << targetVariable_ << "\",";
    oss << "\"pointerId\":\"" << pointerId_ << "\",";
    oss << "\"offset\":" << offset_;
    oss << "}";
    return oss.str();
}

std::string ArduinoPointer::toString() const {
    StringBuildStream oss;
    oss << "ArduinoPointer(" << pointerId_ << " -> " << targetVariable_;
    if (offset_ != 0) {
        oss << "[" << offset_ << "]";
    }
    oss << ")";
    return oss.str();
}

// =============================================================================
// ARDUINO ARRAY IMPLEMENTATION
// =============================================================================

ArduinoArray::ArduinoArray(const std::string& elementType, 
                           const std::vector<size_t>& dimensions) 
    : elementType_(elementType), dimensions_(dimensions) {
    
    // Calculate total size for multi-dimensional arrays
    size_t totalSize = 1;
    for (size_t dim : dimensions_) {
        totalSize *= dim;
    }
    elements_.resize(totalSize);
}

EnhancedCommandValue ArduinoArray::getElement(size_t index) const {
    if (index >= elements_.size()) {
        throw std::out_of_range("Array index out of bounds");
    }
    return elements_[index];
}

void ArduinoArray::setElement(size_t index, const EnhancedCommandValue& value) {
    if (index >= elements_.size()) {
        throw std::out_of_range("Array index out of bounds");
    }
    elements_[index] = value;
}

EnhancedCommandValue ArduinoArray::getElement(const std::vector<size_t>& indices) const {
    size_t flatIndex = 0;
    size_t multiplier = 1;
    
    // Convert multi-dimensional indices to flat index
    for (int i = dimensions_.size() - 1; i >= 0; --i) {
        if (i >= (int)indices.size() || indices[i] >= dimensions_[i]) {
            throw std::out_of_range("Multi-dimensional array index out of bounds");
        }
        flatIndex += indices[i] * multiplier;
        multiplier *= dimensions_[i];
    }
    
    return getElement(flatIndex);
}

void ArduinoArray::setElement(const std::vector<size_t>& indices, const EnhancedCommandValue& value) {
    size_t flatIndex = 0;
    size_t multiplier = 1;
    
    // Convert multi-dimensional indices to flat index
    for (int i = dimensions_.size() - 1; i >= 0; --i) {
        if (i >= (int)indices.size() || indices[i] >= dimensions_[i]) {
            throw std::out_of_range("Multi-dimensional array index out of bounds");
        }
        flatIndex += indices[i] * multiplier;
        multiplier *= dimensions_[i];
    }
    
    setElement(flatIndex, value);
}

void ArduinoArray::resize(size_t newSize, const EnhancedCommandValue& defaultValue) {
    elements_.resize(newSize, defaultValue);
}

void ArduinoArray::resizeMultiDimensional(const std::vector<size_t>& newDimensions, const EnhancedCommandValue& defaultValue) {
    dimensions_ = newDimensions;
    
    // Calculate total size for new dimensions
    size_t totalSize = 1;
    for (size_t dim : dimensions_) {
        totalSize *= dim;
    }
    
    elements_.resize(totalSize, defaultValue);
}

size_t ArduinoArray::getDimensionSize(size_t dimensionIndex) const {
    if (dimensionIndex < dimensions_.size()) {
        return dimensions_[dimensionIndex];
    }
    return 0;
}

bool ArduinoArray::isValidIndices(const std::vector<size_t>& indices) const {
    if (indices.size() != dimensions_.size()) {
        return false;
    }
    
    for (size_t i = 0; i < indices.size(); ++i) {
        if (indices[i] >= dimensions_[i]) {
            return false;
        }
    }
    
    return true;
}

size_t ArduinoArray::calculateFlatIndex(const std::vector<size_t>& indices) const {
    if (!isValidIndices(indices)) {
        throw std::out_of_range("Invalid multi-dimensional array indices");
    }
    
    size_t flatIndex = 0;
    size_t multiplier = 1;
    
    // Convert multi-dimensional indices to flat index
    for (int i = dimensions_.size() - 1; i >= 0; --i) {
        flatIndex += indices[i] * multiplier;
        multiplier *= dimensions_[i];
    }
    
    return flatIndex;
}

std::vector<size_t> ArduinoArray::calculateMultiDimensionalIndex(size_t flatIndex) const {
    if (flatIndex >= elements_.size()) {
        throw std::out_of_range("Flat index out of bounds for multi-dimensional array");
    }
    
    std::vector<size_t> indices(dimensions_.size());
    
    for (int i = dimensions_.size() - 1; i >= 0; --i) {
        indices[i] = flatIndex % dimensions_[i];
        flatIndex /= dimensions_[i];
    }
    
    return indices;
}

std::string ArduinoArray::toString() const {
    StringBuildStream oss;
    oss << elementType_ << "[";
    for (size_t i = 0; i < dimensions_.size(); ++i) {
        if (i > 0) oss << "][";
        oss << dimensions_[i];
    }
    oss << "] { ";
    
    for (size_t i = 0; i < std::min(elements_.size(), size_t(5)); ++i) {
        if (i > 0) oss << ", ";
        oss << enhancedCommandValueToString(elements_[i]);
    }
    if (elements_.size() > 5) {
        oss << ", ... (" << elements_.size() << " total)";
    }
    oss << " }";
    return oss.str();
}

// =============================================================================
// ARDUINO STRING IMPLEMENTATION
// =============================================================================

ArduinoString::ArduinoString(const std::string& str) : data_(str) {
}

char ArduinoString::charAt(size_t index) const {
    if (index >= data_.length()) {
        return '\0';  // Arduino String behavior
    }
    return data_[index];
}

void ArduinoString::setCharAt(size_t index, char c) {
    if (index < data_.length()) {
        data_[index] = c;
    }
}

ArduinoString ArduinoString::substring(size_t start, size_t end) const {
    if (end == std::string::npos) {
        end = data_.length();
    }
    if (start >= data_.length()) {
        return ArduinoString("");
    }
    if (end > data_.length()) {
        end = data_.length();
    }
    if (start >= end) {
        return ArduinoString("");
    }
    return ArduinoString(data_.substr(start, end - start));
}

int ArduinoString::indexOf(const std::string& str, size_t start) const {
    size_t pos = data_.find(str, start);
    return (pos == std::string::npos) ? -1 : static_cast<int>(pos);
}

int ArduinoString::lastIndexOf(const std::string& str, size_t start) const {
    size_t pos = data_.rfind(str, start);
    return (pos == std::string::npos) ? -1 : static_cast<int>(pos);
}

bool ArduinoString::startsWith(const std::string& str) const {
    return data_.substr(0, str.length()) == str;
}

bool ArduinoString::endsWith(const std::string& str) const {
    if (str.length() > data_.length()) return false;
    return data_.substr(data_.length() - str.length()) == str;
}

ArduinoString ArduinoString::toLowerCase() const {
    std::string result = data_;
    for (char& c : result) {
        c = std::tolower(c);
    }
    return ArduinoString(result);
}

ArduinoString ArduinoString::toUpperCase() const {
    std::string result = data_;
    for (char& c : result) {
        c = std::toupper(c);
    }
    return ArduinoString(result);
}

int ArduinoString::toInt() const {
    try {
        return std::stoi(data_);
    } catch (...) {
        return 0;  // Arduino String behavior
    }
}

double ArduinoString::toFloat() const {
    try {
        return std::stod(data_);
    } catch (...) {
        return 0.0;  // Arduino String behavior
    }
}

ArduinoString ArduinoString::operator+(const ArduinoString& other) const {
    return ArduinoString(data_ + other.data_);
}

ArduinoString& ArduinoString::operator+=(const ArduinoString& other) {
    data_ += other.data_;
    return *this;
}

ArduinoString& ArduinoString::operator+=(const std::string& other) {
    data_ += other;
    return *this;
}

ArduinoString ArduinoString::trim() const {
    std::string result = data_;
    
    // Trim leading whitespace
    size_t start = result.find_first_not_of(" \t\n\r\f\v");
    if (start == std::string::npos) {
        return ArduinoString("");  // String is all whitespace
    }
    
    // Trim trailing whitespace
    size_t end = result.find_last_not_of(" \t\n\r\f\v");
    
    return ArduinoString(result.substr(start, end - start + 1));
}

ArduinoString ArduinoString::replace(const std::string& find, const std::string& replace) const {
    std::string result = data_;
    size_t pos = 0;
    
    while ((pos = result.find(find, pos)) != std::string::npos) {
        result.replace(pos, find.length(), replace);
        pos += replace.length();
    }
    
    return ArduinoString(result);
}

bool ArduinoString::operator==(const ArduinoString& other) const {
    return data_ == other.data_;
}

bool ArduinoString::operator!=(const ArduinoString& other) const {
    return data_ != other.data_;
}

bool ArduinoString::operator<(const ArduinoString& other) const {
    return data_ < other.data_;
}

bool ArduinoString::operator<=(const ArduinoString& other) const {
    return data_ <= other.data_;
}

bool ArduinoString::operator>(const ArduinoString& other) const {
    return data_ > other.data_;
}

bool ArduinoString::operator>=(const ArduinoString& other) const {
    return data_ >= other.data_;
}

// =============================================================================
// UTILITY FUNCTION IMPLEMENTATIONS
// =============================================================================

// Original upgradeCommandValue for basic types
EnhancedCommandValue upgradeCommandValue(const std::variant<std::monostate, bool, int32_t, double, std::string>& basic) {
    return std::visit([](auto&& arg) -> EnhancedCommandValue {
        return arg;  // Direct conversion works for shared types
    }, basic);
}

// Overload for full CommandValue type
EnhancedCommandValue upgradeCommandValue(const CommandValue& command) {
    return std::visit([](auto&& arg) -> EnhancedCommandValue {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::monostate> ||
                      std::is_same_v<T, bool> ||
                      std::is_same_v<T, int32_t> ||
                      std::is_same_v<T, double> ||
                      std::is_same_v<T, std::string>) {
            return arg;  // Direct conversion for shared types
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            return static_cast<int32_t>(arg);  // Convert uint32_t to int32_t
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoStruct>>) {
            return arg;  // Direct pass-through for ArduinoStruct (Test 110 fix - exists in both variants)
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoPointer>>) {
            return arg;  // Direct pass-through for ArduinoPointer (Test 116 fix - exists in both variants)
        } else if constexpr (std::is_same_v<T, std::vector<int32_t>> ||
                           std::is_same_v<T, std::vector<double>> ||
                           std::is_same_v<T, std::vector<std::string>>) {
            // Convert vectors to ArduinoArray
            auto array = std::make_shared<ArduinoArray>();
            array->resize(arg.size());
            for (size_t i = 0; i < arg.size(); ++i) {
                array->setElement(i, arg[i]);
            }
            return array;
        } else {
            return std::monostate{};  // Fallback for unsupported types
        }
    }, command);
}

std::variant<std::monostate, bool, int32_t, double, std::string> downgradeCommandValue(const EnhancedCommandValue& enhanced) {
    return std::visit([](auto&& arg) -> std::variant<std::monostate, bool, int32_t, double, std::string> {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::monostate> || 
                      std::is_same_v<T, bool> || 
                      std::is_same_v<T, int32_t> || 
                      std::is_same_v<T, double> || 
                      std::is_same_v<T, std::string>) {
            return arg;  // Direct conversion for basic types
        } else {
            // Convert complex types to strings
            if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoStruct>>) {
                return arg ? arg->toString() : std::string("null_struct");
            } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoString>>) {
                return arg ? arg->c_str() : std::string("");
            } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoArray>>) {
                return arg ? arg->toString() : std::string("null_array");
            } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoPointer>>) {
                return arg ? arg->toString() : std::string("null_pointer");
            } else {
                return std::string("unknown_type");
            }
        }
    }, enhanced);
}

bool isStructType(const EnhancedCommandValue& value) {
    return std::holds_alternative<std::shared_ptr<ArduinoStruct>>(value);
}

bool isPointerType(const EnhancedCommandValue& value) {
    return std::holds_alternative<std::shared_ptr<ArduinoPointer>>(value);
}

bool isArrayType(const EnhancedCommandValue& value) {
    return std::holds_alternative<std::shared_ptr<ArduinoArray>>(value);
}

bool isStringType(const EnhancedCommandValue& value) {
    return std::holds_alternative<std::shared_ptr<ArduinoString>>(value);
}

std::string enhancedCommandValueToString(const EnhancedCommandValue& value) {
    return std::visit([](auto&& arg) -> std::string {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::monostate>) {
            return "undefined";
        } else if constexpr (std::is_same_v<T, bool>) {
            return arg ? "true" : "false";
        } else if constexpr (std::is_same_v<T, int32_t>) {
            return std::to_string(arg);
        } else if constexpr (std::is_same_v<T, double>) {
            return std::to_string(arg);
        } else if constexpr (std::is_same_v<T, std::string>) {
            return "\"" + arg + "\"";
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoStruct>>) {
            return arg ? arg->toString() : "null_struct";
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoString>>) {
            return arg ? ("\"" + arg->c_str() + "\"") : "null_string";
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoArray>>) {
            return arg ? arg->toString() : "null_array";
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoPointer>>) {
            return arg ? arg->toString() : "null_pointer";
        } else {
            return "unknown_type";
        }
    }, value);
}

std::shared_ptr<ArduinoStruct> createStruct(const std::string& typeName) {
    return std::make_shared<ArduinoStruct>(typeName);
}

std::shared_ptr<ArduinoArray> createArray(const std::string& elementType, const std::vector<size_t>& dimensions) {
    return std::make_shared<ArduinoArray>(elementType, dimensions);
}

std::shared_ptr<ArduinoString> createString(const std::string& initialValue) {
    return std::make_shared<ArduinoString>(initialValue);
}

// =============================================================================
// FUNCTION POINTER IMPLEMENTATION (Test 106)
// =============================================================================

FunctionPointer::FunctionPointer() : functionName(""), pointerId(""), interpreter(nullptr) {
}

FunctionPointer::FunctionPointer(const std::string& name, ASTInterpreter* interp)
    : functionName(name), interpreter(interp) {
    // Generate unique pointer ID matching JavaScript pattern
    auto now = std::chrono::system_clock::now();
    auto duration = now.time_since_epoch();
    auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();

    // Simple random suffix (not cryptographically secure, but sufficient for IDs)
    int random_suffix = (millis * 31 + std::hash<std::string>{}(name)) % 100000;

    StringBuildStream ss;
    ss << "fptr_" << millis << "_" << random_suffix;
    pointerId = ss.str();
}

std::string FunctionPointer::toString() const {
    StringBuildStream ss;
    ss << "ArduinoFunctionPointer(" << pointerId << " -> " << functionName << ")";
    return ss.str();
}

} // namespace arduino_interpreter

// =============================================================================
// EXTENDED COMMAND VALUE SUPPORT (after namespace to avoid circular includes)
// =============================================================================

namespace arduino_interpreter {

EnhancedCommandValue upgradeExtendedCommandValue(const CommandValue& extended) {
    return std::visit([](auto&& arg) -> EnhancedCommandValue {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::vector<int32_t>> ||
                      std::is_same_v<T, std::vector<double>> ||
                      std::is_same_v<T, std::vector<std::string>>) {
            // Convert typed arrays to ArduinoArray
            auto arduinoArray = std::make_shared<ArduinoArray>("auto");

            // Resize to match the source array
            arduinoArray->resize(arg.size());

            // Copy elements
            for (size_t i = 0; i < arg.size(); ++i) {
                if constexpr (std::is_same_v<T, std::vector<int32_t>>) {
                    arduinoArray->setElement(i, EnhancedCommandValue(arg[i]));
                } else if constexpr (std::is_same_v<T, std::vector<double>>) {
                    arduinoArray->setElement(i, EnhancedCommandValue(arg[i]));
                } else if constexpr (std::is_same_v<T, std::vector<std::string>>) {
                    arduinoArray->setElement(i, EnhancedCommandValue(arg[i]));
                }
            }

            return arduinoArray;
        } else if constexpr (std::is_same_v<T, std::vector<std::vector<int32_t>>> ||
                             std::is_same_v<T, std::vector<std::vector<double>>>) {
            // Convert 2D arrays to nested ArduinoArray
            auto outerArray = std::make_shared<ArduinoArray>("auto");
            outerArray->resize(arg.size());

            for (size_t i = 0; i < arg.size(); ++i) {
                auto innerArray = std::make_shared<ArduinoArray>("auto");
                innerArray->resize(arg[i].size());

                for (size_t j = 0; j < arg[i].size(); ++j) {
                    if constexpr (std::is_same_v<T, std::vector<std::vector<int32_t>>>) {
                        innerArray->setElement(j, EnhancedCommandValue(arg[i][j]));
                    } else {
                        innerArray->setElement(j, EnhancedCommandValue(arg[i][j]));
                    }
                }

                outerArray->setElement(i, innerArray);
            }

            return outerArray;
        } else if constexpr (std::is_same_v<T, uint32_t>) {
            // Convert uint32_t to int32_t for EnhancedCommandValue compatibility
            return static_cast<int32_t>(arg);
        } else if constexpr (std::is_same_v<T, FunctionPointer>) {
            // Convert FunctionPointer to string for EnhancedCommandValue compatibility (Test 106)
            return arg.toString();
        } else {
            return arg;  // Direct conversion for shared types
        }
    }, extended);
}

// Extended downgrade function that returns extended CommandValue
CommandValue downgradeExtendedCommandValue(const EnhancedCommandValue& enhanced) {
    return std::visit([](auto&& arg) -> CommandValue {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, std::monostate> ||
                      std::is_same_v<T, bool> ||
                      std::is_same_v<T, int32_t> ||
                      std::is_same_v<T, double> ||
                      std::is_same_v<T, std::string>) {
            return arg;  // Direct conversion for basic types
        } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoArray>>) {
            // Convert ArduinoArray back to typed vector based on element types
            if (arg && arg->size() > 0) {
                EnhancedCommandValue firstElement = arg->getElement(0);
                if (std::holds_alternative<int32_t>(firstElement)) {
                    std::vector<int32_t> vec;
                    for (size_t i = 0; i < arg->size(); ++i) {
                        vec.push_back(std::get<int32_t>(arg->getElement(i)));
                    }
                    return vec;
                } else if (std::holds_alternative<double>(firstElement)) {
                    std::vector<double> vec;
                    for (size_t i = 0; i < arg->size(); ++i) {
                        vec.push_back(std::get<double>(arg->getElement(i)));
                    }
                    return vec;
                } else if (std::holds_alternative<std::string>(firstElement)) {
                    std::vector<std::string> vec;
                    for (size_t i = 0; i < arg->size(); ++i) {
                        vec.push_back(std::get<std::string>(arg->getElement(i)));
                    }
                    return vec;
                } else {
                    return std::vector<int32_t>{}; // Default empty array
                }
            } else {
                return std::vector<int32_t>{}; // Empty array
            }
        } else {
            // Convert complex types to strings for other cases
            if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoStruct>>) {
                return arg ? arg->toString() : std::string("null_struct");
            } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoString>>) {
                return arg ? std::string(arg->c_str()) : std::string("");
            } else if constexpr (std::is_same_v<T, std::shared_ptr<ArduinoPointer>>) {
                return arg ? arg->toString() : std::string("null_pointer");
            } else {
                return std::string("unknown_type");
            }
        }
    }, enhanced);
}

} // namespace arduino_interpreter
