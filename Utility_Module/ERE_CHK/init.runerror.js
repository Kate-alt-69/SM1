// ========================================
// START init.runerror.js
// ========================================
import fs from 'fs';
import path from 'path';

// Paths
const ereChkDir = path.resolve('./ERE_CHK');
const runErrorFile = path.join(ereChkDir, 'runerror.json');

// Ensure ERE_CHK directory exists
if (!fs.existsSync(ereChkDir)) {
    fs.mkdirSync(ereChkDir, { recursive: true });
    console.log(`[INIT] ✅ Created directory: ${ereChkDir}`);
}

// Default runerror.json structure
const defaultData = {
    PID: null,
    PIDNAME: null,
    STATUS: 'IDLE', // Other states: RUNNING, ERROR, KILLED
    LAST_UPDATED: new Date().toISOString()
};

// Create or overwrite file
fs.writeFileSync(runErrorFile, JSON.stringify(defaultData, null, 4));

console.log(`[INIT] ✅ runerror.json initialized at: ${runErrorFile}`);
console.log(`[INIT] Contents:`);
console.log(defaultData);

// ========================================
// END init.runerror.js
// ========================================
