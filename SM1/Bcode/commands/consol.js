const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Console related commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('report')
        .setDescription('Report error to host')
        .addStringOption(option => option.setName('report').setDescription('Report an error during your session').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('Message to send (optional)').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('tell')
        .setDescription('Send a message to the host via console')
        .addStringOption(option => option.setName('host').setDescription('Host to send the message to').setRequired(true))
        .addStringOption(option => option.setName('message').setDescription('Message to send').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('runtime')
        .setDescription('Show how long the bot has been online'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'tell') {
      await handleTell(interaction);
    } else if (subcommand === 'runtime') {
      const uptimeSeconds = Math.floor(process.uptime());
      const timestamp = `<t:${Math.floor((Date.now() / 1000) - uptimeSeconds)}:R>`;
      await interaction.reply({ content: `Bot has been online for ${timestamp}`, ephemeral: true });
    } else if (subcommand === 'report') {
      await handleReport(interaction);
    }
  }
};

async function handleTell(interaction) {
  const hostId = 'HOST_ID'; // Replace with your host ID
  const host = await interaction.client.users.fetch(hostId).catch(() => null);

  if (!host) {
    await interaction.reply({ content: 'Failed to find host.', ephemeral: true });
    return;
  }

  const message = interaction.options.getString('message');

  try {
    await host.send(message);
    await interaction.reply({ content: 'Message sent to the host!', ephemeral: true });
  } catch (error) {
    console.error('Error sending message:', error);
    await interaction.reply({ content: 'Failed to send message.', ephemeral: true });
  }
}

async function handleReport(interaction) {
  const report = interaction.options.getString('report');
  const message = interaction.options.getString('message');
  // TODO: Implement report logic here (log file, webhook, etc.)
  console.log(`[Report] ${interaction.user.tag}: ${report} | ${message}`);
  await interaction.reply({ content: 'Report submitted.', ephemeral: true });
}