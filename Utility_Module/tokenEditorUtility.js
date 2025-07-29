// tokenEditorUtility.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { bcodePath } from '../defined/path-define.js';
import { TokenManager } from '../Bcode/utils/TokenManager.js';
import OSCommandHelper from './OScmd.js';
import { getUserInputDynamic } from './Prompt.js'; // ✅ imported your dynamic prompt
// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  async saveTokenInteractive() {
  try {
    const defaultValue = ''; // Or load previous token from JSON if needed
    const token = await getUserInputDynamic('Enter new Discord Bot Token', defaultValue);

    this.unlockInput();

    if (!token || !token.trim()) {
      console.log('[TOKEN] ⚠️ No token provided or user cancelled. Startup continues.');
      return null;
    }

    await this.tokenManager.saveToken(token);
    console.log('[TOKEN] 💾 Token saved successfully.');
    return token;
  } catch (err) {
    console.error('[TOKEN] ❌ Unexpected error during token save:', err);
    this.unlockInput();
    return null;
  }
}

  async editTokenInteractive() {
  try {
    const currentToken = await this.tokenManager.loadFromJson();
    const token = await getUserInputDynamic('Edit Discord Token', currentToken || '');

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

    await this.tokenManager.saveToken(token);
    console.log('[TOKEN] ✅ Token edited and saved successfully.');
    return token;
  } catch (err) {
    console.error('Unexpected error during token edit:', err);
    this.unlockInput();
    return null;
  }
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

  deleteToken() {
    const tokenJsonPath = path.join(bcodePath, 'config', 'token.json');
    try {
      if (!fs.existsSync(tokenJsonPath)) {
        const defaultData = { token: '' };
        fs.mkdirSync(path.dirname(tokenJsonPath), { recursive: true });
        fs.writeFileSync(tokenJsonPath, JSON.stringify(defaultData, null, 2));
        console.log('[TOKEN] 📁 Created missing token.json file.');
      }

      const tokenJson = JSON.parse(fs.readFileSync(tokenJsonPath, 'utf8'));
      tokenJson.token = '';
      fs.writeFileSync(tokenJsonPath, JSON.stringify(tokenJson, null, 2));
      console.log('[TOKEN] 🧹 Token deleted successfully.');
      return true;
    } catch (err) {
      console.error('Error deleting token:', err);
      return false;
    }
  }
}

export default TokenEditorUtility;
