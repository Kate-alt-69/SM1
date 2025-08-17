//==========================================================================
// CommandExecutor.js — Command Execution + Error Handling (Flat JSON Support)
//==========================================================================

import fs from 'fs';
import path from 'path';
import { commandsJsonPath } from '../../defined/path-define.js';
import { ErrorCodes, getErrorMessage } from './ErrorCodes.js';

/**
 * Load and parse commands.json
 * @returns {object|null}
 */
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

/**
 * Check if a specific command (or subcommand) is enabled
 * @param {string} fullCommand - e.g., "role.add"
 * @returns {boolean}
 */
function isCommandEnabled(fullCommand) {
  // normalize in case an object is passed
  if (typeof fullCommand === 'object' && fullCommand !== null) {
    fullCommand = fullCommand.full || fullCommand.parent || '';
  }

  if (typeof fullCommand !== 'string') {
    console.warn(`{ERROR} [CommandExecutor] ⚠ fullCommand is not a string:`, fullCommand);
    return true; // fallback to prevent crash
  }

  const commandsJson = loadCommandsJson();
  if (!commandsJson) return true; // fallback: allow if file missing

  // Direct flat key check
  if (typeof commandsJson[fullCommand] === 'boolean') {
    return commandsJson[fullCommand];
  }

  // Folder check
  const [parent] = fullCommand.split('.');
  if (commandsJson?.['__folders']?.[parent]) {
    return commandsJson?.[`${parent}.folder`] === true;
  }

  return true;
}

/**
 * Validate command state before execution
 * @param {string} full - full command name, e.g., "role.add"
 * @returns {null | { success: false, error: string, code: string }}
 */
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

/**
 * Dynamically execute a command’s logic
 * @param {object} options
 * @param {string} options.parent - parent command, e.g., "role"
 * @param {string} options.name - subcommand name, e.g., "add"
 * @param {object} options.ctx - context object (interaction, args, etc.)
 * @returns {Promise<{ success: boolean, error?: string, code?: string }>}
 */
async function executeCommand({ parent, name, ctx }) {
  if (typeof parent !== 'string' || (name && typeof name !== 'string')) {
    return {
      success: false,
      error: `{ERROR} Invalid parent or subcommand: parent=${parent}, name=${name}`,
      code: ErrorCodes.CONSOL_COMMMAND_FAILED
    };
  }

  const fullCommand = name ? `${parent}.${name}` : parent;

  // 1. Check enabled
  const stateError = checkCommandState(fullCommand);
  if (stateError) return stateError;

  // 2. Build path to logic file
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
      error: `{ERROR} ${getErrorMessage(
        ErrorCodes.CONSOL_COMMMAND_FAILED,
        `Command file not found: ${commandFilePath}`
      )}`,
      code: ErrorCodes.CONSOL_COMMMAND_FAILED
    };
  }

  try {
    const commandModule = await import(commandFilePath);
    if (typeof commandModule.run !== 'function') {
      return {
        success: false,
        error: `{ERROR} ${getErrorMessage(
          ErrorCodes.CONSOL_COMMMAND_FAILED,
          `Missing "run" function in ${commandFilePath}`
        )}`,
        code: ErrorCodes.CONSOL_COMMMAND_FAILED
      };
    }

    // 3. Run command
    await commandModule.run(ctx);
    return { success: true };

  } catch (err) {
    console.error(`{ERROR} [CommandExecutor] ❌ Error executing ${fullCommand}:`, err);
    return {
      success: false,
      error: `{ERROR} ${getErrorMessage(
        ErrorCodes.CONSOL_COMMMAND_FAILED,
        `Execution error: ${err.message}`
      )}`,
      code: ErrorCodes.CONSOL_COMMMAND_FAILED
    };
  }
}

export {
  isCommandEnabled,
  checkCommandState,
  executeCommand
};