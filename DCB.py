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
# Load environment variables
load_dotenv()
TOKEN = os.getenv("TOKEN_SM")
if not TOKEN:
    raise ValueError("❌ Bot token not found in .env file")

class Bot(commands.Bot):
    def __init__(self):
        # Configure intents
        intents = discord.Intents.all()
        
        # Initialize dictionaries
        self.server_info = {}
        self.sticky_messages = {}
        self.sticky_cooldowns = {}
        self.sticky_last_sent = {}
        
        # Initialize bot
        super().__init__(
            command_prefix="SM!",
            intents=intents,
            activity=discord.Game(name="Server Manager"),
            status=discord.Status.online
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
        if sticky_data.get('is_embed', False):
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

@bot.tree.command(name="stickyremove", description="Remove a sticky message from the server")
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

@bot.tree.command(name="stickylist", description="Get information about the server")
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

@bot.tree.command(name="role_channel_permissions", description="Set channel permissions for a role")
@app_commands.describe(
    role="The role to modify permissions for",
    channel="The channel to modify",
    permission="The permission to modify",
    value="True to allow, False to deny",
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
    ]
)
@app_commands.default_permissions(administrator=True)
async def role_channel_permissions(
    interaction: discord.Interaction,
    role: discord.Role,
    channel: discord.TextChannel,
    permission: str,
    value: bool,
    all_channels: bool = False
):
    try:
        await interaction.response.defer(ephemeral=True)
        
        if not interaction.user.guild_permissions.manage_roles:
            await interaction.followup.send("❌ You don't have permission to manage roles!", ephemeral=True)
            return
            
        # Handle channel selection
        channels_to_update = []
        if all_channels:
            channels_to_update = [ch for ch in interaction.guild.channels if isinstance(ch, discord.TextChannel)]
        else:
            channels_to_update = [channel]
            
        success_count = 0
        failed_count = 0
        
        for ch in channels_to_update:
            try:
                perms = ch.overwrites_for(role)
                setattr(perms, permission, value)
                await ch.set_permissions(role, overwrite=perms, reason=f"Permission update by {interaction.user}")
                success_count += 1
            except Exception as e:
                print(f"Error setting permissions in channel {ch.name}: {e}")
                failed_count += 1
        
        response = f"✅ Updated permissions for role {role.mention}:\n"
        response += f"Permission: `{permission}` set to `{value}`\n"
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

if __name__ == "__main__":
    try:
        keep_alive()  # Start the web server
        print("✅ Web server started!")
        bot.run(TOKEN)
    except Exception as e:
        print(f"❌ Error starting bot: {e}")