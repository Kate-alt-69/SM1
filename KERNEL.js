//,,,,,,,,,,,,,
// KERNEL.js |
//````````````
console.log('[STARTUP] Starting Bcode Startup Script...');
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { checkBcodeStructure } from './Utility_Module/KNchecksum.js';
import moduleCHK from './Bcode/utils/moduleCHK.js';
import startup from './Utility_Module/CMDstartup.js';
import CMDstart from './Utility_Module/CMDstart.js';
import CMDstop from './Utility_Module/CMDstop.js';
import {
  bcodePath,
  tokenPath,
  cmdPath,
  commandsJsonPath,
  cmdSnapshotPath
} from './defined/path-define.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await checkBcodeStructure();
console.log('[CHECK] ✔️ Bcode structure verified successfully!');
console.log('[STARTUP] 📦 Installing root dependencies via npm...');
try {
  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
  console.log('[STARTUP] ✔️ Root dependencies installed');
} catch (err) {
  console.error('[STARTUP] ❌ Failed to install root dependencies:', err.message);
}

console.log('[STARTUP] 📝 Bcode Startup Script installing NODE_MODULES');
await moduleCHK.checkAndInstallModules(bcodePath);
console.log('[STARTUP] 📝 Bcode Startup Script Online');

const pidPath = path.resolve('./Utility_Module/PID.json');
if (!fs.existsSync(pidPath)) {
  fs.writeFileSync(pidPath, JSON.stringify({ START: 'DISCORDSERVERMANAGER', PID: null, botrunning: false }, null, 2));
}

if (!fs.existsSync(commandsJsonPath)) {
  console.log('[CMD] ⛏ No commands.json file found. Generating default config...');
  const { default: ToggleManager } = await import('./Utility_Module/FUNCTtoggle.js');
  ToggleManager.regenerateCommandJson();
}

const { default: TokenEditorUtility } = await import('./Utility_Module/tokenEditorUtility.js');
const tokenEditor = new TokenEditorUtility(() => (inputLocked = false));

let inputLocked = false;
let promptVisible = false;

function showPrompt(force = false) {
  if (!promptVisible || force) {
    process.stdout.write('<<-');
    promptVisible = true;
  }
}

function clearPrompt() {
  promptVisible = false;
}

const tokenExists = () => {
  try {
    const tokenJson = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return tokenJson.token !== '';
  } catch {
    return false;
  }
};

const editToken = () => {
  inputLocked = true;
  tokenEditor.editTokenInteractive(() => {
    inputLocked = false;
    showPrompt(true);
  });
};

const deleteToken = () => {
  tokenEditor.deleteToken();
  console.log('[STARTUP] ✔️ Token deleted successfully');
  console.log('[STARTUP] 🚨 Please create a new token.');
  showPrompt(true);
};

const saveToken = () => {
  inputLocked = true;
  tokenEditor.saveTokenInteractive(() => {
    inputLocked = false;
    showPrompt(true);
  });
};

const restartBot = async () => {
  const command = process.platform === 'win32' ? 'tasklist /FI "IMAGENAME eq node.exe"' : `pidof node`;
  try {
    const output = execSync(command).toString();
    if (output.trim() !== '') {
      console.log('[RESTART] 🚀 Bot is online, stopping and restarting...');
      await CMDstop({ restart: true });
      setTimeout(() => CMDstart(), 1000);
      console.log('[RESTART] ✔️ Bot restarted successfully');
    } else {
      console.log('[RESTART] Bot is offline, starting...');
      CMDstart();
    }
  } catch (err) {
    console.error(`[RESTART] ❌ Failed to restart bot: ${err.message}`);
  }
  showPrompt(true);
};

if (!tokenExists()) {
  console.log('[STARTUP] 🚨 No token found. Prompting user to create one...');
  const token = await tokenEditor.saveTokenInteractive();
  if (!token) {
    console.log('[STARTUP] ⚠️ Continuing without bot startup. Other modules still functional.');
  }
} else {
  console.log('[STARTUP] ✔️ Token found. Use "# start" to launch the bot.');
}

showPrompt(true);

const shutdownProcess = async () => {
  console.log('[STARTUP] ⛔️ Shutting down process...');
  await CMDstop({ shutdown: true });
  console.log('[STARTUP] ✔️ shutting down...');
  process.exit(0);
};

