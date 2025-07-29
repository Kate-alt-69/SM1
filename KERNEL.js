//,,,,,,,,,,,,,
// KERNEL.js |
//````````````
console.log('[STARTUP] Starting Bcode Startup Script...');
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import { checkBcodeStructure } from './Utility Module/KNchecksum.js';
import moduleCHK from './Bcode/utils/moduleCHK.js';
import startup from './Utility Module/CMDstartup.js';
import {
  bcodePath,
  tokenPath,
  commandsJsonPath
} from './defined/path-define.js';
import { toggleCommand, createCommandsJson } from './Utility Module/CMDtoggle.js';

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

// 🕐 Dynamically import TokenEditorUtility AFTER node_modules are available
const { default: TokenEditorUtility } = await import('./Utility Module/TokenEditorUtility.js');
const tokenEditor = new TokenEditorUtility();

// 🖥 OS Detection
const getOS = () => {
  switch (process.platform) {
    case 'win32': return 'Windows';
    case 'darwin': return 'macOS';
    case 'linux': return 'Linux';
    default: return 'Unknown';
  }
};

console.log(`Operating System: ${getOS()}`);

// 🔍 Windows-specific PID checker
const getPidFromTasklist = (command) => {
  const output = execSync(command).toString();
  const regex = /node.exe\s+(\d+)/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    if (output.includes('DISCORDSERVERMANAGER')) return match[1];
  }
  return null;
};
const getPidFromPs = (command) => {
  const output = execSync(command).toString();
  const regex = /node\s+(\d+)/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    if (output.includes('DISCORDSERVERMANAGER')) return match[1];
  }
  return null;
};

const getBotPid = () => {
  const os = getOS();
  let command;
  switch (os) {
    case 'Windows': command = 'tasklist'; return getPidFromTasklist(command);
    case 'macOS':
    case 'Linux': command = 'ps -ef'; return getPidFromPs(command);
    default:
      console.error(`Unsupported operating system: ${os}`);
      return null;
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
      else if (arg === 'save') saveToken(arg2);
      else if (arg === 'help') {
        console.log('|        [TOKEN]');
        console.log('|  # token edit <token>  |- Edit the token in system');
        console.log('|  # token delete        |- Delete the token from system');
        console.log('|  # token save <token>  |- Save the token to system');
      } else {
        const closest = suggestClosestCommand(command, availableCommands.filter(cmd => cmd.startsWith('# token')));
        console.log(`[ERROR] ❌ Invalid token command. Use "# token help". Did you mean "${closest}"?`);
      }
    } else if (sub === 'start') startBot();
    else if (sub === 'stop') stopBot();
    else if (sub === 'restart') restartBot();
    else if (sub === 'help') {
      console.log('|    [COMMANDS]');
      console.log('|  # token              |- Use "# token help"');
      console.log('|  # re-toggle <true|false> |- Toggle feature');
      console.log('|  # start              |- Start the Bot');
      console.log('|  # stop               |- Stop the Bot');
      console.log('|  # restart            |- Restart the Bot');
    } else {
      const closest = suggestClosestCommand(command, availableCommands.filter(cmd => cmd.startsWith('# ')));
      console.log(`[ERROR] ❌ Unknown command. Use "# help". Did you mean "${closest}"?`);
    }
  } else if (main === '#-dev') {
    if (sub === 'shutdown') shutdownProcess();
    else if (sub === 'help') {
      console.log('|      [DEV]');
      console.log('|  #-dev shutdown   |- Shutdown the process and stop the bot');
    } else {
      const closest = suggestClosestCommand(command, availableCommands.filter(cmd => cmd.startsWith('#-dev ')));
      console.log(`[ERROR] ❌ Unknown dev command. Use "#-dev help". Did you mean "${closest}"?`);
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
//````````````