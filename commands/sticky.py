import discord
from discord import app_commands
from discord.ext import commands
from datetime import datetime

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
        return choices[:25]
    except Exception as e:
        print(f"Error in get_embed_choices: {e}")
        return []

class StickyCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        super().__init__()

    @app_commands.command(name="sticky", description="Create sticky messages")
    @app_commands.describe(
        action="Choose create or create-embed",
        title="Title for embed (only for create-embed)",
        description="Message content or embed description",
        name="Name for your sticky message",
        color="Color for embed (optional)",
        cooldown="Cooldown in seconds"
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
    async def sticky(self, interaction: discord.Interaction, action: str, description: str, name: str, title: str = None, color: str = "blue", cooldown: int = 1):
        try:
            channel_id = interaction.channel.id
            guild_id = interaction.guild.id
            
            if not hasattr(self.bot, 'guild_sticky_messages'):
                self.bot.guild_sticky_messages = {}
            if guild_id not in self.bot.guild_sticky_messages:
                self.bot.guild_sticky_messages[guild_id] = {}
            
            self.bot.sticky_cooldowns[channel_id] = cooldown
            self.bot.sticky_last_sent[channel_id] = datetime.utcnow()
            
            if action == "create":
                sticky_msg = await interaction.channel.send(description)
                await self.bot.update_sticky_message(channel_id, sticky_msg.id, description)
                self.bot.guild_sticky_messages[guild_id][name] = {
                    'channel_id': channel_id,
                    'message_id': sticky_msg.id,
                    'content': description,
                    'is_embed': False
                }
            else:  # create-embed
                embed = discord.Embed(
                    title=title or "Sticky Message",
                    description=description,
                    color=getattr(discord.Color, color)()
                )
                embed.set_footer(text=f"📌 Sticky message • {interaction.guild.name}")
                sticky_msg = await interaction.channel.send(embed=embed)
                content = {"type": "embed", "title": title, "description": description, "color": color}
                await self.bot.update_sticky_message(channel_id, sticky_msg.id, content)
                self.bot.guild_sticky_messages[guild_id][name] = {
                    'channel_id': channel_id,
                    'message_id': sticky_msg.id,
                    'content': content,
                    'is_embed': True
                }
            
            await self.bot.data_storage.save_data()
            await interaction.response.send_message(f"✅ Sticky message '{name}' created!", ephemeral=True)
                
        except Exception as e:
            print(f"Error in sticky command: {e}")
            await interaction.response.send_message("❌ Failed to create sticky message!", ephemeral=True)

    @app_commands.command(name="sticky-remove", description="Remove a sticky message from the server")
    @app_commands.describe(name="Name of the sticky message to remove")
    @app_commands.default_permissions(manage_messages=True)
    async def sticky_remove(self, interaction: discord.Interaction, name: str):
        try:
            guild_id = interaction.guild.id
            
            if not hasattr(self.bot, 'guild_sticky_messages') or \
               guild_id not in self.bot.guild_sticky_messages or \
               name not in self.bot.guild_sticky_messages[guild_id]:
                await interaction.response.send_message(
                    f"❌ No sticky message found with name '{name}'!", 
                    ephemeral=True
                )
                return
                
            sticky_info = self.bot.guild_sticky_messages[guild_id][name]
            channel_id = sticky_info['channel_id']
            
            try:
                channel = interaction.guild.get_channel(channel_id)
                if channel:
                    sticky_msg = await channel.fetch_message(sticky_info['message_id'])
                    await sticky_msg.delete()
            except (discord.NotFound, discord.Forbidden):
                pass
            
            del self.bot.guild_sticky_messages[guild_id][name]
            del self.bot.sticky_messages[channel_id]
            self.bot.sticky_cooldowns.pop(channel_id, None)
            self.bot.sticky_last_sent.pop(channel_id, None)
            
            await self.bot.data_storage.save_data()
            await interaction.response.send_message(
                f"✅ Sticky message '{name}' removed!", 
                ephemeral=True
            )
            
        except Exception as e:
            print(f"Error in sticky_remove command: {e}")
            await interaction.response.send_message(
                "❌ Failed to remove sticky message!", 
                ephemeral=True
            )

    @app_commands.command(name="sticky-list", description="List all sticky messages in server")
    @app_commands.default_permissions(manage_messages=True)
    async def sticky_list(self, interaction: discord.Interaction):
        try:
            guild_id = interaction.guild.id
            
            if not hasattr(self.bot, 'guild_sticky_messages') or \
               guild_id not in self.bot.guild_sticky_messages or \
               not self.bot.guild_sticky_messages[guild_id]:
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
            
            for name, info in self.bot.guild_sticky_messages[guild_id].items():
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
            print(f"Error in sticky_list command: {e}")
            await interaction.response.send_message(
                "❌ Failed to list sticky messages!", 
                ephemeral=True
            )

    @app_commands.command(name="sticky-embed", description="Create a sticky embed using a saved embed")
    @app_commands.describe(
        embed_id="Select an embed to make sticky",
        name="Name for your sticky message",
        cooldown="Cooldown in seconds between sticky messages"
    )
    @app_commands.autocomplete(embed_id=get_embed_choices)
    @app_commands.default_permissions(manage_messages=True)
    async def sticky_embed(self, interaction: discord.Interaction, embed_id: str, name: str, cooldown: int = 1):
        try:
            if embed_id not in self.bot.stored_embeds:
                await interaction.response.send_message("❌ Embed not found!", ephemeral=True)
                return

            channel_id = interaction.channel.id
            guild_id = interaction.guild.id
            
            if not hasattr(self.bot, 'guild_sticky_messages'):
                self.bot.guild_sticky_messages = {}
            if guild_id not in self.bot.guild_sticky_messages:
                self.bot.guild_sticky_messages[guild_id] = {}
            
            self.bot.sticky_cooldowns[channel_id] = cooldown
            self.bot.sticky_last_sent[channel_id] = datetime.utcnow()
            
            embed_data = self.bot.stored_embeds[embed_id]
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
            
            sticky_msg = await interaction.channel.send(embed=embed)
            
            content = {
                "type": "stored_embed",
                "embed_id": embed_id,
                "original_data": embed_data
            }
            
            await self.bot.update_sticky_message(channel_id, sticky_msg.id, content)
            self.bot.guild_sticky_messages[guild_id][name] = {
                'channel_id': channel_id,
                'message_id': sticky_msg.id,
                'content': content,
                'is_embed': True
            }
            
            await self.bot.data_storage.save_data()
            await interaction.response.send_message(
                f"✅ Sticky embed '{name}' created with {cooldown}s cooldown!", 
                ephemeral=True
            )
            
        except Exception as e:
            print(f"Error in sticky_embed command: {e}")
            await interaction.response.send_message("❌ Failed to create sticky embed!", ephemeral=True)

async def setup(bot):
    await bot.add_cog(StickyCommands(bot))
