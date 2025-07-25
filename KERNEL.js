//,,,,,,,,,,,,
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
import {
  bcodePath,
  tokenPath,
  cmdPath,
  commandsJsonPath
} from './defined/path-define.js';
import { handleToggleCommand } from './Utility_Module/CMDtoggle.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await checkBcodeStructure();
console.log('[CHECK] ✔️ Bcode structure verified successfully!');
console.log('[STARTUP] 📝 Bcode Startup Script installing NODE_MODULES');
await moduleCHK.checkAndInstallModules(bcodePath);
console.log('[STARTUP] 📝 Bcode Startup Script Online');

const { default: TokenEditorUtility } = await import('./Utility_Module/tokenEditorUtility.js');
const tokenEditor = new TokenEditorUtility(() => (inputLocked = false));

const getOS = () => {
  switch (process.platform) {
    case 'win32': return 'Windows';
    case 'darwin': return 'macOS';
    case 'linux': return 'Linux';
    default: return 'Unknown';
  }
};
console.log(`Operating System: ${getOS()}`);

let inputLocked = false;

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
};
let botPid;

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
  tokenEditor.editTokenInteractive(() => (inputLocked = false));
};
const deleteToken = () => {
  tokenEditor.deleteToken();
  console.log('[STARTUP] ✔️ Token deleted successfully');
  console.log('[STARTUP] 🚨 Please create a new token.');
};
const saveToken = () => {
  inputLocked = true;
  tokenEditor.saveTokenInteractive(() => (inputLocked = false));
};

async function startBot() {
  await startup();
  //const commandLoader = new CommandLoader();
  //await commandLoader.loadCommands();
  //const commandManager = new CommandManager(commandLoader);
}

const stopBot = () => {
  console.log('[STARTUP] ✔️ Attempting to stop the bot...');
  const currentPid = getBotPid();
  if (!currentPid) {
    console.log('[STARTUP] ⚠️ Bot is not running or could not be detected.');
    return;
  }
  const command = process.platform === 'win32'
    ? `taskkill /F /PID ${currentPid}`
    : `kill ${currentPid}`;
  try {
    execSync(command);
    console.log(`[STARTUP] ✔️ Bot with PID ${currentPid} stopped successfully.`);
  } catch (err) {
    console.log(`[STARTUP] ❌ Failed to stop bot with PID ${currentPid}: ${err.message}`);
  }
};

const restartBot = () => {
  const command = process.platform === 'win32' ? 'tasklist /FI "IMAGENAME eq node.exe"' : `pidof node`;
  const output = execSync(command).toString();
  if (output.trim() !== '') {
    console.log('[RESTART] 🚀 Bot is online, stopping and restarting...');
    stopBot();
    setTimeout(startBot, 1000);
    console.log('[RESTART] ✔️ Bot restarted successfully');
  } else {
    console.log('[RESTART] Bot is offline, starting...');
    startBot();
  }
};

// 🚀 Main token-check and bot startup logic
if (!tokenExists()) {
  console.log('[STARTUP] 🚨 No token found. Prompting user to create one...');
  const token = await tokenEditor.saveTokenInteractive();
  if (token) {
    await startBot();
  } else {
    console.log('[STARTUP] ⚠️ Continuing without bot startup. Other modules still functional.');
  }
} else {
  await startBot();
}

const shutdownProcess = () => {
  console.log('[STARTUP] ⛔️ Shutting down process...');
  if (botPid) {
    const command = process.platform === 'win32' ? `taskkill /F /PID ${botPid}` : `kill ${botPid}`;
    execSync(command);
    console.log('[STARTUP] ✔️ Bot stopped successfully');
  }
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
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[an][bn];
  };
  return availableCommands.reduce((closest, cmd) => {
    const distance = levenshtein(command, cmd);
    return distance < closest.distance ? { command: cmd, distance } : closest;
  }, { command: '', distance: Infinity }).command;
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
  if (inputLocked) return;
  const command = data.toString().trim();
  const [main, sub, arg, arg2] = command.split(' ');
  if (main === '#') {
    if (sub === 'toggle') {
      await handleToggleCommand(arg, arg2, command.split(' ')[4]);
    } else if (sub === 'token') {
      if (arg === 'edit') editToken();
      else if (arg === 'delete') deleteToken();
      else if (arg === 'save') saveToken();
      else console.log('[TOKEN] Use # token edit/save/delete');
    } else if (sub === 'start') startBot();
    else if (sub === 'stop') stopBot();
    else if (sub === 'restart') restartBot();
    else if (sub === 'help') {
      console.log('[COMMANDS] # token | # toggle | # start | # stop | # restart');
    }
  } else if (main === '@' && sub === 'shutdown') shutdownProcess();
});
process.stdin.resume();

//,,,,,,,,,,,,,,,,,,
//END OF KERNEL.js |
//``````````````````