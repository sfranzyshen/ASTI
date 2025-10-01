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
#include <chrono>
#include "PlatformAbstraction.hpp"

namespace arduino_interpreter {

#ifdef ENABLE_FILE_TRACING

// ============================================================================
// FULL EXECUTION TRACER (FILE TRACING ENABLED)
// ============================================================================

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
        PlatformFile file;
        if (!file.open(filename.c_str())) return;

        file.write("# C++ Execution Trace\n");
        file.write("# Total entries: " + std::to_string(trace_.size()) + "\n");
        file.write("# Context: " + currentContext_ + "\n\n");
        
        for (const auto& entry : trace_) {
            std::string line = "[" + entry.timestamp + "] " + entry.event;

            if (!entry.detail.empty()) {
                line += " | " + entry.detail;
            }

            if (!entry.context.empty() && entry.context != currentContext_) {
                line += " (" + entry.context + ")";
            }

            file.write(line + "\n");
        }
        
        file.close();
    }
    
    void compareWithJS(const std::vector<std::string>& jsTrace) const {
        PlatformFile file;
        if (!file.open("execution_comparison.txt")) return;

        file.write("# Execution Comparison: C++ vs JavaScript\n\n");

        size_t maxLen = std::max(trace_.size(), jsTrace.size());

        file.write("C++ Events: " + std::to_string(trace_.size()) + "\n");
        file.write("JS Events: " + std::to_string(jsTrace.size()) + "\n\n");

        for (size_t i = 0; i < maxLen; i++) {
            file.write("--- Line " + std::to_string(i + 1) + " ---\n");

            if (i < trace_.size()) {
                std::string line = "C++: " + trace_[i].event;
                if (!trace_[i].detail.empty()) {
                    line += " | " + trace_[i].detail;
                }
                file.write(line + "\n");
            } else {
                file.write("C++: <MISSING>\n");
            }

            if (i < jsTrace.size()) {
                file.write("JS:  " + jsTrace[i] + "\n");
            } else {
                file.write("JS:  <MISSING>\n");
            }

            // Mark differences
            if (i < trace_.size() && i < jsTrace.size()) {
                std::string cppEvent = trace_[i].event;
                std::string jsEvent = jsTrace[i];

                if (cppEvent.find(jsEvent) == std::string::npos &&
                    jsEvent.find(cppEvent) == std::string::npos) {
                    file.write("*** DIFFERENCE DETECTED ***\n");
                }
            }

            file.write("\n");
        }

        file.close();
    }
    
    void printSummary() const {
#ifdef DEBUG_EXECUTION_TRACER
        DEBUG_STREAM << "\n=== Execution Trace Summary ===\n";
        DEBUG_STREAM << "Total events: " << trace_.size() << "\n";
        DEBUG_STREAM << "Context: " << currentContext_ << "\n";

        // Count event types
        int visitors = 0, expressions = 0, commands = 0;
        for (const auto& entry : trace_) {
            if (entry.event.find("visit(") != std::string::npos) visitors++;
            else if (entry.event.find("EXPR:") != std::string::npos) expressions++;
            else if (entry.event.find("CMD:") != std::string::npos) commands++;
        }

        DEBUG_STREAM << "Visitor calls: " << visitors << "\n";
        DEBUG_STREAM << "Expression evaluations: " << expressions << "\n";
        DEBUG_STREAM << "Commands generated: " << commands << "\n";
        DEBUG_STREAM << "===============================\n\n";
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

#else // !ENABLE_FILE_TRACING

// ============================================================================
// STUB EXECUTION TRACER (FILE TRACING DISABLED)
// ============================================================================
//
// When ENABLE_FILE_TRACING=OFF, ExecutionTracer becomes a zero-overhead stub.
// All methods are inlined no-ops. This completely eliminates file I/O
// dependencies (fstream, iostream) while maintaining API compatibility.

class ExecutionTracer {
public:
    // Control methods (no-ops)
    void enable() {}
    void disable() {}
    bool isEnabled() const { return false; }
    void setContext(const std::string&) {}

    // Logging methods (no-ops)
    void log(const std::string&, const std::string& = "") {}
    void logEntry(const std::string&, const std::string& = "") {}
    void logExit(const std::string&, const std::string& = "") {}
    void logCommand(const std::string&, const std::string& = "") {}
    void logExpression(const std::string&, const std::string& = "") {}

    // State methods (no-ops)
    void clear() {}
    size_t size() const { return 0; }

    // File output methods (no-ops)
    void saveToFile(const std::string&) const {}
    void compareWithJS(const std::vector<std::string>&) const {}
    void printSummary() const {}
};

// Global tracer instance (stub version)
extern ExecutionTracer g_tracer;

// Convenience macros (become no-ops)
#define TRACE_ENABLE()
#define TRACE_DISABLE()
#define TRACE_CONTEXT(ctx)
#define TRACE(event, detail)
#define TRACE_ENTRY(event, detail)
#define TRACE_EXIT(event, detail)
#define TRACE_COMMAND(type, details)
#define TRACE_EXPR(type, details)
#define TRACE_SAVE(filename)
#define TRACE_SUMMARY()
#define TRACE_CLEAR()

// RAII helper (stub version - does nothing)
class TraceScope {
public:
    TraceScope(const std::string&, const std::string& = "") {}
    ~TraceScope() {}
};

#define TRACE_SCOPE(event, detail)

#endif // ENABLE_FILE_TRACING

} // namespace arduino_interpreter