function suggestClosestCommand(command, availableCommands) {
  const levenshtein = (a, b) => {
    const an = a.length, bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = Array.from({ length: an + 1 }, (_, i) =>
      Array.from({ length: bn + 1 }, (_, j) => (j === 0 ? i : 0))
    );
    for (let j = 0; j <= bn; j++) matrix[0][j] = j;
    for (let i = 1; i <= an; i++) {
      for (let j = 1; j <= bn; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[an][bn];
  };

  return availableCommands.reduce(
    (closest, cmd) => {
      const distance = levenshtein(command, cmd);
      return distance < closest.distance
        ? { command: cmd, distance }
        : closest;
    },
    { command: '', distance: Infinity }
  ).command;
}

function handleInvalidCommand(scope, input, validList, usage) {
  const suggestion = suggestClosestCommand(input || '', validList);
  console.log(`[${scope.toUpperCase()}] ❌ Unknown ${scope}: "${input || 'none'}"`);
  if (suggestion && suggestion !== input) {
    console.log(`[${scope.toUpperCase()}] 🤔 Did you mean: ${usage.replace('<CMD>', suggestion)}?`);
  } else {
    console.log(`[${scope.toUpperCase()}] Usage: ${usage.replace('<CMD>', scope)}`);
  }
  showPrompt(true);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
  if (inputLocked) return;

  clearPrompt();
  const command = data.toString().trim();
  const [main, sub, arg, arg2, arg3] = command.split(' ');

  if (main === '#') {
    const mainCommands = ['token', 'toggle', 'start', 'stop', 'restart', 'help'];
    if (!mainCommands.includes(sub)) {
      handleInvalidCommand('#', sub, mainCommands, '# <CMD>');
      return;
    }

    if (sub === 'token') {
      const tokenSubcommands = ['edit', 'save', 'delete'];
      if (!tokenSubcommands.includes(arg)) {
        handleInvalidCommand('token', arg, tokenSubcommands, '# token <edit|save|delete>');
        return;
      }
      if (arg === 'edit') editToken();
      else if (arg === 'save') saveToken();
      else if (arg === 'delete') deleteToken();

    } else if (sub === 'toggle') {
      const ToggleManager = (await import('./Utility_Module/FUNCTtoggle.js')).default;

      if (arg === 'list') ToggleManager.listTogglableCommands();
      else if (arg === 'on') ToggleManager.enableCommand(arg2);
      else if (arg === 'off') ToggleManager.disableCommand(arg2);
      else if (arg === 'update') ToggleManager.regenerateCommandJson();
      else if (arg === 'cleanup') ToggleManager.deleteSnapshots();
      else if (arg === 'snapshot') ToggleManager.takeSnapshot();
      else if (arg === 'rollback' && arg2 === 'list') ToggleManager.listSnapshots();
      else if (arg === 'rollback' && arg2) ToggleManager.rollbackSnapshot(arg2);
      else if (arg === 'help') ToggleManager.toggleHelp();
      else handleInvalidCommand('toggle', arg, ['list', 'on', 'off', 'update', 'cleanup', 'snapshot', 'rollback', 'help'], '# toggle <CMD>');

    } else if (sub === 'start') {
      await CMDstart();

    } else if (sub === 'stop') {
      await CMDstop({ stop: true });
      console.log('[STOP] 🛑 Bot stopped successfully');

    } else if (sub === 'restart') {
      await restartBot();

    } else if (sub === 'help') {
      console.log('\n# HELP — List of Available Commands');
      console.log('===========================================================================');
      console.log('\n[#] Main Bot Control Commands:');
      console.log('  # start           → Starts the bot using the saved token.');
      console.log('  # stop            → Stops the bot gracefully. No effect if not running.');
      console.log('  # restart         → Restarts the bot. Starts it if offline.');
      console.log('  # help            → Shows this help message with command descriptions.\n');

      console.log('[# token] Token Management Commands:');
      console.log('  # token edit      → Opens prompt to edit and update the bot token.');
      console.log('  # token save      → Opens prompt to enter and save a new bot token.');
      console.log('  # token delete    → Deletes the current saved token permanently.\n');

      console.log('[# toggle] Command Toggle Control:');
      console.log('  # toggle <command> [scope] [value]');
      console.log('                   → Enables or disables a command globally or locally.\n');

      console.log('[@] System-Level Commands:');
      console.log('  @ shutdown        → Terminates the entire CLI interface and exits process.\n');

      console.log('===========================================================================');
    }

  } else if (main === '@') {
    const systemCommands = ['shutdown'];
    if (!systemCommands.includes(sub)) {
      handleInvalidCommand('@', sub, systemCommands, '@ shutdown');
      return;
    }

    if (sub === 'shutdown') {
      await shutdownProcess();
    }

  } else {
    console.log(`[INPUT] ❌ Invalid input: "${command}"`);
    console.log(`[INPUT] 💡 Hint: Commands must begin with '#' or '@'`);
  }

  showPrompt(true);
});

process.stdin.resume();
showPrompt(true);

//,,,,,,,,,,,,,,,,,
//END OF KERNEL.js |
//```````````````