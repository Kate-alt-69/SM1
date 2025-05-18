const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('About the bot'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Welcome to Server Manager!')
            .setDescription('A powerful Discord bot for server management')
            .setColor('Purple')
            .addFields({
                name: '🛠️ Features',
                value: '• Server Management\n• Custom Commands\n• Moderation Tools',
            })
            .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.guild.iconURL()
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
