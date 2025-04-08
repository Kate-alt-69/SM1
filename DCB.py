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
import time 

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
        
        # Load extensions
        for command_module in [
            'commands.moderation',
            'commands.roles',
            'commands.utility',
            'commands.help',
            'commands.embed_logic_command',
            'commands.sticky'
        ]:
            try:
                await self.load_extension(command_module)
                print(f"✅ Loaded {command_module}")
            except Exception as e:
                print(f"❌ Error loading {command_module}: {e}")
        
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

async def load_extensions():
    for command_module in [
        'commands.moderation',
        'commands.roles',
        'commands.utility',
        'commands.help',
        'commands.embed_logic_command',
        'commands.sticky'
    ]:
        try:
            await bot.load_extension(command_module)
            print(f"✅ Loaded {command_module}")
        except Exception as e:
            print(f"❌ Error loading {command_module}: {e}")

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