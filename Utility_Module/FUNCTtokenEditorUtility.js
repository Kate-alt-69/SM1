//==========================================================================
// TokenEditorUtility.js — Enhanced Command Handling + Startup Checks
// Updated: 2025-08-14 (Prompt.new + hard-disable input manager during prompts)
//==========================================================================

import fs from 'fs';
import path from 'path';
import Prompt from './Prompt.js';
import TokenManagerCJS from '../Bcode/utils/TokenManager.js';
import OSCommandHelper from './OScmd.js';
import { tokenPath } from '../defined/path-define.js';
import { toggleInput as setInputEnabled } from './KNinput.manager.js';

const { TokenManager } = TokenManagerCJS;

const DEFAULT_TOKEN_STRUCTURE = {
  temp: '',
  save: '',
  loadtokensave: false,
  loadtokentemp: true
};

class TokenEditorUtility {
  /**
   * @param {(enabled:boolean)=>void} [ setInputLockCallback_unused]
   * KERNEL can still pass a callback, but this module now directly controls
   * the global input manager via KNinput.manager.toggleInput to guarantee
   * no per-character echo during prompts.
   */
  constructor(_unused) {
    this.tokenManager = new TokenManager();
    this.osHelper = new OSCommandHelper();

    console.log(this.osHelper.getInfoMessage());
    console.log(this.osHelper.getShellUsageNote());

    // Ensure token.json exists with required structure
    this.ensureTokenFileExists();
  }
  ensureTokenFileExists() {
    if (!fs.existsSync(tokenPath)) {
      this.writeTokenJson(DEFAULT_TOKEN_STRUCTURE);
    } else {
      const tokens = this.readTokenJson();
      const merged = { ...DEFAULT_TOKEN_STRUCTURE, ...tokens };
      this.writeTokenJson(merged);
    }
  }

  readTokenJson() {
    try {
      return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    } catch {
      return { ...DEFAULT_TOKEN_STRUCTURE };
    }
  }

  writeTokenJson(data) {
    try {
      fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
      fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to write token.json:', err);
      return false;
    }
  }
  isValidTokenFormat(token) {
    return this.tokenManager.isValidTokenFormat(token);
  }

  isDiscordToken(token) {
    // Covers classic and mfa tokens reasonably well without overfitting
    const discordTokenRegex = /^(mfa\.[\w-]{20,200}|[\w-]{20,100}\.[\w-]{6,30}\.[\w-]{27,200})$/;
    return typeof token === 'string' && discordTokenRegex.test(token);
  }

