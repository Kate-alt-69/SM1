//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// CMDstop.js (in Utility_Module) |
//````````````````````````````````

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import process from 'process';
import {
  bcodePath,
  commandsJsonPath,
  cmdSnapshotPath
} from '../defined/path-define.js';

const rootDir = bcodePath.replace(/[/\\]Bcode$/, '');
const pidPath = path.resolve('./Utility_Module/PID.json');
const tokenPath = path.resolve('./Utility_Module/token.json');

export default function CMDstop({ restart = false, shutdown = false } = {}) {
  console.log('[CMDstop] 🛑 Attempting to stop bot process...');

  let killed = false, pid = null, title = 'DISCORDSERVERMANAGER', botrunning = false;

  if (fs.existsSync(pidPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
      pid = typeof data.PID === 'number' ? data.PID : null;
      title = typeof data.START === 'string' ? data.START : title;
      botrunning = typeof data.botrunning === 'boolean' ? data.botrunning : false;
    } catch (err) {
      console.error(`[CMDstop] ❌ Failed to read PID.json: ${err.message}`);
    }
  }

  if (botrunning && pid) {
    try {
      process.kill(pid, 0);
      process.kill(pid);
      console.log(`[CMDstop] ✅ Killed bot process with PID: ${pid}`);
      killed = true;
    } catch {
      console.warn(`[CMDstop] ⚠️ PID ${pid} not running anymore.`);
    }
  }

  if (!killed) {
    try {
      const output = execSync('ps -ef').toString().split('\n');
      for (const line of output) {
        if (line.includes('node') && line.includes('DCB.js')) {
          const parts = line.trim().split(/\s+/);
          const foundPid = parts[1];
          execSync(`kill ${foundPid}`);
          console.log(`[CMDstop] ✅ Killed bot by script name: DCB.js (PID: ${foundPid})`);
          killed = true;
          break;
        }
      }
      if (!killed) console.log('[CMDstop] ⚠️ No matching DCB.js process found.');
    } catch (err) {
      console.error(`[CMDstop] ❌ Error scanning for DCB.js process: ${err.message}`);
    }
  }

  try {
    if (fs.existsSync(pidPath)) {
      const data = JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
      data.botrunning = false;
      fs.writeFileSync(pidPath, JSON.stringify(data, null, 2));
      console.log(`[CMDstop] 📝 Updated PID.json: botrunning = false`);
    }
  } catch (err) {
    console.error(`[CMDstop] ❌ Failed to update PID.json: ${err.message}`);
  }

  if (shutdown) {
    try {
      if (fs.existsSync(tokenPath)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        if ('temp' in tokenData) {
          delete tokenData.temp;
          fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
          console.log(`[CMDstop] 🔐 Removed temporary token from token.json`);
        } else {
          console.log(`[CMDstop] ℹ️ No temp token found in token.json`);
        }
      }
    } catch (err) {
      console.error(`[CMDstop] ❌ Failed to update token.json: ${err.message}`);
    }

    if (botrunning && !killed) {
      console.log('[CMDstop] ⚠️ Bot was marked as running but could not be killed. Manual intervention may be needed.');
    } else {
      console.log('[CMDstop] ⛔️ Shutting down host process...');
      process.exit(0);
    }
  }
}
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// END OF CMDstop.js              |
//`````````````````````````````````
