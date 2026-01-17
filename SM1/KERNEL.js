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
//import { handleInput, toggleInput, initInputListener, setLockState, isLocked,storeOutput,storeInput,getStoredContent,clearBuffer,setRawMode} from './Utility_Module/KNinput.manager.js';
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
global.toggleInput = () => {}; // No-op for backward compatibility
global.setLockState = () => {}; // No-op for backward compatibility
global.isLocked = false; // No-op for backward compatibility

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
// ✅ Step 3: Continue startup
import { KNchecksum } from './Utility_Module/KNchecksum.js';
import CMDstart from './Utility_Module/CMDstart.js';
import CMDstop from './Utility_Module/CMDstop.js';
import Settings from './Utility_Module/FUNCTsetting.js';
import { getShellEnvironment } from './Utility_Module/ShellEnvironment.js';
import { commandsJsonPath, settingsPath } from './defined/path-define.js';
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
const tokenEditor = new TokenEditorUtility(() => {}); // No-op callback for now
let signalSent = false;

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
  shell.writeLine(`[${scope.toUpperCase()}]${scope}"${input || 'none'}"`);
  shell.writeLine(`[${scope.toUpperCase()}] 🤔 Did you mean: ${usage.replace('<CMD>', suggestion)}?`);
};

// ✅ Autostart function - checks settings and automatically starts the bot if enabled
async function checkAndAutostart() {
  try {
    if (!fs.existsSync(settingsPath)) {
      return; // Settings file doesn't exist, skip autostart
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const autostartEnabled = settings.autostart === 'true' || settings.autostart === true;

    if (autostartEnabled) {
      console.log('[AUTOSTART] 🚀 Autostart enabled - Starting bot automatically...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Give time for prompt to display
      await CMDstart();
    }
  } catch (err) {
    console.error('[AUTOSTART] ⚠️ Error checking autostart setting:', err.message);
  }
}

// ✅ Initialize Shell Environment (SINGLETON - Only one instance for all I/O)
const shell = getShellEnvironment();

// ✅ Command Handler for '#' prefix
async function handleHashCommand(args, signal) {
  const [sub, arg, arg2] = args.split(' ');

  const mainCmds = ['token', 'toggle', 'start', 'stop', 'clear', 'version', 'restart', 'help', 'setting'];
  if (!mainCmds.includes(sub)) {
    const suggestion = suggestClosestCommand(sub || '', mainCmds);
    shell.writeLine(`[#] ❌ Unknown command: "${sub || 'none'}"`);
    shell.writeLine(`[#] 🤔 Did you mean: # ${suggestion}?`);
    return;
  }

  if (sub === 'token') {
    await tokenEditor.handleCommand(arg, arg2);
  } else if (sub === 'toggle') {
    const ToggleManager = (await import('./Utility_Module/FUNCTtoggle.js')).default;
    if (!arg) {
      shell.writeLine('[TOGGLE] 💡 Use "# toggle help" for available subcommands.');
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
    shell.writeLine('[STOP] 🛑 Bot stopped');
  } else if (sub === 'clear') {
    clearTerminal();
  } else if (sub === 'version') {
    shell.writeLine('Version 1.2.0');
  } else if (sub === 'restart') {
    shell.writeLine('[RESTART] 🚀 Restarting...');
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
    shell.write('\n┌───┬──────────────────────────┬─────────────────────────────────────────────────────────┐\n');
    shell.write('│   │ Command                  │ Description                                             │\n');
    shell.write('├───┼──────────────────────────┼─────────────────────────────────────────────────────────┤\n');
    commands.forEach((cmd, i) => {
      const idx = String(i).padEnd(1);
      const c = cmd.command.padEnd(24);
      const d = cmd.info.padEnd(55);
      shell.write(`│ ${idx} │ ${c} │ ${d} │\n`);
    });
    shell.write('└───┴──────────────────────────┴─────────────────────────────────────────────────────────┘\n');
  } else if (sub === 'setting') {
    if (!arg) {
      shell.writeLine('[SETTING] 💡 Use "# setting help" for available subcommands.');
      return;
    }
    if (arg === 'list') console.table(await Settings.listSettings());
    else if (arg === 'about') console.dir(await Settings.getBotAboutInfo(), { depth: null });
    else if (arg === 'runerror') await Settings.runErrorCheck(console.log);
    else if (arg === 'cleanup') shell.writeLine(await Settings.cleanUpSettings());
    else if (arg === 'relaunch') await Settings.relaunchBot(__filename);
    else if (arg === 'setram') Settings.setRamLimit(arg2);
    else if (arg === 'setcpu') Settings.setCpuLimit(arg2);
    else if (arg === 'help') Settings.helpCmd();
    else shell.writeLine('[SETTING] list | about | runerror | cleanup | relaunch | help');
  }
}

// ✅ Register command handlers with shell
shell.register('#', handleHashCommand);

// ✅ Setup shutdown handler
shell.onShutdown(async () => {
  try {
    await Settings.cleanUpSettings();
  } catch {}
  if (process.send) process.send('shutdown');
});

// ✅ Startup Token Check (delegated)
await tokenEditor.ensureTokenOnStartup();
clearTerminal();

// // ✅ Setup signal handlers
// process.on('SIGINT', async () => {
//   if (signalSent) return;
//   signalSent = true;
//   shell.writeLine('\n[CTRL+C] 🔌 Interrupt signal received');
//   await restartprocess();
// });

// process.on('SIGTERM', async () => {
//   if (signalSent) return;
//   signalSent = true;
//   shell.writeLine('\n[SIGNAL] 🔌 SIGTERM received');
//   await restartprocess();
// });

// ✅ Start shell environment with routing
shell.start();

// ✅ Check and trigger autostart if enabled
await checkAndAutostart();

//,,,,,,,,,,,,,,,,,
//END OF KERNEL.js |
//```````````````