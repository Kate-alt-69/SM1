//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// CMDstart.js (in Utility_Module) |
//`````````````````````````````````|

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function CMDstart() {
  const bcodeDir = path.resolve(__dirname, '../Bcode');
  const dcbPath = path.join(bcodeDir, 'DCB.js');
  const pidPath = path.resolve(__dirname, 'PID.json');

  let processTitle = 'DISCORDSERVERMANAGER';
  let previousPID = null;

  // Ensure PID.json exists (create if not)
  if (!fs.existsSync(pidPath)) {
    fs.writeFileSync(pidPath, JSON.stringify({}, null, 2));
  }

  // Attempt to read existing PID config
  try {
    const config = JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
    if (typeof config.START === 'string') processTitle = config.START;
    if (typeof config.PID === 'number') previousPID = config.PID;
  } catch (err) {
    console.warn('[CMDstart] ⚠️ Failed to parse PID.json. Using defaults.');
  }

  // Check if bot is already running by previous PID
  if (previousPID) {
    try {
      process.kill(previousPID, 0);
      console.log(`[CMDstart] ⛔ Bot is already running with PID: ${previousPID}`);
      return;
    } catch {
      // Previous PID not alive — continue
    }
  }

  console.log(`[CMDstart] 🚀 Launching bot from: ${dcbPath}`);
  console.log(`[CMDstart] 🆔 Setting process title: ${processTitle}`);
  console.log(`[CMDstart] 🧠 DCB.js must set: process.title = "${processTitle}"`);

  const child = spawn('node', [dcbPath], {
    cwd: bcodeDir,
    detached: true,
    stdio: 'inherit' // ✅ Allow logging from child process to same console
  });

  const actualPID = child.pid;

  const newPidData = {
    START: processTitle,
    PID: actualPID,
    TIMESTAMP: new Date().toISOString(),
    FILE: dcbPath,
    botrunning: true
  };

  try {
    fs.writeFileSync(pidPath, JSON.stringify(newPidData, null, 2));
    console.log(`[CMDstart] 💾 Saved correct PID (${actualPID}) and marked bot as running`);
  } catch (err) {
    console.error(`[CMDstart] ❌ Failed to write PID.json: ${err.message}`);
  }

  child.unref(); // Make sure it runs independently but still logs
}

//,,,,,,,,,,,,,,,,,,,|
// END OF CMDstart.js|
//```````````````````|