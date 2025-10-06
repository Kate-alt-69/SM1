// KNinput.manager.js – Global Input Manager with Auto-Recovery Check
import fs from 'fs';
import path from 'path';
const settingsPath = path.resolve('./config/settings.json');
let inputEnabled = true; 
let checkInterval = null;
let isSystemLocked = false; // Add lock state tracking
let terminalBuffer = [];
let inputHistory = [];
function loadSettings() {
    if (!fs.existsSync(settingsPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
        return {};
    }
}
function saveSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf-8');
}
/**
 * Reads settings.json and updates the input state.
 */
export function refreshInputState(silent = false) {
    const settings = loadSettings();
    const shouldEnable = settings["input.from"] !== 'inprompt';

    if (inputEnabled !== shouldEnable) {
        inputEnabled = shouldEnable;
        if (!silent) console.log(' ')
        };
    // If disabled, start silent auto-check loop
    if (!inputEnabled) {
        startDisabledCheck();
    } else {
        stopDisabledCheck();
    }
}
/**
 * Starts a background loop that checks settings.json every 5s while disabled.
 */
function startDisabledCheck() {
    if (checkInterval) return; // Already running
    checkInterval = setInterval(() => {
        const settings = loadSettings();
        if (settings["input.from"] !== 'inprompt') {
            inputEnabled = true;
            stopDisabledCheck();
            console.log(`[INPUT_MANAGER] Auto-recovered: Input ENABLED via settings.json`);
        }
    }, 5000);
}
/**
 * Stops the disabled state background check.
 */
function stopDisabledCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}
/**
 * Manually toggle input on/off and save state to settings.json.
 */
export function toggleInput(enable) {
    inputEnabled = enable;
    const settings = loadSettings();
    settings["input.from"] = enable ? 'inmanage' : 'inprompt';
    saveSettings(settings);
    if (!enable) {
        startDisabledCheck();
    } else {
        stopDisabledCheck();
    }
}
/**
 * Directly set input source and refresh state.
 */
export function setInputSource(source) {
    const settings = loadSettings();
    settings["input.from"] = source;
    saveSettings(settings);
    refreshInputState();
}
/**
 * Returns whether input is currently enabled.
 */
export function isInputEnabled() {
    return inputEnabled && !isSystemLocked;
}
/**
 * Main stdin input handler — silent if disabled.
 */
export function handleInput(data) {
    if (!inputEnabled) return; // ❌ Do nothing when disabled

    const input = data.trim();
    if (input) {
        console.log(`${input}`);
        // Add command routing here if needed
    }
}
// Initial state check
refreshInputState(true);
// stdin listener
let listenerInitialized = false;
export function initInputListener() {
    if (listenerInitialized) return;
    listenerInitialized = true;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => handleInput(chunk));
}
export function setLockState(locked) {
    isSystemLocked = locked;
    if (locked) {
        terminalBuffer = [];
        inputHistory = [];
        inputEnabled = false;
    } else {
        inputEnabled = true;
    }
    const settings = loadSettings();
    settings["input.from"] = locked ? 'inprompt' : 'inmanage';
    saveSettings(settings);
}

export function storeOutput(output) {
    if (!isSystemLocked) return;
    terminalBuffer.push({
        type: 'output',
        content: output,
        timestamp: Date.now()
    });
}

export function storeInput(input) {
    if (!isSystemLocked) return;
    inputHistory.push({
        type: 'input',
        content: input,
        timestamp: Date.now()
    });
}

export function getStoredContent() {
    return [...terminalBuffer, ...inputHistory]
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(entry => entry.content)
        .join('\n');
}

export function clearBuffer() {
    terminalBuffer = [];
    inputHistory = [];
}

export function setRawMode(enabled) {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(enabled);
        if (enabled) {
            process.stdin.resume();
        } else {
            process.stdin.pause();
        }
    }
}

export function isLocked() {
    return isSystemLocked;
}

export function updateActivity() {
    if (global.tsm) {
        global.tsm.updateActivity();
    }
}

export default { 
    handleInput, 
    isInputEnabled, 
    setInputSource, 
    toggleInput, 
    refreshInputState,
    isLocked,
    setLockState,
    updateActivity,
    storeOutput,
    storeInput,
    getStoredContent,
    clearBuffer,
    setRawMode
};