class TokenService {
    constructor() {
        this.tokenPath = 'Bcode/config/token.json';
        this.configPath = 'Bcode/config';
    }

    async validateToken(token) {
        // Discord tokens follow this format:
        // First part: User/Bot ID encoded in base64
        // Second part: Timestamp
        // Third part: HMAC
        if (!token || typeof token !== 'string') return false;

        const parts = token.split('.');
        if (parts.length !== 3) return false;

        // Check basic structure (no need to decode, just verify format)
        const [idPart, timestamp, hmac] = parts;

        // ID part should be base64 and decode to a valid snowflake
        if (!idPart.match(/^[A-Za-z0-9_-]+$/)) return false;

        // Timestamp should start with 'G' for newer tokens
        if (!timestamp.startsWith('G')) return false;

        // HMAC should be appropriate length and valid chars
        if (!hmac.match(/^[A-Za-z0-9_-]+$/)) return false;

        return true;
    }

    async saveToken(token) {
        try {
            if (!await this.validateToken(token)) {
                throw new Error('Invalid token format');
            }

            await Neutralino.filesystem.createDirectory(this.configPath, { recursive: true });
            await Neutralino.filesystem.writeFile(
                this.tokenPath,
                JSON.stringify({ token }, null, 2)
            );
            return true;
        } catch (error) {
            console.error('Token save error:', error);
            throw new Error('Failed to save token');
        }
    }

    async loadToken() {
        try {
            const tokenFile = await Neutralino.filesystem.readFile(this.tokenPath);
            const { token } = JSON.parse(tokenFile);
            if (!await this.validateToken(token)) {
                console.log('Invalid token format found');
                return null;
            }
            return token;
        } catch {
            // Just return null without throwing an error
            return null;
        }
    }

    async removeToken() {
        try {
            await Neutralino.filesystem.removeFile(this.tokenPath);
            return true;
        } catch {
            return false;
        }
    }

    maskToken(token) {
        if (!token) return null;
        return `${token.slice(0, 6)}...${token.slice(-4)}`;
    }
}

window.TokenService = new TokenService();
