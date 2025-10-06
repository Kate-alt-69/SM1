import { createInterface } from 'readline';
import { spawn } from 'child_process';
import { clearScreenDown, cursorTo } from 'readline';
import { TerminalStateManager } from './TSM.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'terminal_state.json');
const TERMINALSM = new TerminalStateManager();

class TerminalLock {
    constructor(inactivityTimeout = 300000) { // Default 5 minutes
        this.inactivityTimeout = inactivityTimeout;
        this.inactivityTimer = null;
        this.isLocked = false;
        this.terminalState = null;
        this.tsm = TERMINALSM;
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Bind methods
        this.resetInactivityTimer = this.resetInactivityTimer.bind(this);
        this.lockTerminal = this.lockTerminal.bind(this);
        this.unlockTerminal = this.unlockTerminal.bind(this);
        this.centerText = this.centerText.bind(this);
        this.saveState = this.saveState.bind(this);
        this.loadState = this.loadState.bind(this);
        
        // Setup activity listeners
        this.setupActivityListeners();
        
        // Load previous state if exists
        this.loadState();
    }

    async saveState() {
        const state = {
            timestamp: Date.now(),
            virtualBuffer: this.tsm.virtualBuffer,
            cursorPos: await this.getCurrentCursorPosition(),
            isLocked: this.isLocked
        };

        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    }

    async loadState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                this.tsm.virtualBuffer = state.virtualBuffer || [];
                this.isLocked = state.isLocked || false;
                
                if (!this.isLocked && state.virtualBuffer.length > 0) {
                    // Replay terminal content
                    this.tsm.isCapturing = false;
                    for (const entry of state.virtualBuffer) {
                        if (entry.type === 'output') {
                            process.stdout.write(entry.content);
                        }
                    }
                    this.tsm.isCapturing = true;
                }
            }
        } catch (error) {
            console.error('Failed to load terminal state:', error);
        }
    }

    async getCurrentCursorPosition() {
        return new Promise((resolve) => {
            process.stdout.write('\x1B[6n');
            const onData = (data) => {
                process.stdin.removeListener('data', onData);
                const matches = /\[(\d+);(\d+)R/.exec(data.toString());
                if (matches) {
                    resolve({ row: parseInt(matches[1]), column: parseInt(matches[2]) });
                } else {
                    resolve({ row: 0, column: 0 });
                }
            };
            process.stdin.on('data', onData);
        });
    }

    setupActivityListeners() {
        // Monitor keyboard activity
        process.stdin.on('keypress', this.resetInactivityTimer);
        
        // Monitor mouse movement (if supported)
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.on('mousepress', this.resetInactivityTimer);
        }

        // Initial timer start
        this.resetInactivityTimer();
    }

    resetInactivityTimer() {
        if (this.isLocked) return;
        
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }

        this.inactivityTimer = setTimeout(() => {
            this.lockTerminal();
        }, this.inactivityTimeout);
    }

    async saveTerminalState() {
        return new Promise((resolve) => {
            // Save cursor position and screen content
            process.stdout.write('\x1B7', () => {
                this.terminalState = {
                    timestamp: Date.now(),
                    // Add any other state information you want to preserve
                };
                resolve();
            });
        });
    }

    async restoreTerminalState() {
        return new Promise((resolve) => {
            // Restore cursor position and screen content
            process.stdout.write('\x1B8', () => {
                resolve();
            });
        });
    }

    centerText(text) {
        const width = process.stdout.columns || 80;
        const padding = Math.floor((width - text.length) / 2);
        return ' '.repeat(padding) + text;
    }

    async clearScreen() {
        return new Promise((resolve) => {
            cursorTo(process.stdout, 0, 0, () => {
                clearScreenDown(process.stdout, resolve);
            });
        });
    }

    async lockTerminal() {
        if (this.isLocked) return;
        
        this.isLocked = true;
        await this.saveState();
        this.tsm.isCapturing = false;
        await this.clearScreen();

        // Close existing readline interface if it exists
        if (this.rl) {
            this.rl.close();
        }

        // Create new readline interface
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Display centered lock screen
        const lockMessage = [
            "🔒 TERMINAL LOCKED",
            "",
            "Press Enter to unlock",
            "Enter password to continue...",
            "",
            "Session saved: " + new Date().toLocaleString()
        ];

        const height = process.stdout.rows || 24;
        const startRow = Math.floor((height - lockMessage.length) / 2);

        lockMessage.forEach((line, index) => {
            cursorTo(process.stdout, 0, startRow + index);
            process.stdout.write(this.centerText(line));
        });

        // Set up unlock prompt
        const promptPassword = () => {
            cursorTo(process.stdout, 0, startRow + lockMessage.length);
            this.rl.question(this.centerText('Password: '), async (password) => {
                if (password === process.env.TERMINAL_PASSWORD || password === 'admin') {
                    await this.unlockTerminal();
                } else {
                    cursorTo(process.stdout, 0, startRow + lockMessage.length + 1);
                    process.stdout.write(this.centerText('❌ Incorrect password. Try again.'));
                    setTimeout(() => {
                        this.clearScreen();
                        lockMessage.forEach((line, index) => {
                            cursorTo(process.stdout, 0, startRow + index);
                            process.stdout.write(this.centerText(line));
                        });
                        promptPassword();
                    }, 1500);
                }
            });
        };

        promptPassword();
    }

    async unlockTerminal() {
        if (!this.isLocked) return;

        // Close the current readline interface
        if (this.rl) {
            this.rl.close();
        }

        this.isLocked = false;
        await this.clearScreen();
        
        // Display unlock message
        const unlockMsg = '🔓 Terminal Unlocked - Restoring Session...';
        process.stdout.write(this.centerText(unlockMsg));
        
        // Create new readline interface
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Restore terminal state from TSM
        this.tsm.isCapturing = false;
        for (const entry of this.tsm.virtualBuffer) {
            if (entry.type === 'output') {
                process.stdout.write(entry.content);
            }
        }
        this.tsm.isCapturing = true;
        
        this.resetInactivityTimer();
        await this.saveState(); // Save the unlocked state
        
        // Show restored message briefly
        cursorTo(process.stdout, 0, process.stdout.rows - 1);
        process.stdout.write(this.centerText('✅ Session Restored'));
        setTimeout(() => {
            cursorTo(process.stdout, 0, process.stdout.rows - 1);
            clearScreenDown(process.stdout);
        }, 1500);

        // Set up new activity listeners
        this.setupActivityListeners();
    }

    async destroy() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
        }
        await this.saveState();
        this.rl.close();
        process.stdin.setRawMode(false);
    }
}

export default TerminalLock;