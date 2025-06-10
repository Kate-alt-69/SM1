const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    SlashCommandBuilder
} = require('discord.js');

class EmbedCreator {
    // ...existing EmbedCreator class from embedCommands.js...
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage embeds')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new embed')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Send a saved embed')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('The embed to send')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send the embed to')
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch(subcommand) {
            case 'create':
                const creator = new EmbedCreator(interaction.client);
                const embed = creator.createPreviewEmbed();
                const components = creator.createComponents();

                await interaction.reply({
                    content: '🔨 Embed Creator - Use the buttons below to customize your embed',
                    embeds: [embed],
                    components,
                    ephemeral: true
                });
                break;

            case 'send':
                // Handle send subcommand
                break;
        }
    }
};
