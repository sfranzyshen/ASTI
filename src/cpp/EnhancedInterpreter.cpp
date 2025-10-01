#include "EnhancedInterpreter.hpp"
#include <iostream>

namespace arduino_interpreter {

// =============================================================================
// ENHANCED VARIABLE IMPLEMENTATION
// =============================================================================

// Conversion functions commented out due to circular dependencies
// EnhancedVariable EnhancedVariable::fromBasic(const Variable& basic) {
//     // Convert basic CommandValue to EnhancedCommandValue
//     EnhancedCommandValue enhanced = std::visit([](auto&& arg) -> EnhancedCommandValue {
//         return arg;  // Direct conversion for shared types
//     }, basic.value);
//     
//     return EnhancedVariable(enhanced, basic.type, basic.isConst);
// }
// 
// Variable EnhancedVariable::toBasic() const {
//     // Convert EnhancedCommandValue to basic CommandValue
//     auto basic = downgradeCommandValue(value);
//     Variable result;
//     result.value = basic;
//     result.type = type;
//     result.isConst = isConst;
//     result.isReference = isReference;
//     return result;
// }

// =============================================================================
// ENHANCED SCOPE MANAGER IMPLEMENTATION
// =============================================================================

void EnhancedScopeManager::debugPrintScopes() const {
#ifdef DEBUG_ENHANCED_SCOPE
    std::cout << "=== Enhanced Scope Debug ===" << std::endl;
    for (size_t i = 0; i < scopes_.size(); ++i) {
        std::cout << "Scope " << i << ": ";
        for (const auto& [name, var] : scopes_[i]) {
            std::cout << name << "(" << var.type << ") ";
        }
        std::cout << std::endl;
    }
    std::cout << "=========================" << std::endl;
#endif // DEBUG_ENHANCED_SCOPE
}

// =============================================================================
// MEMBER ACCESS HELPER IMPLEMENTATION
// =============================================================================

EnhancedCommandValue MemberAccessHelper::getMemberValue(EnhancedScopeManager* scopeManager, 
                                                       const std::string& objectName, 
                                                       const std::string& memberName) {
    // First, try to get the object as a struct
    EnhancedVariable* objectVar = scopeManager->getVariable(objectName);
    if (objectVar && objectVar->isStruct()) {
        auto structPtr = std::get<std::shared_ptr<ArduinoStruct>>(objectVar->value);
        if (structPtr) {
            return structPtr->getMember(memberName);
        }
    }
    
    // Special case: handle built-in objects like Serial and Keyboard
    if (objectName == "Serial") {
        if (memberName == "available") {
            return int32_t(0);  // Mock value for available bytes
        } else if (memberName == "read") {
            return int32_t(65);  // Mock value for read byte (ASCII 'A')
        } else if (memberName == "peek") {
            return int32_t(65);  // Mock value for peek byte
        } else if (memberName == "write") {
            return int32_t(1);   // Mock value for bytes written
        } else if (memberName == "print" || memberName == "println" || memberName == "begin") {
            // These are function calls, not property access
            // Return a callable placeholder
            return std::string("SerialMethod");
        }
        // Default return for unknown Serial members
        return std::monostate{};
    }

    // Special case: handle Keyboard USB HID object
    if (objectName == "Keyboard") {
        if (memberName == "begin" || memberName == "press" || memberName == "write" ||
            memberName == "releaseAll" || memberName == "release" ||
            memberName == "print" || memberName == "println") {
            // These are function calls, not property access
            // Return a callable placeholder
            return std::string("KeyboardMethod");
        }
        // Default return for unknown Keyboard members
        return std::monostate{};
    }

    // Fall back to composite variable name simulation for compatibility
    std::string compositeName = objectName + "_" + memberName;
    EnhancedVariable* compositeVar = scopeManager->getVariable(compositeName);
    if (compositeVar) {
        return compositeVar->value;
    }
    
    return std::monostate{};  // Return undefined
}

void MemberAccessHelper::setMemberValue(EnhancedScopeManager* scopeManager,
                                       const std::string& objectName,
                                       const std::string& memberName,
                                       const EnhancedCommandValue& value) {
    // First, try to set the member if object is a struct
    EnhancedVariable* objectVar = scopeManager->getVariable(objectName);
    if (objectVar && objectVar->isStruct()) {
        auto structPtr = std::get<std::shared_ptr<ArduinoStruct>>(objectVar->value);
        if (structPtr) {
            structPtr->setMember(memberName, value);
            return;
        }
    }
    
    // Create the object as a struct if it doesn't exist
    if (!objectVar) {
        auto newStruct = createStruct("struct");
        newStruct->setMember(memberName, value);
        EnhancedVariable structVar(newStruct, "struct");
        scopeManager->setVariable(objectName, structVar);
        return;
    }
    
    // Fall back to composite variable name simulation for compatibility
    std::string compositeName = objectName + "_" + memberName;
    
    // Determine type from the value
    std::string valueType = std::visit([](auto&& arg) -> std::string {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, bool>) return "bool";
        else if constexpr (std::is_same_v<T, int32_t>) return "int";
        else if constexpr (std::is_same_v<T, double>) return "double";
        else if constexpr (std::is_same_v<T, std::string>) return "String";
        else return "unknown";
    }, value);
    
