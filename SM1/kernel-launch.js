//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// kernel-launcher.js (Persistent, Single-Run) |
//``````````````````````````````````````````````|

import { spawn } from 'child_process';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';
import fs from "fs";
const pidFile = "./Utility_Module/PID.json";
let child = null;
let running = false;

const kernelPath = path.resolve('./KERNEL.js');
const processName = 'SM1-kernel';

console.log(`[LAUNCHER] 🚀 Launcher started for: ${kernelPath}`);

async function startKernel() {
  if (running) {
    console.log(`[LAUNCHER] ⏳ KERNEL.js is already running (PID: ${child?.pid})`);
    return;
  }

  console.log(`[LAUNCHER] 🧠 Starting SM1-kernel process...`);
  child = spawn('node', ['--title=' + processName, kernelPath], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    detached: false
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
    try {
      const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
      if (pidData.kerpid) process.kill(pidData.kerpid, 'SIGTERM');
    } catch {}
    process.exit(0);
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
  running = false;
  child = null;
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
  while (true) {
    if (!running) {
      await startKernel(); // one-time start
    }
    await sleep(3000); // sleep 3s, don’t hammer CPU
  }
})();