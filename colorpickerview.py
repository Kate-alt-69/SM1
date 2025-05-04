import discord

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
            ("Orange", discord.Color.orange())
        ]
        
        for i, (name, color) in enumerate(colors):
            button = discord.ui.Button(
                label=name,
                style=discord.ButtonStyle.secondary,
                row=i // 4
            )
            button.callback = self.create_color_callback(color)
            self.add_item(button)
    
    def create_color_callback(self, color):
        async def callback(interaction: discord.Interaction):
            self.parent.embed_data['color'] = color
            await self.parent.update_preview(interaction)
            await interaction.message.delete()
        return callback