    EnhancedVariable compositeVar(value, valueType);
    scopeManager->setVariable(compositeName, compositeVar);
}

EnhancedCommandValue MemberAccessHelper::getArrayElement(EnhancedScopeManager* scopeManager,
                                                        const std::string& arrayName,
                                                        size_t index) {
    EnhancedVariable* arrayVar = scopeManager->getVariable(arrayName);
    if (arrayVar && arrayVar->isArray()) {
        auto arrayPtr = std::get<std::shared_ptr<ArduinoArray>>(arrayVar->value);
        if (arrayPtr) {
            try {
                return arrayPtr->getElement(index);
            } catch (const std::out_of_range&) {
                return std::monostate{};  // Return undefined for out-of-bounds
            }
        }
    }
    
    // Fall back to composite variable name simulation
    std::string elementName = arrayName + "_" + std::to_string(index);
    EnhancedVariable* elementVar = scopeManager->getVariable(elementName);
    if (elementVar) {
        return elementVar->value;
    }
    
    return std::monostate{};
}

void MemberAccessHelper::setArrayElement(EnhancedScopeManager* scopeManager,
                                        const std::string& arrayName,
                                        size_t index,
                                        const EnhancedCommandValue& value) {
    EnhancedVariable* arrayVar = scopeManager->getVariable(arrayName);
    if (arrayVar && arrayVar->isArray()) {
        auto arrayPtr = std::get<std::shared_ptr<ArduinoArray>>(arrayVar->value);
        if (arrayPtr) {
            try {
                // Resize array if needed
                if (index >= arrayPtr->size()) {
                    arrayPtr->resize(index + 1);
                }
                arrayPtr->setElement(index, value);
                return;
            } catch (const std::out_of_range&) {
                // Fall through to composite simulation
            }
        }
    }
    
    // Create array if it doesn't exist and the object name suggests it's an array
    if (!arrayVar) {
        // Determine element type from value
        std::string elementType = std::visit([](auto&& arg) -> std::string {
            using T = std::decay_t<decltype(arg)>;
            if constexpr (std::is_same_v<T, bool>) return "bool";
            else if constexpr (std::is_same_v<T, int32_t>) return "int";
            else if constexpr (std::is_same_v<T, double>) return "double";
            else if constexpr (std::is_same_v<T, std::string>) return "String";
            else return "variant";
        }, value);
        
        auto newArray = createArray(elementType, {index + 1});
        newArray->setElement(index, value);
        EnhancedVariable arrayVar(newArray, elementType + "[]");
        scopeManager->setVariable(arrayName, arrayVar);
        return;
    }
    
    // Fall back to composite variable name simulation
    std::string elementName = arrayName + "_" + std::to_string(index);
    std::string valueType = std::visit([](auto&& arg) -> std::string {
        using T = std::decay_t<decltype(arg)>;
        if constexpr (std::is_same_v<T, bool>) return "bool";
        else if constexpr (std::is_same_v<T, int32_t>) return "int";
        else if constexpr (std::is_same_v<T, double>) return "double";
        else if constexpr (std::is_same_v<T, std::string>) return "String";
        else return "unknown";
    }, value);
    
    EnhancedVariable elementVar(value, valueType);
    scopeManager->setVariable(elementName, elementVar);
}

} // namespace arduino_interpreter