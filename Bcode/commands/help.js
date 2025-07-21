const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows help for bot commands'),

    async execute(interaction) {
        const commands = [...interaction.client.commands.values()];

        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Bot Commands')
            .setDescription('Here are all available commands:')
            .addFields(
                commands.map(cmd => ({
                    name: `/${cmd.data.name}`,
                    value: cmd.data.description || 'No description available',
                    inline: true
                }))
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
};
