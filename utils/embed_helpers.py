import discord
from typing import Optional

async def create_embed(
    title: str,
    description: str,
    color: discord.Color,
    author: Optional[discord.Member] = None,
    footer_text: Optional[str] = None,
    thumbnail_url: Optional[str] = None
) -> discord.Embed:
    """Helper function to create embeds consistently"""
    embed = discord.Embed(
        title=title,
        description=description,
        color=color,
        timestamp=discord.utils.utcnow()
    )
    
    if author:
        embed.set_author(
            name=author.display_name,
            icon_url=author.display_avatar.url
        )
    
    if footer_text:
        embed.set_footer(text=footer_text)
        
    if thumbnail_url:
        embed.set_thumbnail(url=thumbnail_url)
        
    return embed
