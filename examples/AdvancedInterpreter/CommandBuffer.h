/**
 * CommandBuffer.h
 *
 * Custom output stream to capture interpreter command output.
 * Buffers JSON command strings for processing and hardware execution.
 *
 * This allows the AdvancedInterpreter to intercept commands before
 * they go to Serial, parse them, and execute on real hardware.
 */

#pragma once

#include <Arduino.h>
#include <vector>

// ============================================================================
// COMMAND BUFFER CLASS
// ============================================================================

/**
 * Buffer to capture interpreter JSON command output
 */
class CommandBuffer {
private:
    std::vector<String> commands_;
    String currentLine_;
    bool enabled_;

public:
    CommandBuffer() : enabled_(true) {}

    /**
     * Enable/disable command buffering
     */
    void enable() { enabled_ = true; }
    void disable() { enabled_ = false; }
    bool isEnabled() const { return enabled_; }

    /**
     * Write character to buffer
     * Accumulates characters until newline, then stores complete command
     */
    void write(char c) {
        if (!enabled_) return;

        if (c == '\n') {
            // Complete command received - store it
            if (currentLine_.length() > 0) {
                // Only store if it looks like JSON (starts with '{')
                currentLine_.trim();
                if (currentLine_.startsWith("{")) {
                    commands_.push_back(currentLine_);
                }
                currentLine_ = "";
            }
        } else {
            currentLine_ += c;
        }
    }

    /**
     * Write string to buffer
     */
    void write(const char* str) {
        if (!enabled_) return;
        while (*str) {
            write(*str++);
        }
    }

    void write(const String& str) {
        write(str.c_str());
    }

    /**
     * Check if commands are available
     */
    bool hasCommands() const {
        return !commands_.empty();
    }

    /**
     * Get count of buffered commands
     */
    size_t count() const {
        return commands_.size();
    }

    /**
     * Get next command (FIFO)
     * Returns empty string if no commands available
     */
    String pop() {
        if (commands_.empty()) {
            return "";
        }
        String cmd = commands_.front();
        commands_.erase(commands_.begin());
        return cmd;
    }

    /**
     * Peek at next command without removing it
     */
    String peek() const {
        if (commands_.empty()) {
            return "";
        }
        return commands_.front();
    }

    /**
     * Clear all buffered commands
     */
    void clear() {
        commands_.clear();
        currentLine_ = "";
    }

    /**
     * Get total buffer size estimate (for debugging)
     */
    size_t getBufferSize() const {
        size_t total = 0;
        for (const auto& cmd : commands_) {
            total += cmd.length();
        }
        total += currentLine_.length();
        return total;
    }
};

// ============================================================================
// CUSTOM OUTPUT STREAM FOR INTERPRETER
// ============================================================================

/**
 * Custom output stream that captures to CommandBuffer
 * Used to redirect interpreter OUTPUT_STREAM
 */
class BufferedOutputStream {
private:
    CommandBuffer* buffer_;

public:
    BufferedOutputStream(CommandBuffer* buf) : buffer_(buf) {}

    // Stream operator for various types
    BufferedOutputStream& operator<<(const char* str) {
        if (buffer_) buffer_->write(str);
        return *this;
    }

    BufferedOutputStream& operator<<(const String& str) {
        if (buffer_) buffer_->write(str);
        return *this;
    }

    BufferedOutputStream& operator<<(char c) {
        if (buffer_) buffer_->write(c);
        return *this;
    }

    BufferedOutputStream& operator<<(int val) {
        if (buffer_) buffer_->write(String(val));
        return *this;
    }

    BufferedOutputStream& operator<<(unsigned int val) {
        if (buffer_) buffer_->write(String(val));
        return *this;
    }

    BufferedOutputStream& operator<<(long val) {
        if (buffer_) buffer_->write(String(val));
        return *this;
    }

    BufferedOutputStream& operator<<(unsigned long val) {
        if (buffer_) buffer_->write(String(val));
        return *this;
    }

    BufferedOutputStream& operator<<(double val) {
        if (buffer_) buffer_->write(String(val, 6));
        return *this;
    }

    // Handle std::endl and other manipulators
    BufferedOutputStream& operator<<(std::ostream& (*manip)(std::ostream&)) {
        if (buffer_) buffer_->write('\n');
        return *this;
    }
};

