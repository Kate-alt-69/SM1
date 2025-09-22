// CMDstart.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc'); // Full reset
    console.log('[KERNEL] Try # help for information');
  }
}
export default function CMDstart() {
  const bcodeDir = path.resolve(__dirname, '../Bcode'),
        dcbPath = path.join(bcodeDir, 'DCB.js'),
        pidPath = path.resolve(__dirname, 'PID.json'),
        settingsPath = path.resolve(__dirname, '../config/settings.json');

  let processTitle = 'DISCORDSERVERMANAGER', previousPID = null;

  if (!fs.existsSync(pidPath)) fs.writeFileSync(pidPath, JSON.stringify({}, null, 2));

  try {
    const config = JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
    if (typeof config.START === 'string') processTitle = config.START;
    if (typeof config.PID === 'number') previousPID = config.PID;
  } catch { console.warn('[CMDstart] ⚠️ Failed to parse PID.json. Using defaults.'); }

  if (previousPID) {
    try {
      process.kill(previousPID, 0);
      console.log(`[CMDstart] ⛔ Bot is already running with PID: ${previousPID}`);
      return;
    } catch {}
  }

  // Read settings.json for alaRAM and alaCPU
  let alaRAM = 1024; // default 1 GB (MB)
  let alaCPU = 10;   // default 10%
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.alaRAM && !isNaN(settings.alaRAM)) alaRAM = parseInt(settings.alaRAM, 10);
      if (settings.alaCPU && !isNaN(settings.alaCPU)) alaCPU = parseInt(settings.alaCPU, 10);
    }
  } catch (err) {
    console.warn(`[CMDstart] ⚠️ Could not read settings.json, using defaults. (${err.message})`);
  }

  console.log(`[CMDstart] 🚀 Launching bot from: ${dcbPath}`);
  console.log(`[CMDstart] 🆔 Setting process title: ${processTitle}`);
  console.log(`[CMDstart] 🧠 Limits: RAM=${alaRAM} MB, CPU=${alaCPU}%`);

  let child;
  if (os.platform() === 'win32') {
  // Windows: limit RAM via --max-old-space-size
  const ramArg = `--max-old-space-size=${alaRAM}`;
  child = spawn('node', [ramArg, dcbPath], { cwd: bcodeDir, detached: true, stdio: 'inherit' });
} else {
  // Linux/macOS: spawn normally, then apply cpulimit externally
  const ramArg = `--max-old-space-size=${alaRAM}`;
  child = spawn('node', [ramArg, dcbPath], { cwd: bcodeDir, detached: true, stdio: 'inherit' });

  // Apply CPU limit safely
  const cpuLimiter = spawn('cpulimit', ['-p', String(child.pid), '-l', String(alaCPU)], { detached: true });
  
  cpuLimiter.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[CMDstart] ⚠️ cpulimit not found! CPU limit could not be applied.');
      console.warn('[CMDstart] ℹ️ Linux/Mac: install cpulimit via `sudo apt install cpulimit` (Debian/Ubuntu/Mint)');
      console.warn('[CMDstart] ℹ️ Windows: cpulimit not available natively; CPU limiting skipped.');
    } else {
      console.warn(`[CMDstart] ⚠️ Error starting cpulimit: ${err.message}`);
    }
  });

  cpuLimiter.unref();
  console.log(`[CMDstart] 🖥️ Attempted to apply CPU limit: ${alaCPU}%`);
}


  const newPidData = {
    START: processTitle,
    PID: child.pid,
    TIMESTAMP: new Date().toISOString(),
    FILE: dcbPath,
    botrunning: true
  };

  try {
    fs.writeFileSync(pidPath, JSON.stringify(newPidData, null, 2));
    console.log(`[CMDstart] 💾 Saved correct PID (${child.pid}) and marked bot as running`);
  } catch (err) {
    console.error(`[CMDstart] ❌ Failed to write PID.json: ${err.message}`);
  }

  child.on('exit', (code, signal) => {
    console.log(`[CMDstart] ⚰️ Bot exited. Code=${code}, Signal=${signal}`);
    try {
      const data = JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
      data.botrunning = false;
      fs.writeFileSync(pidPath, JSON.stringify(data, null, 2));
    } catch {}
  });
}

//,,,,,,,,,,,,,,,,,,,,,,,,|
// END OF CMDstart.js     |
//```````````````````````|
