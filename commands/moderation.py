from discord import app_commands, Interaction, Member, TextChannel, Role
from discord.ext import commands
import discord
import datetime

class ModerationCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        super().__init__()

    @app_commands.command(name="kick", description="Kick a member from the server")
    @app_commands.describe(member="The member to kick", reason="Reason for kicking")
    @app_commands.default_permissions(kick_members=True)
    async def kick(self, interaction: Interaction, member: Member, reason: str = None):
        try:
            await self.bot.update_server_info(interaction.guild)
            server_name = self.bot.server_info[interaction.guild.id]['name']
            
            await member.kick(reason=reason)
            
            embed = discord.Embed(
                title="Member Kicked",
                description=f"Successfully kicked {member.mention} from {server_name}",
                color=discord.Color.red()
            )
            embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
            embed.set_footer(text=f"Kicked by {interaction.user}", icon_url=interaction.user.display_avatar.url)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            print(f"Error in kick command: {e}")
            await interaction.response.send_message("❌ Failed to kick member!", ephemeral=True)

    @app_commands.command(name="role-channel-permissions", description="Set channel permissions for a role")
    @app_commands.describe(
        role="The role to modify permissions for",
        channel="The channel to modify",
        permission="The permission to modify",
        value="True to allow, False to deny, Both for neutral",
        all_channels="Whether to apply to all channels"
    )
    @app_commands.choices(
        permission=[
            app_commands.Choice(name="View Channel", value="view_channel"),
            app_commands.Choice(name="Manage Channel", value="manage_channel"),
            app_commands.Choice(name="Manage Permissions", value="manage_permissions"),
            app_commands.Choice(name="Create Instant Invite", value="create_instant_invite"),
            app_commands.Choice(name="Send Messages", value="send_messages"),
            app_commands.Choice(name="Embed Links", value="embed_links"),
            app_commands.Choice(name="Attach Files", value="attach_files"),
            app_commands.Choice(name="Add Reactions", value="add_reactions"),
            app_commands.Choice(name="Use External Emojis", value="use_external_emojis"),
            app_commands.Choice(name="Use External Stickers", value="use_external_stickers"),
            app_commands.Choice(name="Mention Everyone", value="mention_everyone"),
            app_commands.Choice(name="Manage Messages", value="manage_messages"),
            app_commands.Choice(name="Read Message History", value="read_message_history"),
            app_commands.Choice(name="Send TTS Messages", value="send_tts_messages"),
            app_commands.Choice(name="Use Slash Commands", value="use_application_commands")
        ],
        value=[
            app_commands.Choice(name="Allow ✅", value="true"),
            app_commands.Choice(name="Deny ❌", value="false"),
            app_commands.Choice(name="Neutral ↔️", value="both")
        ]
    )
    @app_commands.default_permissions(administrator=True)
    async def role_channel_permissions(
        self, 
        interaction: Interaction,
        role: Role,
        channel: TextChannel,
        permission: str,
        value: str,
        all_channels: bool = False
    ):
        try:
            await interaction.response.defer(ephemeral=True)
            
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.followup.send("❌ You don't have permission to manage roles!", ephemeral=True)
                return
                
            channels_to_update = []
            if all_channels:
                channels_to_update = [ch for ch in interaction.guild.channels if isinstance(ch, discord.TextChannel)]
            else:
                channels_to_update = [channel]
                
            success_count = 0
            failed_count = 0
            
            for ch in channels_to_update:
                try:
                    existing_perms = ch.overwrites_for(role)
                    
                    if value == "both":
                        if hasattr(existing_perms, permission):
                            setattr(existing_perms, permission, None)
                        if all(getattr(existing_perms, perm, None) is None for perm in dict(existing_perms)):
                            await ch.set_permissions(role, overwrite=None, 
                                reason=f"Permission reset to neutral by {interaction.user}")
                        else:
                            await ch.set_permissions(role, overwrite=existing_perms, 
                                reason=f"Permission set to neutral by {interaction.user}")
                    else:
                        permission_value = value == "true"
                        setattr(existing_perms, permission, permission_value)
                        await ch.set_permissions(role, overwrite=existing_perms, 
                            reason=f"Permission update by {interaction.user}")
                    
                    success_count += 1
                except Exception as e:
                    print(f"Error setting permissions in channel {ch.name}: {e}")
                    failed_count += 1
            
            value_display = {
                "both": "Neutral ↔️",
                "true": "Allow ✅",
                "false": "Deny ❌"
            }.get(value, "Unknown")
            
            response = f"✅ Updated permissions for role {role.mention}:\n"
            response += f"Permission: `{permission}` set to `{value_display}`\n"
            if all_channels:
                response += f"Updated {success_count} channels successfully"
                if failed_count > 0:
                    response += f" ({failed_count} failed)"
            else:
                if success_count > 0:
                    response += f"Channel: {channel.mention}"
                else:
                    response += "❌ Failed to update permissions"
            
            await interaction.followup.send(response, ephemeral=True)
                
        except Exception as e:
            print(f"Error in role_permissions command: {e}")
            await interaction.followup.send("❌ An error occurred while updating permissions!", ephemeral=True)

    @app_commands.command(name="timeout", description="Timeout a member for a specified duration")
    @app_commands.describe(
        member="The member to timeout",
        duration="Duration in minutes",
        reason="Reason for the timeout"
    )
    @app_commands.default_permissions(moderate_members=True)
    async def timeout(
        self,
        interaction: Interaction,
        member: Member,
        duration: int,
        reason: str = None
    ):
        try:
            if duration < 1 or duration > 40320:  # Max 28 days
                await interaction.response.send_message("Duration must be between 1 minute and 28 days!", ephemeral=True)
                return

            until = discord.utils.utcnow() + datetime.timedelta(minutes=duration)
            await member.timeout(until=until, reason=reason)
            
            embed = discord.Embed(
                title="Member Timed Out",
                description=f"{member.mention} has been timed out",
                color=discord.Color.orange()
            )
            embed.add_field(name="Duration", value=f"{duration} minutes", inline=True)
            embed.add_field(name="Expires", value=discord.utils.format_dt(until, style='R'), inline=True)
            embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
            embed.set_footer(text=f"Timed out by {interaction.user}", icon_url=interaction.user.display_avatar.url)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            print(f"Error in timeout command: {e}")
            await interaction.response.send_message("❌ Failed to timeout member!", ephemeral=True)

    @app_commands.command(name="mass-role", description="Add or remove a role from multiple members")
    @app_commands.describe(
        role="The role to add/remove",
        action="Whether to add or remove the role",
        filter_role="Optional: Only affect members with this role"
    )
    @app_commands.choices(
        action=[
            app_commands.Choice(name="Add ➕", value="add"),
            app_commands.Choice(name="Remove ➖", value="remove")
        ]
    )
    @app_commands.default_permissions(manage_roles=True)
    async def mass_role(
        self,
        interaction: Interaction,
        role: Role,
        action: str,
        filter_role: Role = None
    ):
        try:
            await interaction.response.defer(ephemeral=True)
            
            members_to_update = (
                [m for m in interaction.guild.members if filter_role in m.roles]
                if filter_role
                else interaction.guild.members
            )
            
            success = 0
            failed = 0
            
            for member in members_to_update:
                try:
                    if action == "add":
                        await member.add_roles(role)
                    else:
                        await member.remove_roles(role)
                    success += 1
                except:
                    failed += 1
            
            embed = discord.Embed(
                title="Mass Role Update",
                description=f"Role: {role.mention}",
                color=discord.Color.blue()
            )
            embed.add_field(name="Action", value="Added ➕" if action == "add" else "Removed ➖", inline=True)
            if filter_role:
                embed.add_field(name="Filter", value=f"Members with {filter_role.mention}", inline=True)
            embed.add_field(name="Success", value=str(success), inline=True)
            if failed > 0:
                embed.add_field(name="Failed", value=str(failed), inline=True)
            embed.set_footer(text=f"Updated by {interaction.user}", icon_url=interaction.user.display_avatar.url)
            
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            print(f"Error in mass_role command: {e}")
            await interaction.followup.send("❌ An error occurred!", ephemeral=True)

    @app_commands.command(name="lock-channel", description="Lock or unlock a channel")
    @app_commands.describe(
        channel="The channel to lock/unlock",
        lock="True to lock, False to unlock",
        reason="Reason for locking/unlocking"
    )
    @app_commands.default_permissions(manage_channels=True)
    async def lock_channel(
        self,
        interaction: Interaction,
        channel: TextChannel = None,
        lock: bool = True,
        reason: str = None
    ):
        try:
            channel = channel or interaction.channel
            default_role = interaction.guild.default_role
            
            overwrite = channel.overwrites_for(default_role)
            overwrite.send_messages = not lock
            await channel.set_permissions(
                default_role,
                overwrite=overwrite,
                reason=f"{reason or 'No reason provided'} - By {interaction.user}"
            )
            
            embed = discord.Embed(
                title="Channel Updated",
                description=f"{channel.mention} has been {'locked 🔒' if lock else 'unlocked 🔓'}",
                color=discord.Color.red() if lock else discord.Color.green()
            )
            embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
            embed.set_footer(text=f"Modified by {interaction.user}", icon_url=interaction.user.display_avatar.url)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            print(f"Error in lock_channel command: {e}")
            await interaction.response.send_message("❌ Failed to modify channel!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(ModerationCommands(bot))
