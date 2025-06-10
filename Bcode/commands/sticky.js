const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Manage sticky messages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a sticky message')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message to make sticky')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove the sticky message')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;

        if (subcommand === 'set') {
            const message = interaction.options.getString('message');
            
            try {
                // Set the sticky message
                interaction.client.stickyMessages.set(channel.id, {
                    messageId: null,  // Will be set when first sticky is sent
                    content: message,
                    isEmbed: false
                });

                // Send initial sticky
                const stickyMsg = await channel.send(message);
                interaction.client.stickyMessages.get(channel.id).messageId = stickyMsg.id;
                interaction.client.stickyLastSent.set(channel.id, Date.now());

                await interaction.reply({ 
                    content: 'Sticky message set! It will reappear after 3 new messages.',
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Error setting sticky:', error);
                await interaction.reply({
                    content: 'Failed to set sticky message.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'remove') {
            try {
                // Get and delete current sticky if it exists
                const stickyData = interaction.client.stickyMessages.get(channel.id);
                if (stickyData?.messageId) {
                    try {
                        const msg = await channel.messages.fetch(stickyData.messageId);
                        await msg.delete();
                    } catch (e) {
                        // Ignore if message already deleted
                    }
                }

                // Clear sticky data
                interaction.client.stickyMessages.delete(channel.id);
                interaction.client.stickyLastSent.delete(channel.id);

                await interaction.reply({
                    content: 'Sticky message removed!',
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error removing sticky:', error);
                await interaction.reply({
                    content: 'Failed to remove sticky message.',
                    ephemeral: true
                });
            }
        }
    }
};
