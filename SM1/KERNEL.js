//,,,,,,,,,,,,,
// KERNEL.js |
//````````````

console.log('[STARTUP] Starting Bcode Startup Script...');

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import moduleCHK from './Bcode/utils/moduleCHK.js';
import { bcodePath } from './defined/path-define.js';
import { terminalManager } from './Utility_Module/TSM.js';
import { handleInput, toggleInput, initInputListener, setLockState, isLocked,storeOutput,storeInput,getStoredContent,clearBuffer,setRawMode} from './Utility_Module/KNinput.manager.js';
//import { AuthManager } from "./Utility_Module/auth0.js";

// Initialize terminal state manager before anything else
const tsm = terminalManager;
global.tsm = tsm;

// Initialize auth manager with terminal manager
//const auth = new AuthManager(tsm);

// Set up activity monitoring
//tsm.onActivity(() => {
//    if (auth) auth.updateActivity();
//});

// Make input control globally available
global.toggleInput = toggleInput;
global.setLockState = setLockState;
global.isLocked = isLocked;

// ✅ Setup dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Step 1: Ensure node_modules are installed
await moduleCHK.checkAndInstallModules(bcodePath);

// ✅ Step 2: AUTHENTICATION
//toggleInput(false); // Disable CLI while login is pending
// Add terminal state to auth manager
//const loginData = await auth.initAuth(); // Blocks until login succeeds
//console.log(`[AUTH] ✅ Logged in as: ${loginData.username}`);
//initInputListener(); // Start listener only after login
//toggleInput(true);   // Enable CLI now
// Make toggleInput globally accessible for auth system
global.toggleInput = toggleInput;
// ✅ Step 3: Continue startup
import { KNchecksum } from './Utility_Module/KNchecksum.js';
import CMDstart from './Utility_Module/CMDstart.js';
import CMDstop from './Utility_Module/CMDstop.js';
import Settings from './Utility_Module/FUNCTsetting.js';
import { commandsJsonPath } from './defined/path-define.js';
import { setTimeout } from 'timers/promises';

// ✅ Small helper to clear the terminal nicely
function clearTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc'); // Full reset
    console.log('[KERNEL] Try # help for information');
  }
}

// ✅ Verify Bcode structure
await KNchecksum.checkBcodeStructure();
console.log('[CHECK] ✔️ Bcode structure verified successfully!');

// ✅ Install root dependencies (safety check for root, separate from moduleCHK)
try {
  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
  console.log('[STARTUP] ✔️ Root dependencies installed');
} catch (err) {
  console.error('[STARTUP] ❌ Failed to install dependencies:', err.message);
}

console.log('[STARTUP] 📝 Installing NODE_MODULES');
await moduleCHK.checkAndInstallModules(bcodePath);
console.log('[STARTUP] 📝 Bcode Startup Complete');

// ✅ PID File Initialization
const pidPath = path.resolve('./Utility_Module/PID.json');
if (!fs.existsSync(pidPath)) {
  fs.writeFileSync(
    pidPath,
    JSON.stringify({ START: 'DISCORDSERVERMANAGER', PID: null, botrunning: false }, null, 2)
  );
}

// ✅ Ensure commands.json exists
if (!fs.existsSync(commandsJsonPath)) {
  console.log('[CMD] ⛏ No commands.json found. Generating default config...');
  const { default: ToggleManager } = await import('./Utility_Module/FUNCTtoggle.js');
  ToggleManager.regenerateCommandJson();
}

// ✅ Load Token Editor
const { default: TokenEditorUtility } = await import('./Utility_Module/FUNCTtokenEditorUtility.js');
const tokenEditor = new TokenEditorUtility(() => toggleInput(true)); // Re-enable input after prompt
let signalSent = false;
let promptVisible = false;
const showPrompt = (force = false) => {
  if (!promptVisible || force) {
    process.stdout.write('<<-');
    promptVisible = true;
  }
};
const clearPrompt = () => {
  promptVisible = false;
};

// ✅ Startup Token Check (delegated)
await tokenEditor.ensureTokenOnStartup();
showPrompt(true);
clearTerminal();

// ✅ Restart Logic
const restartprocess = async () => {
  console.log('[STARTUP] ⛔️ Shutting down...');
  if (process.send) process.send("restart");
  console.log('[STARTUP] ✔️ Shutdown complete');
};
const shutdownkernel = async () => {
  console.log('[SHUTDOWN] ⛔️ Shutting down SM1...');
  // optional cleanup routines here
  try {
    await Settings.cleanUpSettings();
  } catch {}
  // Notify launcher
  if (process.send) process.send('shutdown');
  process.exit(0);
};
// ✅ Command Suggestion
const suggestClosestCommand = (input, list) =>
  list.reduce((a, b) => {
    const d = (x, y) =>
      x.length === 0
        ? y.length
        : y.length === 0
        ? x.length
        : Math.min(
            d(x.slice(1), y) + 1,
            d(x, y.slice(1)) + 1,
            d(x.slice(1), y.slice(1)) + (x[0] !== y[0])
          );
    return d(input, b) < d(input, a) ? b : a;
  });

const handleInvalidCommand = (scope, input, validList, usage) => {
  const suggestion = suggestClosestCommand(input || '', validList);
  console.log(`[${scope.toUpperCase()}] ❌ Unknown ${scope}: "${input || 'none'}"`);
  console.log(`[${scope.toUpperCase()}] 🤔 Did you mean: ${usage.replace('<CMD>', suggestion)}?`);
  showPrompt(true);
};

