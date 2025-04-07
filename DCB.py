#
#---Kate---
#---Project-1--
#---sign--HELLOIAMKATE---
#---Owner--Kate---
#---MB--Kate---
#---1001---
#
import discord
from discord import app_commands
from discord.ext import commands
import os
from dotenv import load_dotenv
from typing import Union
from discord.ext.commands import CooldownMapping
from datetime import datetime, timedelta
from KA import keep_alive  # Add this import
import asyncio
import json
from colorpickerview import ColorPickerView
import time 

async def get_embed_choices(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    """Get available embed choices for a guild"""
    try:
        guild_embeds = {k: v for k, v in interaction.client.stored_embeds.items() 
                       if v.get('guild_id') == interaction.guild_id}
        
        choices = []
        for embed_id, data in guild_embeds.items():
            if (current.lower() in embed_id.lower() or 
                current.lower() in data.get('title', '').lower()):
                choices.append(app_commands.Choice(
                    name=f"📄 {data.get('title', 'Untitled')}",
                    value=embed_id
                ))
        return choices[:25]  # Discord limits to 25 choices
    except Exception as e:
        print(f"Error in get_embed_choices: {e}")
        return []

# Load environment variables
load_dotenv()
TOKEN = os.getenv("TOKEN_SM")
if not TOKEN:
    raise ValueError("❌ Bot token not found in .env file")

class DataStorage:
    def __init__(self, bot):
        self.bot = bot
        self.data_file = "bot_data.json"
        self.save_lock = asyncio.Lock()
        self.bot.stored_embeds = {}  # Add this line

    async def save_data(self):
        async with self.save_lock:
            data = {
                'sticky_messages': self.bot.sticky_messages,
                'sticky_cooldowns': self.bot.sticky_cooldowns,
                'guild_sticky_messages': getattr(self.bot, 'guild_sticky_messages', {}),
                'server_info': self.bot.server_info,
                'stored_embeds': self.bot.stored_embeds  # Add this line
            }
            try:
                with open(self.data_file, 'w') as f:
                    json.dump(data, f, indent=4)
            except Exception as e:
                print(f"Error saving data: {e}")

    async def load_data(self):
        try:
            with open(self.data_file, 'r') as f:
                data = json.load(f)
                self.bot.sticky_messages = data.get('sticky_messages', {})
                self.bot.sticky_cooldowns = data.get('sticky_cooldowns', {})
                self.bot.guild_sticky_messages = data.get('guild_sticky_messages', {})
                self.bot.server_info = data.get('server_info', {})
                self.bot.stored_embeds = data.get('stored_embeds', {})  # Add this line
        except FileNotFoundError:
            print("No existing data file found, starting fresh")
            self.bot.stored_embeds = {}  # Add this line
        except Exception as e:
            print(f"Error loading data: {e}")

    async def auto_save(self):
        while True:
            await asyncio.sleep(300)  # Save every 5 minutes
            await self.save_data()

class Bot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.all()
        self.server_info = {}
        self.sticky_messages = {}
        self.sticky_cooldowns = {}
        self.sticky_last_sent = {}
        self.guild_sticky_messages = {}
        self.data_storage = DataStorage(self)
        
        # Initialize bot without prefix
        super().__init__(
            command_prefix=None,  # Remove prefix
            intents=intents,
            activity=discord.Game(name="/help | Server Manager"),
            status=discord.Status.online,
            help_command=None  # Disable default help command
        )
    
    async def reload_bot(self):
        """Reload the bot and sync commands"""
        try:
            await self.tree.sync()
            print("✅ Commands synced!")
            return True
        except Exception as e:
            print(f"❌ Error syncing commands: {e}")
            return False
    
    async def update_sticky_message(self, channel_id: int, message_id: int, content: Union[str, dict]):
        """Update sticky message in cache"""
        self.sticky_messages[channel_id] = {
            'message_id': message_id,
            'content': content,
            'is_embed': isinstance(content, dict)
        }

    async def setup_hook(self):
        """Called before the bot starts running"""
        # Load saved data
        await self.data_storage.load_data()
        
        # Start auto-save task
        self.auto_save_task = self.loop.create_task(self.data_storage.auto_save())
        
        await self.tree.sync()
        print("✅ Commands synced!")

    async def update_server_info(self, guild):
        """Update server information cache"""
        self.server_info[guild.id] = {
            'name': guild.name,
            'id': guild.id,
            'member_count': guild.member_count,
            'icon_url': guild.icon.url if guild.icon else None,
            'banner_url': guild.banner.url if guild.banner else None,
            'description': guild.description or "No description set",
            'owner': guild.owner,
            'created_at': guild.created_at,
            'roles': len(guild.roles),
            'channels': len(guild.channels),
            'boost_level': guild.premium_tier,
            'boost_count': guild.premium_subscription_count
        }

    async def on_command_error(self, ctx, error):
        """Handle traditional command errors"""
        if isinstance(error, commands.errors.CommandNotFound):
            await ctx.send("❌ Command not found!")
        elif isinstance(error, commands.errors.MissingPermissions):
            await ctx.send("❌ You don't have permission to use this command!")
        else:
            print(f"An error occurred: {str(error)}")
            await ctx.send("❌ An error occurred while executing the command!")

bot = Bot()

@bot.event
async def on_message(message):
    if message.author.bot:
        return
    
    channel_id = message.channel.id
    if channel_id in bot.sticky_messages:
        # Check cooldown
        now = datetime.utcnow()
        last_sent = bot.sticky_last_sent.get(channel_id)
        cooldown = bot.sticky_cooldowns.get(channel_id, 1)
        
        if last_sent and (now - last_sent).total_seconds() < 0.005:  # 5ms check
            return  # Still on cooldown
            
        sticky_data = bot.sticky_messages[channel_id]
        
        # Delete ALL previous sticky messages to prevent duplication
        async for old_message in message.channel.history(limit=50):  # Increased search limit
            if old_message.author == bot.user and (
                old_message.id == sticky_data.get('message_id') or
                (old_message.embeds and sticky_data.get('is_embed')) or
                (not old_message.embeds and not sticky_data.get('is_embed'))
            ):
                try:
                    await old_message.delete()
                except discord.NotFound:
                    pass
        
        # Wait briefly to ensure message order
        await asyncio.sleep(0.1)
        
        # Send new sticky message
        content = sticky_data['content']
        if isinstance(content, dict) and content.get('type') == 'stored_embed':
            # Use stored embed
            embed_data = content['original_data']
            embed = discord.Embed(
                title=embed_data['title'],
                description=embed_data['description'],
                color=discord.Color(embed_data['color'])
            )
            if embed_data['footer']:
                embed.set_footer(text=f"{embed_data['footer']} • 📌 Sticky message • {message.guild.name}")
            else:
                embed.set_footer(text=f"📌 Sticky message • {message.guild.name}")
            if embed_data['thumbnail']:
                embed.set_thumbnail(url=embed_data['thumbnail'])
            if embed_data['image']:
                embed.set_image(url=embed_data['image'])
            
            new_sticky = await message.channel.send(embed=embed)
        elif sticky_data.get('is_embed', False):
            content = sticky_data['content']
            embed = discord.Embed(
                title=content.get('title', 'Sticky Message'),
                description=content.get('description'),
                color=getattr(discord.Color, content.get('color', 'blue'))()
            )
            embed.set_footer(text=f"📌 Sticky message • {message.guild.name}")
            embed.timestamp = discord.utils.utcnow()
            new_sticky = await message.channel.send(embed=embed)
        else:
            new_sticky = await message.channel.send(sticky_data['content'])
        
        # Update tracking
        bot.sticky_last_sent[channel_id] = now
        await bot.update_sticky_message(
            channel_id,
            new_sticky.id,
            sticky_data['content']
        )

# Error handler for slash commands
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    """Handle slash command errors"""
    try:
        if isinstance(error, app_commands.CommandOnCooldown):
            await interaction.response.send_message(
                f"⏰ Command on cooldown. Try again in {error.retry_after:.2f}s",
                ephemeral=True
            )
        elif isinstance(error, app_commands.MissingPermissions):
            await interaction.response.send_message(
                "🔒 You don't have permission to use this command!",
                ephemeral=True
            )
        else:
            print(f"Slash command error: {str(error)}")
            await interaction.response.send_message(
                "❌ An error occurred while executing this command!",
                ephemeral=True
            )
    except Exception as e:
        print(f"Error in error handler: {str(e)}")

@bot.tree.command(name="ping", description="Check bot's ping")
async def ping(interaction: discord.Interaction):
    latency = round(bot.latency * 1000)
    await interaction.response.send_message(f"🏓 Pong! {latency}ms")

@bot.tree.command(name="about", description="About Of The Bot")
async def embed(interaction: discord.Interaction):
    try:
        # Create embed first
        embed = discord.Embed(
            title="Welcome to Server Manager!",
            description="A powerful Discord bot for server management, and Creating Custom Message's",
            color=discord.Color.purple()
        )
        
        # Add fields to the embed
        embed.add_field(
            name="🛠️ Features", 
            value="• Server Management\n• Custom Commands\n• Moderation Tools", 
            inline=False
        )
        
        # Add author information
        embed.set_author(
            name=interaction.user.display_name,
            icon_url=interaction.user.avatar.url if interaction.user.avatar else None
        )
        
        # Add footer
        embed.set_footer(
            text=f"Requested by {interaction.user.name}",
            icon_url=interaction.guild.icon.url if interaction.guild.icon else None
        )
        
        # Add timestamp
        embed.timestamp = discord.utils.utcnow()
        
        # Send the embed
        await interaction.response.send_message(embed=embed)
        
    except Exception as e:
        print(f"Error in embed command: {e}")
        await interaction.response.send_message(
            "❌ Failed to create embed!",
            ephemeral=True
        )

@bot.tree.command(name="kick", description="Kick a member from the server")
@app_commands.describe(member="The member to kick", reason="Reason for kicking")
@app_commands.default_permissions(kick_members=True)
async def kick(interaction: discord.Interaction, member: discord.Member, reason: str = None):
    try:
        # Update server info
        await bot.update_server_info(interaction.guild)
        server_name = bot.server_info[interaction.guild.id]['name']
        
        await member.kick(reason=reason)
        await interaction.response.send_message(
            f"✅ Successfully kicked {member.mention} from {server_name}\n"
            f"Reason: {reason or 'No reason provided'}",
            ephemeral=True
        )
    except Exception as e:
        print(f"Error in kick command: {e}")
        await interaction.response.send_message("❌ Failed to kick member!", ephemeral=True)

@bot.tree.command(name="sticky", description="Create sticky messages")
@app_commands.describe(
    action="Choose create or create-embed",
    title="Title for embed (only for create-embed)",
    description="Message content or embed description",
    name="Name for your sticky message (used to identify it later)",
    color="Color for embed (optional)",
    cooldown="Cooldown in seconds between sticky messages(default: 1)"
)
@app_commands.choices(
    action=[
        app_commands.Choice(name="create", value="create"),
        app_commands.Choice(name="create-embed", value="create-embed")
    ],
    color=[
        app_commands.Choice(name="blue", value="blue"),
        app_commands.Choice(name="red", value="red"),
        app_commands.Choice(name="green", value="green"),
        app_commands.Choice(name="purple", value="purple")
    ]
)
@app_commands.default_permissions(manage_messages=True)
async def sticky(
    interaction: discord.Interaction,
    action: str,
    description: str,
    name: str,
    title: str = None,
    color: str = "blue",
    cooldown: int = 1
):
    try:
        channel_id = interaction.channel.id
        guild_id = interaction.guild.id
        
        # Initialize guild sticky messages tracking if not exists
        if not hasattr(bot, 'guild_sticky_messages'):
            bot.guild_sticky_messages = {}
        if guild_id not in bot.guild_sticky_messages:
            bot.guild_sticky_messages[guild_id] = {}
            
        # Store cooldown
        bot.sticky_cooldowns[channel_id] = cooldown
        bot.sticky_last_sent[channel_id] = datetime.utcnow()
        
        if action == "create":
            sticky_msg = await interaction.channel.send(description)
            await bot.update_sticky_message(channel_id, sticky_msg.id, description)
            # Store sticky message info
            bot.guild_sticky_messages[guild_id][name] = {
                'channel_id': channel_id,
                'message_id': sticky_msg.id,
                'content': description,
                'is_embed': False
            }
        else:  # create-embed
            colors = {
                "blue": discord.Color.blue(),
                "red": discord.Color.red(),
                "green": discord.Color.green(),
                "purple": discord.Color.purple()
            }
            
            embed = discord.Embed(
                title=title or "Sticky Message",
                description=description,
                color=colors.get(color, discord.Color.blue())
            )
            embed.set_footer(text=f"📌 Sticky message • {interaction.guild.name} • Cooldown: {cooldown}s")
            embed.timestamp = discord.utils.utcnow()
            
            sticky_msg = await interaction.channel.send(embed=embed)
            content = {"type": "embed", "title": title, "description": description, "color": color}
            await bot.update_sticky_message(channel_id, sticky_msg.id, content)
            # Store sticky message info
            bot.guild_sticky_messages[guild_id][name] = {
                'channel_id': channel_id,
                'message_id': sticky_msg.id,
                'content': content,
                'is_embed': True
            }
        
        # After successful sticky message creation
        await bot.data_storage.save_data()
        
        await interaction.response.send_message(
            f"✅ Sticky message '{name}' created with {cooldown}s cooldown!", 
            ephemeral=True
        )
            
    except Exception as e:
        print(f"Error in sticky command: {e}")
        await interaction.response.send_message(
            "❌ Failed to create sticky message!", 
            ephemeral=True
        )

@bot.tree.command(name="sticky-remove", description="Remove a sticky message from the server")
@app_commands.describe(
    name="Name of the sticky message to remove"
)
@app_commands.default_permissions(manage_messages=True)
async def stickyremove(
    interaction: discord.Interaction,
    name: str
):
    try:
        guild_id = interaction.guild.id
        
        if not hasattr(bot, 'guild_sticky_messages') or \
           guild_id not in bot.guild_sticky_messages or \
           name not in bot.guild_sticky_messages[guild_id]:
            await interaction.response.send_message(
                f"❌ No sticky message found with name '{name}'!", 
                ephemeral=True
            )
            return
            
        sticky_info = bot.guild_sticky_messages[guild_id][name]
        channel_id = sticky_info['channel_id']
        
        try:
            channel = interaction.guild.get_channel(channel_id)
            if channel:
                sticky_msg = await channel.fetch_message(sticky_info['message_id'])
                await sticky_msg.delete()
        except (discord.NotFound, discord.Forbidden):
            pass  # Message might already be deleted
        
        # Clean up tracking data
        del bot.guild_sticky_messages[guild_id][name]
        del bot.sticky_messages[channel_id]
        bot.sticky_cooldowns.pop(channel_id, None)
        bot.sticky_last_sent.pop(channel_id, None)
        
        # After successful sticky message removal
        await bot.data_storage.save_data()
        
        await interaction.response.send_message(
            f"✅ Sticky message '{name}' removed!", 
            ephemeral=True
        )
        
    except Exception as e:
        print(f"Error in stickyremove command: {e}")
        await interaction.response.send_message(
            "❌ Failed to remove sticky message!", 
            ephemeral=True
        )

@bot.tree.command(name="sticky-list", description="Get information about the server")
@app_commands.default_permissions(manage_messages=True)
async def stickylist(interaction: discord.Interaction):
    try:
        guild_id = interaction.guild.id
        
        if not hasattr(bot, 'guild_sticky_messages') or \
           guild_id not in bot.guild_sticky_messages or \
           not bot.guild_sticky_messages[guild_id]:
            await interaction.response.send_message(
                "❌ No sticky messages found in this server!", 
                ephemeral=True
            )
            return
            
        embed = discord.Embed(
            title="📌 Sticky Messages",
            description="List of all sticky messages in this server:",
            color=discord.Color.blue()
        )
        
        for name, info in bot.guild_sticky_messages[guild_id].items():
            channel = interaction.guild.get_channel(info['channel_id'])
            channel_name = channel.name if channel else "deleted-channel"
            message_type = "Embed" if info['is_embed'] else "Text"
            embed.add_field(
                name=name,
                value=f"Type: {message_type}\nChannel: #{channel_name}",
                inline=True
            )
            
        embed.set_footer(text=f"Server: {interaction.guild.name}")
        embed.timestamp = discord.utils.utcnow()
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
    except Exception as e:
        print(f"Error in stickylist command: {e}")
        await interaction.response.send_message(
            "❌ Failed to list sticky messages!", 
            ephemeral=True
        )

@bot.tree.command(name="restart", description="Restart and reload the bot (Admin only)")
@app_commands.default_permissions(administrator=True)
async def restart(interaction: discord.Interaction):
    try:
        await interaction.response.send_message("🔄 Restarting bot...", ephemeral=True)
        
        # Reload bot
        success = await bot.reload_bot()
        
        if success:
            await interaction.edit_original_response(
                content="✅ Bot restarted and commands resynced successfully!"
            )
            
            # Optional: Update bot's status/activity
            await bot.change_presence(
                activity=discord.Game(name="Server Manager"),
                status=discord.Status.online
            )
        else:
            await interaction.edit_original_response(
                content="❌ Failed to restart bot. Check console for errors."
            )
    except Exception as e:
        print(f"Error in restart command: {e}")
        await interaction.edit_original_response(
            content="❌ An error occurred while restarting the bot!"
        )

@bot.tree.command(name="role-channel-permissions", description="Set channel permissions for a role")
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
    interaction: discord.Interaction,
    role: discord.Role,
    channel: discord.TextChannel,
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
                    # For neutral, remove the permission override completely
                    if hasattr(existing_perms, permission):
                        setattr(existing_perms, permission, None)
                    if all(getattr(existing_perms, perm, None) is None for perm in dict(existing_perms)):
                        # If all permissions are None, remove the role override completely
                        await ch.set_permissions(role, overwrite=None, 
                            reason=f"Permission reset to neutral by {interaction.user}")
                    else:
                        await ch.set_permissions(role, overwrite=existing_perms, 
                            reason=f"Permission set to neutral by {interaction.user}")
                else:
                    # For allow/deny, set the specific permission
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

class HelpView(discord.ui.View):
    def __init__(self, commands_info, category, author_id):
        super().__init__(timeout=60)
        self.commands_info = commands_info
        self.category = category
        self.current_page = 0
        self.author_id = author_id
        self.commands_per_page = 5

    def get_page_content(self):
        cat_info = self.commands_info[self.category]
        commands_list = list(cat_info["commands"].items())
        total_commands = len(commands_list)
        start_idx = self.current_page * self.commands_per_page
        end_idx = min(start_idx + self.commands_per_page, total_commands)
        current_commands = dict(commands_list[start_idx:end_idx])
        
        embed = discord.Embed(
            title=f"{cat_info['emoji']} {cat_info['name']} Commands",
            description=cat_info['description'],
            color=discord.Color.blue()
        )
        
        for cmd, info in current_commands.items():
            embed.add_field(
                name=cmd,
                value=f"Description: {info['description']}\nUsage: `{info['usage']}`\nPermissions: {info['perms']}",
                inline=False
            )
            
        total_pages = (total_commands + self.commands_per_page - 1) // self.commands_per_page
        embed.set_footer(text=f"Page {self.current_page + 1}/{total_pages}")
        return embed

    @discord.ui.button(label="◀️", style=discord.ButtonStyle.gray)
    async def previous_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.author_id:
            await interaction.response.send_message("This help menu is not for you!", ephemeral=True)
            return

        self.current_page = max(0, self.current_page - 1)
        await interaction.response.edit_message(embed=self.get_page_content(), view=self)

    @discord.ui.button(label="▶️", style=discord.ButtonStyle.gray)
    async def next_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.author_id:
            await interaction.response.send_message("This help menu is not for you!", ephemeral=True)
            return

        total_commands = len(self.commands_info[self.category]["commands"])
        max_pages = (total_commands + self.commands_per_page - 1) // self.commands_per_page
        self.current_page = min(self.current_page + 1, max_pages - 1)
        await interaction.response.edit_message(embed=self.get_page_content(), view=self)

    async def on_timeout(self):
        for item in self.children:
            item.disabled = True
        try:
            await self.message.edit(view=self)
        except:
            pass

@bot.tree.command(name="help", description="Get help with bot commands")
@app_commands.describe(
    category="Select a command category to view"
)
@app_commands.choices(
    category=[
        app_commands.Choice(name="📚 All Commands", value="all"),
        app_commands.Choice(name="🛡️ Moderation", value="mod"),
        app_commands.Choice(name="🔧 Utility", value="util"),
        app_commands.Choice(name="📌 Sticky Messages", value="sticky"),
        app_commands.Choice(name="👥 Role Management", value="roles")
    ]
)
async def help(interaction: discord.Interaction, category: str = "all"):
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
                    },
                    "role-channel-permissions": {
                        "description": "Modify channel permissions for a role",
                        "usage": "/role-channel-permissions <role> <channel> <permission> <value> [all_channels]",
                        "perms": "Administrator"
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
                    },
                    "restart": {
                        "description": "Restart and sync bot",
                        "usage": "/restart",
                        "perms": "Administrator"
                    }
                }
            },
            "sticky": {
                "emoji": "📌",
                "name": "Sticky Messages",
                "description": "Manage sticky messages in channels",
                "commands": {
                    "sticky": {
                        "description": "Create a sticky message",
                        "usage": "/sticky <action> <description> <name> [title] [color] [cooldown]",
                        "perms": "Manage Messages"
                    },
                    "sticky-remove": {
                        "description": "Remove a sticky message",
                        "usage": "/sticky-remove <name>",
                        "perms": "Manage Messages"
                    },
                    "sticky-list": {
                        "description": "List all sticky messages",
                        "usage": "/sticky-list",
                        "perms": "Manage Messages"
                    }
                }
            },
            "roles": {
                "emoji": "👥",
                "name": "Role Management",
                "description": "Manage server roles and permissions",
                "commands": {
                    "role-bot": {
                        "description": "Toggle roles for all bots",
                        "usage": "/role-bot <role> <toggle>",
                        "perms": "Manage Roles"
                    }
                }
            }
        }

        if category == "all":
            embed = discord.Embed(
                title="📚 Server Manager Commands",
                description="Select a category to view detailed commands:\n" +
                           "Use `/help category:` to view specific categories\n" +
                           "Use `sm.helpme` to view prefix commands",
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

            view = HelpView(commands_info, category, interaction.user.id)
            embed = view.get_page_content()
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
            view.message = await interaction.original_response()

    except Exception as e:
        print(f"Error in help command: {e}")
        await interaction.response.send_message("❌ An error occurred while showing help!", ephemeral=True)

@bot.tree.command(name="role-bot", description="Toggle a role for all bots in the server")
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
async def role_toggle_bot(
    interaction: discord.Interaction,
    role: discord.Role,
    toggle: str
):
    try:
        await interaction.response.defer(ephemeral=True)
        
        if not interaction.user.guild_permissions.manage_roles:
            await interaction.followup.send("❌ You don't have permission to manage roles!", ephemeral=True)
            return
            
        if role.position >= interaction.guild.me.top_role.position:
            await interaction.followup.send("❌ I cannot manage this role as it's higher than or equal to my highest role!", ephemeral=True)
            return
            
        bots = [member for member in interaction.guild.members if member.bot]
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
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
        
        # Create response message
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

@bot.tree.command(name="role-add", description="Add a role to a user")
@app_commands.describe(
    user="The user to add the role to",
    role="The role to add"
)
@app_commands.default_permissions(manage_roles=True)
async def role_add(interaction: discord.Interaction, user: discord.Member, role: discord.Role):
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

@bot.tree.command(name="role-remove", description="Remove a role from a user")
@app_commands.describe(
    user="The user to remove the role from",
    role="The role to remove"
)
@app_commands.default_permissions(manage_roles=True)
async def role_remove(interaction: discord.Interaction, user: discord.Member, role: discord.Role):
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

@bot.tree.command(name="role-all", description="Add or remove a role from all members")
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
async def role_all(interaction: discord.Interaction, role: discord.Role, action: str):
    try:
        await interaction.response.defer(ephemeral=True)
        
        if not interaction.user.guild_permissions.manage_roles:
            await interaction.followup.send("❌ You don't have permission to manage roles!", ephemeral=True)
            return
            
        if role.position >= interaction.guild.me.top_role.position:
            await interaction.followup.send("❌ I cannot manage this role as it's higher than my highest role!", ephemeral=True)
            return
            
        success_count = 0
        failed_count = 0
        skipped_count = 0
        
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

@bot.tree.command(name="test-command", description="Test command")
@app_commands.default_permissions(administrator=True)
@app_commands.describe(
    action1="action 1 toggle"
    ,action2="action 2 toggle"
)
@app_commands.choices(
    action1=[
        app_commands.Choice(name="add", value="add"),
        app_commands.Choice(name="remove", value="remove"),
        app_commands.Choice(name="show", value="show")
    ]
    ,action2=[
        app_commands.Choice(name="add Action 2", value="add"),
        app_commands.Choice(name="remove Action 2", value="remove"),
        app_commands.Choice(name="show Action 2", value="show")
    ]
)
async def test_command(interaction: discord.Interaction, action1: str, action2: str):
    try:
        await interaction.response.defer(ephemeral=True)
        action1_result = f"action1 ({action1}): "
        if action1 == "add":
            action1_result += "added"
        elif action1 == "remove":
            action1_result += "removed"
        elif action1 == "show":
            action1_result += "showed"
        else:
            action1_result += "unknown"
        action2_result = f"action2 ({action2}): "
        if action2 == "add":
            action2_result += "added"
        elif action2 == "remove":
            action2_result += "removed"
        elif action2 == "show":
            action2_result += "showed"
        await interaction.followup.send(
            f"✅ Test Command Executed:/n{action1_result}\n{action2_result}",
            ephemeral=True
        )
    except Exception as e:
        print(f"Error In Test Command: {e}")
        await interaction.followup.send(
            "❌ An error occurred while executing the test command!",
            ephemeral=True
        )

class EmbedModal(discord.ui.Modal):
    def __init__(self, title: str, label: str, value: str = ""):
        super().__init__(title=title)
        self.value = None
        
        formatting_guide = """
Formatting Guide:
**bold** = **text**
*italic* = *text*
~~strike~~ = ~~text~~
__underline__ = __text__
[link](url) = [text](https://example.com)
`code` = `text`
>>> quote = >>> text
• bullet = • text"""

        self.text = discord.ui.TextInput(
            label=label,
            style=discord.TextStyle.paragraph,
            default=value,
            required=True,
            max_length=4000,
            placeholder=formatting_guide
        )
        self.add_item(self.text)

    async def on_submit(self, interaction: discord.Interaction):
        self.value = self.text.value
        await interaction.response.defer()

class ColorPickerView(discord.ui.View):
    def __init__(self, parent_view):
        super().__init__(timeout=60)
        self.parent = parent_view
        self.add_color_buttons()
    
    def add_color_buttons(self):
        colors = [
            ("Red", discord.Color.red()),
            ("Blue", discord.Color.blue()),
            ("Green", discord.Color.green()),
            ("Purple", discord.Color.purple()),
            ("Gold", discord.Color.gold()),
            ("Orange", discord.Color.orange()),
            ("Teal", discord.Color.teal()),
            ("Dark Blue", discord.Color.dark_blue()),
            ("Custom Hex", None)
        ]
        
        for i, (name, color) in enumerate(colors):
            button = discord.ui.Button(
                label=name,
                style=discord.ButtonStyle.secondary,
                row=i // 4
            )
            
            if name == "Custom Hex":
                class HexColorModal(discord.ui.Modal, title="Custom Hex Color"):
                    def __init__(self):
                        super().__init__()
                        self.hex_code = discord.ui.TextInput(
                            label="Enter hex color code (e.g., #FF0000)",
                            placeholder="#",
                            min_length=4,
                            max_length=7,
                            required=True
                        )
                        self.add_item(self.hex_code)
                    
                    async def on_submit(self, interaction: discord.Interaction):
                        try:
                            hex_value = self.hex_code.value.strip('#')
                            color_value = int(hex_value, 16)
                            custom_color = discord.Color(color_value)
                            self.view.parent.embed_data['color'] = custom_color
                            await self.view.parent.update_preview(interaction)
                            await interaction.message.delete()
                        except ValueError:
                            await interaction.response.send_message(
                                "❌ Invalid hex color code! Use format: #RRGGBB",
                                ephemeral=True
                            )
                
                async def hex_callback(interaction: discord.Interaction):
                    modal = HexColorModal()
                    modal.view = self
                    await interaction.response.send_modal(modal)
                
                button.callback = hex_callback
            else:
                async def color_callback(interaction: discord.Interaction, color=color):
                    self.parent.embed_data['color'] = color
                    await self.parent.update_preview(interaction)
                    await interaction.message.delete()
                    
                button.callback = color_callback
            
            self.add_item(button)

class SaveEmbedModal(discord.ui.Modal, title="Save Embed"):
    def __init__(self):
        super().__init__()
        self.embed_name = discord.ui.TextInput(
            label="Embed Name/ID",
            placeholder="Enter a name to identify this embed",
            min_length=1,
            max_length=100,
            required=True
        )
        self.add_item(self.embed_name)

class EmbedCreatorView(discord.ui.View):
    def __init__(self, bot):
        super().__init__(timeout=300)
        self.bot = bot
        self.embed_data = {
            'title': 'New Embed',
            'description': 'Use the buttons below to customize this embed\n\n' + 
                         'Text Formatting Examples:\n' +
                         '**Bold Text**\n' +
                         '*Italic Text*\n' +
                         '~~Strikethrough~~\n' +
                         '__Underlined__\n' +
                         '[Click Here](https://discord.com)\n' +
                         '`Code Block`\n' +
                         '>>> Quote Block\n' +
                         '• Bullet Point',
            'color': discord.Color.blue(),
            'footer': None,
            'thumbnail': None,
            'image': None,
            'author': {
                'name': None,
                'icon_url': None,
                'url': None
            },
            'timestamp': False,
            'fields': []
        }
        self.message = None
        self.add_default_buttons()

    def add_default_buttons(self):
        # Create button rows
        row1 = [
            ("Title", discord.ButtonStyle.primary),
            ("Description", discord.ButtonStyle.primary),
            ("Color", discord.ButtonStyle.primary),
            ("Footer", discord.ButtonStyle.primary)
        ]
        row2 = [
            ("Author", discord.ButtonStyle.secondary),
            ("Thumbnail", discord.ButtonStyle.secondary), 
            ("Image", discord.ButtonStyle.secondary),
            ("Timestamp", discord.ButtonStyle.secondary)
        ]
        row3 = [
            ("Add Field", discord.ButtonStyle.success),
            ("Edit Fields", discord.ButtonStyle.success),
            ("Save", discord.ButtonStyle.success),
            ("Cancel", discord.ButtonStyle.danger)
        ]

        # Add buttons by row
        for i, row in enumerate([row1, row2, row3]):
            for label, style in row:
                button = discord.ui.Button(label=label, style=style, row=i)
                button.callback = self.create_button_callback(label.lower())
                self.add_item(button)

    def create_button_callback(self, action):
        async def callback(interaction: discord.Interaction):
            if action == "title":
                modal = EmbedModal("Set Title", "Enter title text", self.embed_data['title'])
                await interaction.response.send_modal(modal)
                await modal.wait()
                if modal.value:
                    self.embed_data['title'] = modal.value

            elif action == "description":
                modal = EmbedModal("Set Description", "Enter description", self.embed_data['description'])
                await interaction.response.send_modal(modal)
                await modal.wait()
                if modal.value:
                    self.embed_data['description'] = modal.value

            elif action == "color":
                # Show color picker view
                color_view = ColorPickerView(self)
                await interaction.response.send_message("Choose a color:", view=color_view, ephemeral=True)
                return

            elif action == "footer":
                modal = EmbedModal("Set Footer", "Enter footer text", self.embed_data.get('footer', ''))
                await interaction.response.send_modal(modal)
                await modal.wait()
                if modal.value:
                    self.embed_data['footer'] = modal.value

            elif action == "author":
                # Create a modal for author settings
                class AuthorSettingsModal(discord.ui.Modal, title="Set Author"):
                    name = discord.ui.TextInput(
                        label="Author Name",
                        style=discord.TextStyle.short,
                        default=self.embed_data['author']['name'] or '',
                        required=True,
                        max_length=256
                    )
                    icon_url = discord.ui.TextInput(
                        label="Author Icon URL",
                        style=discord.TextStyle.short,
                        default=self.embed_data['author']['icon_url'] or '',
                        required=False,
                        max_length=1024
                    )
                    url = discord.ui.TextInput(
                        label="Author URL (clickable link)",
                        style=discord.TextStyle.short,
                        default=self.embed_data['author']['url'] or '',
                        required=False,
                        max_length=1024
                    )

                    async def on_submit(self, interaction: discord.Interaction):
                        await interaction.response.defer()

                modal = AuthorSettingsModal()
                await interaction.response.send_modal(modal)
                await modal.wait()

                if modal.name:
                    self.embed_data['author']['name'] = modal.name.value
                    self.embed_data['author']['icon_url'] = modal.icon_url.value or None
                    self.embed_data['author']['url'] = modal.url.value or None
                
                await self.update_preview(interaction)

            elif action == "thumbnail":
                modal = EmbedModal("Set Thumbnail", "Enter thumbnail URL", self.embed_data.get('thumbnail', ''))
                await interaction.response.send_modal(modal)
                await modal.wait()
                if modal.value:
                    self.embed_data['thumbnail'] = modal.value

            elif action == "image":
                modal = EmbedModal("Set Image", "Enter image URL", self.embed_data.get('image', ''))
                await interaction.response.send_modal(modal)
                await modal.wait()
                if modal.value:
                    self.embed_data['image'] = modal.value

            elif action == "timestamp":
                self.embed_data['timestamp'] = not self.embed_data.get('timestamp', False)
                await interaction.response.defer()

            elif action == "add field":
                modal = FieldModal("Add Field")
                await interaction.response.send_modal(modal)
                await modal.wait()
                if modal.name and modal.value:
                    self.embed_data['fields'].append({
                        'name': modal.name,
                        'value': modal.value,
                        'inline': modal.inline
                    })

            elif action == "edit fields":
                if not self.embed_data['fields']:
                    await interaction.response.send_message("No fields to edit!", ephemeral=True)
                    return
                view = FieldManagerView(self)
                await interaction.response.send_message("Manage fields:", view=view, ephemeral=True)
                return

            elif action == "save":
                # Show save modal
                save_modal = SaveEmbedModal()
                await interaction.response.send_modal(save_modal)
                await save_modal.wait()
                
                if save_modal.embed_name:
                    embed_id = save_modal.embed_name.value
                    # Check if ID already exists
                    if embed_id in self.bot.stored_embeds:
                        await interaction.followup.send(
                            "❌ An embed with this name already exists! Please choose a different name.",
                            ephemeral=True
                        )
                        return
                    
                    # Save embed with custom ID
                    self.bot.stored_embeds[embed_id] = {
                        'title': self.embed_data['title'],
                        'description': self.embed_data['description'],
                        'color': self.embed_data['color'].value,
                        'footer': self.embed_data['footer'],
                        'thumbnail': self.embed_data['thumbnail'],
                        'image': self.embed_data['image'],
                        'author': self.embed_data['author'],
                        'fields': self.embed_data['fields'],
                        'created_at': int(time.time()),
                        'creator_id': interaction.user.id,
                        'guild_id': interaction.guild_id
                    }
                    await self.bot.data_storage.save_data()
                    await interaction.followup.send(
                        f"✅ Embed saved with ID: `{embed_id}`\nUse this ID to load or send this embed later!",
                        ephemeral=True
                    )
                    await self.message.delete()
                    return

            elif action == "cancel":
                await self.message.delete()
                await interaction.response.send_message("❌ Embed creation cancelled!", ephemeral=True)
                return

            # Update preview after any change
            await self.update_preview(interaction)

        return callback

    async def update_preview(self, interaction: discord.Interaction = None):
        """Update the embed message"""
        embed = self.get_preview_embed()
        if interaction:
            try:
                await interaction.response.edit_message(embed=embed, view=self)
            except discord.errors.InteractionResponded:
                await self.message.edit(embed=embed, view=self)
        elif self.message:
            await self.message.edit(embed=embed, view=self)

    def get_preview_embed(self):
        embed = discord.Embed(
            title=self.embed_data['title'],
            description=self.embed_data['description'],
            color=self.embed_data['color']
        )
        if self.embed_data['footer']:
            embed.set_footer(text=self.embed_data['footer'])
        if self.embed_data['thumbnail']:
            embed.set_thumbnail(url=self.embed_data['thumbnail'])
        if self.embed_data['image']:
            embed.set_image(url=self.embed_data['image'])
        if self.embed_data['author']['name']:
            embed.set_author(
                name=self.embed_data['author']['name'],
                icon_url=self.embed_data['author']['icon_url'],
                url=self.embed_data['author']['url']
            )
        if self.embed_data['timestamp']:
            embed.timestamp = discord.utils.utcnow()
        for field in self.embed_data['fields']:
            embed.add_field(
                name=field['name'],
                value=field['value'],
                inline=field.get('inline', True)
            )
        return embed

class FieldModal(discord.ui.Modal):
    def __init__(self, title: str, edit_mode: bool = False, default_name: str = "", default_value: str = "", default_inline: bool = True):
        super().__init__(title=title)
        self.name = None
        self.value = None
        self.inline = default_inline
        
        formatting_guide = "You can use **bold**, *italic*, ~~strike~~, __underline__, [link](url), `code`"
        
        self.name_input = discord.ui.TextInput(
            label="Field Name",
            style=discord.TextStyle.short,
            default=default_name,
            placeholder=formatting_guide,
            required=True,
            max_length=256
        )
        self.value_input = discord.ui.TextInput(
            label="Field Value",
            style=discord.TextStyle.paragraph,
            default=default_value,
            placeholder=formatting_guide,
            required=True,
            max_length=1024
        )
        self.inline_input = discord.ui.TextInput(
            label="Inline (true/false)",
            style=discord.TextStyle.short,
            default=str(default_inline).lower(),
            required=True,
            max_length=5
        )
        
        self.add_item(self.name_input)
        self.add_item(self.value_input)
        self.add_item(self.inline_input)

    async def on_submit(self, interaction: discord.Interaction):
        self.name = self.name_input.value
        self.value = self.value_input.value
        self.inline = self.inline_input.value.lower() == 'true'
        await interaction.response.defer()

class FieldManagerView(discord.ui.View):
    def __init__(self, parent_view: EmbedCreatorView):
        super().__init__(timeout=60)
        self.parent = parent_view
        self.add_field_select()

    def add_field_select(self):
        select = discord.ui.Select(
            placeholder="Choose a field...",
            options=[
                discord.SelectOption(
                    label=f"Field {i+1}: {field['name'][:50]}",
                    value=str(i),
                    description="Click to manage this field"
                )
                for i, field in enumerate(self.parent.embed_data['fields'])
            ]
        )
        select.callback = self.field_select_callback
        self.add_item(select)

    async def field_select_callback(self, interaction: discord.Interaction):
        index = int(interaction.data['values'][0])
        field = self.parent.embed_data['fields'][index]
        
        view = discord.ui.View(timeout=60)
        
        async def edit_callback(btn_interaction):
            modal = FieldModal(
                title="Edit Field",
                edit_mode=True,
                default_name=field['name'],
                default_value=field['value'],
                default_inline=field.get('inline', True)
            )
            await btn_interaction.response.send_modal(modal)
            await modal.wait()
            
            if modal.name and modal.value:
                self.parent.embed_data['fields'][index] = {
                    'name': modal.name,
                    'value': modal.value,
                    'inline': modal.inline
                }
                await self.parent.update_preview(btn_interaction)
                await btn_interaction.message.delete()

        async def remove_callback(btn_interaction):
            self.parent.embed_data['fields'].pop(index)
            await self.parent.update_preview(btn_interaction)
            await btn_interaction.message.delete()

        edit_btn = discord.ui.Button(label="Edit", style=discord.ButtonStyle.primary)
        remove_btn = discord.ui.Button(label="Remove", style=discord.ButtonStyle.danger)
        
        edit_btn.callback = edit_callback
        remove_btn.callback = remove_callback
        
        view.add_item(edit_btn)
        view.add_item(remove_btn)
        
        await interaction.response.send_message(
            f"Managing field: {field['name']}\nValue: {field['value']}\nInline: {field.get('inline', True)}",
            view=view,
            ephemeral=True
        )

@bot.tree.command(name="embed", description="Create and customize an embed message")
@app_commands.describe(template="Optional template ID to start from")
@app_commands.autocomplete(template=get_embed_choices)
async def embed_command(interaction: discord.Interaction, template: str = None):
    try:
        view = EmbedCreatorView(bot)
        
        if template and template in bot.stored_embeds:
            template_data = bot.stored_embeds[template]
            view.embed_data.update({
                'title': template_data['title'],
                'description': template_data['description'],
                'color': discord.Color(template_data['color']),
                'footer': template_data['footer'],
                'thumbnail': template_data['thumbnail'],
                'image': template_data['image'],
                'author': template_data.get('author'),
                'fields': template_data.get('fields', []),
                'timestamp': template_data.get('timestamp', False)
            })

        embed = view.get_preview_embed()
        await interaction.response.send_message(
            "🔨 Embed Creator - Use the buttons below to customize your embed",
            embed=embed,
            view=view,
            ephemeral=True
        )
        view.message = await interaction.original_response()

    except Exception as e:
        print(f"Error in embed command: {e}")
        await interaction.response.send_message(
            "❌ Failed to start embed creator!",
            ephemeral=True
        )

@bot.tree.command(name="embed-send")
@app_commands.describe(
    embed_id="Select an embed to send",
    channel="The channel to send the embed to"
)
@app_commands.autocomplete(embed_id=get_embed_choices)
async def embed_send(
    interaction: discord.Interaction,
    embed_id: str,
    channel: discord.TextChannel = None
):
    try:
        # Check if embed exists
        if embed_id not in bot.stored_embeds:
            await interaction.response.send_message(
                "❌ Embed not found!",
                ephemeral=True
            )
            return

        # Get embed data
        embed_data = bot.stored_embeds[embed_id]
        
        # Create embed
        embed = discord.Embed(
            title=embed_data['title'],
            description=embed_data['description'],
            color=discord.Color(embed_data['color'])
        )

        if embed_data['footer']:
            embed.set_footer(text=embed_data['footer'])
        if embed_data['thumbnail']:
            embed.set_thumbnail(url=embed_data['thumbnail'])
        if embed_data['image']:
            embed.set_image(url=embed_data['image'])

        # Send embed
        target_channel = channel or interaction.channel
        await target_channel.send(embed=embed)
        
        await interaction.response.send_message(
            f"✅ Embed sent to {target_channel.mention}!",
            ephemeral=True
        )

    except Exception as e:
        print(f"Error in embed_send command: {e}")
        await interaction.response.send_message(
            "❌ Failed to send embed!",
            ephemeral=True
        )

@bot.tree.command(name="sticky-embed", description="Create a sticky embed using a saved embed")
@app_commands.describe(
    embed_id="Select an embed to make sticky",
    name="Name for your sticky message",
    cooldown="Cooldown in seconds between sticky messages"
)
@app_commands.autocomplete(embed_id=get_embed_choices)
@app_commands.default_permissions(manage_messages=True)
async def sticky_embed(
    interaction: discord.Interaction,
    embed_id: str,
    name: str,
    cooldown: int = 1
):
    try:
        if embed_id not in bot.stored_embeds:
            await interaction.response.send_message("❌ Embed not found!", ephemeral=True)
            return

        channel_id = interaction.channel.id
        guild_id = interaction.guild.id
        
        # Initialize guild sticky messages if needed
        if not hasattr(bot, 'guild_sticky_messages'):
            bot.guild_sticky_messages = {}
        if guild_id not in bot.guild_sticky_messages:
            bot.guild_sticky_messages[guild_id] = {}
        
        # Set up cooldown
        bot.sticky_cooldowns[channel_id] = cooldown
        bot.sticky_last_sent[channel_id] = datetime.utcnow()
        
        # Create embed from stored data
        embed_data = bot.stored_embeds[embed_id]
        embed = discord.Embed(
            title=embed_data['title'],
            description=embed_data['description'],
            color=discord.Color(embed_data['color'])
        )
        if embed_data['footer']:
            embed.set_footer(text=f"{embed_data['footer']} • 📌 Sticky message • {interaction.guild.name}")
        else:
            embed.set_footer(text=f"📌 Sticky message • {interaction.guild.name}")
        if embed_data['thumbnail']:
            embed.set_thumbnail(url=embed_data['thumbnail'])
        if embed_data['image']:
            embed.set_image(url=embed_data['image'])
        
        # Send initial sticky
        sticky_msg = await interaction.channel.send(embed=embed)
        
        # Store sticky data with embed reference
        content = {
            "type": "stored_embed",
            "embed_id": embed_id,
            "original_data": embed_data
        }
        
        await bot.update_sticky_message(channel_id, sticky_msg.id, content)
        bot.guild_sticky_messages[guild_id][name] = {
            'channel_id': channel_id,
            'message_id': sticky_msg.id,
            'content': content,
            'is_embed': True
        }
        
        # Save data
        await bot.data_storage.save_data()
        
        await interaction.response.send_message(
            f"✅ Sticky embed '{name}' created with {cooldown}s cooldown!", 
            ephemeral=True
        )
        
    except Exception as e:
        print(f"Error in sticky_embed command: {e}")
        await interaction.response.send_message("❌ Failed to create sticky embed!", ephemeral=True)

@bot.tree.command(name="embed-list", description="List all stored embeds")
@app_commands.default_permissions(manage_messages=True)
async def embed_list(interaction: discord.Interaction):
    try:
        guild_embeds = {k: v for k, v in bot.stored_embeds.items() 
                       if v['guild_id'] == interaction.guild_id}

        if not guild_embeds:
            await interaction.response.send_message(
                "❌ No stored embeds found for this server!",
                ephemeral=True
            )
            return

        embed = discord.Embed(
            title="📋 Stored Embeds",
            description="List of all stored embeds in this server:",
            color=discord.Color.blue()
        )

        for embed_id, data in guild_embeds.items():
            creator = interaction.guild.get_member(data['creator_id'])
            creator_name = creator.name if creator else "Unknown"
            timestamp = datetime.fromtimestamp(data['created_at'])

            embed.add_field(
                name=f"ID: {embed_id}",
                value=f"Title: {data['title']}\n"
                      f"Created by: {creator_name}\n"
                      f"Created at: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
                inline=False
            )

        await interaction.response.send_message(embed=embed, ephemeral=True)

    except Exception as e:
        print(f"Error in embed_list command: {e}")
        await interaction.response.send_message(
            "❌ Failed to list embeds!",
            ephemeral=True
        )

#
#---Kate---
#---Project-1--
#---sign--HELLOIAMKATE---
#---Owner--Kate---
#---MB--Kate---
#---1001---
#

if __name__ == "__main__":
    try:
        keep_alive()
        print("✅ Web server started!")
        print("✅ Starting bot with data persistence...")
        bot.run(TOKEN)
    except Exception as e:
        print(f"❌ Error starting bot: {e}")
        # Save data on shutdown
        if hasattr(bot, 'data_storage'):
            asyncio.run(bot.data_storage.save_data())