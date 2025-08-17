// Bcode/commands/embed/embedLogic.js
import fs from "fs";
import path from "path";
import { defaultEmbeds } from "./default-embed-logic.js";
export async function handleManager(interaction) {
  const action = interaction.options.getString("action");

  if (action === "create") {
    await interaction.reply({
      content: "📝 Creating new embed...",
      ephemeral: true,
    });
  } else if (action === "edit") {
    await interaction.reply({
      content: "✏️ Editing an existing embed (coming soon)...",
      ephemeral: true,
    });
  } else {
    // Show the default manager embed
    const { embed, components } = defaultEmbeds.manager;
    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }
}
export async function handleSend(interaction) {
  const id = interaction.options.getString("id");
  await interaction.reply({ content: `📤 Sending embed with ID: ${id}`, ephemeral: true });
  // TODO: fetch and send embed
}

export async function handleList(interaction) {
  await interaction.reply({ content: "📜 Listing all embeds (stubbed)", ephemeral: true });
  // TODO: load embeds from embeds.json + defaults and present with dropdown
}
