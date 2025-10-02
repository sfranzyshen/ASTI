#----------------------------------------------------------------
# Generated CMake target import file for configuration "MinSizeRel".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "ArduinoASTInterpreter::arduino_ast_interpreter" for configuration "MinSizeRel"
set_property(TARGET ArduinoASTInterpreter::arduino_ast_interpreter APPEND PROPERTY IMPORTED_CONFIGURATIONS MINSIZEREL)
set_target_properties(ArduinoASTInterpreter::arduino_ast_interpreter PROPERTIES
  IMPORTED_LINK_INTERFACE_LANGUAGES_MINSIZEREL "CXX"
  IMPORTED_LOCATION_MINSIZEREL "${_IMPORT_PREFIX}/lib/libarduino_ast_interpreter.a"
  )

list(APPEND _IMPORT_CHECK_TARGETS ArduinoASTInterpreter::arduino_ast_interpreter )
list(APPEND _IMPORT_CHECK_FILES_FOR_ArduinoASTInterpreter::arduino_ast_interpreter "${_IMPORT_PREFIX}/lib/libarduino_ast_interpreter.a" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
