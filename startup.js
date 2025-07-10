const { join } = require('path');
const path = require('path');
const { execSync } = require('child_process');
const moduleCHK = require('./Bcode/utils/moduleCHK');
console.log('[STARTUP] 📝 Bcode Startup Script installing NODE_MODULES');
moduleCHK.checkAndInstallModules(path.join(__dirname, 'Bcode'));
console.log('[STARTUP] 📝 Bcode Startup Script NODE_MODULE installed..');
const TokenEditorUtility = require('./Utility/tokenEditorUtility');
const startup = require('./Utility/CMDstartup')(CMDtoggle);
const bcodePath = join(__dirname, 'Bcode');
const tokenEditor = new TokenEditorUtility();
console.log('[STARTUP] 📝 Bcode Startup Script Online');
console.log('[STARTUP]\n⚙ Working Commands\n2.dcb token save <TOKEN>\n3.dcb token edit <NEW_TOKEN>\n4.dcb token delete\n5.dcb start\n6.dcb stop\n7.dcb restart\n8.dcb help\n\n⚙ Working STARTUP Commands\n1.su shutdown\n2.su help');
// Function toget OS
const getOS = () => {
  switch (process.platform) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return 'Unknown';
  }
};
console.log(`Operating System: ${getOS()}`);
// Function to get the process ID of the bot
const getBotPid = () => {
  const os = getOS();
  let command;
  let pid;

  switch (os) {
    case 'Windows':
      command = 'tasklist';
      // Use tasklist command to get PID on Windows
      pid = getPidFromTasklist(command);
      break;
    case 'macOS':
    case 'Linux':
      command = 'ps -ef';
      // Use ps command to get PID on macOS and Linux
      pid = getPidFromPs(command);
      break;
    default:
      console.error(`Unsupported operating system: ${os}`);
      return null;
  }

  return pid;
};

const getPidFromTasklist = (command) => {
  const output = execSync(command).toString();
  const regex = /node.exe\s+(\d+)/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    if (output.includes('DISCORDSERVERMANAGER')) {
      return match[1];
    }
  }
  return null;
};

const getPidFromPs = (command) => {
  const output = execSync(command).toString();
  const regex = /node\s+(\d+)/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    if (output.includes('DISCORDSERVERMANAGER')) {
      return match[1];
    }
  }
  return null;
};

let botPid;
// Function to check if token exists
const tokenExists = () => {
  const tokenJsonPath = path.join(bcodePath, 'config', 'token.json');
  try {
    const tokenJson = JSON.parse(fs.readFileSync(tokenJsonPath, 'utf8'));
    return tokenJson.token !== '';
  } catch (err) {
    return false;
  }
};

// Function to edit token
const editToken = (newToken) => {
  const tokenEditor = new TokenEditorUtility();
  const errorMessage = tokenEditor.editToken(newToken);
  if (errorMessage) {
    console.log(errorMessage);
  } else {
    console.log('[STARTUP] ✔️ Token edited successfully');
  }
};

// Function to delete token
const deleteToken = () => {
  const tokenEditor = new TokenEditorUtility();
  tokenEditor.deleteToken();
  console.log('[STARTUP] ✔️ Token deleted successfully');
  console.log('[STARTUP] 🚨 Please create a new token using the command:\n "dcb token save <TOKEN>"');
};

// Function to save token
const saveToken = (token) => {
  const errorMessage = tokenEditor.validateToken(token);
  if (errorMessage) {
    console.log(errorMessage);
  } else {
    tokenEditor.saveToken(token);
    console.log('[STARTUP] Token saved successfully');
  }
};
async function startBot() {
  await startup();
  const commandLoader = new CommandLoader();
  await commandLoader.loadCommands();
  const commandManager = new CommandManager(commandLoader);
  // Start the bot here...
}
// Function to stop bot
const stopBot = () => {
  console.log('[STARTUP] ✔️ Stopping bot...');
  if (botPid) {
    const os = process.platform;
    let command;
    if (os === 'win32') {
      command = `taskkill /F /PID ${botPid}`;
    } else {
      command = `kill ${botPid}`;
    }
    execSync(command);
    console.log('[STARTUP] ✔️ Bot stopped successfully');
  } else {
    console.log('[STARTUP] Error: Bot PID not found');
  }
  
  // Delete node_modules folder
  const nodeModulesPath = path.join(bcodePath, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('[STARTUP] 🗑 Deleting node_modules folder...');
    fs.rmdirSync(nodeModulesPath, { recursive: true });
    console.log('[STARTUP] ✔️ node_modules folder deleted successfully');
  } else {
    console.log('[STARTUP] No node_modules folder found.');
  }
};
const restartBot = () => {
  const os = process.platform;
  let command;
  if (os === 'win32') {
    command = 'tasklist /FI "IMAGENAME eq node.exe"';
  } else {
    command = `pidof node`;
  }
  const output = execSync(command).toString();
  if (output.trim() !== '') {
    console.log('[RESTART] 🚀 Bot is online, stopping and restarting...');
    stopBot();
    setTimeout(() => {
      startBot();
    }, 1000); // wait 1 seconds before starting the bot again
    console.log('[RESTART] ✔️ Bot restarted successfully');
  } else {
    console.log('[RESTART] Bot is offline, starting...');
    startBot();
  }
};
// Check if token exists
if (!tokenExists()) {
  console.log('[STARTUP] 🚨 No token found, please create one using the command:');
  console.log('  dcb token save <token>');
}
// Function to shutdown bot
// Function to shutdown process
const shutdownProcess = () => {
  console.log('[STARTUP] ⛔️ Shutting down process...');
  if (botPid) {
    console.log('[STARTUP] ⛔️ Stopping bot...');
    const os = process.platform;
    let command;
    if (os === 'win32') {
      command = `taskkill /F /PID ${botPid}`;
    } else {
      command = `kill ${botPid}`;
    }
    execSync(command);
    console.log('[STARTUP] ✔️ Bot stopped successfully');
  }
  const nodeModulesPath = path.join(bcodePath, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('[STARTUP] 🗑 Deleting node_modules folder...');
    fs.rmdirSync(nodeModulesPath, { recursive: true });
    console.log('[STARTUP] ✔️ node_modules folder deleted successfully');
  } else {
    console.log('[STARTUP] ✔️ No node_modules folder found. Shutting down process...');
  }
  console.log('[STARTUP] ✔️ shutting down...');
  process.exit(0);
};
const levenshteinDistance = (a, b) => {
  const m = a.length;
  const n = b.length;
  const d = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }

  return d[m][n];
};

