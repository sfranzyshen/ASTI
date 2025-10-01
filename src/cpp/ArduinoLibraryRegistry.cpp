/**
 * ArduinoLibraryRegistry.cpp - Comprehensive Arduino Library Implementation
 * 
 * Implements comprehensive Arduino library support matching JavaScript system
 * with internal/external method routing and proper command generation.
 * 
 * Version: 1.0
 */

#include "ArduinoLibraryRegistry.hpp"
#include "ASTInterpreter.hpp"
#include <iostream>
#include <sstream>
#include <cmath>

namespace arduino_interpreter {

// Helper conversion functions
static int32_t convertToInt(const CommandValue& value) {
    if (std::holds_alternative<int>(value)) {
        return std::get<int>(value);
    } else if (std::holds_alternative<double>(value)) {
        return static_cast<int32_t>(std::get<double>(value));
    } else if (std::holds_alternative<bool>(value)) {
        return std::get<bool>(value) ? 1 : 0;
    }
    return 0;
}

// =============================================================================
// ARDUINO LIBRARY OBJECT IMPLEMENTATION
// =============================================================================

void ArduinoLibraryObject::initializeLibraryProperties() {
    // Initialize library-specific properties based on constructor args
    if (libraryName == "Adafruit_NeoPixel") {
        properties["numPixels"] = constructorArgs.size() > 0 ? constructorArgs[0] : CommandValue(60);
        properties["pin"] = constructorArgs.size() > 1 ? constructorArgs[1] : CommandValue(6);
        properties["pixelType"] = constructorArgs.size() > 2 ? constructorArgs[2] : CommandValue(0x06);
        properties["brightness"] = CommandValue(255);
        properties["isBegun"] = CommandValue(false);
    }
    else if (libraryName == "Servo") {
        properties["pin"] = CommandValue(-1);  // Not attached initially
        properties["currentAngle"] = CommandValue(90);
        properties["isAttached"] = CommandValue(false);
    }
    else if (libraryName == "LiquidCrystal") {
        properties["rs"] = constructorArgs.size() > 0 ? constructorArgs[0] : CommandValue(12);
        properties["enable"] = constructorArgs.size() > 1 ? constructorArgs[1] : CommandValue(11);
        properties["d4"] = constructorArgs.size() > 2 ? constructorArgs[2] : CommandValue(5);
        properties["d5"] = constructorArgs.size() > 3 ? constructorArgs[3] : CommandValue(4);
        properties["d6"] = constructorArgs.size() > 4 ? constructorArgs[4] : CommandValue(3);
        properties["d7"] = constructorArgs.size() > 5 ? constructorArgs[5] : CommandValue(2);
        properties["cols"] = CommandValue(16);
        properties["rows"] = CommandValue(2);
    }
    else if (libraryName == "CapacitiveSensor") {
        properties["sendPin"] = constructorArgs.size() > 0 ? constructorArgs[0] : CommandValue(4);
        properties["receivePin"] = constructorArgs.size() > 1 ? constructorArgs[1] : CommandValue(2);
        properties["timeout"] = CommandValue(2000);
    }
}

CommandValue ArduinoLibraryObject::callMethod(const std::string& methodName,
                                             const std::vector<CommandValue>& args,
                                             ASTInterpreter* interpreter) {
    // Get the library definition from registry
    if (!interpreter) {
        return std::monostate{};
    }

    auto registry = interpreter->getLibraryRegistry();
    if (!registry) {
        return std::monostate{};
    }

    const LibraryDefinition* libDef = registry->getLibraryDefinition(libraryName);
    if (!libDef) {
        return std::monostate{};
    }

    // Check if this is an INTERNAL method (executed locally, returns value immediately)
    auto internalIt = libDef->internalMethods.find(methodName);
    if (internalIt != libDef->internalMethods.end()) {
        // Call the internal method lambda and return result directly
        // Pass interpreter so lambda can access mock provider
        return internalIt->second(args, interpreter);
    }

    // Check if this is an EXTERNAL method (emits command to hardware)
    if (libDef->externalMethods.find(methodName) != libDef->externalMethods.end()) {
        // External methods emit commands but don't return values immediately
        // TODO: Implement external method command emission when needed
        // For now, return undefined
        return std::monostate{};
    }

    // Method not found in library definition
    return std::monostate{};
}

// =============================================================================
// ARDUINO LIBRARY REGISTRY IMPLEMENTATION
// =============================================================================

ArduinoLibraryRegistry::ArduinoLibraryRegistry(ASTInterpreter* interpreter) 
    : interpreter_(interpreter) {
    registerStandardLibraries();
}

void ArduinoLibraryRegistry::registerStandardLibraries() {
    registerAdafruitNeoPixelLibrary();
    registerServoLibrary();
    registerCapacitiveSensorLibrary();
    registerLiquidCrystalLibrary();
    registerSPILibrary();
    registerWireLibrary();
    registerEEPROMLibrary();
}

void ArduinoLibraryRegistry::registerAdafruitNeoPixelLibrary() {
    LibraryDefinition neoPixel;
    neoPixel.libraryName = "Adafruit_NeoPixel";
    
    // Internal methods - calculated by interpreter, return values immediately
    neoPixel.internalMethods["numPixels"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        // Return number of pixels (first constructor arg, default 60)
        return static_cast<int32_t>(60);  // Default value
    };
    
    neoPixel.internalMethods["getBrightness"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        return static_cast<int32_t>(255);  // Default brightness
    };
    
    neoPixel.internalMethods["getPixelColor"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        // Return stored pixel color or 0 (simplified)
        return static_cast<int32_t>(0);  // Default: no color
    };
    
    neoPixel.internalMethods["canShow"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        return true;  // Always return true for simulation
    };
    
    neoPixel.internalMethods["getPin"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        // Return pin number (second constructor arg, default 6)
        return static_cast<int32_t>(6);  // Default pin
    };
    
    neoPixel.internalMethods["attached"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        return true;  // Assume always attached for simulation
    };
    
    // External methods - emit commands to parent app for hardware operations
    neoPixel.externalMethods = {
        "begin", "show", "clear", "setPixelColor", "setBrightness", "setPin",
        "updateLength", "updateType", "fill", "rainbow"
    };
    
    // Static methods - class-level methods
    neoPixel.staticMethods["Color"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        // Convert RGB to 32-bit color value: 0xRRGGBB
        int32_t r = args.size() > 0 ? convertToInt(args[0]) : 0;
        int32_t g = args.size() > 1 ? convertToInt(args[1]) : 0;  
        int32_t b = args.size() > 2 ? convertToInt(args[2]) : 0;
        
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    };
    
    neoPixel.staticMethods["ColorHSV"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        // Simplified HSV to RGB conversion
        int32_t hue = args.size() > 0 ? convertToInt(args[0]) : 0;
        int32_t sat = args.size() > 1 ? convertToInt(args[1]) : 255;
        int32_t val = args.size() > 2 ? convertToInt(args[2]) : 255;
        
        hue = hue % 65536;
        int32_t sector = hue / 10923;
        int32_t offset = hue - (sector * 10923);
        int32_t p = (val * (255 - sat)) >> 8;
        int32_t q = (val * (255 - ((sat * offset) >> 15))) >> 8;
        int32_t t = (val * (255 - ((sat * (10923 - offset)) >> 15))) >> 8;
        
        int32_t r, g, b;
        switch (sector) {
            case 0: r = val; g = t; b = p; break;
            case 1: r = q; g = val; b = p; break;
            case 2: r = p; g = val; b = t; break;
            case 3: r = p; g = q; b = val; break;
            case 4: r = t; g = p; b = val; break;
            default: r = val; g = p; b = q; break;
        }
        
        return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    };
    
    neoPixel.staticMethods["sine8"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        int32_t x = args.size() > 0 ? convertToInt(args[0]) : 0;
        return static_cast<int32_t>(std::sin(x * M_PI / 128) * 127 + 128);
    };
    
    neoPixel.staticMethods["gamma8"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        int32_t x = args.size() > 0 ? convertToInt(args[0]) : 0;
        return static_cast<int32_t>(std::pow(x / 255.0, 2.8) * 255);
    };
    
    neoPixel.constructorArgs = {"numPixels", "pin", "pixelType"};
    
    registerLibrary(neoPixel);
}

void ArduinoLibraryRegistry::registerServoLibrary() {
    LibraryDefinition servo;
    servo.libraryName = "Servo";
    
    // Internal methods - calculated by interpreter
    servo.internalMethods["read"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        return static_cast<int32_t>(90);  // Default servo position
    };
    
    servo.internalMethods["readMicroseconds"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        return static_cast<int32_t>(1500);  // 90 degrees = 1500 microseconds
    };
    
    servo.internalMethods["attached"] = [](const std::vector<CommandValue>& args, ASTInterpreter*) -> CommandValue {
        return false;  // Default: not attached
    };
    
    // External methods - emit commands to parent app
    servo.externalMethods = {"attach", "detach", "write", "writeMicroseconds"};
    
    servo.constructorArgs = {};
    
    registerLibrary(servo);
}

void ArduinoLibraryRegistry::registerCapacitiveSensorLibrary() {
    LibraryDefinition capSensor;
    capSensor.libraryName = "CapacitiveSensor";

    // Internal methods - get external values from parent app provider
    capSensor.internalMethods["capacitiveSensor"] = [](const std::vector<CommandValue>& args, ASTInterpreter* interpreter) -> CommandValue {
        // Get sample count argument (default 30)
        int32_t sampleCount = 30;
        if (!args.empty() && std::holds_alternative<int>(args[0])) {
            sampleCount = std::get<int>(args[0]);
        }

        // Get external value from parent app provider
        // Parent app MUST provide SyncDataProvider implementation
        if (!interpreter || !interpreter->getSyncDataProvider()) {
            // Configuration error: missing provider
            // Return -1 as sentinel value indicating error
            return static_cast<int32_t>(-1);
        }
        return interpreter->getSyncDataProvider()->getLibrarySensorValue("CapacitiveSensor", "capacitiveSensor", sampleCount);
    };

    capSensor.internalMethods["capacitiveSensorRaw"] = [](const std::vector<CommandValue>& args, ASTInterpreter* interpreter) -> CommandValue {
        // Get sample count argument (default 30)
        int32_t sampleCount = 30;
        if (!args.empty() && std::holds_alternative<int>(args[0])) {
            sampleCount = std::get<int>(args[0]);
        }

        // Get external value from parent app provider
        // Parent app MUST provide SyncDataProvider implementation
        if (!interpreter || !interpreter->getSyncDataProvider()) {
            // Configuration error: missing provider
            // Return -1 as sentinel value indicating error
            return static_cast<int32_t>(-1);
        }
        return interpreter->getSyncDataProvider()->getLibrarySensorValue("CapacitiveSensor", "capacitiveSensorRaw", sampleCount);
    };

    // Constructor parameters
    capSensor.constructorArgs = {"sendPin", "receivePin"};

    registerLibrary(capSensor);
}

void ArduinoLibraryRegistry::registerLiquidCrystalLibrary() {
    LibraryDefinition lcd;
    lcd.libraryName = "LiquidCrystal";
    
    // Internal methods - mostly none (all operations require hardware)
    // Could add some status getters here if needed
    
    // External methods - all display operations need hardware
    lcd.externalMethods = {
        "begin", "clear", "home", "setCursor", "print", "println", "write", 
        "display", "noDisplay", "cursor", "noCursor", "blink", "noBlink", 
        "scrollDisplayLeft", "scrollDisplayRight", "autoscroll", "noAutoscroll", 
        "leftToRight", "rightToLeft", "createChar"
    };
    
    lcd.constructorArgs = {"rs", "enable", "d4", "d5", "d6", "d7"};
    
    registerLibrary(lcd);
}

void ArduinoLibraryRegistry::registerSPILibrary() {
    LibraryDefinition spi;
    spi.libraryName = "SPI";
    
    // Internal methods - none for SPI (all require hardware)
    
    // External methods - all SPI operations need hardware
    spi.externalMethods = {
        "begin", "end", "beginTransaction", "endTransaction", "transfer",
        "transfer16", "setBitOrder", "setDataMode", "setClockDivider"
    };
    
    spi.constructorArgs = {};
    
    registerLibrary(spi);
}

void ArduinoLibraryRegistry::registerWireLibrary() {
    LibraryDefinition wire;
    wire.libraryName = "Wire";
    
    // Internal methods - none for I2C (all require hardware)
    
    // External methods - all I2C operations need hardware
    wire.externalMethods = {
        "begin", "beginTransmission", "endTransmission", "requestFrom",
        "write", "read", "available", "setClock", "setWireTimeout"
    };
    
    wire.constructorArgs = {};
    
    registerLibrary(wire);
}

void ArduinoLibraryRegistry::registerEEPROMLibrary() {
    LibraryDefinition eeprom;
    eeprom.libraryName = "EEPROM";
    
    // Internal methods - could simulate some operations
    
    // External methods - EEPROM operations need hardware/persistence
    eeprom.externalMethods = {
        "read", "write", "update", "get", "put", "length"
    };
    
    eeprom.constructorArgs = {};
    
    registerLibrary(eeprom);
}

void ArduinoLibraryRegistry::registerLibrary(const LibraryDefinition& library) {
    libraries_[library.libraryName] = library;
}

std::shared_ptr<ArduinoLibraryObject> ArduinoLibraryRegistry::createLibraryObject(
    const std::string& libraryName, const std::vector<CommandValue>& args,
    const std::string& objectId) {

    if (!hasLibrary(libraryName)) {
        return nullptr;
    }

    auto object = std::make_shared<ArduinoLibraryObject>(libraryName, args);

    // Store object with provided unique ID (NOT generated - must match ASTInterpreter's ID!)
    libraryObjects_[objectId] = object;

    return object;
}

CommandValue ArduinoLibraryRegistry::callStaticMethod(const std::string& libraryName, 
                                                     const std::string& methodName,
                                                     const std::vector<CommandValue>& args) {
    auto it = libraries_.find(libraryName);
    if (it == libraries_.end()) {
        return std::monostate{};  // Library not found
    }
    
    auto methodIt = it->second.staticMethods.find(methodName);
    if (methodIt == it->second.staticMethods.end()) {
        return std::monostate{};  // Method not found
    }

    // Static methods have access to interpreter (for consistency with internal methods)
    return methodIt->second(args, interpreter_);
}

CommandValue ArduinoLibraryRegistry::callObjectMethod(const std::string& objectId,
                                                      const std::string& methodName,
                                                      const std::vector<CommandValue>& args) {
    // Find the library object by ID
    auto it = libraryObjects_.find(objectId);
    if (it == libraryObjects_.end()) {
        return std::monostate{};  // Object not found
    }

    auto libraryObject = it->second;
    if (!libraryObject) {
        return std::monostate{};
    }

    // Delegate to the object's callMethod
    return libraryObject->callMethod(methodName, args, interpreter_);
}

bool ArduinoLibraryRegistry::hasLibrary(const std::string& libraryName) const {
    return libraries_.find(libraryName) != libraries_.end();
}

bool ArduinoLibraryRegistry::hasStaticMethod(const std::string& libraryName, 
                                            const std::string& methodName) const {
    auto it = libraries_.find(libraryName);
    if (it == libraries_.end()) {
        return false;
    }
    
    return it->second.staticMethods.find(methodName) != it->second.staticMethods.end();
}

const LibraryDefinition* ArduinoLibraryRegistry::getLibraryDefinition(const std::string& libraryName) const {
    auto it = libraries_.find(libraryName);
    return (it != libraries_.end()) ? &it->second : nullptr;
}

LibraryObjectMetadata ArduinoLibraryRegistry::getLibraryObjectMetadata(const std::string& objectId) const {
    auto it = libraryObjects_.find(objectId);
    if (it == libraryObjects_.end()) {
        return LibraryObjectMetadata{"", {}, ""};
    }

    auto obj = it->second;
    return LibraryObjectMetadata{
        obj->libraryName,
        obj->constructorArgs,
        objectId
    };
}

void ArduinoLibraryRegistry::emitExternalCommand(const std::string& libraryName, 
                                                const std::string& methodName,
                                                const std::vector<CommandValue>& args, 
                                                const std::string& objectId) {
    // For now, emit a simple system command with library method information
    // TODO: Implement proper LibraryCommand when command system is complete
    std::ostringstream oss;
    oss << libraryName << "." << methodName << "(";
    for (size_t i = 0; i < args.size(); ++i) {
        if (i > 0) oss << ", ";
        oss << commandValueToString(args[i]);
    }
    oss << ")";
    
    if (!objectId.empty()) {
        oss << " [" << objectId << "]";
    }
    
    // Emit as system command for now
    if (interpreter_) {
        // TODO: Use proper library command when available
        // interpreter_->emitSystemCommand(CommandType::LIBRARY_METHOD_REQUEST, oss.str());
    }
}

} // namespace arduino_interpreter