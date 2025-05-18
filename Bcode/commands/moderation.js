const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for kicking'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        try {
            const member = interaction.options.getMember('member');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            await member.kick(reason);

            const embed = new EmbedBuilder()
                .setTitle('Member Kicked')
                .setDescription(`Successfully kicked ${member} from ${interaction.guild.name}`)
                .setColor('Red')
                .addFields({ name: 'Reason', value: reason })
                .setFooter({ 
                    text: `Kicked by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error(`Error in kick command: ${error}`);
            await interaction.reply({ 
                content: '❌ Failed to kick member!', 
                ephemeral: true 
            });
        }
    }
};
