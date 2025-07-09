const fs = require('fs').promises;
const path = require('path');

class EmojiCache {
    constructor(client) {
        this.client = client;
        this.staticEmojis = new Map();
        this.animatedEmojis = new Map();
        this.dataPath = path.join(__dirname, '../data');
        this.staticFile = path.join(this.dataPath, 'static_emojis.json');
        this.animatedFile = path.join(this.dataPath, 'animated_emojis.json');
    }

    async loadEmojis() {
        console.log('\n[SYSTEM] 🔄 Loading application emojis...');
        
        try {
            const botEmojis = Array.from(this.client.emojis.cache.values());
            console.log(`[SYSTEM] 📥 Fetched ${botEmojis.length} emojis from application`);
            
            // Clear existing data
            this.staticEmojis.clear();
            this.animatedEmojis.clear();
            
            // Process each emoji with detailed logging
            console.log('\n[EMOJI]📋 Emoji Fetch Log:');
            botEmojis.forEach(emoji => {
                const emojiData = {
                    id: emoji.id,
                    name: emoji.name,
                    animated: emoji.animated,
                    format: `<${emoji.animated ? 'a' : ':'}${emoji.name}:${emoji.id}>`,
                    imageUrl: emoji.imageURL({ size: 64 })
                };

                if (emoji.animated) {
                    this.animatedEmojis.set(emoji.name, emojiData);
                    console.log(`   • 🎵 Animated: ${emoji.name}`);
                    console.log(`     ID: ${emoji.id}`);
                    console.log(`     Format: ${emojiData.format}`);
                    console.log(`     URL: ${emojiData.imageUrl}\n`);
                } else {
                    this.staticEmojis.set(emoji.name, emojiData);
                    console.log(`   • 🖼️ Static: ${emoji.name}`);
                    console.log(`     ID: ${emoji.id}`);
                    console.log(`     Format: ${emojiData.format}`);
                    console.log(`     URL: ${emojiData.imageUrl}\n`);
                }
            });

            // Save to files
            await this.saveToFiles();
            
            console.log('📊 Emoji Cache Summary:');
            console.log(`   • Static Emojis: ${this.staticEmojis.size}`);
            console.log(`   • Animated Emojis: ${this.animatedEmojis.size}`);
            console.log(`   • Total Emojis: ${this.staticEmojis.size + this.animatedEmojis.size}\n`);
            
            // Log status
            console.log(`[SYSTEM] ✅ Loaded and saved ${this.staticEmojis.size} static and ${this.animatedEmojis.size} animated emojis`);
            
            // Also save to emoji_data.json for backward compatibility
            await this.saveLegacyFormat();
            
            return true;
        } catch (error) {
            console.error('{ERROR} ❌ Error loading emojis:', error);
            return false;
        }
    }

    async saveToFiles() {
        try {
            await fs.mkdir(this.dataPath, { recursive: true });

            // Save static emojis
            const staticData = {
                type: 'static',
                lastUpdated: new Date().toISOString(),
                count: this.staticEmojis.size,
                emojis: Object.fromEntries(this.staticEmojis)
            };
            await fs.writeFile(
                this.staticFile,
                JSON.stringify(staticData, null, 2)
            );

            // Save animated emojis
            const animatedData = {
                type: 'animated',
                lastUpdated: new Date().toISOString(),
                count: this.animatedEmojis.size,
                emojis: Object.fromEntries(this.animatedEmojis)
            };
            await fs.writeFile(
                this.animatedFile,
                JSON.stringify(animatedData, null, 2)
            );

            console.log(`   • Saved emoji data to:\n     - ${path.basename(this.staticFile)}\n     - ${path.basename(this.animatedFile)}`);
        } catch (error) {
            console.error('{ERROR} ❌ Error saving emoji files:', error);
            throw error;
        }
    }

    async saveLegacyFormat() {
        try {
            const legacyPath = path.join(this.dataPath, 'emoji_data.json');
            const legacyData = {
                lastUpdated: new Date().toISOString(),
                emojis: [
                    ...Array.from(this.staticEmojis.values()),
                    ...Array.from(this.animatedEmojis.values())
                ]
            };
            
            await fs.writeFile(legacyPath, JSON.stringify(legacyData, null, 2));
        } catch (error) {
            console.error('{ERROR} ❌ Saving legacy emoji data:', error);
        }
    }

    getEmoji(name, type = 'any') {
        if (type === 'animated') return this.animatedEmojis.get(name)?.format;
        if (type === 'static') return this.staticEmojis.get(name)?.format;
        return this.animatedEmojis.get(name)?.format || this.staticEmojis.get(name)?.format;
    }

    getAllEmojis(type = 'any') {
        if (type === 'animated') return Array.from(this.animatedEmojis.values());
        if (type === 'static') return Array.from(this.staticEmojis.values());
        return [
            ...Array.from(this.animatedEmojis.values()),
            ...Array.from(this.staticEmojis.values())
        ];
    }
}

module.exports = { EmojiCache };
