/**
 * ArduinoLibraryRegistry.hpp - Comprehensive Arduino Library System
 * 
 * Implements the same library architecture as JavaScript ASTInterpreter.js
 * with internal methods (calculated locally) and external methods (hardware commands).
 * 
 * Version: 1.0
 * Compatible with: ASTInterpreter.js library system
 */

#pragma once

#include "ArduinoDataTypes.hpp"
#include <memory>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <string>
#include <functional>

namespace arduino_interpreter {

// Forward declarations
class ASTInterpreter;

// =============================================================================
// LIBRARY METHOD TYPES
// =============================================================================

/**
 * Internal method function signature - calculated locally, returns value immediately
 * Parameters: args, interpreter pointer (for accessing mock provider)
 */
using InternalMethod = std::function<CommandValue(const std::vector<CommandValue>&, class ASTInterpreter*)>;

/**
 * External method information - emits command to parent application
 */
struct ExternalMethodInfo {
    std::string methodName;
    std::string description;
    bool requiresResponse = false;  // Some external methods return values
};

/**
 * Static method function signature - class-level methods
 * Parameters: args, interpreter pointer (for accessing mock provider)
 */
using StaticMethod = std::function<CommandValue(const std::vector<CommandValue>&, class ASTInterpreter*)>;

/**
 * Library object metadata for emission
 */
struct LibraryObjectMetadata {
    std::string libraryName;
    std::vector<CommandValue> constructorArgs;
    std::string objectId;
};

// =============================================================================
// LIBRARY DEFINITION STRUCTURE
// =============================================================================

/**
 * Complete library definition matching JavaScript ARDUINO_LIBRARIES structure
 */
struct LibraryDefinition {
    std::string libraryName;
    
    // Internal methods - calculated by interpreter, return values immediately
    std::unordered_map<std::string, InternalMethod> internalMethods;
    
    // External methods - emit commands to parent app for hardware operations
    std::unordered_set<std::string> externalMethods;
    
    // Static methods - class-level methods (e.g., Adafruit_NeoPixel.Color)
    std::unordered_map<std::string, StaticMethod> staticMethods;
    
    // Constructor parameter names for object creation
    std::vector<std::string> constructorArgs;
    
    // Library-specific initialization function (optional)
    std::function<void()> initFunction = nullptr;
};

// =============================================================================
// ARDUINO LIBRARY OBJECT
// =============================================================================

/**
 * Runtime library object instance (matches JavaScript ArduinoLibraryObject)
 */
class ArduinoLibraryObject {
public:
    std::string libraryName;
    std::vector<CommandValue> constructorArgs;
    std::unordered_map<std::string, CommandValue> properties;
    
    ArduinoLibraryObject(const std::string& name, const std::vector<CommandValue>& args)
        : libraryName(name), constructorArgs(args) {
        initializeLibraryProperties();
    }
    
    /**
     * Call a method on this library object
     */
    CommandValue callMethod(const std::string& methodName, const std::vector<CommandValue>& args,
                           ASTInterpreter* interpreter);
    
private:
    void initializeLibraryProperties();
};

// =============================================================================
// ARDUINO LIBRARY REGISTRY
// =============================================================================

/**
 * Central registry for all Arduino libraries
 * Manages library definitions, object instances, and method routing
 */
class ArduinoLibraryRegistry {
private:
    ASTInterpreter* interpreter_;
    std::unordered_map<std::string, LibraryDefinition> libraries_;
    std::unordered_map<std::string, std::shared_ptr<ArduinoLibraryObject>> libraryObjects_;
    
public:
    explicit ArduinoLibraryRegistry(ASTInterpreter* interpreter);
    
    /**
     * Register all standard Arduino libraries
     */
    void registerStandardLibraries();
    
    /**
     * Register a custom library definition
     */
    void registerLibrary(const LibraryDefinition& library);
    
    /**
     * Create a library object instance
     */
    std::shared_ptr<ArduinoLibraryObject> createLibraryObject(const std::string& libraryName,
                                                             const std::vector<CommandValue>& args,
                                                             const std::string& objectId);
    
    /**
     * Call a static method on a library class
     */
    CommandValue callStaticMethod(const std::string& libraryName, const std::string& methodName,
                                 const std::vector<CommandValue>& args);

    /**
     * Call a method on a library object instance
     */
    CommandValue callObjectMethod(const std::string& objectId,
                                  const std::string& methodName,
                                  const std::vector<CommandValue>& args);

    /**
     * Check if a library is registered
     */
    bool hasLibrary(const std::string& libraryName) const;
    
    /**
     * Check if a library has a specific static method
     */
    bool hasStaticMethod(const std::string& libraryName, const std::string& methodName) const;
    
    /**
     * Get library definition for debugging
     */
    const LibraryDefinition* getLibraryDefinition(const std::string& libraryName) const;

    /**
     * Get library object metadata for command emission
     */
    LibraryObjectMetadata getLibraryObjectMetadata(const std::string& objectId) const;

private:
    /**
     * Register individual libraries
     */
    void registerAdafruitNeoPixelLibrary();
    void registerServoLibrary();
    void registerCapacitiveSensorLibrary();
    void registerLiquidCrystalLibrary();
    void registerSPILibrary();
    void registerWireLibrary();
    void registerEEPROMLibrary();
    
    /**
     * Emit external command to parent application
     */
    void emitExternalCommand(const std::string& libraryName, const std::string& methodName,
                            const std::vector<CommandValue>& args, const std::string& objectId = "");
};

} // namespace arduino_interpreter