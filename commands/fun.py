import discord
from discord import app_commands
from discord.ext import commands
import random
import aiohttp
import json

class Fun(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="8ball", description="Ask the magic 8-ball a question")
    async def eight_ball(self, interaction: discord.Interaction, question: str):
        responses = [
            "It is certain.", "Without a doubt.", "Yes, definitely.",
            "Better not tell you now.", "Ask again later.", "Cannot predict now.",
            "Don't count on it.", "My reply is no.", "Very doubtful."
        ]
        await interaction.response.send_message(f"Question: {question}\n🎱 Answer: {random.choice(responses)}")

    @app_commands.command(name="flip", description="Flip a coin")
    async def flip(self, interaction: discord.Interaction):
        result = random.choice(["Heads", "Tails"])
        await interaction.response.send_message(f"🪙 The coin landed on: **{result}**!")

    @app_commands.command(name="roll", description="Roll a dice")
    async def roll(self, interaction: discord.Interaction, sides: int = 6):
        if sides < 1:
            await interaction.response.send_message("Please specify a positive number of sides!")
            return
        result = random.randint(1, sides)
        await interaction.response.send_message(f"🎲 You rolled a d{sides} and got: **{result}**!")

    @app_commands.command(name="joke", description="Get a random joke")
    async def joke(self, interaction: discord.Interaction):
        async with aiohttp.ClientSession() as session:
            async with session.get('https://official-joke-api.appspot.com/random_joke') as response:
                if response.status == 200:
                    joke_data = await response.json()
                    await interaction.response.send_message(f"**{joke_data['setup']}**\n\n||{joke_data['punchline']}||")
                else:
                    await interaction.response.send_message("Sorry, I couldn't fetch a joke at the moment!")

async def setup(bot):
    await bot.add_cog(Fun(bot))
