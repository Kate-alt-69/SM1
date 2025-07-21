const { PermissionFlagsBits } = require('discord.js');

/**
 * Check if user has mod permissions
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').Client} bot
 * @returns {Promise<boolean>}
 */
async function checkModPerms(interaction, bot) {
    // Server owner always has permission
    if (interaction.user.id === interaction.guild.ownerId) {
        return true;
    }

    // Check for mod roles if configured
    if (bot.serverInfo) {
        const guildInfo = bot.serverInfo.get(interaction.guild.id) || {};
        const modRoles = guildInfo.modRoles || [];
        
        return interaction.member.roles.cache.some(role => modRoles.includes(role.id));
    }

    return false;
}

/**
 * Decorator for checking mod permissions
 */
function hasModPerms() {
    return async (interaction) => {
        try {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                await interaction.reply({ 
                    content: "❌ Command module not found!", 
                    ephemeral: true 
                });
                return false;
            }

            const hasPerms = await checkModPerms(interaction, interaction.client);
            if (!hasPerms) {
                await interaction.reply({ 
                    content: "❌ You don't have permission to use this command!", 
                    ephemeral: true 
                });
                return false;
            }

            return true;
        } catch (error) {
            console.error("Permission check error:", error);
            await interaction.reply({ 
                content: "❌ Error checking permissions!", 
                ephemeral: true 
            });
            return false;
        }
    };
}

module.exports = { checkModPerms, hasModPerms };
