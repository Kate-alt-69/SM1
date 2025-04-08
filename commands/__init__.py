from .moderation import ModerationCommands
from .roles import RoleCommands
from .utility import UtilityCommands
from .help import HelpCommands
from .embed_logic_command import EmbedCommands
from .sticky import StickyCommands

async def setup(bot):
    await bot.add_cog(ModerationCommands(bot))
    await bot.add_cog(RoleCommands(bot))
    await bot.add_cog(UtilityCommands(bot))
    await bot.add_cog(HelpCommands(bot))
    await bot.add_cog(EmbedCommands(bot))
    await bot.add_cog(StickyCommands(bot))