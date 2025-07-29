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

export default function CMDstop({ restart = false, shutdown = false } = {}) {
  console.log('[CMDstop] 🛑 Attempting to stop bot process...');

  let killed = false;
  let pid = null;
  let title = 'DISCORDSERVERMANAGER';
  let botrunning = false;

  // Load PID.json
  if (fs.existsSync(pidPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pidPath, 'utf-8'));
      if (typeof data.PID === 'number') pid = data.PID;
      if (typeof data.START === 'string') title = data.START;
      if (typeof data.botrunning === 'boolean') botrunning = data.botrunning;
    } catch (err) {
      console.error(`[CMDstop] ❌ Failed to read PID.json: ${err.message}`);
    }
  }

  // If marked running, attempt to kill by PID
  if (botrunning && pid) {
    try {
      process.kill(pid, 0);  // Check if alive
      process.kill(pid);     // Kill it
      console.log(`[CMDstop] ✅ Killed bot process with PID: ${pid}`);
      killed = true;
    } catch {
      console.warn(`[CMDstop] ⚠️ PID ${pid} not running anymore.`);
    }
  }

  // Fallback: Try to find process by script name (DCB.js)
  if (!killed) {
    try {
      const output = execSync('ps -ef').toString();
      const lines = output.split('\n');
      for (const line of lines) {
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

  // Mark bot as not running
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

  // Clean up node_modules to save disk space
  try {
    const rootModules = path.join(rootDir, 'node_modules');
    const bcodeModules = path.join(bcodePath, 'node_modules');

    if (fs.existsSync(rootModules)) {
      fs.rmSync(rootModules, { recursive: true, force: true });
      console.log('[CMDstop] 🧹 Removed root node_modules directory');
    }

    if (fs.existsSync(bcodeModules)) {
      fs.rmSync(bcodeModules, { recursive: true, force: true });
      console.log('[CMDstop] 🧹 Removed Bcode node_modules directory');
    }
  } catch (err) {
    console.error(`[CMDstop] ❌ Failed to remove node_modules: ${err.message}`);
  }

  // Final shutdown
  if (shutdown) {
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