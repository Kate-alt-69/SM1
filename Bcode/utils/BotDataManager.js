const fs = require('fs').promises;
const path = require('path');

class BotDataManager {
    constructor(client) {
        this.client = client;
        this.dataPath = path.join(__dirname, '../data');
        this.botDataFile = path.join(this.dataPath, 'bot_info.json');
        this.emojiDataFile = path.join(this.dataPath, 'emoji_data.json');
    }

    async initialize() {
        console.log('\n📝 Initializing bot data manager...');
        await this.ensureDataDirectory();
        await this.saveBotInfo();
        await this.saveEmojiData();
        console.log('✅ Bot data initialized successfully');
    }

    async ensureDataDirectory() {
        await fs.mkdir(this.dataPath, { recursive: true });
    }

    async saveBotInfo() {
        const botInfo = {
            id: this.client.user.id,
            username: this.client.user.username,
            discriminator: this.client.user.discriminator,
            avatar: this.client.user.avatarURL(),
            createdAt: this.client.user.createdAt,
            lastUpdated: new Date().toISOString(),
            servers: this.client.guilds.cache.size,
            presence: this.client.user.presence.status
        };

        await fs.writeFile(
            this.botDataFile,
            JSON.stringify(botInfo, null, 2)
        );
        console.log('✅ Saved bot information');
    }

    async saveEmojiData() {
        const emojiData = {
            lastUpdated: new Date().toISOString(),
            emojis: Array.from(this.client.emojis.cache.values()).map(emoji => ({
                id: emoji.id,
                name: emoji.name,
                animated: emoji.animated,
                format: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
                url: emoji.url
            }))
        };

        await fs.writeFile(
            this.emojiDataFile,
            JSON.stringify(emojiData, null, 2)
        );
        console.log(`✅ Saved ${emojiData.emojis.length} emojis`);
    }

    async getBotInfo() {
        try {
            const data = await fs.readFile(this.botDataFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Failed to read bot info:', error);
            return null;
        }
    }

    async getEmoji(name) {
        try {
            const data = await fs.readFile(this.emojiDataFile, 'utf8');
            const { emojis } = JSON.parse(data);
            return emojis.find(e => e.name === name)?.format || null;
        } catch (error) {
            console.error('Failed to get emoji:', error);
            return null;
        }
    }
}

module.exports = { BotDataManager };
