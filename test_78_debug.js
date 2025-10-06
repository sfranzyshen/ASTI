#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load modules
const { parse, exportCompactAST } = require('./libs/ArduinoParser/src/ArduinoParser.js');
const { examplesFiles } = require('./examples.js');
const { oldTestFiles } = require('./old_test.js');
const { neopixelFiles } = require('./neopixel.js');
const MockDataManager = require('./src/javascript/MockDataManager.js');

// Debug log file
const logFile = 'test_78_debug.log';
function log(msg) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(logFile, logMsg);
    process.stderr.write(logMsg); // Also write to stderr
}

// Clear log file
if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
}

log('=== TEST 78 DEBUG SESSION STARTED ===');

// Get Test 78
const allExamples = [...examplesFiles, ...oldTestFiles, ...neopixelFiles];
const example = allExamples[78];

log(`Test name: ${example.name}`);
log(`Code size: ${example.content.length} bytes`);

async function debugTest78() {
    try {
        log('Parsing AST...');
        const ast = parse(example.content);
        log('AST parsed successfully');

        log('Exporting CompactAST...');
        const compactAST = exportCompactAST(ast);
        log(`CompactAST size: ${compactAST.byteLength} bytes`);

        log('Loading ASTInterpreter...');
        const { ASTInterpreter } = require('./src/javascript/ASTInterpreter.js');
        log('ASTInterpreter loaded');

        log('Creating MockDataManager...');
        const mockData = new MockDataManager();
        log('MockDataManager created');

        log('Creating interpreter...');
        const interpreter = new ASTInterpreter(ast, {
            verbose: false,
            debug: false,
            stepDelay: 0,
            maxLoopIterations: 1,
            mockDataManager: mockData
        });
        log('Interpreter created');

        const commands = [];
        let done = false;
        let commandCount = 0;

        interpreter.onCommand = (cmd) => {
            commands.push(cmd);
            commandCount++;
            log(`CMD ${commandCount}: ${cmd.type}${cmd.message ? ' - ' + cmd.message : ''}`);

            // Handle requests
            switch (cmd.type) {
                case 'ANALOG_READ_REQUEST':
                    const analogValue = mockData.getAnalogReadValue(cmd.pin || 0);
                    log(`  -> Scheduling analogRead response: ${analogValue}`);
                    setTimeout(() => {
                        log(`  -> Delivering analogRead response: ${analogValue}`);
                        interpreter.handleResponse(cmd.requestId, analogValue);
                    }, 5);
                    break;
                case 'DIGITAL_READ_REQUEST':
                    const digitalValue = mockData.getDigitalReadValue(cmd.pin || 0);
                    log(`  -> Scheduling digitalRead response: ${digitalValue}`);
                    setTimeout(() => {
                        log(`  -> Delivering digitalRead response: ${digitalValue}`);
                        interpreter.handleResponse(cmd.requestId, digitalValue);
                    }, 5);
                    break;
                case 'MILLIS_REQUEST':
                    const millisValue = mockData.getMillisValue();
                    log(`  -> Scheduling millis response: ${millisValue}`);
                    setTimeout(() => {
                        log(`  -> Delivering millis response: ${millisValue}`);
                        interpreter.handleResponse(cmd.requestId, millisValue);
                    }, 5);
                    break;
                case 'MICROS_REQUEST':
                    const microsValue = mockData.getMicrosValue();
                    log(`  -> Scheduling micros response: ${microsValue}`);
                    setTimeout(() => {
                        log(`  -> Delivering micros response: ${microsValue}`);
                        interpreter.handleResponse(cmd.requestId, microsValue);
                    }, 5);
                    break;
                case 'LOOP_END':
                    log('  -> LOOP_END received, setting done=true');
                    done = true;
                    break;
                case 'PROGRAM_END':
                    log('  -> PROGRAM_END received, setting done=true');
                    done = true;
                    break;
            }
        };

        interpreter.onError = (error) => {
            log(`ERROR: ${error.message}`);
            done = true;
        };

        log('Starting interpreter...');
        interpreter.start();

        log('Starting polling loop...');
        const startTime = Date.now();
        let timedOut = false;

        const timeout = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            log(`TIMEOUT after ${elapsed}ms, commandCount=${commandCount}, done=${done}`);
            timedOut = true;
            done = true;
        }, 10000);

        let checkCount = 0;
        const check = () => {
            checkCount++;

            if (checkCount % 1000 === 0) {
                const elapsed = Date.now() - startTime;
                log(`check() iteration ${checkCount}, elapsed=${elapsed}ms, done=${done}, commandCount=${commandCount}`);
            }

            if (done) {
                const elapsed = Date.now() - startTime;
                log(`done=true at check ${checkCount}, elapsed=${elapsed}ms, commandCount=${commandCount}`);
                clearTimeout(timeout);

                if (timedOut) {
                    log('RESULT: TIMEOUT FAILURE');
                } else {
                    log(`RESULT: SUCCESS with ${commands.length} commands`);
                }

                log('=== TEST 78 DEBUG SESSION COMPLETE ===');
                process.exit(timedOut ? 1 : 0);
            } else if (checkCount > 10000) {
                log(`Infinite check loop at ${checkCount} iterations`);
                clearTimeout(timeout);
                log('=== TEST 78 DEBUG SESSION COMPLETE ===');
                process.exit(2);
            } else {
                setTimeout(check, 1);
            }
        };

        check();

    } catch (error) {
        log(`FATAL ERROR: ${error.message}`);
        log(`Stack: ${error.stack}`);
        log('=== TEST 78 DEBUG SESSION COMPLETE ===');
        process.exit(3);
    }
}

debugTest78();
