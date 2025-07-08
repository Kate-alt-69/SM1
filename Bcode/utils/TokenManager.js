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
        
        // Add debug logging
        console.log('📝 TokenManager initialized with paths:');
        console.log(`   Config: ${this.configPath}`);
        console.log(`   Env: ${this.envPath}`);
    }

    async loadToken() {
        try {
            console.log('\n🔄 Starting token load sequence');
            console.log('🔍 Checking token sources...');

            const envConfig = dotenv.config({ path: this.envPath });
            const isDevMode = envConfig.parsed?.MODE === 'DEV';
            
            if (isDevMode) {
                console.log('🔧 Development mode detected');
                const envToken = envConfig.parsed?.TOKEN;

                if (!envToken || envToken === 'your-bot-token-here') {
                    console.error('\n❌ Development Mode Error:');
                    console.error('The default token value was found in .env file');
                    console.error('\n📝 Please add your bot token:');
                    console.error('1. Open Bcode/.env file');
                    console.error('2. Replace "your-bot-token-here" with your actual bot token');
                    console.error('3. Keep MODE=DEV enabled\n');
                    throw new Error('Invalid token in DEV mode - using default value');
                }

                console.log('✅ Successfully loaded token from .env [DEV MODE]');
                this.setTokenInfo(envToken, '.env [DEV MODE]');
                this.isDev = true;
                return envToken;
            }

            // Not in dev mode - load from token.json
            const jsonToken = await this.loadFromJson();
            if (jsonToken) {
                this.setTokenInfo(jsonToken, 'token.json');
                return jsonToken;
            }

            throw new Error('No valid token found');
        } catch (err) {
            console.error(`\n❌ Token loading failed: ${err.message}`);
            return null;
        }
    }

    isValidTokenFormat(token) {
        // Basic Discord token format validation
        const tokenRegex = /^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}$/;
        return tokenRegex.test(token);
    }

    setTokenInfo(token, source) {
        this.tokenSource = source;
        // Mask more of the token for security
        this.maskedToken = `${token.slice(0, 5)}...${token.slice(-5)}`;
        console.log(`✅ Token source set to: ${source}`);
        console.log(`✅ Token validated and masked: ${this.maskedToken}`);
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
