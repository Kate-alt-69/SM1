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
    console.warn(`[CommandExecutor] ⚠ commands.json not found at ${commandsJsonPath}`);
    return null;
  }

  try {
    const data = fs.readFileSync(commandsJsonPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`[CommandExecutor] ❌ Failed to parse commands.json: ${err.message}`);
    return null;
  }
}

/**
 * Check if a specific command (or subcommand) is enabled
 * @param {string} parentCommand - e.g., "role"
 * @param {string} fullCommand - e.g., "role.add"
 * @returns {boolean}
 */
function isCommandEnabled(parentCommand, fullCommand) {
  const commandsJson = loadCommandsJson();
  if (!commandsJson) return true; // fallback: allow if file missing or unreadable

  return commandsJson?.[parentCommand]?.[fullCommand] === true;
}

/**
 * Validate command state before execution
 * @param {object} options
 * @param {string} options.parent - e.g., "role"
 * @param {string} options.full - e.g., "role.add"
 * @returns {null | { error: string, code: string }}
 */
function checkCommandState({ parent, full }) {
  const enabled = isCommandEnabled(parent, full);

  if (!enabled) {
    return {
      error: getErrorMessage(ErrorCodes.COMMAND_DISABLED),
      code: ErrorCodes.COMMAND_DISABLED
    };
  }

  return null;
}
export {
  isCommandEnabled,
  checkCommandState
};
