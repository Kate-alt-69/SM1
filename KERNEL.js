//,,,,,,,,,,,,,
// KERNEL.js |
//````````````

console.log('[STARTUP] Starting Bcode Startup Script...');
import path from 'path'; import fs from 'fs'; import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
import { checkBcodeStructure } from './Utility_Module/KNchecksum.js';
import moduleCHK from './Bcode/utils/moduleCHK.js';
import startup from './Utility_Module/CMDstartup.js';
import CMDstart from './Utility_Module/CMDstart.js';
import CMDstop from './Utility_Module/CMDstop.js';
import { bcodePath, tokenPath, cmdPath, commandsJsonPath, configPath } from './defined/path-define.js';
import * as Settings from './Utility_Module/FUNCTsetting.js';

const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);
await checkBcodeStructure(); console.log('[CHECK] ✔️ Bcode structure verified successfully!');

try { execSync('npm install', { cwd: __dirname, stdio: 'inherit' }); console.log('[STARTUP] ✔️ Root dependencies installed'); }
catch (err) { console.error('[STARTUP] ❌ Failed to install dependencies:', err.message); }

console.log('[STARTUP] 📝 Installing NODE_MODULES'); await moduleCHK.checkAndInstallModules(bcodePath); console.log('[STARTUP] 📝 Bcode Startup Complete');

const pidPath = path.resolve('./Utility_Module/PID.json');
if (!fs.existsSync(pidPath)) fs.writeFileSync(pidPath, JSON.stringify({ START: 'DISCORDSERVERMANAGER', PID: null, botrunning: false }, null, 2));

if (!fs.existsSync(commandsJsonPath)) {
  console.log('[CMD] ⛏ No commands.json found. Generating default config...');
  const { default: ToggleManager } = await import('./Utility_Module/FUNCTtoggle.js');
  ToggleManager.regenerateCommandJson();
}

const { default: TokenEditorUtility } = await import('./Utility_Module/tokenEditorUtility.js');
const tokenEditor = new TokenEditorUtility(() => (inputLocked = false));
let inputLocked = false, promptVisible = false;

const showPrompt = (force = false) => { if (!promptVisible || force) { process.stdout.write('<<-'); promptVisible = true; } };
const clearPrompt = () => { promptVisible = false; };

const tokenExists = () => { try { const t = JSON.parse(fs.readFileSync(tokenPath, 'utf8')); return t.token !== ''; } catch { return false; } };
const editToken = () => { inputLocked = true; tokenEditor.editTokenInteractive(() => { inputLocked = false; showPrompt(true); }); };
const deleteToken = () => { tokenEditor.deleteToken(); console.log('[STARTUP] ✔️ Token deleted'); console.log('[STARTUP] 🚨 Please create a new token.'); showPrompt(true); };
const saveToken = async () => { inputLocked = true; await tokenEditor.saveTokenInteractive(); inputLocked = false; showPrompt(true); };
const restartBot = async () => {
  try {
    const output = execSync(process.platform === 'win32' ? 'tasklist /FI "IMAGENAME eq node.exe"' : 'pidof node').toString();
    if (output.trim()) {
      console.log('[RESTART] 🚀 Restarting...'); await CMDstop({ restart: true }); setTimeout(() => CMDstart(), 1000);
    } else CMDstart();
  } catch (err) { console.error(`[RESTART] ❌ Restart failed: ${err.message}`); }
  showPrompt(true);
};

if (!tokenExists()) {
  console.log('[STARTUP] 🚨 No token found. Prompting user...');
  const token = await tokenEditor.saveTokenInteractive();
  if (!token) console.log('[STARTUP] ⚠️ Continuing without bot startup.');
} else console.log('[STARTUP] ✔️ Token found. Use "# start" to launch.');

showPrompt(true);

const shutdownProcess = async () => { console.log('[STARTUP] ⛔️ Shutting down...'); await CMDstop({ shutdown: true }); console.log('[STARTUP] ✔️ Shutdown complete'); process.exit(0); };

const suggestClosestCommand = (input, list) => list.reduce((a, b) => {
  const d = (x, y) => x.length === 0 ? y.length : y.length === 0 ? x.length : Math.min(
    d(x.slice(1), y) + 1, d(x, y.slice(1)) + 1, d(x.slice(1), y.slice(1)) + (x[0] !== y[0])
  );
  return d(input, b) < d(input, a) ? b : a;
});

const handleInvalidCommand = (scope, input, validList, usage) => {
  const suggestion = suggestClosestCommand(input || '', validList);
  console.log(`[${scope.toUpperCase()}] ❌ Unknown ${scope}: "${input || 'none'}"`);
  console.log(`[${scope.toUpperCase()}] 🤔 Did you mean: ${usage.replace('<CMD>', suggestion)}?`);
  showPrompt(true);
};

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
  if (inputLocked) return;
  clearPrompt();
  const [main, sub, arg, arg2] = data.trim().split(' ');

  if (main === '#') {
    const mainCmds = ['token', 'toggle', 'start', 'stop', 'restart', 'help', 'setting'];
    if (!mainCmds.includes(sub)) return handleInvalidCommand('#', sub, mainCmds, '# <CMD>');

    if (sub === 'token') {
      const tCmds = ['edit', 'save', 'delete', 'help'];
      if (!tCmds.includes(arg)) return handleInvalidCommand('token', arg, tCmds, '# token help');
      if (arg === 'edit') editToken();
      else if (arg === 'save') await saveToken();
      else if (arg === 'delete') deleteToken();
      else console.log('[# TOKEN] edit | save | delete');

    } else if (sub === 'toggle') {
      const ToggleManager = (await import('./Utility_Module/FUNCTtoggle.js')).default;
      if (arg === 'list') ToggleManager.listTogglableCommands();
      else if (arg === 'on') ToggleManager.enableCommand(arg2);
      else if (arg === 'off') ToggleManager.disableCommand(arg2);
      else if (arg === 'update') ToggleManager.regenerateCommandJson();
      else if (arg === 'cleanup') ToggleManager.deleteSnapshots();
      else if (arg === 'snapshot') ToggleManager.takeSnapshot();
      else if (arg === 'rollback' && arg2) ToggleManager.rollbackSnapshot(arg2);
      else ToggleManager.toggleHelp();

    } else if (sub === 'start') await CMDstart();
    else if (sub === 'stop') { await CMDstop({ stop: true }); console.log('[STOP] 🛑 Bot stopped'); }
    else if (sub === 'restart') await restartBot();
    else if (sub === 'help') console.log('[HELP] start | stop | restart | token | toggle | setting');

    else if (sub === 'setting') {
      if (arg === 'list') console.table(await Settings.listSettings());
      else if (arg === 'about') console.dir(await Settings.getBotAboutInfo(), { depth: null });
      else if (arg === 'runerror') await Settings.runErrorCheck(console.log);
      else if (arg === 'cleanup') console.log(await Settings.cleanUpSettings());
      else if (arg === 'relaunch') await Settings.relaunchBot(__filename);
      else console.log('[SETTING] list | about | runerror | cleanup | relaunch');
    }

  } else if (main === '@') {
    if (sub === 'shutdown') await shutdownProcess();
    else handleInvalidCommand('@', sub, ['shutdown'], '@ shutdown');
  } else {
    console.log(`[INPUT] ❌ Invalid input: "${data.trim()}"\n[INPUT] 💡 Commands start with '#' or '@'`);
  }
  showPrompt(true);
});

process.stdin.resume();
showPrompt(true);

//,,,,,,,,,,,,,,,,,
//END OF KERNEL.js |
//```````````````
