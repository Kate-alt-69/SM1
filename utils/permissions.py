from discord import Interaction, app_commands
from typing import Optional

async def check_mod_perms(interaction: Interaction, bot) -> bool:
    """Check if user is server owner or has mod role"""
    # Server owner always has permission
    if interaction.user.id == interaction.guild.owner_id:
        return True
        
    # Check for mod roles if configured
    if hasattr(bot, "server_info"):
        guild_info = bot.server_info.get(interaction.guild.id, {})
        mod_roles = guild_info.get("mod_roles", [])
        
        if any(role.id in mod_roles for role in interaction.user.roles):
            return True
            
    return False

async def has_mod_perms():
    """Decorator for checking mod permissions"""
    async def predicate(interaction: Interaction) -> bool:
        try:
            # Get the cog instance from the client
            cog = interaction.client.get_cog(interaction.command.binding.__class__.__name__)
            if not cog:
                await interaction.response.send_message("❌ Command module not found!", ephemeral=True)
                return False
                
            has_perms = await check_mod_perms(interaction, cog.bot)
            if not has_perms:
                await interaction.response.send_message("❌ You don't have permission to use this command!", ephemeral=True)
                return False
                
            return True
        except Exception as e:
            print(f"Permission check error: {e}")
            await interaction.response.send_message("❌ Error checking permissions!", ephemeral=True)
            return False
        
    return app_commands.check(predicate)
