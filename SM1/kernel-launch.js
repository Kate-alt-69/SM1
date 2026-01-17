// kernel-launcher.js
// Purpose: Passive supervisor for KERNEL.js
// Owns NO terminal, NO input, NO signals

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';

/* ------------------------------------------------------------------ */
/* paths */
/* ------------------------------------------------------------------ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KERNEL_PATH = path.resolve(__dirname, 'KERNEL.js');
const LOG_DIR = path.resolve(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'kernel.log');
const PID_FILE = path.join(__dirname, 'Utility_Module', 'PID.json');

/* ------------------------------------------------------------------ */
/* state */
/* ------------------------------------------------------------------ */

let child = null;
let running = true;
let retries = 0;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

/* ------------------------------------------------------------------ */
/* utils */
/* ------------------------------------------------------------------ */

function ensureDirs() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const pidDir = path.dirname(PID_FILE);
  if (!fs.existsSync(pidDir)) fs.mkdirSync(pidDir, { recursive: true });
}

function log(line) {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  fs.appendFileSync(LOG_FILE, entry);
}

function writePid(pid) {
  let data = {};
  if (fs.existsSync(PID_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    } catch {}
  }
  data.kerpid = pid;
  fs.writeFileSync(PID_FILE, JSON.stringify(data, null, 2));
}

function clearPid() {
  if (!fs.existsSync(PID_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    delete data.kerpid;
    fs.writeFileSync(PID_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

/* ------------------------------------------------------------------ */
/* kernel control */
/* ------------------------------------------------------------------ */

async function startKernel() {
  if (!running) return;
  if (child) return;

  retries++;
  log(`Starting kernel (attempt ${retries}/${MAX_RETRIES})`);

  child = spawn(
    process.execPath,
    [KERNEL_PATH],
    {
      stdio: [
        'inherit', // stdin → KERNEL OWNS TTY
        'inherit', // stdout
        'inherit', // stderr
        'ipc'      // IPC only (safe)
      ],
      cwd: __dirname
    }
  );

  writePid(child.pid);
  log(`Kernel started PID=${child.pid}`);

  /* ---------- IPC ---------- */

  child.on('message', async (msg) => {
    if (msg === 'shutdown') {
      log('Kernel requested shutdown');
      running = false;
      await stopKernel();
      process.exit(0);
    }

    if (msg === 'restart') {
      log('Kernel requested restart');
      await stopKernel();
      await sleep(500);
      await startKernel();
    }
  });

  /* ---------- exit ---------- */

  child.on('exit', async (code, signal) => {
    log(`Kernel exited code=${code} signal=${signal}`);
    clearPid();
    child = null;

    if (!running) return;

    if (retries >= MAX_RETRIES) {
      log('Max retries exceeded — launcher giving up');
      process.exit(1);
    }

    log(`Retrying in ${RETRY_DELAY_MS}ms`);
    await sleep(RETRY_DELAY_MS);
    await startKernel();
  });

  child.on('error', (err) => {
    log(`Kernel spawn error: ${err.stack || err.message}`);
  });
}

async function stopKernel() {
  if (!child) return;

  log(`Stopping kernel PID=${child.pid}`);

  try {
    child.kill('SIGTERM');
  } catch {}

  await sleep(500);

  if (child && !child.killed) {
    try {
      child.kill('SIGKILL');
    } catch {}
  }

  child = null;
  clearPid();
}

/* ------------------------------------------------------------------ */
/* entry */
/* ------------------------------------------------------------------ */

ensureDirs();
log('Launcher started');

await startKernel();

/* ------------------------------------------------------------------ */
/* keep alive (NO stdin, NO signals) */
/* ------------------------------------------------------------------ */

while (running) {
  await sleep(5000);
}
