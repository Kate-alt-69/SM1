from discord import app_commands, Interaction, TextChannel, Color
from discord.ext import commands
import discord
import time
from typing import Optional, Dict, Any
from datetime import datetime

# Helper function for embed choices autocomplete
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

    async def on_submit(self, interaction: Interaction):
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
                button.callback = self.hex_callback
            else:
                button.callback = lambda i, c=color: self.color_callback(i, c)
            
            self.add_item(button)

    async def hex_callback(self, interaction: Interaction):
        modal = HexColorModal()
        modal.view = self
        await interaction.response.send_modal(modal)

    async def color_callback(self, interaction: Interaction, color: discord.Color):
        self.parent.embed_data['color'] = color
        await self.parent.update_preview(interaction)
        await interaction.message.delete()

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
    
    async def on_submit(self, interaction: Interaction):
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

class EmbedCreator(discord.ui.View):
    def __init__(self, bot):
        super().__init__(timeout=300)
        self.bot = bot
        self.embed_data = self.get_default_embed_data()
        self.message = None
        self.setup_view()

    def get_default_embed_data(self) -> Dict[str, Any]:
        return {
            'title': 'New Embed',
            'description': 'Use the buttons below to customize this embed',
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

    def setup_view(self):
        # Add buttons
        buttons = [
            ("Title", discord.ButtonStyle.primary, 1),
            ("Description", discord.ButtonStyle.primary, 1),
            ("Color", discord.ButtonStyle.primary, 1),
            ("Footer", discord.ButtonStyle.primary, 1),
            ("Author", discord.ButtonStyle.secondary, 2),
            ("Thumbnail", discord.ButtonStyle.secondary, 2),
            ("Image", discord.ButtonStyle.secondary, 2),
            ("Timestamp", discord.ButtonStyle.secondary, 2),
            ("Add Field", discord.ButtonStyle.success, 3),
            ("Edit Fields", discord.ButtonStyle.success, 3),
            ("Save", discord.ButtonStyle.success, 3),
            ("Cancel", discord.ButtonStyle.danger, 3)
        ]

        for label, style, row in buttons:
            button = discord.ui.Button(label=label, style=style, row=row)
            button.callback = self.create_button_callback(label.lower())
            self.add_item(button)

    def get_preview_embed(self) -> discord.Embed:
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

    async def update_preview(self, interaction: Optional[Interaction] = None):
        embed = self.get_preview_embed()
        if interaction:
            try:
                await interaction.response.edit_message(embed=embed, view=self)
            except discord.errors.InteractionResponded:
                await self.message.edit(embed=embed, view=self)
        elif self.message:
            await self.message.edit(embed=embed, view=self)

    def create_button_callback(self, action: str):
        async def callback(interaction: Interaction):
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
                color_view = ColorPickerView(self)
                await interaction.response.send_message("Choose a color:", view=color_view, ephemeral=True)
                return

            elif action == "save":
                save_modal = SaveEmbedModal()
                await interaction.response.send_modal(save_modal)
                await save_modal.wait()
                
                if save_modal.embed_name:
                    embed_id = save_modal.embed_name.value
                    if embed_id in self.bot.stored_embeds:
                        await interaction.followup.send(
                            "❌ An embed with this name already exists!",
                            ephemeral=True
                        )
                        return
                    
                    self.bot.stored_embeds[embed_id] = {
                        'title': self.embed_data['title'],
                        'description': self.embed_data['description'],
                        'color': self.embed_data['color'].value,
                        'footer': self.embed_data['footer'],
                        'thumbnail': self.embed_data['thumbnail'],
                        'image': self.embed_data['image'],
                        'author': self.embed_data['author'],
                        'fields': self.embed_data['fields'],
                        'timestamp': self.embed_data['timestamp'],
                        'created_at': int(time.time()),
                        'creator_id': interaction.user.id,
                        'guild_id': interaction.guild_id
                    }
                    await self.bot.data_storage.save_data()
                    await interaction.followup.send(
                        f"✅ Embed saved as: `{embed_id}`",
                        ephemeral=True
                    )
                    await self.message.delete()
                    return

            elif action == "cancel":
                await self.message.delete()
                await interaction.response.send_message("❌ Embed creation cancelled!", ephemeral=True)
                return

            await self.update_preview(interaction)

        return callback

class EmbedCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        super().__init__()  # Initialize Cog base class

    @app_commands.command(name="embed", description="Create and customize an embed message")
    @app_commands.describe(template="Optional template ID to start from")
    @app_commands.autocomplete(template=get_embed_choices)
    async def embed_command(self, interaction: Interaction, template: str = None):
        try:
            view = EmbedCreator(self.bot)
            
            if template and template in self.bot.stored_embeds:
                template_data = self.bot.stored_embeds[template]
                view.embed_data.update(template_data)

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

    @app_commands.command(name="embed-send")
    @app_commands.describe(
        embed_id="Select an embed to send",
        channel="The channel to send the embed to"
    )
    @app_commands.autocomplete(embed_id=get_embed_choices)
    async def embed_send(
        self,
        interaction: Interaction,
        embed_id: str,
        channel: TextChannel = None
    ):
        try:
            if embed_id not in self.bot.stored_embeds:
                await interaction.response.send_message(
                    "❌ Embed not found!",
                    ephemeral=True
                )
                return

            embed_data = self.bot.stored_embeds[embed_id]
            embed = discord.Embed(
                title=embed_data['title'],
                description=embed_data['description'],
                color=discord.Color(embed_data['color'])
            )

            if embed_data['footer']:
                embed.set_footer(text=embed_data['footer'])
            if embed_data['thumbnail']:
                embed.set_thumbnail(url=self.embed_data['thumbnail'])
            if embed_data['image']:
                embed.set_image(url=self.embed_data['image'])

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

    @app_commands.command(name="embed-list", description="List all stored embeds")
    @app_commands.default_permissions(manage_messages=True)
    async def embed_list(self, interaction: Interaction):
        try:
            guild_embeds = {k: v for k, v in self.bot.stored_embeds.items() 
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

async def setup(bot):
    await bot.add_cog(EmbedCommands(bot))