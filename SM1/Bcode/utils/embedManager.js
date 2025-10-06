const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

class EmbedManager {
    constructor() {
        this.cache = new Map();
        this.templates = {};
        this._loadTemplates();
    }

    async _loadTemplates() {
        try {
            const filePath = path.join(__dirname, '..', 'data', 'default_embeds.json');
            const data = await fs.readFile(filePath, 'utf8');
            this.templates = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading templates:', error);
            }
            this.templates = {};
        }
    }

    getTemplate(templateName) {
        return this.templates[templateName] || null;
    }

    createEmbed(templateName = null, options = {}) {
        if (templateName && this.cache.has(templateName)) {
            return EmbedBuilder.from(this.cache.get(templateName));
        }

        const template = templateName ? this.getTemplate(templateName) || {} : {};
        const embedData = { ...template, ...options };

        const embed = new EmbedBuilder()
            .setTitle(embedData.title || '')
            .setDescription(embedData.description || '')
            .setColor(embedData.color || 0);

        if (embedData.footer) {
            embed.setFooter({ text: embedData.footer });
        }

        if (embedData.timestamp) {
            embed.setTimestamp();
        }

        if (templateName) {
            this.cache.set(templateName, embed);
        }

        return embed;
    }
}

module.exports = EmbedManager;
