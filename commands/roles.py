from discord import app_commands, Interaction, Member, Role
import discord
from discord.ext import commands

class RoleCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        super().__init__()
        
    @app_commands.command(name="role-bot", description="Toggle a role for all bots in the server")
    @app_commands.describe(
        role="The role to toggle for bots",
        toggle="Whether to add or remove the role"
    )
    @app_commands.choices(
        toggle=[
            app_commands.Choice(name="Add Role ✅", value="add"),
            app_commands.Choice(name="Remove Role ❌", value="remove")
        ]
    )
    @app_commands.default_permissions(manage_roles=True)
    async def role_toggle_bot(self, interaction: Interaction, role: Role, toggle: str):
        try:
            await interaction.response.defer(ephemeral=True)
            
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.followup.send("❌ You don't have permission to manage roles!", ephemeral=True)
                return
            
            bots = [member for member in interaction.guild.members if member.bot]
            success_count = failed_count = skipped_count = 0
            
            for bot_member in bots:
                try:
                    if toggle == "add":
                        if role in bot_member.roles:
                            skipped_count += 1
                            continue
                        await bot_member.add_roles(role, reason=f"Bot role toggle by {interaction.user}")
                    else:  # remove
                        if role not in bot_member.roles:
                            skipped_count += 1
                            continue
                        await bot_member.remove_roles(role, reason=f"Bot role toggle by {interaction.user}")
                    success_count += 1
                except Exception as e:
                    print(f"Error toggling role for bot {bot_member.name}: {e}")
                    failed_count += 1
            
            action = "added to" if toggle == "add" else "removed from"
            response = f"✅ Role {role.mention} {action}:\n"
            response += f"• Success: {success_count} bots\n"
            if skipped_count > 0:
                response += f"• Skipped: {skipped_count} bots (already had correct state)\n"
            if failed_count > 0:
                response += f"• Failed: {failed_count} bots\n"
            
            await interaction.followup.send(response, ephemeral=True)
                
        except Exception as e:
            print(f"Error in role_toggle_bot command: {e}")
            await interaction.followup.send("❌ An error occurred while toggling bot roles!", ephemeral=True)

    @app_commands.command(name="role-add", description="Add a role to a user")
    @app_commands.describe(
        user="The user to add the role to",
        role="The role to add"
    )
    @app_commands.default_permissions(manage_roles=True)
    async def role_add(self, interaction: Interaction, user: Member, role: Role):
        try:
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.response.send_message("❌ You don't have permission to manage roles!", ephemeral=True)
                return
                
            if role.position >= interaction.guild.me.top_role.position:
                await interaction.response.send_message("❌ I cannot manage this role as it's higher than my highest role!", ephemeral=True)
                return
                
            if role in user.roles:
                await interaction.response.send_message(f"❌ {user.mention} already has the role {role.mention}!", ephemeral=True)
                return
                
            await user.add_roles(role, reason=f"Role added by {interaction.user}")
            await interaction.response.send_message(
                f"✅ Successfully added role {role.mention} to {user.mention}",
                ephemeral=True
            )
                
        except Exception as e:
            print(f"Error in role_add command: {e}")
            await interaction.response.send_message("❌ Failed to add role!", ephemeral=True)

    @app_commands.command(name="role-remove", description="Remove a role from a user")
    @app_commands.describe(
        user="The user to remove the role from",
        role="The role to remove"
    )
    @app_commands.default_permissions(manage_roles=True)
    async def role_remove(self, interaction: Interaction, user: Member, role: Role):
        try:
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.response.send_message("❌ You don't have permission to manage roles!", ephemeral=True)
                return
                
            if role.position >= interaction.guild.me.top_role.position:
                await interaction.response.send_message("❌ I cannot manage this role as it's higher than my highest role!", ephemeral=True)
                return
                
            if role not in user.roles:
                await interaction.response.send_message(f"❌ {user.mention} doesn't have the role {role.mention}!", ephemeral=True)
                return
                
            await user.remove_roles(role, reason=f"Role removed by {interaction.user}")
            await interaction.response.send_message(
                f"✅ Successfully removed role {role.mention} from {user.mention}",
                ephemeral=True
            )
                
        except Exception as e:
            print(f"Error in role_remove command: {e}")
            await interaction.response.send_message("❌ Failed to remove role!", ephemeral=True)

    @app_commands.command(name="role-all", description="Add or remove a role from all members")
    @app_commands.describe(
        role="The role to manage",
        action="Whether to add or remove the role"
    )
    @app_commands.choices(
        action=[
            app_commands.Choice(name="Add Role ✅", value="add"),
            app_commands.Choice(name="Remove Role ❌", value="remove")
        ]
    )
    @app_commands.default_permissions(manage_roles=True)
    async def role_all(self, interaction: Interaction, role: Role, action: str):
        try:
            await interaction.response.defer(ephemeral=True)
            
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.followup.send("❌ You don't have permission to manage roles!", ephemeral=True)
                return
                
            if role.position >= interaction.guild.me.top_role.position:
                await interaction.followup.send("❌ I cannot manage this role as it's higher than my highest role!", ephemeral=True)
                return
                
            success_count = failed_count = skipped_count = 0
            
            for member in interaction.guild.members:
                try:
                    if action == "add":
                        if role in member.roles:
                            skipped_count += 1
                            continue
                        await member.add_roles(role, reason=f"Mass role add by {interaction.user}")
                        success_count += 1
                    elif action == "remove":
                        if role not in member.roles:
                            skipped_count += 1
                            continue
                        await member.remove_roles(role, reason=f"Mass role remove by {interaction.user}")
                        success_count += 1
                except Exception as e:
                    print(f"Error managing role for {member.name}: {e}")
                    failed_count += 1
            
            action_text = "added to" if action == "add" else "removed from"
            response = f"✅ Role {role.mention} {action_text}:\n"
            response += f"• Success: {success_count} members\n"
            if skipped_count > 0:
                response += f"• Skipped: {skipped_count} members (already in correct state)\n"
            if failed_count > 0:
                response += f"• Failed: {failed_count} members\n"
            
            await interaction.followup.send(response, ephemeral=True)
                
        except Exception as e:
            print(f"Error in role_all command: {e}")
            await interaction.followup.send("❌ An error occurred while managing roles!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(RoleCommands(bot))
