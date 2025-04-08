import json
import discord
from typing import Dict, Optional
import os

class EmbedManager:
    def __init__(self):
        self.cache: Dict[str, discord.Embed] = {}
        self.templates = self._load_templates()
        
    def _load_templates(self) -> dict:
        path = os.path.join(os.path.dirname(__file__), '..', 'data', 'default_embeds.json')
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
            
    def get_template(self, template_name: str) -> Optional[dict]:
        return self.templates.get(template_name)
        
    def create_embed(self, template_name: str = None, **kwargs) -> discord.Embed:
        if template_name and template_name in self.cache:
            # Return a copy of cached embed
            return discord.Embed.from_dict(self.cache[template_name].to_dict())
            
        # Get template or empty dict if template doesn't exist
        template = self.templates.get(template_name, {})
        
        # Merge template with kwargs
        embed_data = {**template, **kwargs}
        
        embed = discord.Embed(
            title=embed_data.get('title', ''),
            description=embed_data.get('description', ''),
            color=embed_data.get('color', 0)
        )
        
        if embed_data.get('footer'):
            embed.set_footer(text=embed_data['footer'])
            
        if embed_data.get('timestamp', False):
            embed.timestamp = discord.utils.utcnow()
            
        # Cache the template if it's a template embed
        if template_name:
            self.cache[template_name] = embed
            
        return embed
