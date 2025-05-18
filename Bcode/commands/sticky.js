const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Create a sticky message')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to make sticky')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('cooldown')
                .setDescription('Cooldown in seconds')
                .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            const message = interaction.options.getString('message');
            const cooldown = interaction.options.getInteger('cooldown') || 1;
            const channelId = interaction.channelId;

            const stickyMsg = await interaction.channel.send(message);
            
            // Update bot's sticky message tracking
            interaction.client.stickyMessages.set(channelId, {
                messageId: stickyMsg.id,
                content: message,
                isEmbed: false
            });
            
            interaction.client.stickyCooldowns.set(channelId, cooldown);

            await interaction.reply({
                content: '✅ Sticky message created!',
                ephemeral: true
            });

        } catch (error) {
            console.error(`Error in sticky command: ${error}`);
            await interaction.reply({
                content: '❌ Failed to create sticky message!',
                ephemeral: true
            });
        }
    }
};
