// Bcode/commands/embed/default-embed.js
import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";

// Default embed
export const defaultEmbeds = {
  manager: {
    embed: new EmbedBuilder()
      .setTitle("Thenks For Using Embed Manager")
      .setDescription(
        "Embed Manager lets you edit embeds created in your server and send them as examples.\n\n" +
        "Update this embed to your desire or click list embed below from the drop down for showing what embeds your server holds"
      ),
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("embed_manager_menu")
          .setPlaceholder("Select here!")
          .addOptions([
            {
              label: "List Embed",
              description: "Lists all embeds that your server holds",
              value: "list_embed",
              emoji: "📔",
            },
            {
              label: "Create New",
              description: "Create New Embed Here",
              value: "create_embed",
              emoji: "📝",
            },
            {
              label: "Edit Existing",
              description: "Edit an embed already created in this server",
              value: "edit_embed",
              emoji: "📃",
            },
            {
              label: "View Embed",
              description: "View an embed created in your server here",
              value: "view_embed",
              emoji: "📄",
            },
          ])
      ),
    ],
  },
};
