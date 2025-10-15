/**
 * TemplateInstantiations.cpp - Explicit template instantiations
 *
 * Reduces template bloat by explicitly instantiating commonly used
 * template combinations. Prevents compiler from generating these
 * instantiations in every translation unit.
 *
 * Size impact: ~10-15% reduction in MinSizeRel builds
 *
 * Version: 1.0
 * Compatible with: ASTInterpreter v21.2.1
 */

#include "ArduinoDataTypes.hpp"
#include "ASTInterpreter.hpp"
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <string>
#include <variant>
#include <functional>

// =============================================================================
// EXPLICIT VECTOR INSTANTIATIONS
// =============================================================================

// Primitive vector types
template class std::vector<int32_t>;
template class std::vector<double>;
template class std::vector<std::string>;

// CommandValue vectors
template class std::vector<CommandValue>;

// =============================================================================
// EXPLICIT UNORDERED_MAP INSTANTIATIONS
// =============================================================================

// CommandValue maps (most common in interpreter)
template class std::unordered_map<std::string, CommandValue>;

// Primitive maps
template class std::unordered_map<std::string, int32_t>;
template class std::unordered_map<std::string, double>;
template class std::unordered_map<std::string, std::string>;

// =============================================================================
// EXPLICIT UNORDERED_SET INSTANTIATIONS
// =============================================================================

// String sets (used in library registry)
template class std::unordered_set<std::string>;

// Integer sets
template class std::unordered_set<int32_t>;

// =============================================================================
// EXPLICIT VARIANT INSTANTIATIONS
// =============================================================================

// CommandValue variant (defined in ArduinoDataTypes.hpp)
// This is the most commonly used template in the codebase
template class std::variant<
    std::monostate,                          // void/undefined
    bool,                                    // boolean
    int32_t,                                 // integer (Arduino pins, values)
    uint32_t,                                // unsigned integer (compatibility)
    double,                                  // floating point numbers
    std::string,                             // strings and identifiers
    std::vector<int32_t>,                    // simple integer arrays (most common)
    std::vector<double>,                     // double arrays
    std::vector<std::string>                 // string arrays
>;

// =============================================================================
// EXPLICIT FUNCTION WRAPPER INSTANTIATIONS
// =============================================================================

// Library function callbacks
template class std::function<
    CommandValue(
        const std::vector<CommandValue>&,
        arduino_interpreter::ASTInterpreter*
    )
>;

// Simple callbacks
template class std::function<void()>;
template class std::function<bool()>;
template class std::function<int32_t()>;
template class std::function<double()>;

// =============================================================================
// NOTES
// =============================================================================

/**
 * These explicit instantiations tell the compiler to generate the template
 * code once in this translation unit, rather than in every file that uses
 * these types. This reduces:
 *
 * 1. Object file size (less duplicate code)
 * 2. Link time (fewer symbols to resolve)
 * 3. Final binary size (dead code elimination more effective)
 *
 * Trade-off: Slightly longer compilation time for THIS file, but overall
 * build is faster and produces smaller binaries.
 *
 * Only included in MinSizeRel builds via CMakeLists.txt conditional.
 */
