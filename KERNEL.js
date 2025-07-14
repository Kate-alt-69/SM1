// KERNEL.js 
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
  cmdPath,
  commandsJsonPath
} from './defined/path-define.js';
import { toggleCommand, createCommandsJson } from './Utility Module/CMDtoggle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Run structure check
await checkBcodeStructure();
console.log('[CHECK] ✔️ Bcode structure verified successfully!');

// 📦 Ensure node_modules is installed before using packages like dotenv
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

const editToken = (newToken) => {
  const errorMessage = tokenEditor.editToken(newToken);
  if (errorMessage) console.log(errorMessage);
  else console.log('[STARTUP] ✔️ Token edited successfully');
};

const deleteToken = () => {
  tokenEditor.deleteToken();
  console.log('[STARTUP] ✔️ Token deleted successfully');
  console.log('[STARTUP] 🚨 Please create a new token using the command:\n "# token save <TOKEN>"');
};

const saveToken = (token) => {
  const errorMessage = tokenEditor.validateToken(token);
  if (errorMessage) console.log(errorMessage);
  else {
    tokenEditor.saveToken(token);
    console.log('[STARTUP] Token saved successfully');
  }
};

async function startBot() {
  await startup();
  const commandLoader = new CommandLoader();
  await commandLoader.loadCommands();
  const commandManager = new CommandManager(commandLoader);
}

const stopBot = () => {
  console.log('[STARTUP] ✔️ Stopping bot...');
  if (botPid) {
    const command = process.platform === 'win32' ? `taskkill /F /PID ${botPid}` : `kill ${botPid}`;
    execSync(command);
    console.log('[STARTUP] ✔️ Bot stopped successfully');
  } else {
    console.log('[STARTUP] Error: Bot PID not found');
  }

  const nodeModulesPath = path.join(bcodePath, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('[STARTUP] 🗑 Deleting node_modules folder...');
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    console.log('[STARTUP] ✔️ node_modules folder deleted successfully');
  } else {
    console.log('[STARTUP] No node_modules folder found.');
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
if (!tokenExists()) {
  console.log('[STARTUP] 🚨 No token found, please create one using the command:');
  console.log('  # token save <token>');
}
const shutdownProcess = () => {
  console.log('[STARTUP] ⛔️ Shutting down process...');
  if (botPid) {
    const command = process.platform === 'win32' ? `taskkill /F /PID ${botPid}` : `kill ${botPid}`;
    execSync(command);
    console.log('[STARTUP] ✔️ Bot stopped successfully');
  }
  const nodeModulesPath = path.join(bcodePath, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('[STARTUP] 🗑 Deleting node_modules folder...');
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    console.log('[STARTUP] ✔️ node_modules folder deleted successfully');
  } else {
    console.log('[STARTUP] ✔️ No node_modules folder found. Shutting down process...');
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
process.stdin.on('data', (data) => {
  const command = data.toString().trim();
  const [main, sub, arg, arg2] = command.split(' ');
  const availableCommands = [
    '# token edit',
    '# token delete',
    '# token save',
    '# token help',
    '# re-toggle true',
    '# re-toggle false',
    '# start',
    '# stop',
    '# restart',
    '# help',
    '#-dev shutdown',
    '#-dev help'
  ];
  if (main === '#') {
    if (sub === 're-toggle') {
      if (arg === 'true') toggleCommand('re-toggle', true);
      else if (arg === 'false') toggleCommand('re-toggle', false);
      else console.log('[ERROR] ❌ Invalid argument for re-toggle. Use "true" or "false".');
    } else if (sub === 'token') {
      if (arg === 'edit') editToken(arg2);
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
    const closest = suggestClosestCommand(main, ['#', '#-dev']);
    console.log(`[ERROR] ❌ Unknown command group. Did you mean "${closest}"?`);
  }
});
process.stdin.resume();