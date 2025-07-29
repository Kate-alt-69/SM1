//,,,,,,,,,,,,,,,,,,|
//Start OF Prompt.js|
//``````````````````|

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
/**
 * Dynamic banner-style prompt.
 * Shows a simple one-line header like a thumbnail,
 * then prompts once with smart defaults.
 * @param {string} field - What the prompt should display (acts like a banner)
 * @param {string | boolean} defaultV - The current/default value
 * @returns {Promise<string | boolean>}
 */
export async function getUserInputDynamic(field, defaultV = '') {
  const rl = readline.createInterface({ input, output });
  const inputType = typeof defaultV;
  // Optional tip above prompt
  if (inputType === 'boolean') {
    console.log(`[TIP] Enter 'true' to enable, 'false' to disable (default: ${defaultV})`);
  }
  // Banner-style line
  process.stdout.write(`${field} = `);
  const response = await rl.question('');
  rl.close();
  if (inputType === 'boolean') {
    const lower = response.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return defaultV;
  }
  return response.trim() || defaultV;
}
//````````````````|
//End OF Prompt.js|
//,,,,,,,,,,,,,,,,|