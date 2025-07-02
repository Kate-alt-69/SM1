const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Console related commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('report')
        .setDescription('Report error to host')
        .addStringOption(option =>
          option.setName('report')
            .setDescription('Report a error during your session')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Message to send (optional)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('tell')
        .setDescription('Send a message to the host via console')
        .addStringOption(option =>
          option.setName('host')
            .setDescription('Host to send the message to')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Message to send')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('runtime')
        .setDescription('Show how long the bot has been online'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'tell') {
      const host = interaction.options.getString('host');
      const message = interaction.options.getString('message');
      console.log(`[Tell Command] Host: ${host} - Message: ${message}`);
      await interaction.reply({ content: `Message sent to host: ${host}`, ephemeral: true });
    } else if (subcommand === 'runtime') {
      const uptimeSeconds = Math.floor(process.uptime());
      const timestamp = `<t:${Math.floor((Date.now() / 1000) - uptimeSeconds)}:R>`;
      await interaction.reply({ content: `Bot has been online for ${timestamp}`, ephemeral: true });
    } else if (subcommand === 'report') {
      await runReportCommand(interaction);
    }
  }
};

async function runTellCommand(interaction) {
    const host = interaction.client.users.cache.get('HOST_ID'); // Replace with the host's ID
    if (!host) {
      await interaction.reply(ErrorMessages[ErrorCodes.CONSOL_COMMMAND_FAILED]);
      return;
    }

    const message = interaction.options.getString('message');
    try {
      const sentMessage = await host.send(message);
      if (!sentMessage) {
        throw new Error('Message not sent');
      }
      await interaction.reply('Message sent to the host!');
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.message === 'Message not sent') {
        await interaction.reply(ErrorMessages[ErrorCodes.CONSOLE_RECEIVED_FAILED]);
      } else {
        await interaction.reply(ErrorMessages[ErrorCodes.CONSOLE_SEND_FAILED]);
      }
    }
}

async function runTellCommand(interaction) {
    const host = interaction.client.users.cache.get('HOST_ID'); // Replace with the host's ID
    if (!host) {
      await interaction.reply(ErrorMessages[ErrorCodes.CONSOL_COMMMAND_FAILED]);
      return;
    }

    const message = interaction.options.getString('message');
    try {
      const sentMessage = await host.send(message);
      if (!sentMessage) {
        throw new Error('Message not sent');
      }
      await interaction.reply('Message sent to the host!');
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.message === 'Message not sent') {
        await interaction.reply(ErrorMessages[ErrorCodes.CONSOLE_RECEIVED_FAILED]);
      } else {
        await interaction.reply(ErrorMessages[ErrorCodes.CONSOLE_SEND_FAILED]);
      }
    }
}