const { EmbedBuilder } = require('discord.js');

/**
 * Utility functions for embed creation
 */
async function createEmbed(title, description, color, author = null, footerText = null, thumbnailUrl = null) {
    // ...existing code...
}

async function loadStoredEmbed(client, guildId, embedId) {
    return client.storedEmbeds?.[guildId]?.[embedId];
}

module.exports = { createEmbed, loadStoredEmbed };