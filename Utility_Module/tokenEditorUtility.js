//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// TokenEditorUtility.js — Enhanced Format + Usage Flags Support          |
// Updated: 2025-08                                                        |
//------------------------------------------------------------------------//

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

    // Ensure token.json is present on init
    this.ensureTokenFileExists();
  }

  ensureTokenFileExists() {
    if (!fs.existsSync(tokenPath)) {
      this.writeTokenJson(DEFAULT_TOKEN_STRUCTURE);
    } else {
      const tokens = this.readTokenJson();
      const missingKeys = Object.keys(DEFAULT_TOKEN_STRUCTURE).filter(k => !(k in tokens));
      if (missingKeys.length > 0) {
        // Merge missing defaults without overwriting existing values
        this.writeTokenJson({ ...DEFAULT_TOKEN_STRUCTURE, ...tokens });
      }
    }
  }

  isValidTokenFormat(token) {
    return this.tokenManager.isValidTokenFormat(token);
  }

  isDiscordToken(token) {
    const discordTokenRegex = /^[\w-]{20,100}\.[\w-]{6,30}\.[\w-]{27,100}$/;
    return discordTokenRegex.test(token);
  }

  validateToken(token) {
    if (!this.isValidTokenFormat(token)) {
      return 'Error: ⛔️ Invalid token format. Please use a valid token format.';
    }
    if (!this.isDiscordToken(token)) {
      return 'Error: ⛔️ Token is not a Discord token. Please use a valid Discord token.';
    }
    return null;
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

  async editTokenInteractive() {
    try {
      const tokens = this.readTokenJson();

      const token = await Prompt.ask({
        promptTitle: '# token edit',
        promptAsk: 'Enter your bot token.',
        defaultValue: tokens.temp || tokens.save || ''
      });

      this.unlockInput();

      if (!token || !token.trim()) {
        console.log('[TOKEN] ⚠️ Token edit aborted or no data entered.');
        return null;
      }

      const errorMessage = this.validateToken(token);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        return null;
      }

      tokens.temp = token;
      this.writeTokenJson(tokens);
      console.log('[TOKEN] ✅ Temp token set. Use `# token save` to persist.');
      return token;
    } catch (err) {
      console.error('[TOKEN] ❌ Error during token edit:', err);
      this.unlockInput();
      return null;
    }
  }

  async saveTokenInteractive() {
    try {
      const tokens = this.readTokenJson();
      const token = tokens.temp;

      this.unlockInput();

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
      this.unlockInput();
      return false;
    }
  }

  async saveTokenPersistent(token = null) {
    try {
      if (!token) {
        token = await this.prompt.ask({
          promptTitle: '# token save',
          promptAsk: 'Enter permanent bot token to save',
          defaultValue: ''
        });

        if (!token || !token.trim()) {
          console.log('[TOKEN] ❌ No token entered. Operation cancelled.');
          return false;
        }
      }

      const errorMessage = this.validateToken(token);
      if (errorMessage) {
        console.log(`[TOKEN] ❌ ${errorMessage}`);
        return false;
      }

      const tokens = this.readTokenJson();
      tokens.save = token;
      tokens.temp = '';
      tokens.loadtokensave = true;
      tokens.loadtokentemp = false;

      this.writeTokenJson(tokens);
      console.log('[TOKEN] 🔐 Permanent token saved and activated.');
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to save permanent token:', err);
      return false;
    }
  }

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

  async switchTokenMode(mode = 'temp') {
    const tokens = this.readTokenJson();

    if (mode === 'save') {
      tokens.loadtokensave = true;
      tokens.loadtokentemp = false;
      console.log('[TOKEN] 🟢 Now using SAVED token at startup.');
    } else {
      tokens.loadtokentemp = true;
      tokens.loadtokensave = false;
      console.log('[TOKEN] 🟢 Now using TEMPORARY token at startup.');
    }

    this.writeTokenJson(tokens);
  }

  async loadTokenForStartup() {
    const tokens = this.readTokenJson();
    if (tokens.loadtokentemp) return tokens.temp || null;
    if (tokens.loadtokensave) return tokens.save || null;
    return null;
  }
}

export default TokenEditorUtility;
