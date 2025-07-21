const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emojitest')
        .setDescription('Test custom application emojis'),

    async execute(interaction) {
        const allEmojis = interaction.client.emojiCache.getAllEmojis();

        const embed = new EmbedBuilder()
            .setTitle('Emoji Test')
            .setDescription(`
                **Available Emojis:**
                ${allEmojis.map(e => `
                    ${e.name}: ${e.format}
                    Type: ${e.animated ? 'Animated' : 'Static'}
                    URL: ${e.imageUrl}
                `).join('\n')}
            `)
            .setColor('#0099ff');

        await interaction.reply({ embeds: [embed] });
    }
};
