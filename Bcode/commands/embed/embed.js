// Bcode/commands/embed/embed.js
const { SlashCommandBuilder } = require('discord.js');
const {
  execute: handleManager,
  handleSelect,
  handleButton,
  handleModal,
} = require('./embed-commands/--command-manager.js'); // updated path

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
          await handleManager(interaction); // directly calls command-manager.js execute
          break;

        case 'send':
          // TODO: hook this into DSS like in command-manager.js
          await interaction.reply({ content: '📤 Send/embed feature not implemented yet.', ephemeral: true });
          break;

        case 'list':
          // TODO: hook this into DSS like in command-manager.js
          await interaction.reply({ content: '📂 Listing embeds is not implemented yet.', ephemeral: true });
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
  }
};