//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// kernel-launcher.js (Persistent, Single-Run) |
//``````````````````````````````````````````````|

import { spawn } from 'child_process';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';
import fs from "fs";
import { fileURLToPath } from 'url';
import TerminalLock from './Utility_Module/terminalLock.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pidFile = path.join(__dirname, "Utility_Module", "PID.json");
let child = null;
let running = true; // Changed from false to true for initial start

// Initialize terminal lock with 5 minutes timeout
const terminalLock = new TerminalLock(300000); // 5 minutes in milliseconds

const kernelPath = path.resolve('./KERNEL.js');
const processName = 'SM1-kernel';

console.log(`[LAUNCHER] 🚀 Launcher started for: ${kernelPath}`);

async function startKernel() {
  if (child) {
    console.log(`[LAUNCHER] ⏳ KERNEL.js is already running (PID: ${child?.pid})`);
    return;
  }

  // Ensure Utility_Module directory exists
  const utilityModulePath = path.dirname(pidFile);
  if (!fs.existsSync(utilityModulePath)) {
    fs.mkdirSync(utilityModulePath, { recursive: true });
  }

  // Run npm install in the kernel directory if node_modules doesn't exist
  const kernelDir = path.dirname(kernelPath);
  if (!fs.existsSync(path.join(kernelDir, 'node_modules'))) {
    console.log('[LAUNCHER] 📦 Installing dependencies...');
    try {
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const install = spawn(npm, ['install'], {
        cwd: kernelDir,
        stdio: 'inherit',
        shell: true
      });
      await new Promise((resolve, reject) => {
        install.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`npm install failed with code ${code}`));
        });
      });
    } catch (err) {
      console.error('[LAUNCHER] ❌ Failed to install dependencies:', err);
      process.exit(1);
    }
  }

  console.log(`[LAUNCHER] 🧠 Starting SM1-kernel process...`);
  child = spawn('node', ['--title=' + processName, kernelPath], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    detached: false,
    cwd: path.dirname(kernelPath)
  });

  // Give it a name so it shows up in process listings
  process.title = 'servermanager1-KERNEL';

  // Save PID to JSON
  const pidPath = path.resolve('./Utility_Module/PID.json');
  const pidData = fs.existsSync(pidPath) ? JSON.parse(fs.readFileSync(pidPath, 'utf8')) : {};
  pidData.kerpid = child.pid;
  fs.writeFileSync(pidPath, JSON.stringify(pidData, null, 2));
  running = true;
  console.log(`[LAUNCHER] 🆔 KERNEL.js started with PID: ${child.pid}`);

  // 🔑 Save kernel PID to PID.json
  try {
    let data = {};
    if (fs.existsSync(pidFile)) {
      data = JSON.parse(fs.readFileSync(pidFile, "utf8"));
    }
    data.kerpid = child.pid;
    fs.writeFileSync(pidFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[LAUNCHER] ❌ Failed to write PID.json:", err);
  }

  let restartRequested = false;

  child.on('message', async (msg) => {
    if (msg === 'shutdown') {
      console.log('[LAUNCHER] ⚡ Shutdown requested from KERNEL');
      running = false; // Prevent restart loop
      try {
        // Clean up PID file
        const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
        delete pidData.kerpid;
        fs.writeFileSync(pidFile, JSON.stringify(pidData, null, 2));
        
        // Kill kernel process if still running
        if (child && !child.killed) {
          child.kill();
        }
      } catch (err) {
        console.error('[LAUNCHER] Error during shutdown:', err);
      }
      process.exit(0); // Exit launcher
    }

    if (msg === 'restart' && !restartRequested) {
      restartRequested = true;
      console.log('[LAUNCHER] 🔄 Restart requested from KERNEL...');
      try {
        const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
        if (pidData.kerpid) {
          process.kill(pidData.kerpid, 'SIGTERM');
        }
      } catch (err) {
        console.error('[LAUNCHER] ❌ Failed to kill kernel PID:', err.message);
      }

      // Wait for process to die before restarting
      let check = 0;
      const maxWait = 5000; // 5 seconds
      while (check < maxWait) {
        try {
          process.kill(JSON.parse(fs.readFileSync(pidFile, 'utf8')).kerpid, 0);
          await sleep(200);
          check += 200;
        } catch {
          break; // PID gone, safe to restart
        }
      }

      running = false;
      restartRequested = false;
      startKernel();
    }
  });

  child.on('exit', (code, signal) => {
    console.log(`[LAUNCHER] ❌ KERNEL.js exited with code ${code} (${signal || 'no signal'})`);
    child = null;
    if (running) {
      // Only restart if not intentionally stopped
      setTimeout(() => startKernel(), 1000);
    }
  });
}

// 🛑 Handle launcher-level shutdown (Ctrl+C, terminal X, SIGTERM)
process.on('exit', () => {
  if (child) child.kill();
});
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// 🔁 Main loop
(async function loopForever() {
  // Initial kernel start
  await startKernel();

  // Keep process alive but don't hammer CPU
  while (true) {
    await sleep(3000);
    if (!running) break;
  }
})();