// ✅ CLI Input
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
  if (!toggleInput) return; // Ignore if input is disabled
  clearPrompt();

  buffer += data;

  // Wait until a newline before processing the command
  if (!buffer.endsWith('\n')) return;

  const input = buffer.trim();
  buffer = '';

  const [main, sub, arg, arg2] = input.split(' ');

  if (main === '#') {
    const mainCmds = ['token', 'toggle', 'start', 'stop', 'clear', 'version', 'restart', 'help', 'setting'];
    if (!mainCmds.includes(sub)) {
      return handleInvalidCommand('#', sub, mainCmds, '# <CMD>');
    }

    if (sub === 'token') {
      toggleInput(false); // Disable input while token editor runs
      await tokenEditor.handleCommand(arg, arg2);
      toggleInput(true);
    } else if (sub === 'toggle') {
      const ToggleManager = (await import('./Utility_Module/FUNCTtoggle.js')).default;
      if (!arg) {
        console.log('\n[TOGGLE] 💡 Use "# toggle help" for available subcommands.');
        return;
      }
      if (arg === 'list') ToggleManager.listTogglableCommands();
      else if (arg === 'on') ToggleManager.enableCommand(arg2);
      else if (arg === 'off') ToggleManager.disableCommand(arg2);
      else if (arg === 'update') ToggleManager.regenerateCommandJson();
      else if (arg === 'cleanup') ToggleManager.deleteSnapshots();
      else if (arg === 'snapshot') ToggleManager.takeSnapshot();
      else if (arg === 'rollback' && arg2) ToggleManager.rollbackSnapshot(arg2);
      else ToggleManager.toggleHelp();
    } else if (sub === 'start') {
      await CMDstart();
    } else if (sub === 'stop') {
      await CMDstop({ stop: true });
      console.log('[STOP] 🛑 Bot stopped');
    } else if (sub === 'clear') {
      clearTerminal();
    } else if (sub === 'version') {
      console.log('Version 1.2.0');
    } else if (sub === 'restart') {
      console.log('[RESTART] 🚀 Restarting...');
      await CMDstop({ restart: true });
    } else if (sub === 'help') {
      const commands = [
        { command: '# version', info: 'Check SM1 Version' },
        { command: '# clear', info: 'clear the terminal' },
        { command: '# start', info: 'Start the bot' },
        { command: '# stop', info: 'Stop the bot' },
        { command: '# restart', info: 'Restart the bot' },
        { command: '# token help', info: 'Token management commands' },
        { command: '# toggle help', info: 'Command toggling commands' },
        { command: '# setting help', info: 'Bot settings commands' },
        { command: 'how to shutdown', info: 'use the normal CTRL + C to shutdown whole process' }
      ];
      console.log('\n┌───┬──────────────────────────┬─────────────────────────────────────────────────────────┐');
      console.log('│   │ Command                  │ Description                                             │');
      console.log('├───┼──────────────────────────┼─────────────────────────────────────────────────────────┤');
      commands.forEach((cmd, i) => {
        const idx = String(i).padEnd(1);
        const c = cmd.command.padEnd(24);
        const d = cmd.info.padEnd(55);
        console.log(`│ ${idx} │ ${c} │ ${d} │`);
      });
      console.log('└───┴──────────────────────────┴─────────────────────────────────────────────────────────┘\n');
    } else if (sub === 'setting') {
      if (!arg) {
        console.log('\n[SETTING] 💡 Use "# setting help" for available subcommands.');
        return;
      }
      if (arg === 'list') console.table(await Settings.listSettings());
      else if (arg === 'about') console.dir(await Settings.getBotAboutInfo(), { depth: null });
      else if (arg === 'runerror') await Settings.runErrorCheck(console.log);
      else if (arg === 'cleanup') console.log(await Settings.cleanUpSettings());
      else if (arg === 'relaunch') await Settings.relaunchBot(__filename);
       // ---- New = commands ---- //
      else if (arg === 'passwordreset') await auth.passwordReset();
      else if (arg === 'lock') await auth.lockScreen();
      else if (arg === 'accountreset') await auth.accountReset();
      else if (arg === 'accountdetail') auth.accountDetail();
      else if (arg === 'setram') Settings.setRamLimit(arg2);
      else if (arg === 'setcpu') Settings.setCpuLimit(arg2);
      else if (arg === 'help') Settings.helpCmd();
      else console.log('[SETTING] list | about | runerror | cleanup | relaunch | help');
    }
  } else if (main === '@') {
    if (sub === 'restart') await restartprocess();
    else if (sub === 'shutdown') {
      console.log('[STARTUP] ⛔️ Shutting down...');
      if (process.send) process.send('shutdown');
      console.log('[STARTUP] ✔️ Shutdown complete');
      process.exit(0);
    }
    else handleInvalidCommand('@', sub, ['restart', 'shutdown'], '@ <CMD>');
  } else {
    console.log(`[INPUT] ❌ Invalid input: "${input}"\n[INPUT] 💡 Commands start with '#' or '@'`);
  }
  showPrompt(true);
});
process.on('SIGINT', async () => {
  if (signalSent) return;
  signalSent = true;
  console.log('\n[CTRL+C] 🔌 Interrupt signal received');
  await restartprocess();
});

process.on('SIGTERM', async () => {
  if (signalSent) return;
  signalSent = true;
  console.log('\n[SIGNAL] 🔌 SIGTERM received');
  await restartprocess();
});

process.stdin.resume();
showPrompt(true);

// Remove the existing keyboard monitor and idle check interval
// Instead, add this new activity monitor:
const ACTIVITY_CHECK_INTERVAL = 10000; // Check every 10 seconds

process.stdin.on('data', () => tsm.updateActivity());

// Watch for idle timeout
//setInterval(async () => {
//    if (!auth.isLocked && auth.isIdle()) {
//        await auth.lockScreen();
//    }
//}, ACTIVITY_CHECK_INTERVAL);

//,,,,,,,,,,,,,,,,,
//END OF KERNEL.js |
//```````````````