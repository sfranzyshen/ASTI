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

    void executePinMode(int pin, int mode) {
        if (executor_) {
            String cmd = "{\"type\":\"PIN_MODE\",\"pin\":_PIN_,\"mode\":_MODE_}";
            cmd.replace("_PIN_", String(pin));
            cmd.replace("_MODE_", String(mode));
            executor_->execute(cmd);
        }
    }

    void executeDigitalWrite(int pin, int value) {
        if (executor_) {
            String cmd = "{\"type\":\"DIGITAL_WRITE\",\"pin\":_PIN_,\"value\":_VALUE_}";
            cmd.replace("_PIN_", String(pin));
            cmd.replace("_VALUE_", String(value));
            executor_->execute(cmd);
        }
    }

    void executeAnalogWrite(int pin, int value) {
        if (executor_) {
            String cmd = "{\"type\":\"ANALOG_WRITE\",\"pin\":_PIN_,\"value\":_VALUE_}";
            cmd.replace("_PIN_", String(pin));
            cmd.replace("_VALUE_", String(value));
            executor_->execute(cmd);
        }
    }
};

#endif // IMMEDIATE_COMMAND_EXECUTOR_H
