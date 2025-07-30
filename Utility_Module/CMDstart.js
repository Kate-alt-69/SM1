//`````````````````````````|
// CMDstart.js START       |
//,,,,,,,,,,,,,,,,,,,,,,,,,|

import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url'; import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url), __dirname = path.dirname(__filename);

export default function CMDstart() {
  const bcodeDir = path.resolve(__dirname, '../Bcode'),
        dcbPath = path.join(bcodeDir, 'DCB.js'),
        pidPath = path.resolve(__dirname, 'PID.json');

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

  console.log(`[CMDstart] 🚀 Launching bot from: ${dcbPath}`);
  console.log(`[CMDstart] 🆔 Setting process title: ${processTitle}`);
  console.log(`[CMDstart] 🧠 DCB.js must set: process.title = "${processTitle}"`);

  const child = spawn('node', [dcbPath], { cwd: bcodeDir, detached: true, stdio: 'inherit' });

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

  child.unref();
}

//,,,,,,,,,,,,,,,,,,,,,,,,|
// END OF CMDstart.js     |
//`````````````````````````|
