// ,,,,, START OF Utility_Module/Prompt.js ,,,,,
import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import inputManager from './KNinput.manager.js'; // Adjust path if needed

const settingsPath = path.resolve('./config/settings.json');

function updateInputSource(source) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings['input.from'] = source;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`[SETTINGS] Updated input.from → ${source}`);
  } catch (err) {
    console.error('[ERROR] Failed to update settings.json:', err);
  }
}

class Prompt {
  /**
   * Create and handle a dynamic CLI prompt with routing.
   * @param {{
   *   promptID: string,
   *   title: string,
   *   description: string,
   *   defaultValue?: string | boolean | number,
   *   onReceive?: (input: string | boolean | number) => void | Promise<void>
   * }} config
   * @returns {Promise<string | boolean | number>}
   */
  static async new(config = {}) {
    const {
      promptID = 'generic',
      title = 'Prompt',
      description = '',
      defaultValue = '',
      onReceive = null
    } = config;

    updateInputSource('inprompt');
    if (inputManager?.toggle) inputManager.toggle(false);

    const rl = readline.createInterface({ input, output });
    const type = typeof defaultValue;

    console.log(`\n=== ${title} (${promptID}) ===`);
    console.log(`> ${description}`);
    if (type === 'boolean') console.log(`[TIP] Enter 'true' or 'false' (default: ${defaultValue})`);
    else if (type === 'number') console.log(`[TIP] Must be a number (default: ${defaultValue})`);
    else if (defaultValue !== '') console.log(`[TIP] Press Enter to use default: "${defaultValue}"`);

    process.stdout.write('> ');
    const raw = await rl.question('');
    rl.close();

    const trimmed = raw.trim();
    const result = !trimmed ? defaultValue :
      (type === 'boolean' ? (trimmed.toLowerCase() === 'true' ? true :
      (trimmed.toLowerCase() === 'false' ? false : defaultValue)) :
      (type === 'number' ? (isNaN(Number(trimmed)) ? defaultValue : Number(trimmed)) :
      trimmed));

    if (typeof onReceive === 'function') {
      try { await onReceive(result); }
      catch (err) { console.error(`[ERROR] Failed in onReceive handler for ${promptID}:`, err); }
    }

    updateInputSource('inmanage');
    if (inputManager?.toggle) inputManager.toggle(true);

    return result;
  }
}

export default Prompt;
// ,,,,, END OF Utility_Module/Prompt.js ,,,,,