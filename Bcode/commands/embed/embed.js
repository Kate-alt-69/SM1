// Bcode/commands/embed/embed.js
const { SlashCommandBuilder } = require('discord.js');
const { DataSavingSystem: DSS } = require('../../utils/DataSavingSystem.js');
const commandManager = require('./embed-commands/--command-manager.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Embed management system')
    .addSubcommand(sub =>
      sub.setName('manager').setDescription('Open the embed manager')
    )
    .addSubcommand(sub =>
      sub.setName('send').setDescription('Send an embed by ID')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('The embed ID to send')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all available embeds')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case 'manager':
          return await commandManager.execute(interaction);
        case 'send':
          await this.handleSend(interaction);
          break;
        case 'list':
          await this.handleList(interaction);
          break;
        default:
          await interaction.reply({ content: '❌ Unknown subcommand', ephemeral: true });
      }
    } catch (err) {
      console.error('Embed command error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ An error occurred while processing your embed command.',
          ephemeral: true,
        });
      }
    }
  },

  // Use the manager's interaction handler
  handleInteraction: commandManager.handleInteraction
};