  validateToken(token) {
    if (!this.isValidTokenFormat(token)) {
      return '⛔️ Invalid token format. Please use a valid token format.';
    }
    if (!this.isDiscordToken(token)) {
      return '⛔️ Token is not a Discord token. Please use a valid Discord token.';
    }
    return null;
  }
  async #withPromptLock(fn) {
    // Ensure main stdin consumer does not echo per-char while we prompt
    setInputEnabled(false);
    try {
      return await fn();
    } finally {
      setInputEnabled(true);
    }
  }
  async #askForToken({ promptID = 'token.edit', title = 'Edit Bot Token', description = 'Paste your bot token below. This will be saved temporarily.', defaultValue = '' } = {}) {
    return this.#withPromptLock(async () => {
      console.log('\n[INFO] Enter your bot token below (paste it fully and press Enter):\n');

      // Use Prompt.new (the only exported API). It itself will also set
      // settings["input.from"] to `inprompt` and restore after.
      const token = await Prompt.new({
        promptID,
        title,
        description,
        defaultValue
      });

      const trimmed = (token ?? '').toString().trim();
      return trimmed.length ? trimmed : null;
    });
  }
  async editTokenInteractive() {
    try {
      const tokens = this.readTokenJson();
      const provided = await this.#askForToken({
        promptID: 'token.edit',
        title: 'Edit Bot Token',
        description: 'Paste your bot token below. This will be saved temporarily.',
        defaultValue: tokens.temp || tokens.save || ''
      });

      if (!provided) {
        console.log('[TOKEN] ⚠️ Token edit aborted or no data entered.');
        return null;
      }

      const errorMessage = this.validateToken(provided);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        return null;
      }

      const next = { ...tokens, temp: provided };
      this.writeTokenJson(next);
      console.log('[TOKEN] ✅ Temp token set. Use `# token save` to persist.');
      return provided;
    } catch (err) {
      console.error('[TOKEN] ❌ Error during token edit:', err);
      return null;
    }
  }

  async saveTokenInteractive() {
    try {
      const tokens = this.readTokenJson();
      const token = (tokens.temp || '').trim();

      if (!token) {
        console.log('[TOKEN] ⚠️ No temporary token to save.');
        return false;
      }

      const errorMessage = this.validateToken(token);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        return false;
      }

      const next = {
        ...tokens,
        save: token,
        temp: '',
        loadtokensave: true,
        loadtokentemp: false
      };

      this.writeTokenJson(next);
      console.log('[TOKEN] 💾 Temp token saved as permanent and set for startup.');
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Error saving token:', err);
      return false;
    }
  }

  deleteToken({ all = false } = {}) {
    try {
      const tokens = this.readTokenJson();
      const next = { ...tokens };

      if (all) {
        next.save = '';
        next.temp = '';
        next.loadtokensave = false;
        next.loadtokentemp = true;
        console.log('[TOKEN] 🧹 Deleted both saved and temporary token.');
      } else {
        next.temp = '';
        console.log('[TOKEN] 🧼 Temporary token cleared.');
      }

      this.writeTokenJson(next);
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to delete token:', err);
      return false;
    }
  }

  enableTempToken() {
    try {
      const tokens = this.readTokenJson();
      const next = { ...tokens, loadtokentemp: true, loadtokensave: false };
      this.writeTokenJson(next);
      console.log('[TOKEN] ✅ Using TEMPORARY token for startup.');
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to enable temporary token:', err);
      return false;
    }
  }

  enableSavedToken() {
    try {
      const tokens = this.readTokenJson();
      const next = { ...tokens, loadtokensave: true, loadtokentemp: false };
      this.writeTokenJson(next);
      console.log('[TOKEN] ✅ Using SAVED token for startup.');
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to enable saved token:', err);
      return false;
    }
  }

  async loadTokenForStartup() {
    const tokens = this.readTokenJson();
    if (tokens.loadtokentemp) return tokens.temp || null;
    if (tokens.loadtokensave) return tokens.save || null;
    return null;
  }

  showHelp() {
    console.log('\n┌─────────┬───────────────────────────┬─────────────────────────────────────┐');
    console.log('│ (index) │ Command                   │ Description                         │');
    console.log('├─────────┼───────────────────────────┼─────────────────────────────────────┤');
    console.log('│ 0       │ # token edit              │ Edit or set temporary token         │');
    console.log('│ 1       │ # token save              │ Save temporary token as permanent   │');
    console.log('│ 2       │ # token delete            │ Delete temporary and/or saved token │');
    console.log('│ 3       │ # token load save.token   │ Use saved token at startup          │');
    console.log('│ 4       │ # token load temp.token   │ Use temporary token at startup      │');
    console.log('│ 5       │ # token help              │ Show this help menu                 │');
    console.log('└─────────┴───────────────────────────┴─────────────────────────────────────┘\n');
  }

  async handleCommand(arg, arg2) {
    const tCmds = ['edit', 'save', 'delete', 'help', 'load'];

    if (!arg) {
      console.log('\n[TOKEN] 💡 Use "# token help" for available subcommands.');
      return;
    }

    if (!tCmds.includes(arg)) {
      console.log(`[TOKEN] ❌ Unknown subcommand: "${arg}"`);
      this.showHelp();
      return;
    }

    if (arg === 'help') return this.showHelp();
    if (arg === 'edit') return await this.editTokenInteractive();
    if (arg === 'save') return await this.saveTokenInteractive();
    if (arg === 'delete') return this.deleteToken({ all: true });

    if (arg === 'load') {
      if (!arg2) {
        console.log('\n[TOKEN] 💡 Use "# token load [save.token | temp.token]"');
        return;
      }
      if (arg2 === 'save.token') this.enableSavedToken();
      else if (arg2 === 'temp.token') this.enableTempToken();
      else console.log('[TOKEN] ❌ Invalid load option. Use "save.token" or "temp.token".');
    }
  }

  async ensureTokenOnStartup() {
    const token = await this.loadTokenForStartup();
    if (!token) {
      console.log('[STARTUP] 🚨 No token found. Prompting user...');
      const newToken = await this.#askForToken({
        promptID: 'startup.token',
        title: 'Bot Token (Startup)',
        description: 'No token found. Paste your bot token and press Enter.',
        defaultValue: ''
      });

      if (!newToken) {
        console.log('[STARTUP] ⚠️ No token provided. Continuing without bot startup.');
        return;
      }

      const errorMessage = this.validateToken(newToken);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        console.log('[STARTUP] ⚠️ Token rejected. You can re-run with "# token edit".');
        return;
      }

      const tokens = this.readTokenJson();
      const next = { ...tokens, temp: newToken };
      this.writeTokenJson(next);
      console.log('[STARTUP] ✅ Token captured to temp. Use "# token save" to persist.');
    } else {
      console.log('[STARTUP] ✔️ Token found. Use "# start" to launch.');
    }
  }
}

export default TokenEditorUtility;