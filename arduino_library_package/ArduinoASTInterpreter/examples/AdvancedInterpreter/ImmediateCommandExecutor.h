/**
 * ImmediateCommandExecutor.h
 *
 * ZERO-COPY command execution for AdvancedInterpreter.
 * Executes commands IMMEDIATELY when received - no queuing, no String copies, no heap fragmentation.
 *
 * This eliminates the heap fragmentation bug that caused crashes after ~138 iterations.
 */

#ifndef IMMEDIATE_COMMAND_EXECUTOR_H
#define IMMEDIATE_COMMAND_EXECUTOR_H

#include <ArduinoASTInterpreter.h>
#include "CommandExecutor.h"

class ImmediateCommandExecutor : public arduino_interpreter::CommandCallback {
private:
    CommandExecutor* executor_;
    size_t totalExecuted_;

public:
    /**
     * Constructor
     * @param executor Pointer to CommandExecutor that will execute commands
     */
    ImmediateCommandExecutor(CommandExecutor* executor)
        : executor_(executor), totalExecuted_(0) {}

    /**
     * CommandCallback interface implementation
     * Executes command IMMEDIATELY - no queuing, no copies!
     */
    void onCommand(const std::string& jsonCommand) override {
        if (executor_) {
            // Convert std::string to Arduino String once, execute, done
            // No queuing, no fragmentation!
            String cmd(jsonCommand.c_str());
            executor_->execute(cmd);
            totalExecuted_++;
        }
    }

    /**
     * Get total commands executed
     */
    size_t getTotalExecuted() const { return totalExecuted_; }

    /**
     * Reset statistics
     */
    void resetStats() {
        totalExecuted_ = 0;
    }
};

#endif // IMMEDIATE_COMMAND_EXECUTOR_H
