//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// Prompt.js – Dynamic CLI Prompt System (2025) |
//```````````````````````````````````````````````

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

class Prompt {
  /**
   * Displays a dynamic input banner and returns raw user input.
   * @param {{
   *   promptTitle: string,
   *   promptAsk: string,
   *   defaultValue?: string | boolean | number
   * }} options
   * @returns {Promise<string | boolean | number>}
   */
  static async ask(options = {}) {
    const { promptTitle, promptAsk, defaultValue = '' } = options;

    const rl = readline.createInterface({ input, output });
    const type = typeof defaultValue;

    // Display banner
    console.log(`\n# ${promptTitle}`);
    console.log(`[INFO] ${promptAsk}`);
    if (type === 'boolean') {
      console.log(`[TIP] Enter 'true' or 'false' (default: ${defaultValue})`);
    }

    process.stdout.write('> ');
    const raw = await rl.question('');
    rl.close();

    const trimmed = raw.trim();
    if (!trimmed) return defaultValue;

    if (type === 'boolean') {
      const lower = trimmed.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      return defaultValue;
    }

    if (type === 'number') {
      const num = Number(trimmed);
      return isNaN(num) ? defaultValue : num;
    }

    return trimmed;
  }
}
export default Prompt 
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// END OF Prompt.js |
//```````````````````````````````````````````````