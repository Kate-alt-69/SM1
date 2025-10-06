// ,,,,, START OF Utility_Module/Prompt.js ,,,,,
import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import inputManager from './KNinput.manager.js'; // Compatibility

const settingsPath = path.resolve('../config/settings.json');

function updateInputSource(source) {
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      settings['input.from'] = source;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
  } catch (err) {
    // Silently handle error to prevent breaking the auth flow
  }
}

class Prompt {
  /**
   * Main entrypoint for prompts
   * @param {{
   *   promptID?: string,
   *   title?: string,
   *   description?: string,
   *   type?: 'string' | 'number' | 'boolean' | 'truerfalse' | 'select' | 'masked',
   *   defaultValue?: string | boolean | number | null,
   *   choices?: string[],
   *   onReceive?: (input: any) => void | Promise<void>
   * }} config
   * @returns {Promise<any>}
   */
  static async new(config = {}) {
    const {
      promptID = 'generic',
      title = 'Prompt',
      description = '',
      type = 'string',
      defaultValue = '',
      choices = [],
      onReceive = null
    } = config;

    updateInputSource('inprompt');
    if (inputManager?.toggle) inputManager.toggle(false);

    console.log(`\n=== ${title} (${promptID}) ===`);
    if (description) console.log(`> ${description}`);

    let result;

    if (type === 'masked') {
      result = await this.askMasked();
    } else if (type === 'truerfalse') {
      result = await this.askTrueRFalse(defaultValue);
    } else if (type === 'select' && choices.length > 0) {
      result = await this.askSelect(choices, defaultValue);
    } else {
      result = await this.askGeneric(type, defaultValue);
    }

    if (typeof onReceive === 'function') {
      try { await onReceive(result); }
      catch (err) { console.error(`[ERROR] Failed in onReceive handler for ${promptID}:`, err); }
    }

    updateInputSource('inmanage');
    if (inputManager?.toggle) inputManager.toggle(true);

    return result;
  }

  static async askGeneric(type, defaultValue) {
    const rl = readline.createInterface({ input, output });
    if (defaultValue !== '' && defaultValue !== null)
      console.log(`[TIP] Press Enter to use default: "${defaultValue}"`);
    process.stdout.write('> ');
    const raw = await rl.question('');
    rl.close();

    const trimmed = raw.trim();
    if (!trimmed) return defaultValue;

    if (type === 'number') return isNaN(Number(trimmed)) ? defaultValue : Number(trimmed);
    if (type === 'boolean') {
      const low = trimmed.toLowerCase();
      return low === 'true' ? true : low === 'false' ? false : defaultValue;
    }
    return trimmed;
  }

  static async askTrueRFalse(defaultValue = null) {
    const rl = readline.createInterface({ input, output });
    console.log(`[TIP] yes = true, no = false, none/null = null (default: ${defaultValue})`);
    process.stdout.write('> ');
    const raw = await rl.question('');
    rl.close();

    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return defaultValue;

    if (['yes', 'y', 'true'].includes(trimmed)) return true;
    if (['no', 'n', 'false'].includes(trimmed)) return false;
    if (['none', 'null'].includes(trimmed)) return null;

    return defaultValue;
  }

  static async askSelect(choices, defaultValue = null) {
    return new Promise((resolve) => {
      let index = 0;
      const render = () => {
        console.clear();
        console.log('Use ↑/↓ and Enter to choose:');
        choices.forEach((c, i) => {
          console.log(i === index ? `> ${c}` : `  ${c}`);
        });
      };

      const onKey = (chunk) => {
        const key = chunk.toString();
        if (key === '\u0003') { // Ctrl+C
          process.exit();
        } else if (key === '\r') { // Enter
          process.stdin.off('data', onKey);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          resolve(choices[index]);
        } else if (key === '\u001b[A') { // Up
          index = (index - 1 + choices.length) % choices.length;
          render();
        } else if (key === '\u001b[B') { // Down
          index = (index + 1) % choices.length;
          render();
        }
      };

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onKey);
      render();
    });
  }

  static async askMasked() {
    return new Promise((resolve) => {
      let input = '';
      let shiftPressed = false;
      let lastLineLength = 2; // accounts for "> "
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdout.write('> ');

      const renderLine = () => {
        // Clear current line
        process.stdout.write('\r' + ' '.repeat(lastLineLength) + '\r');
        // Write prompt and masked/unmasked input
        process.stdout.write('> ' + (shiftPressed ? input : '#'.repeat(input.length)));
        lastLineLength = 2 + input.length;
      };

      const onData = (data) => {
        const char = data.toString();

        // Handle special keys
        if (char === '\u0003') { // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.exit();
        }

        if (char === '\r' || char === '\n') { // Enter
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
          return;
        }

        if (char === '\b' || char === '\x7F') { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            renderLine();
          }
          return;
        }

        // Handle shift key
        if (char === '\u001B[1;2A' || char === '\u001B[1;2B' || 
            char === '\u001B[1;2C' || char === '\u001B[1;2D') { // Shift + Arrow keys
          shiftPressed = true;
          renderLine();
          return;
        }

        // Handle shift release (detected by other keys)
        if (shiftPressed && char !== '\u001B') {
          shiftPressed = false;
          renderLine();
        }

        // Normal character (only printable)
        if (char >= ' ' && char <= '~') {
          input += char;
          renderLine();
        }
      };

      process.stdin.on('data', onData);
    });
  }
}
export default Prompt;