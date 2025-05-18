const { EmbedBuilder } = require('discord.js');

/**
 * Helper function to create embeds consistently
 */
async function createEmbed(title, description, color, author = null, footerText = null, thumbnailUrl = null) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    if (author) {
        embed.setAuthor({
            name: author.displayName,
            iconURL: author.displayAvatarURL()
        });
    }
    
    if (footerText) embed.setFooter({ text: footerText });
    if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
        
    return embed;
}

module.exports = { createEmbed };
