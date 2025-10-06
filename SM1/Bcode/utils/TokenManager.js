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

    /**
     * Load token based on priority:
     * 1. .env (DEV mode)
     * 2. token.json (save or temp based on flags)
     */
    async loadToken() {
    try {
        console.log('\n[SYSTEM] 🔄 Starting token load sequence');

        // ✅ Check for DEV mode via .env
        const envConfig = dotenv.config({ path: this.envPath });
        const isDevMode = envConfig.parsed?.MODE === 'DEV';
        if (isDevMode) {
            console.log('[SYSTEM] 🔧 Development mode detected');
            const envToken = envConfig.parsed?.TOKEN;
            if (!envToken || envToken === 'your-bot-token-here' || envToken === 'empty-token') {
                throw new Error('{ERROR} ❌ Please Input a Token Using # token edit to use your bot');
            }
            console.log('[SYSTEM] ✅ Loaded token from .env [DEV MODE]');
            this.setTokenInfo(envToken, '.env [DEV MODE]');
            this.isDev = true;
            return envToken;
        }

        // ✅ Load token.json
        const jsonData = await fs.readFile(this.configPath, 'utf8');
        const parsed = JSON.parse(jsonData);
        const { save, temp, loadtokensave, loadtokentemp } = parsed;

        // Validate toggle states
        if (loadtokensave && loadtokentemp) {
            throw new Error('{ERROR} ❌ Both loadtokensave and loadtokentemp are true. Only one can be true.');
        }
        if (!loadtokensave && !loadtokentemp) {
            throw new Error('{ERROR} ❌ Both loadtokensave and loadtokentemp are false. One must be true.');
        }

        const activeToken = loadtokensave ? save?.trim() : temp?.trim();
        const sourceLabel = loadtokensave ? 'token.json [SAVED]' : 'token.json [TEMP]';

        // 🔍 Check for empty or "empty-token"
        if (!activeToken || activeToken.toLowerCase() === 'empty-token') {
            throw new Error('{ERROR} ❌ Please Input a Token Using # token edit to use your bot');
        }

        // 🔍 Validate token format
        if (!this.isValidTokenFormat(activeToken)) {
            throw new Error(`Invalid token format in ${sourceLabel}`);
        }

        this.setTokenInfo(activeToken, sourceLabel);
        return activeToken;

        } catch (err) {
            console.error(err.message);
            console.error('[HINT] Ensure token.json or .env is configured properly.');
            return null;
        }
    }


    /**
     * Validate Discord bot token format
     */
    isValidTokenFormat(token) {
        const tokenRegex = /^[\w-]{24,}\.[\w-]{6,}\.[\w-]{27,}$/;
        const valid = tokenRegex.test(token.trim());
        if (!valid) {
            console.warn('[TOKEN-CHECK] Rejected token: Invalid format');
        }
        return valid;
    }

    /**
     * Store token info and mask it for display
     */
    setTokenInfo(token, source) {
        this.tokenSource = source;
        this.maskedToken = `${token.slice(0, 5)}...${token.slice(-5)}`;
        console.log(`[SYSTEM] ✅ Token source set: ${source}`);
        console.log(`[SYSTEM] ✅ Masked token: ${this.maskedToken}`);
    }

    /**
     * Display token information with bot stats
     */
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
📊 Servers In     : ${this.client?.guilds?.cache.size || 0}
🤖 Logged in As   : ${this.client?.user?.tag || 'Unknown'}
🆔 Bot ID         : ${this.client?.user?.id || 'Unknown'}
🔑 Logged in with : ${this.maskedToken} (${this.tokenSource})
📁 Loaded CF      : ${stats.mainCommands || 0}
🎮 Commands Total : ${stats.commands || 0} (${stats.mainCommands} main, ${stats.subCommands} sub)
===========================================`
        };
    }

    /**
     * Save token into token.json (manual override)
     */
    async saveToken(token, useAs = 'save') {
    try {
        const jsonData = await fs.readFile(this.configPath, 'utf8');
        const parsed = JSON.parse(jsonData);

        parsed[useAs] = token;

        // Optional: set the load flag automatically
        parsed.loadtokensave = useAs === 'save';
        parsed.loadtokentemp = useAs === 'temp';

        await fs.writeFile(this.configPath, JSON.stringify(parsed, null, 2));
        console.log('[SYSTEM] ✅ Token saved successfully');
         return true;
        } catch (error) {
            console.error('{ERROR} ❌ Failed to save token:', error);
            return false;
        }
    }

}
//
module.exports = { TokenManager };
