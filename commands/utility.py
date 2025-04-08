from discord import app_commands, Interaction, Member
from discord.ext import commands
import discord
from datetime import datetime

class UtilityCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="ping", description="Check bot's ping")
    async def ping(self, interaction: Interaction):
        latency = round(self.bot.latency * 1000)
        await interaction.response.send_message(f"🏓 Pong! {latency}ms")

    @app_commands.command(name="about", description="About Of The Bot")
    async def about(self, interaction: Interaction):
        try:
            embed = discord.Embed(
                title="Welcome to Server Manager!",
                description="A powerful Discord bot for server management, and Creating Custom Message's",
                color=discord.Color.purple()
            )
            
            embed.add_field(
                name="🛠️ Features", 
                value="• Server Management\n• Custom Commands\n• Moderation Tools", 
                inline=False
            )
            
            embed.set_author(
                name=interaction.user.display_name,
                icon_url=interaction.user.avatar.url if interaction.user.avatar else None
            )
            
            embed.set_footer(
                text=f"Requested by {interaction.user.name}",
                icon_url=interaction.guild.icon.url if interaction.guild.icon else None
            )
            
            embed.timestamp = discord.utils.utcnow()
            
            await interaction.response.send_message(embed=embed)
            
        except Exception as e:
            print(f"Error in about command: {e}")
            await interaction.response.send_message(
                "❌ Failed to create embed!",
                ephemeral=True
            )

    @app_commands.command(name="restart", description="Restart and reload the bot (Admin only)")
    @app_commands.default_permissions(administrator=True)
    async def restart(self, interaction: Interaction):
        try:
            await interaction.response.send_message("🔄 Restarting bot...", ephemeral=True)
            
            success = await self.bot.reload_bot()
            
            if success:
                await interaction.edit_original_response(
                    content="✅ Bot restarted and commands resynced successfully!"
                )
                
                await self.bot.change_presence(
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

    @app_commands.command(name="message", description="Send a private message to a user in the server")
    @app_commands.describe(
        user="The user to send the message to",
        message="The message to send privately"
    )
    async def private_message(self, interaction: Interaction, user: Member, message: str):
        try:
            embed = discord.Embed(
                title="💌 Private Message",
                description=message,
                color=user.color,
                timestamp=discord.utils.utcnow()
            )
            embed.set_author(
                name=f"From {interaction.user.display_name}",
                icon_url=interaction.user.display_avatar.url
            )
            embed.set_footer(
                text=f"Sent from {interaction.guild.name}",
                icon_url=interaction.guild.icon.url if interaction.guild.icon else None
            )

            try:
                await interaction.channel.send(
                    content=f"{user.mention}, you have a new message!",
                    embed=embed,
                    allowed_mentions=discord.AllowedMentions(users=[user]),
                    view=None,
                    ephemeral=True
                )
                
                preview_embed = discord.Embed(
                    title="✉️ Message Sent!",
                    description="Your message has been delivered.",
                    color=discord.Color.green()
                )
                preview_embed.add_field(
                    name="📨 Preview of your message",
                    value=f"To: {user.mention}\n```\n{message}\n```",
                    inline=False
                )
                
                await interaction.response.send_message(
                    embed=preview_embed,
                    ephemeral=True
                )
                
            except discord.Forbidden:
                await interaction.response.send_message(
                    "❌ Unable to send message to this user!",
                    ephemeral=True
                )

        except Exception as e:
            print(f"Error in message command: {e}")
            await interaction.response.send_message(
                "❌ Failed to send private message!",
                ephemeral=True
            )

async def setup(bot):
    await bot.add_cog(UtilityCommands(bot))
