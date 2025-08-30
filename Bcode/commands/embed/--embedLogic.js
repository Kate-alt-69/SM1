// embedLogic.js — Embed Logic Handler with Dropdown + Manager Functions

const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const DataSavingSystem = require('../../utils/DataSavingSystem');

class EmbedLogic {
  constructor(client) {
    this.client = client;
  }

  // Main entry point for embed manager command (/embed manager)
  async handleEmbedManager(interaction) {
    const menu = await EmbedLogic.buildDropdownMenu(interaction.guildId);

    await interaction.reply({
      content: '📂 Embed Manager — Choose an option below:',
      components: [menu],
      ephemeral: true
    });
  }

  // Handles dropdown menu selection
  async handleSelect(interaction) {
    const { customId, values, guildId, user } = interaction;

    if (customId === 'embed_manager') {
      const selection = values[0];

      if (selection === 'create_new') {
        await this.startEmbedCreation(interaction, guildId, user.id);
      } else if (selection.startsWith('embed_')) {
        const embedId = selection.replace('embed_', '');
        await this.showEmbed(interaction, guildId, embedId);
      }
    }
  }

  // Start creating a new embed flow
  async startEmbedCreation(interaction, guildId, userId) {
    const embedData = {
      title: 'New Embed',
      description: 'Describe your embed here...',
      color: 0x00AE86,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    const blobId = await DataSavingSystem.writeBlob(guildId, 'embed', embedData);

    const embed = new EmbedBuilder()
      .setTitle(embedData.title)
      .setDescription(embedData.description)
      .setColor(embedData.color);

    // Show the embed immediately after creation
    await interaction.reply({
      content: `📝 New embed created and loaded with ID: \`${blobId}\`. You can now edit it further.`,
      embeds: [embed],
      ephemeral: true
    });
  }

  // Show an existing embed
  async showEmbed(interaction, guildId, embedId) {
    try {
      const embedData = await DataSavingSystem.readBlob(guildId, 'embed', embedId);

      if (!embedData) {
        return await interaction.reply({
          content: `⚠️ Embed with ID \`${embedId}\` not found.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(embedData.title || 'Untitled Embed')
        .setDescription(embedData.description || 'No description')
        .setColor(embedData.color || 0x2f3136);

      await interaction.reply({
        content: `📤 Here is your embed (ID: \`${embedId}\`)`,
        embeds: [embed],
        ephemeral: true
      });
    } catch (err) {
      console.error('Error showing embed:', err);
      await interaction.reply({
        content: `❌ Failed to load embed: ${err.message}`,
        ephemeral: true
      });
    }
  }

  // Generate the dropdown menu (includes Create New + existing embeds)
  static async buildDropdownMenu(guildId) {
    let options = [
      {
        label: '➕ Create New Embed',
        description: 'Start creating a brand new embed',
        value: 'create_new'
      }
    ];

    try {
      const metadata = await DataSavingSystem.listMetadata(guildId, 'embed');
      if (metadata && metadata.length > 0) {
        metadata.forEach(entry => {
          options.push({
            label: entry.title || `Embed ${entry.id}`,
            description: `ID: ${entry.id}`,
            value: `embed_${entry.id}`
          });
        });
      }
    } catch (err) {
      console.warn('⚠️ Failed to load embed metadata:', err);
    }

    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('embed_manager')
        .setPlaceholder('Select an action')
        .addOptions(options)
    );
  }
}

module.exports = EmbedLogic;