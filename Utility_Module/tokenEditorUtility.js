// tokenEditorUtility.js with child process integration
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { bcodePath } from '../defined/path-define.js';
import { TokenManager } from '../Bcode/utils/TokenManager.js';
import OSCommandHelper from './OScmd.js';

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
    return new Promise((resolve) => {
      const promptScriptPath = path.join(__dirname, 'tokenPrompt.js');
      const child = spawn('node', [promptScriptPath], {
        stdio: ['inherit', 'pipe', 'inherit']
      });

      let tokenData = '';

      child.stdout.on('data', (data) => {
        tokenData += data.toString();
      });

      child.on('exit', (code) => {
        this.unlockInput();
        if (code === 0 && tokenData.trim()) {
          const token = tokenData.trim();
          this.tokenManager.saveToken(token);
          console.log('[TOKEN] 💾 Token saved successfully.');
          resolve(token);
        } else {
          console.log('[TOKEN] ⚠️ No token provided or user cancelled. Startup continues.');
          resolve(null);
        }
      });
    });
  }

  editTokenInteractive() {
    // You can optionally switch this to a child process too
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('✏️ Enter the new token (or type "cancel" to abort): ', (newToken) => {
      if (newToken.toLowerCase() === 'cancel' || newToken.trim() === '# cancel') {
        console.log('[TOKEN] ❌ Token edit cancelled by user.');
        rl.close();
        this.unlockInput();
        return;
      }
      const errorMessage = this.validateToken(newToken);
      if (errorMessage) {
        console.log(errorMessage);
        rl.close();
        this.unlockInput();
        return;
      }
      this.tokenManager.editToken(newToken);
      console.log('[TOKEN] ✅ Token edited successfully.');
      rl.close();
      this.unlockInput();
    });
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
