const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

class TokenManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/token.json');
        this.envPath = path.join(__dirname, '../.env');
        this.botDataPath = path.join(__dirname, '../config/bot_data.json');
        this.tokenSource = null;
        this.maskedToken = null;
        this.isDev = false;

        console.log('[SYSTEM] 📝 TokenManager initialized with paths:');
        console.log(`   Config: ${this.configPath}`);
        console.log(`   Env: ${this.envPath}`);
    }

    async loadToken() {
        try {
            console.log('\n[SYSTEM] 🔄 Starting token load sequence');
            console.log('[SYSTEM] 🔍 Checking token sources...');
            const envConfig = dotenv.config({ path: this.envPath });
            const isDevMode = envConfig.parsed?.MODE === 'DEV';

            if (isDevMode) {
                console.log('[SYSTEM] 🔧 Development mode detected');
                const envToken = envConfig.parsed?.TOKEN;
                if (!envToken || envToken === 'your-bot-token-here') {
                    console.error('[HINT] : \n❌ Development Mode Error:');
                    console.error('The default token value was found in .env file');
                    throw new Error('{ERROR} ❌ Invalid token in DEV mode - using default value');
                }
                console.log('[SYSTEM] ✅ Successfully loaded token from .env [DEV MODE]');
                this.setTokenInfo(envToken, '.env [DEV MODE]');
                this.isDev = true;
                return envToken;
            }

            const jsonData = await fs.readFile(this.configPath, 'utf8');
            const parsed = JSON.parse(jsonData);
            const { save, temp, loadtokensave, loadtokentemp } = parsed;


            if (loadtokensave && loadtokentemp) {
                throw new Error('{ERROR} ❌ Invalid token.json: Both "loadtokensave" and "loadtokentemp" are true. Only one can be true.');
            }

            if (!loadtokensave && !loadtokentemp) {
                throw new Error('{ERROR} ❌ Invalid token.json: Both "loadtokensave" and "loadtokentemp" are false. At least one must be true.');
            }

            const activeToken = loadtokensave ? save?.trim() : temp?.trim();
            const sourceLabel = loadtokensave ? 'token.json [SAVED]' : 'token.json [TEMP]';

            if (!this.isValidTokenFormat(activeToken)) {
                throw new Error(`❌ Invalid token format in ${sourceLabel}`);
            }

            this.setTokenInfo(activeToken, sourceLabel);
            return activeToken;

        } catch (err) {
            console.error(`{ERROR} \n❌ Token loading failed: ${err.message}`);
            return null;
        }
    }

    isValidTokenFormat(token) {
        const tokenRegex = /^[\w-]{24,}\.[\w-]{6,}\.[\w-]{27,}$/;
        const valid = tokenRegex.test(token.trim());
        if (!valid) {
            console.warn('[TOKEN-CHECK] Rejected token: Invalid format');
        }
        return valid;
    }


    setTokenInfo(token, source) {
        this.tokenSource = source;
        this.maskedToken = `${token.slice(0, 5)}...${token.slice(-5)}`;
        console.log(`[SYSTEM] ✅ Token source set to: ${source}`);
        console.log(`[SYSTEM] ✅ Token validated and masked: ${this.maskedToken}`);
    }

    getTokenInfo() {
        const stats = this.client?.botStats || {
            commands: 0,
            mainCommands: 0,
            subCommands: 0
        };
        return {
            source: this.tokenSource || 'Unknown',
            maskedToken: this.maskedToken || 'Not Available',
            displayString: `===========================================
                                            BOT STATUS                   
                            ===========================================
                            📊 Servers In     : ${this.client?.guilds.cache.size || 0}
                            🤖 Logged in As   : ${this.client?.user?.tag || 'Unknown'}
                            🆔 Bot ID         : ${this.client?.user?.id || 'Unknown'}
                            🔑 Logged in with : ${this.maskedToken} ${this.tokenSource}
                            📁 Loaded CF      : ${stats.mainCommands || 0}
                            🎮 Commands Total : ${stats.commands || 0} (${stats.mainCommands} main, ${stats.subCommands} sub)
                            ===========================================`
        };
    }

    async saveToken(token) {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify({ token }, null, 2));
            console.log('[SYSTEM] ✅ Token saved successfully');
            return true;
        } catch (error) {
            console.error('{ERROR} ❌ Failed to save token:', error);
            return false;
        }
    }
}

module.exports = { TokenManager };
