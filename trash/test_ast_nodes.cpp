/**
 * test_ast_nodes.cpp - Unit tests for AST node definitions
 * 
 * Tests the C++ AST node implementations for correctness,
 * memory management, and visitor pattern functionality.
 */

#include "test_utils.hpp"

using namespace arduino_interpreter;
using namespace arduino_interpreter::testing;

// =============================================================================
// AST NODE BASIC TESTS
// =============================================================================

void testBasicNodeCreation() {
    // Test basic node types can be created
    auto program = arduino_ast::createProgramNode();
    TEST_ASSERT(program != nullptr, "Program node creation failed");
    TEST_ASSERT_EQ(program->getType(), arduino_ast::ASTNodeType::PROGRAM, "Program node type incorrect");
    
    auto number = arduino_ast::createNumberNode(42);
    TEST_ASSERT(number != nullptr, "Number node creation failed");
    TEST_ASSERT_EQ(number->getType(), arduino_ast::ASTNodeType::NUMBER, "Number node type incorrect");
    
    auto identifier = arduino_ast::createIdentifierNode("testVar");
    TEST_ASSERT(identifier != nullptr, "Identifier node creation failed");
    TEST_ASSERT_EQ(identifier->getType(), arduino_ast::ASTNodeType::IDENTIFIER, "Identifier node type incorrect");
}

void testNodeTypeStrings() {
    // Test node type to string conversion
    TEST_ASSERT_EQ(arduino_ast::nodeTypeToString(arduino_ast::ASTNodeType::PROGRAM), "PROGRAM", "Program type string");
    TEST_ASSERT_EQ(arduino_ast::nodeTypeToString(arduino_ast::ASTNodeType::FUNCTION_DEF), "FUNCTION_DEF", "Function def type string");
    TEST_ASSERT_EQ(arduino_ast::nodeTypeToString(arduino_ast::ASTNodeType::BINARY_OP), "BINARY_OP", "Binary op type string");
}

void testVisitorPattern() {
    // Create a simple visitor for testing
    struct TestVisitor : public arduino_ast::ASTVisitor {
        int visitCount = 0;
        arduino_ast::ASTNodeType lastVisited = arduino_ast::ASTNodeType::PROGRAM;
        
        void visit(arduino_ast::ProgramNode& node) override {
            visitCount++;
            lastVisited = arduino_ast::ASTNodeType::PROGRAM;
        }
        
        void visit(arduino_ast::NumberNode& node) override {
            visitCount++;
            lastVisited = arduino_ast::ASTNodeType::NUMBER;
        }
        
        // Default implementations for other node types
        void visit(arduino_ast::ErrorNode& node) override { visitCount++; }
        void visit(arduino_ast::CommentNode& node) override { visitCount++; }
        void visit(arduino_ast::CompoundStmtNode& node) override { visitCount++; }
        void visit(arduino_ast::ExpressionStatement& node) override { visitCount++; }
        void visit(arduino_ast::IfStatement& node) override { visitCount++; }
        void visit(arduino_ast::WhileStatement& node) override { visitCount++; }
        void visit(arduino_ast::DoWhileStatement& node) override { visitCount++; }
        void visit(arduino_ast::ForStatement& node) override { visitCount++; }
        void visit(arduino_ast::ReturnStatement& node) override { visitCount++; }
        void visit(arduino_ast::BreakStatement& node) override { visitCount++; }
        void visit(arduino_ast::ContinueStatement& node) override { visitCount++; }
        void visit(arduino_ast::BinaryOpNode& node) override { visitCount++; }
        void visit(arduino_ast::UnaryOpNode& node) override { visitCount++; }
        void visit(arduino_ast::FuncCallNode& node) override { visitCount++; }
        void visit(arduino_ast::MemberAccessNode& node) override { visitCount++; }
        void visit(arduino_ast::StringLiteralNode& node) override { visitCount++; }
        void visit(arduino_ast::IdentifierNode& node) override { visitCount++; }
        void visit(arduino_ast::VarDeclNode& node) override { visitCount++; }
        void visit(arduino_ast::FuncDefNode& node) override { visitCount++; }
        void visit(arduino_ast::TypeNode& node) override { visitCount++; }
    };
    
    TestVisitor visitor;
    
    auto program = arduino_ast::createProgramNode();
    program->accept(visitor);
    TEST_ASSERT_EQ(visitor.visitCount, 1, "Program node visit count");
    TEST_ASSERT_EQ(visitor.lastVisited, arduino_ast::ASTNodeType::PROGRAM, "Program node visited");
    
    auto number = arduino_ast::createNumberNode(123);
    number->accept(visitor);
    TEST_ASSERT_EQ(visitor.visitCount, 2, "Number node visit count");
    TEST_ASSERT_EQ(visitor.lastVisited, arduino_ast::ASTNodeType::NUMBER_LITERAL, "Number node visited");
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

int main() {
    std::cout << "=== AST Nodes Unit Tests ===" << std::endl;
    
    int passed = 0;
    int failed = 0;
    
    // Run tests
    auto result1 = runTest("Basic Node Creation", testBasicNodeCreation);
    if (result1.success) passed++; else failed++;
    
    auto result2 = runTest("Node Type Strings", testNodeTypeStrings);
    if (result2.success) passed++; else failed++;
    
    auto result3 = runTest("Visitor Pattern", testVisitorPattern);
    if (result3.success) passed++; else failed++;
    
    // Summary
    std::cout << std::endl;
    std::cout << "=== TEST RESULTS ===" << std::endl;
    std::cout << "Passed: " << passed << std::endl;
    std::cout << "Failed: " << failed << std::endl;
    std::cout << "Success Rate: " << (passed * 100 / (passed + failed)) << "%" << std::endl;
    
    return failed == 0 ? 0 : 1;
}