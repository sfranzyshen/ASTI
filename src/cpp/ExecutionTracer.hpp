/**
 * ExecutionTracer.hpp - Diagnostic system for C++ interpreter execution flow
 * Version: 1.0.0
 * 
 * This system traces C++ interpreter execution step-by-step to identify
 * exactly where it diverges from JavaScript interpreter behavior.
 * 
 * Usage:
 *   TRACE_ENTRY("visit(VarDeclNode)", "varName=" + varName);
 *   TRACE_EVAL("evaluateExpression", "nodeType=" + std::to_string(type));
 *   TRACE_COMMAND("emitCommand", "type=" + commandType);
 */

#pragma once

#include <vector>
#include <string>
#include <fstream>
#include <chrono>
#include <sstream>
#include <iostream>

namespace arduino_interpreter {

class ExecutionTracer {
private:
    struct TraceEntry {
        std::string timestamp;
        std::string event;
        std::string detail;
        std::string context;
        
        TraceEntry(const std::string& ev, const std::string& det, const std::string& ctx = "")
            : event(ev), detail(det), context(ctx) {
            auto now = std::chrono::steady_clock::now();
            auto ms = std::chrono::duration_cast<std::chrono::microseconds>(now.time_since_epoch()).count();
            timestamp = std::to_string(ms);
        }
    };
    
    std::vector<TraceEntry> trace_;
    bool enabled_ = true;
    std::string currentContext_ = "";
    int depth_ = 0;
    
public:
    void enable() { enabled_ = true; }
    void disable() { enabled_ = false; }
    bool isEnabled() const { return enabled_; }
    
    void setContext(const std::string& context) { 
        currentContext_ = context; 
    }
    
    void log(const std::string& event, const std::string& detail = "") {
        if (!enabled_) return;
        
        std::string indent(depth_ * 2, ' ');
        trace_.emplace_back(indent + event, detail, currentContext_);
    }
    
    void logEntry(const std::string& event, const std::string& detail = "") {
        if (!enabled_) return;
        
        std::string indent(depth_ * 2, ' ');
        trace_.emplace_back(indent + "→ " + event, detail, currentContext_);
        depth_++;
    }
    
    void logExit(const std::string& event, const std::string& detail = "") {
        if (!enabled_) return;
        
        depth_--;
        std::string indent(depth_ * 2, ' ');
        trace_.emplace_back(indent + "← " + event, detail, currentContext_);
    }
    
    void logCommand(const std::string& commandType, const std::string& details = "") {
        if (!enabled_) return;
        
        std::string indent(depth_ * 2, ' ');
        trace_.emplace_back(indent + "CMD: " + commandType, details, currentContext_);
    }
    
    void logExpression(const std::string& exprType, const std::string& details = "") {
        if (!enabled_) return;
        
        std::string indent(depth_ * 2, ' ');
        trace_.emplace_back(indent + "EXPR: " + exprType, details, currentContext_);
    }
    
    void clear() {
        trace_.clear();
        depth_ = 0;
        currentContext_ = "";
    }
    
    size_t size() const { return trace_.size(); }
    
    void saveToFile(const std::string& filename) const {
        std::ofstream file(filename);
        if (!file.is_open()) return;
        
        file << "# C++ Execution Trace\n";
        file << "# Total entries: " << trace_.size() << "\n";
        file << "# Context: " << currentContext_ << "\n\n";
        
        for (const auto& entry : trace_) {
            file << "[" << entry.timestamp << "] " 
                 << entry.event;
            
            if (!entry.detail.empty()) {
                file << " | " << entry.detail;
            }
            
            if (!entry.context.empty() && entry.context != currentContext_) {
                file << " (" << entry.context << ")";
            }
            
            file << "\n";
        }
        
        file.close();
    }
    
    void compareWithJS(const std::vector<std::string>& jsTrace) const {
        std::ofstream file("execution_comparison.txt");
        if (!file.is_open()) return;
        
        file << "# Execution Comparison: C++ vs JavaScript\n\n";
        
        size_t maxLen = std::max(trace_.size(), jsTrace.size());
        
        file << "C++ Events: " << trace_.size() << "\n";
        file << "JS Events: " << jsTrace.size() << "\n\n";
        
        for (size_t i = 0; i < maxLen; i++) {
            file << "--- Line " << (i + 1) << " ---\n";
            
            if (i < trace_.size()) {
                file << "C++: " << trace_[i].event;
                if (!trace_[i].detail.empty()) {
                    file << " | " << trace_[i].detail;
                }
                file << "\n";
            } else {
                file << "C++: <MISSING>\n";
            }
            
            if (i < jsTrace.size()) {
                file << "JS:  " << jsTrace[i] << "\n";
            } else {
                file << "JS:  <MISSING>\n";
            }
            
            // Mark differences
            if (i < trace_.size() && i < jsTrace.size()) {
                std::string cppEvent = trace_[i].event;
                std::string jsEvent = jsTrace[i];
                
                if (cppEvent.find(jsEvent) == std::string::npos && 
                    jsEvent.find(cppEvent) == std::string::npos) {
                    file << "*** DIFFERENCE DETECTED ***\n";
                }
            }
            
            file << "\n";
        }
        
        file.close();
    }
    
    void printSummary() const {
#ifdef DEBUG_EXECUTION_TRACER
        std::cout << "\n=== Execution Trace Summary ===\n";
        std::cout << "Total events: " << trace_.size() << "\n";
        std::cout << "Context: " << currentContext_ << "\n";

        // Count event types
        int visitors = 0, expressions = 0, commands = 0;
        for (const auto& entry : trace_) {
            if (entry.event.find("visit(") != std::string::npos) visitors++;
            else if (entry.event.find("EXPR:") != std::string::npos) expressions++;
            else if (entry.event.find("CMD:") != std::string::npos) commands++;
        }

        std::cout << "Visitor calls: " << visitors << "\n";
        std::cout << "Expression evaluations: " << expressions << "\n";
        std::cout << "Commands generated: " << commands << "\n";
        std::cout << "===============================\n\n";
#endif // DEBUG_EXECUTION_TRACER
    }
};

// Global tracer instance
extern ExecutionTracer g_tracer;

// Convenience macros for tracing
#define TRACE_ENABLE() g_tracer.enable()
#define TRACE_DISABLE() g_tracer.disable()  
#define TRACE_CONTEXT(ctx) g_tracer.setContext(ctx)
#define TRACE(event, detail) g_tracer.log(event, detail)
#define TRACE_ENTRY(event, detail) g_tracer.logEntry(event, detail)
#define TRACE_EXIT(event, detail) g_tracer.logExit(event, detail)  
#define TRACE_COMMAND(type, details) g_tracer.logCommand(type, details)
#define TRACE_EXPR(type, details) g_tracer.logExpression(type, details)
#define TRACE_SAVE(filename) g_tracer.saveToFile(filename)
#define TRACE_SUMMARY() g_tracer.printSummary()
#define TRACE_CLEAR() g_tracer.clear()

// RAII helper for automatic entry/exit tracing
class TraceScope {
    std::string event_;
public:
    TraceScope(const std::string& event, const std::string& detail = "") 
        : event_(event) {
        g_tracer.logEntry(event_, detail);
    }
    
    ~TraceScope() {
        g_tracer.logExit(event_, "");
    }
};

#define TRACE_SCOPE(event, detail) TraceScope _trace_scope(event, detail)

} // namespace arduino_interpreter