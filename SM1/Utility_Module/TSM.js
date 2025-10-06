import fs from 'fs';
class TerminalStateManager {
    constructor() {
        this.virtualBuffer = [];
        this.isCapturing = true;
        this.activityCallbacks = new Set();
        this.setupOutputCapture();
    }

    setupOutputCapture() {
        const oldWrite = process.stdout.write;
        process.stdout.write = (...args) => {
            this.virtualBuffer.push({
                timestamp: Date.now(),
                content: args[0],
                type: 'output'
            });

            // Only write if capturing is enabled
            if (this.isCapturing) {
                return oldWrite.apply(process.stdout, args);
            }
            return true;
        };
    }

    hookStdout() {
        const originalWrite = process.stdout.write;
        process.stdout.write = (...args) => {
            // Always capture to virtual buffer
            if (typeof args[0] === 'string') {
                this.virtualBuffer.push({
                    timestamp: Date.now(),
                    content: args[0],
                    type: 'output'
                });
                // Call output callback if defined
                if (this.onOutput) this.onOutput(args[0]);
            }
            // Only write to actual terminal if not suppressed
            if (this.isCapturing) {
                return originalWrite.apply(process.stdout, args);
            }
            return true;
        };
    }

    captureInput(input) {
        this.virtualBuffer.push({
            timestamp: Date.now(),
            content: input,
            type: 'input'
        });
    }

    getBufferContent() {
        return this.virtualBuffer.map(entry => entry.content).join('');
    }

    setOnOutput(callback) {
        this.onOutput = callback;
    }

    clearBuffer() {
        this.virtualBuffer = [];
    }

    suppressOutput() {
        this.isCapturing = false;
    }

    resumeOutput() {
        this.isCapturing = true;
        // Replay buffer if needed
        if (this.virtualBuffer.length > 0) {
            const content = this.getBufferContent();
            process.stdout.write(content);
        }
    }

    updateActivity() {
        this.activityCallbacks.forEach(cb => cb());
    }

    onActivity(callback) {
        this.activityCallbacks.add(callback);
    }

    offActivity(callback) {
        this.activityCallbacks.delete(callback);
    }
}

// Export both the class and a singleton instance
export { TerminalStateManager };
export const terminalManager = new TerminalStateManager();
export default TerminalStateManager;