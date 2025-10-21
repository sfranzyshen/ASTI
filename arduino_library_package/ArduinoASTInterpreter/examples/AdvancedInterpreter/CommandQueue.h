/**
 * CommandQueue.h
 *
 * Command queue for AdvancedInterpreter that implements CommandCallback interface.
 * Receives commands from interpreter and queues them for processing by the parent app.
 *
 * This allows the interpreter to generate commands without blocking, while the parent
 * app processes them at its own pace (including step-by-step execution).
 */

#ifndef COMMAND_QUEUE_H
#define COMMAND_QUEUE_H

#include <ArduinoASTInterpreter.h>
#include <vector>
#include <string>

class CommandQueue : public arduino_interpreter::CommandCallback {
private:
    std::vector<std::string> queue_;
    size_t maxSize_;
    size_t totalReceived_;
    size_t totalProcessed_;

public:
    /**
     * Constructor
     * @param maxSize Maximum queue size (default: 1000 commands)
     */
    CommandQueue(size_t maxSize = 1000)
        : maxSize_(maxSize), totalReceived_(0), totalProcessed_(0) {}

    /**
     * CommandCallback interface implementation
     * Called by interpreter to enqueue a command
     */
    void onCommand(const std::string& jsonCommand) override {
        if (queue_.size() < maxSize_) {
            queue_.push_back(jsonCommand);
            totalReceived_++;
        } else {
            Serial.println("⚠ WARNING: Command queue full, dropping command");
        }
    }

    /**
     * Check if queue has commands
     */
    bool hasCommands() const {
        return !queue_.empty();
    }

    /**
     * Get number of queued commands
     */
    size_t size() const {
        return queue_.size();
    }

    /**
     * Pop next command from queue
     * Returns empty string if queue is empty
     */
    String pop() {
        if (queue_.empty()) {
            return "";
        }

        std::string cmd = queue_.front();
        queue_.erase(queue_.begin());
        totalProcessed_++;
        return String(cmd.c_str());
    }

    /**
     * Peek at next command without removing it
     */
    String peek() const {
        if (queue_.empty()) {
            return "";
        }
        return String(queue_.front().c_str());
    }

    /**
     * Clear all queued commands
     */
    void clear() {
        queue_.clear();
    }

    /**
     * Get statistics
     */
    size_t getTotalReceived() const { return totalReceived_; }
    size_t getTotalProcessed() const { return totalProcessed_; }
    size_t getPending() const { return queue_.size(); }

    /**
     * Reset statistics
     */
    void resetStats() {
        totalReceived_ = 0;
        totalProcessed_ = 0;
    }
};

#endif // COMMAND_QUEUE_H
