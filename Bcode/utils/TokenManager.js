const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

class TokenManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/token.json');
        this.envPath = path.join(__dirname, '../.env');
        this.tokenSource = null;
        this.maskedToken = null;
        
        // Add debug logging
        console.log('📝 TokenManager initialized with paths:');
        console.log(`   Config: ${this.configPath}`);
        console.log(`   Env: ${this.envPath}`);
    }

    async loadToken() {
        try {
            console.log('🔄 Starting token load sequence');
            console.log('🔍 Checking token sources...');

            // Clear any cached tokens
            delete process.env.TOKEN_SM;
            delete require.cache[this.configPath];

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
}

module.exports = { TokenManager };
