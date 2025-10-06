// Bcode/commands/embed/embed.js
const { SlashCommandBuilder } = require('discord.js');
const { 
    execute, 
    handleButton, 
    handleModal, 
    handleInteraction, 
    cleanupAllSessions 
} = require('./embed-commands/--command-manager.js');

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

  execute,
  handleButton,
  handleModal,
  handleInteraction,
  cleanupAllSessions // Make sure this is included in the exports
};