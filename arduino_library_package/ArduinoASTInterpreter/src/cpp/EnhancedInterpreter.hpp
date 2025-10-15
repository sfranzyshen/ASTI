#pragma once

#include "ArduinoDataTypes.hpp"

namespace arduino_interpreter {

// Forward declarations to avoid circular dependencies  
struct Variable;  // Forward declaration - will be defined in ASTInterpreter.hpp

// Enhanced Variable struct that can handle both basic and complex types
struct EnhancedVariable {
    EnhancedCommandValue value;
    std::string type;
    bool isConst = false;
    bool isReference = false;
    
    EnhancedVariable() : value(std::monostate{}), type("undefined") {}
    
    template<typename T>
    EnhancedVariable(const T& val, const std::string& t = "", bool c = false) 
        : value(val), type(t), isConst(c) {}
    
    // Conversion to/from basic Variable for compatibility (commented out due to circular dependencies)
    // static EnhancedVariable fromBasic(const Variable& basic);
    // Variable toBasic() const;
    
    // Type checking helpers
    bool isStruct() const { return isStructType(value); }
    bool isArray() const { return isArrayType(value); }
    bool isEnhancedString() const { return isStringType(value); }
    bool isPointer() const { return isPointerType(value); }
    
    std::string toString() const { return enhancedCommandValueToString(value); }
};

// Enhanced scope manager that can handle both basic and complex types
class EnhancedScopeManager {
private:
    std::vector<std::unordered_map<std::string, EnhancedVariable>> scopes_;
    
public:
    EnhancedScopeManager() {
        pushScope(); // Global scope
    }
    
    void pushScope() {
        scopes_.emplace_back();
    }
    
    void popScope() {
        if (scopes_.size() > 1) { // Keep global scope
            scopes_.pop_back();
        }
    }
    
    void setVariable(const std::string& name, const EnhancedVariable& var) {
        scopes_.back()[name] = var;
    }
    
    EnhancedVariable* getVariable(const std::string& name) {
        // Search from innermost to outermost scope
        for (auto it = scopes_.rbegin(); it != scopes_.rend(); ++it) {
            auto varIt = it->find(name);
            if (varIt != it->end()) {
                return &varIt->second;
            }
        }
        return nullptr;
    }
    
    bool hasVariable(const std::string& name) const {
        for (auto it = scopes_.rbegin(); it != scopes_.rend(); ++it) {
            if (it->find(name) != it->end()) {
                return true;
            }
        }
        return false;
    }
    
    size_t getScopeCount() const { return scopes_.size(); }
    
    // Debugging
    void debugPrintScopes() const;
};

// Enhanced member access helper functions
class MemberAccessHelper {
public:
    // Get member from struct or simulate composite variable access for compatibility
    static EnhancedCommandValue getMemberValue(EnhancedScopeManager* scopeManager, 
                                             const std::string& objectName, 
                                             const std::string& memberName);
    
    // Set member in struct or simulate composite variable assignment for compatibility
    static void setMemberValue(EnhancedScopeManager* scopeManager,
                             const std::string& objectName,
                             const std::string& memberName,
                             const EnhancedCommandValue& value);
    
    // Get array element or simulate access for compatibility
    static EnhancedCommandValue getArrayElement(EnhancedScopeManager* scopeManager,
                                              const std::string& arrayName,
                                              size_t index);
    
    // Set array element or simulate assignment for compatibility  
    static void setArrayElement(EnhancedScopeManager* scopeManager,
                              const std::string& arrayName,
                              size_t index,
                              const EnhancedCommandValue& value);
};

} // namespace arduino_interpreter