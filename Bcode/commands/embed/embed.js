// Bcode/commands/embed/embed.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import * as EmbedLogic from "./embedLogic.js";

export default {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Embed management system")
    .addSubcommand(sub =>
      sub
        .setName("manager")
        .setDescription("Create or edit an embed for this server")
        .addStringOption(opt =>
          opt.setName("action")
            .setDescription("What do you want to do?")
            .setRequired(true)
            .addChoices(
              { name: "create", value: "create" },
              { name: "edit", value: "edit" }
            )
        )
        .addStringOption(opt =>
          opt.setName("id")
            .setDescription("The embed ID (required for edit)")
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("send")
        .setDescription("Send an embed by ID")
        .addStringOption(opt =>
          opt.setName("id")
            .setDescription("The embed ID to send")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List all available embeds")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "manager":
          await EmbedLogic.handleManager(interaction);
          break;
        case "send":
          await EmbedLogic.handleSend(interaction);
          break;
        case "list":
          await EmbedLogic.handleList(interaction);
          break;
        default:
          await interaction.reply({ content: "Unknown subcommand", ephemeral: true });
      }
    } catch (err) {
      console.error("Embed command error:", err);
      await interaction.reply({ content: "❌ An error occurred while processing your embed command.", ephemeral: true });
    }
  },
};
