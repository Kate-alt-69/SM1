const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with bot commands')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Command category')
                .addChoices(
                    { name: '📚 All Commands', value: 'all' },
                    { name: '🛡️ Moderation', value: 'mod' },
                    { name: '🔧 Utility', value: 'util' },
                    { name: '📌 Sticky Messages', value: 'sticky' }
                )),

    async execute(interaction) {
        const category = interaction.options.getString('category') || 'all';

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Server Manager Help')
            .setTimestamp();

        if (category === 'all') {
            embed.setDescription('Available command categories:')
                .addFields(
                    { name: '🛡️ Moderation', value: 'Server moderation commands' },
                    { name: '🔧 Utility', value: 'General utility commands' },
                    { name: '📌 Sticky', value: 'Sticky message commands' }
                );
        } else {
            const commands = {
                mod: [
                    { name: '/kick', value: 'Kick a member from the server' },
                    { name: '/ban', value: 'Ban a member from the server' }
                ],
                util: [
                    { name: '/ping', value: 'Check bot latency' },
                    { name: '/about', value: 'About the bot' }
                ],
                sticky: [
                    { name: '/sticky', value: 'Create a sticky message' },
                    { name: '/unsticky', value: 'Remove a sticky message' }
                ]
            };

            embed.setDescription(`Commands in ${category} category:`)
                .addFields(commands[category] || []);
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
