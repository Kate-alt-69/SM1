// ========================================
// START start.check.js
// ========================================
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Paths
const logDir = path.resolve('./logs');
const logFile = path.join(logDir, `startup-check-${Date.now()}.txt`);
const botFile = path.resolve('./Bcode/DCB.js');
const pidFile = path.resolve('./config/runerror.json');

// Ensure logs folder exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Helper to get timestamp
const getTimestamp = () => new Date().toISOString();

// Error detection patterns
const errorPatterns = [
    { key: '{ERROR}', type: 'GENERAL ERROR' },
    { key: 'Cannot find module', type: 'MISSING MODULE' },
    { key: 'SyntaxError', type: 'SYNTAX ERROR' },
    { key: 'Token loading failed', type: 'TOKEN ERROR' },
    { key: 'Startup error', type: 'STARTUP ERROR' }
];

// Storage for captured logs and errors
let rawLogs = '';
let errorLogs = [];
let errorDetected = false;
let safeguardTimeout = null;
let cleanExitTimeout = null;

// Spawn bot process silently with custom process title
console.log(`[CHECK] ▶ Running bot in silent mode with custom process name (RUNERRORDISCORDSM1)...`);

const child = spawn('node', ['--title', 'RUNERRORDISCORDSM1', botFile], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
});

// Save PID and name to runerror.json
const pidData = {
    PID: child.pid,
    PIDNAME: 'RUNERRORDISCORDSM1',
    STARTED_AT: getTimestamp()
};
fs.writeFileSync(pidFile, JSON.stringify(pidData, null, 2));

// ⏱ 30s clean exit safeguard if no errors are detected
cleanExitTimeout = setTimeout(() => {
    if (!errorDetected) {
        console.log(`[CHECK] ⏱ No errors detected in 30s. Shutting down bot process (PID: ${child.pid})...`);
        try {
            process.kill(child.pid, 'SIGKILL');
            console.log(`[CHECK] ✅ Bot stopped after clean 30s run (no errors).`);
        } catch (killErr) {
            console.error(`[CHECK] ❌ Failed to kill process: ${killErr.message}`);
        }
        analyzeLogs(rawLogs); // still generate log
        process.exit(0); // exit script too
    }
}, 30000);

// Capture stdout
child.stdout.on('data', (data) => {
    const text = data.toString();
    rawLogs += text + '\n';
    checkForErrors(text);
});

// Capture stderr
child.stderr.on('data', (data) => {
    const text = data.toString();
    rawLogs += text + '\n';
    checkForErrors(text);
});

// Detect errors and set safeguard
function checkForErrors(text) {
    if (!errorDetected) {
        for (const pattern of errorPatterns) {
            if (text.includes(pattern.key)) {
                errorDetected = true;
                console.log(`[CHECK] ⚠ Error detected, starting 10-second safeguard timer...`);
                safeguardTimeout = setTimeout(() => {
                    console.log(`[CHECK] ⏱ Safeguard triggered - Force killing bot process (PID: ${child.pid})`);
                    try {
                        process.kill(child.pid, 'SIGKILL');
                        console.log(`[CHECK] ✅ Process killed successfully`);
                    } catch (killErr) {
                        console.error(`[CHECK] ❌ Failed to kill process: ${killErr.message}`);
                    }
                }, 10000); // 10-second timer
                break;
            }
        }
    }
}

// Process when bot exits
child.on('close', (code) => {
    if (safeguardTimeout) clearTimeout(safeguardTimeout);
    if (cleanExitTimeout) clearTimeout(cleanExitTimeout);
    console.log(`[CHECK] Bot process exited with code ${code}`);
    analyzeLogs(rawLogs);
});

// Analyze logs for errors
function analyzeLogs(logs) {
    const lines = logs.split('\n').filter(line => line.trim());
    let errorCount = 0;

    for (const line of lines) {
        for (const pattern of errorPatterns) {
            if (line.includes(pattern.key)) {
                errorCount++;
                errorLogs.push(formatErrorBlock(line, pattern.type, logs));
            }
        }
    }

    const status = errorCount === 0 ? 'SUCCESS' : 'FAILED';
    const summary = `
SUMMARY
──────────────────────────────
TOTAL ERRORS : ${errorCount}
SUGGESTIONS  :
${errorCount > 0 ? '- Fix the issues listed above before restarting the bot' : '- No issues detected'}
`;

    const report = `
[STARTUP ERROR REPORT]
TIMESTAMP : ${getTimestamp()}
BOT STATUS : ${status}
BOT PID    : ${pidData.PID}
BOT NAME   : ${pidData.PIDNAME}

${errorLogs.length > 0 ? errorLogs.join('\n\n') : '✅ No startup errors detected.'}

${summary}
`;

    fs.writeFileSync(logFile, report.trim());
    console.log(`[CHECK] Report generated at: ${logFile}`);
}

// Format individual error block
function formatErrorBlock(line, type, logs) {
    const fileMatch = logs.match(/at\s+(.*?\.js):(\d+):\d+/);
    const sourceFile = fileMatch ? fileMatch[1] : 'Unknown';
    const lineNumber = fileMatch ? fileMatch[2] : 'Unknown';

    return `
ERROR #${errorLogs.length + 1}
──────────────────────────────
SOURCE FILE   : ${sourceFile}
ERROR TYPE    : ${type}
ERROR MESSAGE : ${line.trim()}
LOCATION      : ${fileMatch ? `line ${lineNumber}` : 'Not available'}
STACK TRACE   :
    ${extractStackTrace(logs)}
`.trim();
}

// Extract stack trace snippet
function extractStackTrace(logs) {
    const traceLines = logs.split('\n').filter(l => l.includes('at ')).slice(0, 5);
    return traceLines.length > 0 ? traceLines.join('\n    ') : 'No stack trace available';
}

// ========================================
// END start.check.js
// ========================================
