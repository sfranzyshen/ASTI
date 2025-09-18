#include "libs/CompactAST/src/CompactAST.hpp"
#include "src/cpp/ASTNodes.hpp"
#include <iostream>
#include <fstream>
#include <vector>

using namespace arduino_ast;

// Temporarily define DEBUG_OUT as cout to see debug output
#define DEBUG_OUT std::cout

int main() {
    try {
        // Read binary file
        std::ifstream file("test_data/example_004.ast", std::ios::binary | std::ios::ate);
        if (!file) {
            std::cerr << "Could not open file" << std::endl;
            return 1;
        }
        
        std::streamsize size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<uint8_t> buffer(size);
        if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
            std::cerr << "Could not read file" << std::endl;
            return 1;
        }
        file.close();
        
        // Create custom reader to access debug info
        class DebugCompactASTReader : public CompactASTReader {
        public:
            DebugCompactASTReader(const uint8_t* buffer, size_t size) : CompactASTReader(buffer, size) {}
            
            void debugParse() {
                parseHeaderInternal();
                parseStringTableInternal();
                parseNodesInternal();
                
                std::cout << "=== DEBUG: Child Indices Map ===" << std::endl;
                for (const auto& pair : childIndices_) {
                    size_t parentIndex = pair.first;
                    const std::vector<uint16_t>& children = pair.second;
                    
                    if (parentIndex < nodes_.size() && nodes_[parentIndex]) {
                        const auto* node = nodes_[parentIndex].get();
                        std::cout << "Node " << parentIndex << " (" << static_cast<int>(node->getType()) << ") has " << children.size() << " child indices: [";
                        for (size_t i = 0; i < children.size(); ++i) {
                            if (i > 0) std::cout << ", ";
                            std::cout << children[i];
                        }
                        std::cout << "]" << std::endl;
                        
                        if (node->getType() == ASTNodeType::FUNC_DEF) {
                            std::cout << "  -> This is a FUNC_DEF node with " << children.size() << " children" << std::endl;
                        }
                    }
                }
                
                // Now perform linking
                std::cout << "=== Performing child linking ===" << std::endl;
                linkNodeChildren();
                
                std::cout << "=== After linking ===" << std::endl;
                for (size_t i = 0; i < nodes_.size(); ++i) {
                    if (nodes_[i] && nodes_[i]->getType() == ASTNodeType::FUNC_DEF) {
                        std::cout << "FUNC_DEF node " << i << " now has " << nodes_[i]->getChildren().size() << " children" << std::endl;
                    }
                }
            }
        };
        
        DebugCompactASTReader reader(buffer.data(), buffer.size());
        reader.debugParse();
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}