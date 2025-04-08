import discord
from discord import app_commands
from discord.ext import commands
from typing import Optional

class HelpCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        super().__init__()

    async def check_mod_perms(self, interaction: discord.Interaction) -> bool:
        """Check if user is server owner or has mod role"""
        if interaction.user.id == interaction.guild.owner_id:
            return True
            
        if not hasattr(self.bot, "server_info"):
            return False
            
        guild_info = self.bot.server_info.get(interaction.guild.id, {})
        mod_roles = guild_info.get("mod_roles", [])
        
        return any(role.id in mod_roles for role in interaction.user.roles)

    @app_commands.command(name="help", description="Get help with bot commands")
    @app_commands.describe(category="Select a command category to view")
    @app_commands.choices(
        category=[
            app_commands.Choice(name="📚 All Commands", value="all"),
            app_commands.Choice(name="🛡️ Moderation", value="mod"),
            app_commands.Choice(name="🔧 Utility", value="util"),
            app_commands.Choice(name="📌 Sticky Messages", value="sticky"),
            app_commands.Choice(name="👥 Role Management", value="roles")
        ]
    )
    async def help(self, interaction: discord.Interaction, category: str = "all"):
        try:
            commands_info = {
                "mod": {
                    "emoji": "🛡️",
                    "name": "Moderation",
                    "description": "Server moderation and management commands",
                    "commands": {
                        "kick": {
                            "description": "Kick a user from the server",
                            "usage": "/kick <member> [reason]",
                            "perms": "Kick Members"
                        }
                    }
                },
                "util": {
                    "emoji": "🔧", 
                    "name": "Utility",
                    "description": "General utility commands",
                    "commands": {
                        "ping": {
                            "description": "Check bot's latency",
                            "usage": "/ping",
                            "perms": "None"
                        },
                        "about": {
                            "description": "View bot information",
                            "usage": "/about",
                            "perms": "None"
                        },
                        "help": {
                            "description": "Show help menu",
                            "usage": "/help [category]",
                            "perms": "None"
                        }
                    }
                },
                "sticky": {
                    "emoji": "📌",
                    "name": "Sticky Messages",
                    "description": "Manage sticky messages in channels",
                    "commands": {
                        "sticky": {
                            "description": "Create a sticky message in a channel",
                            "usage": "/sticky <message>",
                            "perms": "Manage Messages"
                        },
                        "unsticky": {
                            "description": "Remove sticky message from a channel",
                            "usage": "/unsticky",
                            "perms": "Manage Messages"
                        },
                        "sticky-embed": {
                            "description": "Create a sticky embed message",
                            "usage": "/sticky-embed <title> <description>",
                            "perms": "Manage Messages"
                        }
                    }
                },
                "roles": {
                    "emoji": "👥",
                    "name": "Role Management",
                    "description": "Manage server roles and permissions",
                    "commands": {
                        "role-channel-permissions": {
                            "description": "Set channel permissions for a role",
                            "usage": "/role-channel-permissions <role> <channel> <permission> <value>",
                            "perms": "Manage Roles"
                        },
                        "mass-role": {
                            "description": "Add/remove role from multiple members",
                            "usage": "/mass-role <role> <action> [filter_role]",
                            "perms": "Manage Roles"
                        },
                        "mod-roles": {
                            "description": "Configure moderator roles",
                            "usage": "/mod-roles <action> [role]",
                            "perms": "Administrator"
                        }
                    }
                }
            }

            if category == "all":
                embed = discord.Embed(
                    title="📚 Server Manager Commands",
                    description="Select a category to view specific commands",
                    color=discord.Color.blue()
                )
                
                for cat_id, cat_info in commands_info.items():
                    embed.add_field(
                        name=f"{cat_info['emoji']} {cat_info['name']}",
                        value=cat_info['description'],
                        inline=False
                    )
                
                await interaction.response.send_message(embed=embed, ephemeral=True)
            else:
                if category not in commands_info:
                    await interaction.response.send_message("❌ Invalid category!", ephemeral=True)
                    return

                cat_info = commands_info[category]
                embed = discord.Embed(
                    title=f"{cat_info['emoji']} {cat_info['name']} Commands",
                    description=cat_info['description'],
                    color=discord.Color.blue()
                )
                
                for cmd, info in cat_info["commands"].items():
                    embed.add_field(
                        name=cmd,
                        value=f"Description: {info['description']}\nUsage: `{info['usage']}`\nPermissions: {info['perms']}",
                        inline=False
                    )
                
                await interaction.response.send_message(embed=embed, ephemeral=True)

        except Exception as e:
            print(f"Error in help command: {e}")
            await interaction.response.send_message("❌ An error occurred!", ephemeral=True)

    @app_commands.command(name="setup", description="Check and configure server settings")
    async def setup(self, interaction: discord.Interaction):
        try:
            if interaction.user.id != interaction.guild.owner_id:
                await interaction.response.send_message("❌ Only the server owner can use this command!", ephemeral=True)
                return

            await interaction.response.defer(ephemeral=True)
            
            bot_role = interaction.guild.me.top_role
            issues = []
            
            # Check bot role position
            if bot_role.position != len(interaction.guild.roles) - 1:
                issues.append("❌ Bot's role should be at the top of the role list")
            
            # Check bot permissions
            required_perms = {
                "manage_roles": "Manage Roles",
                "manage_channels": "Manage Channels",
                "kick_members": "Kick Members",
                "ban_members": "Ban Members",
                "moderate_members": "Timeout Members",
                "manage_messages": "Manage Messages"
            }
            
            missing_perms = []
            for perm, name in required_perms.items():
                if not getattr(interaction.guild.me.guild_permissions, perm):
                    missing_perms.append(name)
            
            if missing_perms:
                issues.append("❌ Missing required permissions: " + ", ".join(missing_perms))
            
            embed = discord.Embed(
                title="Server Setup Check",
                color=discord.Color.blue() if not issues else discord.Color.red()
            )
            
            if issues:
                embed.description = "Some issues were found that need to be fixed:"
                for issue in issues:
                    embed.add_field(name="Issue", value=issue, inline=False)
                embed.add_field(
                    name="How to Fix",
                    value="1. Move the bot's role to the top of the role list\n"
                          "2. Ensure the bot has all required permissions",
                    inline=False
                )
            else:
                embed.description = "✅ All setup requirements are met!"
                embed.color = discord.Color.green()
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            print(f"Error in setup command: {e}")
            await interaction.followup.send("❌ An error occurred!", ephemeral=True)

    @app_commands.command(name="mod-roles", description="Configure moderator roles")
    @app_commands.describe(
        action="Choose whether to add or remove a role",
        role="The role to configure"
    )
    @app_commands.choices(
        action=[
            app_commands.Choice(name="Add ➕", value="add"),
            app_commands.Choice(name="Remove ➖", value="remove"),
            app_commands.Choice(name="List 📋", value="list")
        ]
    )
    async def mod_roles(
        self, 
        interaction: discord.Interaction, 
        action: str,
        role: Optional[discord.Role] = None
    ):
        try:
            if interaction.user.id != interaction.guild.owner_id:
                await interaction.response.send_message("❌ Only the server owner can use this command!", ephemeral=True)
                return

            await interaction.response.defer(ephemeral=True)
            
            # Initialize mod_roles in server_info if not exists
            if not hasattr(self.bot, "server_info"):
                self.bot.server_info = {}
            if interaction.guild.id not in self.bot.server_info:
                self.bot.server_info[interaction.guild.id] = {}
            if "mod_roles" not in self.bot.server_info[interaction.guild.id]:
                self.bot.server_info[interaction.guild.id]["mod_roles"] = []
            
            mod_roles = self.bot.server_info[interaction.guild.id]["mod_roles"]
            
            embed = discord.Embed(
                title="Moderator Roles Configuration",
                color=discord.Color.blue()
            )
            
            if action == "list":
                if not mod_roles:
                    embed.description = "No moderator roles configured"
                else:
                    embed.description = "Current moderator roles:"
                    for role_id in mod_roles:
                        role = interaction.guild.get_role(role_id)
                        if role:
                            embed.add_field(name=role.name, value=f"ID: {role.id}", inline=False)
            
            elif action in ["add", "remove"]:
                if not role:
                    await interaction.followup.send("❌ You must specify a role!", ephemeral=True)
                    return
                
                if action == "add":
                    if role.id not in mod_roles:
                        mod_roles.append(role.id)
                        embed.description = f"✅ Added {role.mention} to moderator roles"
                    else:
                        embed.description = f"❌ {role.mention} is already a moderator role"
                else:
                    if role.id in mod_roles:
                        mod_roles.remove(role.id)
                        embed.description = f"✅ Removed {role.mention} from moderator roles"
                    else:
                        embed.description = f"❌ {role.mention} is not a moderator role"
                
                # Save changes
                await self.bot.update_server_info(interaction.guild)
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            
        except Exception as e:
            print(f"Error in mod_roles command: {e}")
            await interaction.followup.send("❌ An error occurred!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(HelpCommands(bot))
