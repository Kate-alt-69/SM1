//==========================================================================
// CommandExecutor.js — Command Execution + Error Handling (Folder & Flat JSON Support)
//==========================================================================

const fs = require('fs');
const path = require('path');

// Fix path to commands.json
const commandsJsonPath = path.join(__dirname, '..', 'config', 'commands.json');
const { ErrorCodes } = require('./ErrorCodes.js');

// Replace import/export with CommonJS
function getErrorMessage(code, details = '') {
    return `Error ${code}: ${details || ErrorCodes[code] || 'Unknown error'}`;
}

function loadCommandsJson() {
  if (!fs.existsSync(commandsJsonPath)) {
    console.warn(`{ERROR} [CommandExecutor] ⚠ commands.json not found at ${commandsJsonPath}`);
    return null;
  }

  try {
    const data = fs.readFileSync(commandsJsonPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`{ERROR} [CommandExecutor] ❌ Failed to parse commands.json: ${err.message}`);
    return null;
  }
}

function isCommandEnabled(fullCommand) {
  if (typeof fullCommand === 'object' && fullCommand !== null) {
    fullCommand = fullCommand.full || fullCommand.parent || '';
  }

  if (typeof fullCommand !== 'string') return true;

  const commandsJson = loadCommandsJson();
  if (!commandsJson) return true;

  // Direct flat key check
  if (typeof commandsJson[fullCommand] === 'boolean') return commandsJson[fullCommand];

  // Folder-based check
  const [parent] = fullCommand.split('.');
  const folderMeta = commandsJson?.['__folders']?.[parent];

  if (folderMeta) {
    // Check if folder is disabled
    if (folderMeta.disabled === true) return false;

    // Check if the command exists in folder and is individually disabled
    if (folderMeta.includes && Array.isArray(folderMeta.includes)) {
      const subcommand = fullCommand.split('.').slice(1).join('.');
      if (subcommand && folderMeta.includes.includes(subcommand)) return true;
    }
    return true;
  }

  return true;
}

function checkCommandState(full) {
  const enabled = isCommandEnabled(full);

  if (!enabled) {
    return {
      success: false,
      error: `{ERROR} ${getErrorMessage(ErrorCodes.COMMAND_DISABLED, full)}`,
      code: ErrorCodes.COMMAND_DISABLED
    };
  }

  return null;
}

async function executeCommand({ parent, name, ctx }) {
  if (typeof parent !== 'string' || (name && typeof name !== 'string')) {
    return {
      success: false,
      error: `{ERROR} Invalid parent or subcommand: parent=${parent}, name=${name}`,
      code: ErrorCodes.CONSOL_COMMMAND_FAILED
    };
  }

  const fullCommand = name ? `${parent}.${name}` : parent;
  const stateError = checkCommandState(fullCommand);
  if (stateError) return stateError;

  const commandFilePath = path.resolve(
    process.cwd(),
    'Bcode',
    'commands',
    parent,
    name ? `${name}.js` : `${parent}.js`
  );

  if (!fs.existsSync(commandFilePath)) {
    return {
      success: false,
      error: `{ERROR} ${getErrorMessage(ErrorCodes.CONSOL_COMMMAND_FAILED, `Command file not found: ${commandFilePath}`)}`,
      code: ErrorCodes.CONSOL_COMMMAND_FAILED
    };
  }

  try {
    const commandModule = await import(commandFilePath);
    if (typeof commandModule.run !== 'function') {
      return {
        success: false,
        error: `{ERROR} ${getErrorMessage(ErrorCodes.CONSOL_COMMMAND_FAILED, `Missing \"run\" function in ${commandFilePath}`)}`,
        code: ErrorCodes.CONSOL_COMMMAND_FAILED
      };
    }

    await commandModule.run(ctx);
    return { success: true };

  } catch (err) {
    console.error(`{ERROR} [CommandExecutor] ❌ Error executing ${fullCommand}:`, err);
    return {
      success: false,
      error: `{ERROR} ${getErrorMessage(ErrorCodes.CONSOL_COMMMAND_FAILED, `Execution error: ${err.message}`)}`,
      code: ErrorCodes.CONSOL_COMMMAND_FAILED
    };
  }
}

module.exports = {
  isCommandEnabled,
  checkCommandState,
  executeCommand,
  getErrorMessage
};
