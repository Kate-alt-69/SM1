const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create an embed message')
        .addStringOption(option => 
            option.setName('title')
                .setDescription('Embed title')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('description')
                .setDescription('Embed description')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('color')
                .setDescription('Embed color')
                .addChoices(
                    { name: 'Blue', value: 'Blue' },
                    { name: 'Red', value: 'Red' },
                    { name: 'Green', value: 'Green' }
                )),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color') || 'Blue';

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