function suggestClosestCommand(command, suggestions) {
  const parts = command.split(' ');
  const main = parts[0];
  const sub = parts[1];

  if (sub) {
    const subSuggestions = suggestions.filter(cmd => cmd.startsWith(`${main} ${sub}`));
    if (subSuggestions.length > 0) {
      return subSuggestions[0];
    }
  }

  return suggestions[0];
};
process.stdin.on('data', (data) => {
  const command = data.toString().trim();
  const parts = command.split(' ');
  const main = parts[0];
  const sub = parts[1];
  const arg = parts[2];
  const arg2 = parts[3];

  const availableCommands = [
    'dcb token edit',
    'dcb token delete',
    'dcb token save',
    'dcb token help',
    "dcb re-toggle",
    'dcb start',
    'dcb stop',
    'dcb restart',
    'dcb help',
    'su shutdown',
    'su help'
  ];

  // Handle unknown main command
  if (!['dcb', 'su'].includes(main)) {
    const closest = suggestClosestCommand(main, ['dcb', 'su']);
    return console.log(`[ERROR] ❌ Unknown command group. Did you mean "${closest}"?`);
  }

  // Reconstruct full command string
  const fullCommand = parts.slice(0, 3).join(' ').trim();

  if (!availableCommands.includes(`${main} ${sub}`) &&
      !availableCommands.includes(`${main} ${sub} ${arg}`)) {
    const suggestions = availableCommands.filter(cmd => cmd.startsWith(`${main} `));
    const closest = suggestClosestCommand(command, suggestions);
    return console.log(`[ERROR] ❌ Unknown command. Did you mean "${closest}"?`);
  }

  // Command Execution
  if (main === 'dcb') {
    if (sub === 'token') {
      if (arg === 'edit') {
        editToken(arg2);
      } else if (arg === 'delete') {
        deleteToken();
      } else if (arg === 'save') {
        saveToken(arg2);
      } else if (arg === 'help') {
        console.log('|        [TOKEN]');
        console.log('|  dcb token edit <token>  |- Edit the token in system, Please remove "<>" when using');
        console.log('|  dcb token delete        |- Delete the token from system');
        console.log('|  dcb token save <token>  |- Save the token to system, Please remove "<>" when using');
      } else {
        console.log('[ERROR] ❌ Invalid token command. Use "dcb token help"');
      }
    } else if (sub === 'start') {
      startBot();
    } else if (sub === 'stop') {
      stopBot();
    } else if (sub === 'restart') {
      restartBot();
    } else if (sub === 'help') {
      console.log('|    [DCB]');
      console.log('|  dcb token   |- Please Use "dcb token help" for more information');
      console.log('|  dcb start   |- Start the Bot');
      console.log('|  dcb stop    |- Stop the Bot');
      console.log('|  dcb restart |- Restart the Bot, And Apply Changes');
    } else {
      console.log('[ERROR] ❌ Unknown dcb command. Use "dcb help"');
    }
  } else if (main === 'su') {
    if (sub === 'shutdown') {
      shutdownProcess();
    } else if (sub === 'help') {
      console.log('|      [SU]');
      console.log('|  su shutdown   |- Shutdown the process and stop the bot');
    } else {
      console.log('[ERROR] ❌ Unknown su command. Use "su help"');
    }
  }
});
// Keep the process running
process.stdin.setEncoding('utf8');
process.stdin.resume();
