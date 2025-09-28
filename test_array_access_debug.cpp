#include <iostream>
#include <fstream>
#include <memory>
#include "../src/cpp/ASTInterpreter.hpp"
#include "../libs/CompactAST/src/CompactAST.hpp"

int main() {
    std::cerr << "=== Test 43 Array Access Debug ===" << std::endl;

    // Load test 43 AST
    std::ifstream astFile("/mnt/d/Devel/ASTInterpreter/test_data/example_043.ast", std::ios::binary);
    if (!astFile) {
        std::cerr << "Failed to open AST file" << std::endl;
        return 1;
    }

    // Read binary data
    astFile.seekg(0, std::ios::end);
    size_t fileSize = astFile.tellg();
    astFile.seekg(0, std::ios::beg);

    std::vector<uint8_t> buffer(fileSize);
    astFile.read(reinterpret_cast<char*>(buffer.data()), fileSize);
    astFile.close();

    // Import AST
    CompactAST::CompactASTImporter importer;
    auto ast = importer.importBinary(buffer);
    if (!ast) {
        std::cerr << "Failed to import AST" << std::endl;
        return 1;
    }

    // Create interpreter with debug output
    arduino_interpreter::ASTInterpreter interpreter(3); // maxLoopIterations = 3

    // Add debug wrapper to capture when pixels array is accessed
    class DebugInterpreter : public arduino_interpreter::ASTInterpreter {
    public:
        DebugInterpreter(uint32_t maxIter) : ASTInterpreter(maxIter) {}

        void debugArrayAccess() {
            std::cerr << "\n=== DEBUG: Checking pixels array access ===" << std::endl;

            // Check if pixels exists in basic scope manager
            auto* basicVar = scopeManager_->getVariable("pixels");
            if (basicVar) {
                std::cerr << "FOUND in basic scopeManager_" << std::endl;
                if (std::holds_alternative<std::vector<int32_t>>(basicVar->value)) {
                    auto& vec = std::get<std::vector<int32_t>>(basicVar->value);
                    std::cerr << "  Type: vector<int32_t>, Size: " << vec.size() << std::endl;
                    std::cerr << "  First 10 elements: ";
                    for (size_t i = 0; i < std::min(size_t(10), vec.size()); ++i) {
                        std::cerr << vec[i] << " ";
                    }
                    std::cerr << std::endl;
                } else {
                    std::cerr << "  Type: NOT vector<int32_t>!" << std::endl;
                }
            } else {
                std::cerr << "NOT FOUND in basic scopeManager_" << std::endl;
            }

            // Check enhanced scope manager
            if (enhancedScopeManager_) {
                auto* enhancedVar = enhancedScopeManager_->getVariable("pixels");
                if (enhancedVar) {
                    std::cerr << "FOUND in enhancedScopeManager_" << std::endl;
                    if (enhancedVar->isArray()) {
                        std::cerr << "  Is array: YES" << std::endl;
                    } else {
                        std::cerr << "  Is array: NO" << std::endl;
                    }
                } else {
                    std::cerr << "NOT FOUND in enhancedScopeManager_" << std::endl;
                }
            }

            // Try MemberAccessHelper::getArrayElement
            auto enhancedValue = arduino_interpreter::MemberAccessHelper::getArrayElement(
                enhancedScopeManager_.get(), "pixels", 0);
            if (!std::holds_alternative<std::monostate>(enhancedValue)) {
                std::cerr << "MemberAccessHelper::getArrayElement SUCCESS for pixels[0]" << std::endl;
            } else {
                std::cerr << "MemberAccessHelper::getArrayElement FAILED for pixels[0] - returned monostate" << std::endl;
            }

            std::cerr << "=== END DEBUG ===" << std::endl;
        }
    };

    // Run interpreter
    DebugInterpreter* debugInterp = static_cast<DebugInterpreter*>(&interpreter);

    std::cerr << "\nExecuting AST..." << std::endl;
    auto commands = interpreter.execute(ast.get());

    // Find where thisPixel is accessed and add debug
    for (const auto& cmd : commands) {
        if (cmd.get("variable") == "thisPixel") {
            std::cerr << "\n!!! thisPixel access detected !!!" << std::endl;
            debugInterp->debugArrayAccess();
            auto val = cmd.get("value");
            if (std::holds_alternative<std::monostate>(val)) {
                std::cerr << "thisPixel = null" << std::endl;
            } else if (std::holds_alternative<int32_t>(val)) {
                std::cerr << "thisPixel = " << std::get<int32_t>(val) << std::endl;
            }
        }
    }

    return 0;
}