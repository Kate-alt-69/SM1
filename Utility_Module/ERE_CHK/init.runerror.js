// ========================================
// START init.runerror.js (Updated)
// ========================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve current script directory (__dirname equivalent in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ereChkDir = path.join(__dirname, 'ERE_CHK'); // Create inside current directory
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
