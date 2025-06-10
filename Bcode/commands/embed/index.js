const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder 
} = require('discord.js');
const { ErrorCodes, ErrorMessages } = require('../../utils/ErrorCodes');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage embeds')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new embed'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Send a saved embed')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the embed')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            if (interaction.options.getSubcommand() === 'create') {
                const modal = new ModalBuilder()
                    .setCustomId('embed-create')
                    .setTitle('Create New Embed');

                const titleInput = new TextInputBuilder()
                    .setCustomId('embedTitle')
                    .setLabel('Embed Title')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const descInput = new TextInputBuilder()
                    .setCustomId('embedDescription')
                    .setLabel('Embed Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput)
                );

                // Just show modal without deferring
                try {
                    return await interaction.showModal(modal);
                } catch (error) {
                    console.error('Modal error:', error);
                    await interaction.reply({
                        content: `${ErrorMessages[ErrorCodes.MODAL_FAILED]} (Code: ${ErrorCodes.MODAL_FAILED})`,
                        ephemeral: true
                    });
                }
            }

            if (interaction.options.getSubcommand() === 'send') {
                try {
                    await interaction.deferReply({ ephemeral: true });
                    await interaction.editReply({ content: 'Send feature coming soon!' });
                } catch (error) {
                    console.error('Send error:', error);
                    await interaction.reply({
                        content: `${ErrorMessages[ErrorCodes.EMBED_SEND_FAILED]} (Code: ${ErrorCodes.EMBED_SEND_FAILED})`,
                        ephemeral: true
                    });
                }
            }
        } catch (error) {
            console.error('Command error:', error);
            await interaction.reply({
                content: `${ErrorMessages[ErrorCodes.INTERACTION_FAILED]} (Code: ${ErrorCodes.INTERACTION_FAILED})`,
                ephemeral: true
            });
        }
    },

    async handleModalSubmit(interaction) {
        try {
            if (interaction.customId === 'embed-create') {
                const title = interaction.fields.getTextInputValue('embedTitle');
                const description = interaction.fields.getTextInputValue('embedDescription');

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(0x0099FF);

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('edit_color')
                        .setLabel('Color')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('edit_footer')
                        .setLabel('Footer')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('edit_image')
                        .setLabel('Image')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.reply({
                    content: 'Here\'s your embed! Use the buttons to customize it further.',
                    embeds: [embed],
                    components: [buttons],
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Modal submit error:', error);
            await interaction.reply({
                content: `${ErrorMessages[ErrorCodes.EMBED_CREATE_FAILED]} (Code: ${ErrorCodes.EMBED_CREATE_FAILED})`,
                ephemeral: true
            });
        }
    },

    async handleButton(interaction) {
        try {
            // Will add button handling later
            await interaction.reply({
                content: 'Button functionality coming soon!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Button error:', error);
            await interaction.reply({
                content: `${ErrorMessages[ErrorCodes.BUTTON_FAILED]} (Code: ${ErrorCodes.BUTTON_FAILED})`,
                ephemeral: true
            });
        }
    }
};
