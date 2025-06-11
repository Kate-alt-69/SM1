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
        
        // Add debug logging
        console.log('📝 TokenManager initialized with paths:');
        console.log(`   Config: ${this.configPath}`);
        console.log(`   Env: ${this.envPath}`);
    }

    async loadToken(devMode = false, token = null) {
        if (devMode) {
            try {
                require('dotenv').config();
                return process.env.BOT_TOKEN;
            } catch (err) {
                console.error('Failed to load dev token:', err);
                return null;
            }
        }

        try {
            console.log('🔄 Starting token load sequence');
            console.log('🔍 Checking token sources...');

            // Clear any cached tokens
            delete process.env.TOKEN_SM;
            delete require.cache[this.configPath];

            if (token) {
                console.log('✅ Using provided token directly');
                this.setTokenInfo(token, 'Provided Token');
                return token;
            }

            // Load from .env first (priority)
            const envToken = await this.loadFromEnv();
            if (envToken) {
                console.log('✅ Successfully loaded token from .env [MODE : DEV]');
                this.setTokenInfo(envToken, '.env');
                return envToken;
            }

            // Fallback to token.json
            const jsonToken = await this.loadFromJson();
            if (jsonToken) {
                console.log('✅ Successfully loaded token from token.json');
                this.setTokenInfo(jsonToken, 'token.json');
                return jsonToken;
            }

            // As a last resort, load from bot_data.json
            const botDataToken = await this.loadBotData();
            if (botDataToken) {
                console.log('✅ Successfully loaded token from bot_data.json');
                this.setTokenInfo(botDataToken, 'bot_data.json');
                return botDataToken;
            }

            throw new Error('No valid token found in any source');
        } catch (err) {
            console.error('❌ Token loading failed:', err.message);
            return null;
        }
    }

    setTokenInfo(token, source) {
        this.tokenSource = source;
        // Mask more of the token for security
        this.maskedToken = `${token.slice(0, 5)}...${token.slice(-5)}`;
        console.log(`✅ Token source set to: ${source}`);
        console.log(`✅ Token validated and masked: ${this.maskedToken}`);
    }

    getTokenInfo() {
        return {
            source: this.tokenSource || 'Unknown',
            maskedToken: this.maskedToken || 'Not Available'
        };
    }

    async loadFromJson() {
        const data = await fs.readFile(this.configPath, 'utf8');
        const { token } = JSON.parse(data);
        return token?.trim();
    }

    async loadFromEnv() {
        dotenv.config({ path: this.envPath, override: true });
        return process.env.TOKEN_SM?.trim();
    }

    async loadBotData() {
        try {
            const data = await fs.readFile(this.botDataPath, 'utf8');
            const botData = JSON.parse(data);
            const activeBot = botData.bots.find(b => b.active);
            return activeBot?.token;
        } catch (err) {
            console.error('Failed to load bot data:', err);
            return null;
        }
    }

    async saveToken(token) {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify({ token }, null, 2));
            console.log('✅ Token saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to save token:', error);
            return false;
        }
    }
}

module.exports = { TokenManager };
