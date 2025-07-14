import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { bcodePath } from '../defined/path-define.js';
import { TokenManager } from '../Bcode/utils/TokenManager.js';

// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TokenEditorUtility {
  constructor() {
    this.tokenManager = new TokenManager();
  }

  isValidTokenFormat(token) {
    return this.tokenManager.isValidTokenFormat(token);
  }

  isDiscordToken(token) {
    const discordTokenRegex = /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/;
    return discordTokenRegex.test(token);
  }

  saveToken(token) {
    return this.tokenManager.saveToken(token);
  }

  editToken(newToken) {
    const errorMessage = this.validateToken(newToken);
    if (errorMessage) {
      console.log(errorMessage);
      return false;
    }
    return this.tokenManager.editToken(newToken);
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
