const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Role management commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add the role to')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove the role from')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const user = interaction.options.getMember('user');
            const role = interaction.options.getRole('role');

            if (!interaction.member.permissions.has('ManageRoles')) {
                return await interaction.reply({
                    content: '❌ You don\'t have permission to manage roles!',
                    ephemeral: true
                });
            }

            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return await interaction.reply({
                    content: '❌ I cannot manage this role as it\'s higher than my highest role!',
                    ephemeral: true
                });
            }

            if (subcommand === 'add') {
                await user.roles.add(role);
                await interaction.reply({
                    content: `✅ Added ${role} to ${user}`,
                    ephemeral: true
                });
            } else {
                await user.roles.remove(role);
                await interaction.reply({
                    content: `✅ Removed ${role} from ${user}`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error(`Error in role command: ${error}`);
            await interaction.reply({
                content: '❌ Failed to manage role!',
                ephemeral: true
            });
        }
    }
};
