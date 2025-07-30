// tokenEditorUtility.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { bcodePath } from '../defined/path-define.js';
import { TokenManager } from '../Bcode/utils/TokenManager.js';
import OSCommandHelper from './OScmd.js';
import { getUserInputDynamic } from './Prompt.js';

// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokenJsonPath = path.join(bcodePath, 'config', 'token.json');

class TokenEditorUtility {
  constructor(setInputLockCallback) {
    this.tokenManager = new TokenManager();
    this.unlockInput = setInputLockCallback;
    this.osHelper = new OSCommandHelper();

    console.log(this.osHelper.getInfoMessage());
    console.log(this.osHelper.getShellUsageNote());
  }

  isValidTokenFormat(token) {
    return this.tokenManager.isValidTokenFormat(token);
  }

  isDiscordToken(token) {
    const discordTokenRegex = /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/;
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
      if (!fs.existsSync(tokenJsonPath)) {
        return { temp: '', save: '' };
      }
      return JSON.parse(fs.readFileSync(tokenJsonPath, 'utf8'));
    } catch {
      return { temp: '', save: '' };
    }
  }

  writeTokenJson(data) {
    try {
      fs.mkdirSync(path.dirname(tokenJsonPath), { recursive: true });
      fs.writeFileSync(tokenJsonPath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error('[TOKEN] ❌ Failed to write token.json:', err);
      return false;
    }
  }

  async editTokenInteractive() {
    try {
      const tokens = this.readTokenJson();

      const token = await getUserInputDynamic(
        '# token edit',
        'Enter your bot token (string format)',
        tokens.temp || tokens.save || ''
      );

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
      this.writeTokenJson(tokens);
      console.log('[TOKEN] 💾 Temp token saved as permanent.');
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
        token = await getUserInputDynamic(
          '# token save',
          'Enter permanent bot token to save',
          ''
        );

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
      this.writeTokenJson(tokens);
      console.log('[TOKEN] 🔐 Permanent token saved successfully.');
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

  async loadTokenForStartup() {
    const tokens = this.readTokenJson();
    return tokens.save || null;
  }
}

export default TokenEditorUtility;
