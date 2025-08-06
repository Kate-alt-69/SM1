//==========================================================================
// TokenEditorUtility.js — Enhanced Command Handling + Startup Checks
// Updated: 2025-08
//==========================================================================

import fs from 'fs';
import path from 'path';
import Prompt from './Prompt.js';
import TokenManagerCJS from '../Bcode/utils/TokenManager.js';
import OSCommandHelper from './OScmd.js';
import { tokenPath } from '../defined/path-define.js';

const { TokenManager } = TokenManagerCJS;

const DEFAULT_TOKEN_STRUCTURE = {
  temp: '',
  save: '',
  loadtokensave: false,
  loadtokentemp: true
};

class TokenEditorUtility {
  constructor(setInputLockCallback) {
    this.tokenManager = new TokenManager();
    this.unlockInput = setInputLockCallback;
    this.osHelper = new OSCommandHelper();
    this.prompt = new Prompt();

    console.log(this.osHelper.getInfoMessage());
    console.log(this.osHelper.getShellUsageNote());

    // ✅ Ensure token.json exists with required structure
    this.ensureTokenFileExists();
  }

  /**
   * ✅ Ensure token.json exists and has required keys
   */
  ensureTokenFileExists() {
    if (!fs.existsSync(tokenPath)) {
      this.writeTokenJson(DEFAULT_TOKEN_STRUCTURE);
    } else {
      const tokens = this.readTokenJson();
      const missingKeys = Object.keys(DEFAULT_TOKEN_STRUCTURE).filter(k => !(k in tokens));
      if (missingKeys.length > 0) {
        this.writeTokenJson({ ...DEFAULT_TOKEN_STRUCTURE, ...tokens });
      }
    }
  }

  /**
   * ✅ Validate token format
   */
  isValidTokenFormat(token) {
    return this.tokenManager.isValidTokenFormat(token);
  }

  /**
   * ✅ Additional check for Discord token format
   */
  isDiscordToken(token) {
    const discordTokenRegex = /^[\w-]{20,100}\.[\w-]{6,30}\.[\w-]{27,100}$/;
    return discordTokenRegex.test(token);
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

  /**
   * ✅ Read token.json
   */
  readTokenJson() {
    try {
      return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    } catch {
      return { ...DEFAULT_TOKEN_STRUCTURE };
    }
  }

  /**
   * ✅ Write token.json
   */
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

  /**
   * ✅ Interactive token edit
   */
  async editTokenInteractive() {
    try {
      const tokens = this.readTokenJson();

      console.log('\n[INFO] Enter your bot token below (paste it fully and press Enter):\n');

      this.unlockInput(true); // Lock main parser during input
      const token = await this.prompt.ask({
        promptTitle: '# token edit',
        promptAsk: 'Bot Token:',
        defaultValue: tokens.temp || tokens.save || '',
        rawMode: true
      });
      this.unlockInput(false); // Restore normal input

      if (!token || !token.trim()) {
        console.log('[TOKEN] ⚠️ Token edit aborted or no data entered.');
        return null;
      }

      const errorMessage = this.validateToken(token);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        return null;
      }

      tokens.temp = token.trim();
      this.writeTokenJson(tokens);
      console.log('[TOKEN] ✅ Temp token set. Use `# token save` to persist.');
      return token;
    } catch (err) {
      console.error('[TOKEN] ❌ Error during token edit:', err);
      this.unlockInput(false);
      return null;
    }
  }

  /**
   * ✅ Save temporary token as permanent
   */
  async saveTokenInteractive() {
    try {
      const tokens = this.readTokenJson();
      const token = tokens.temp;

      this.unlockInput(false);

      if (!token || !token.trim()) {
        console.log('[TOKEN] ⚠️ No temporary token to save.');
        return false;
      }

      const errorMessage = this.validateToken(token);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        return false;
      }

      tokens.save = token;
      tokens.temp = '';
      tokens.loadtokensave = true;
      tokens.loadtokentemp = false;

      this.writeTokenJson(tokens);
      console.log('[TOKEN] 💾 Temp token saved as permanent and set for startup.');
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Error saving token:', err);
      this.unlockInput(false);
      return false;
    }
  }

  /**
   * ✅ Delete tokens
   */
  deleteToken({ all = false } = {}) {
    try {
      const tokens = this.readTokenJson();

      if (all) {
        tokens.save = '';
        tokens.temp = '';
        tokens.loadtokensave = false;
        tokens.loadtokentemp = true;
        console.log('[TOKEN] 🧹 Deleted both saved and temporary token.');
      } else {
        tokens.temp = '';
        console.log('[TOKEN] 🧼 Temporary token cleared.');
      }

      this.writeTokenJson(tokens);
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to delete token:', err);
      return false;
    }
  }

  /**
   * ✅ Switch token modes
   */
  enableTempToken() {
    try {
      const tokens = this.readTokenJson();
      tokens.loadtokentemp = true;
      tokens.loadtokensave = false;
      this.writeTokenJson(tokens);
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
      tokens.loadtokensave = true;
      tokens.loadtokentemp = false;
      this.writeTokenJson(tokens);
      console.log('[TOKEN] ✅ Using SAVED token for startup.');
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to enable saved token:', err);
      return false;
    }
  }

  /**
   * ✅ Load token for startup
   */
  async loadTokenForStartup() {
    const tokens = this.readTokenJson();
    if (tokens.loadtokentemp) return tokens.temp || null;
    if (tokens.loadtokensave) return tokens.save || null;
    return null;
  }

  /**
   * ✅ Show help table
   */
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

  /**
   * ✅ Handle commands from CLI
   */
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

    if (arg === 'help') {
      this.showHelp();
      return;
    }

    if (arg === 'edit') {
      await this.editTokenInteractive();
      return;
    }

    if (arg === 'save') {
      await this.saveTokenInteractive();
      return;
    }

    if (arg === 'delete') {
      this.deleteToken({ all: true });
      return;
    }

    if (arg === 'load') {
      if (!arg2) {
        console.log('\n[TOKEN] 💡 Use "# token load [save.token | temp.token]"');
        return;
      }
      if (arg2 === 'save.token') this.enableSavedToken();
      else if (arg2 === 'temp.token') this.enableTempToken();
      else console.log('[TOKEN] ❌ Invalid load option. Use "save.token" or "temp.token".');
      return;
    }
  }

  /**
   * ✅ Ensure token exists on startup
   */
  async ensureTokenOnStartup() {
    const token = await this.loadTokenForStartup();
    if (!token) {
      console.log('[STARTUP] 🚨 No token found. Prompting user...');
      const newToken = await this.editTokenInteractive();
      if (!newToken) {
        console.log('[STARTUP] ⚠️ No token provided. Continuing without bot startup.');
      }
    } else {
      console.log('[STARTUP] ✔️ Token found. Use "# start" to launch.');
    }
  }
}

export default TokenEditorUtility;
