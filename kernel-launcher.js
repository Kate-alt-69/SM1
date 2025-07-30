//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// kernel-launcher.js (Persistent, Single-Run) |
//``````````````````````````````````````````````|

import { spawn } from 'child_process';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';

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
    stdio: 'inherit',
    detached: false
  });

  running = true;

  console.log(`[LAUNCHER] 🆔 KERNEL.js started with PID: ${child.pid}`);

  child.on('exit', (code, signal) => {
    console.log(`[LAUNCHER] ❌ KERNEL.js exited with code ${code} (${signal || 'no signal'})`);
    running = false;
    child = null;
  });
}

(async function loopForever() {
  while (true) {
    if (!running) {
      await startKernel(); // One-time start
    }
    await sleep(3000); // Sleep 3s, don't hammer CPU
  }
})();
