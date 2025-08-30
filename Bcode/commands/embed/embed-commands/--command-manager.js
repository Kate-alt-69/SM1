// ============================================================================
// --command-manager.js — Embed Manager Command (with DSS integration)
// ============================================================================
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { DataSavingSystem: DSS } = require('../../../utils/DataSavingSystem.js');
const { defaultEmbeds } = require('../--default-embed-Logic.js');

// ========================= MAIN COMMAND =========================
async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'manager') {
    const managerEmbed = defaultEmbeds.manager.embed;
    const dropdown = new StringSelectMenuBuilder()
      .setCustomId('embed_options')
      .setPlaceholder('Choose an action...')
      .addOptions([
        { label: 'Create New Embed', value: 'create_new' },
        { label: 'List Embeds', value: 'list_embeds' },
        { label: 'Send Embed', value: 'send_embed' },
      ]);
    const row = new ActionRowBuilder().addComponents(dropdown);
    await interaction.reply({ embeds: [managerEmbed], components: [row] });
  }
}

// ========================= SELECT HANDLER =========================
async function handleSelect(interaction) {
  if (interaction.customId === 'embed_options') {
    const selected = interaction.values[0];

    if (selected === 'create_new') {
      const createEmbed = defaultEmbeds.creating.embed;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('edit_embed').setLabel('Edit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('save_embed').setLabel('Save').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_embed').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      );
      return interaction.reply({ embeds: [createEmbed], components: [row] });
    }

    if (selected === 'list_embeds') {
      await DSS.ready();
      const meta = await DSS.loadMetadata();
      const embeds = Object.keys(meta.blobs)
        .map(id => ({ id, ...meta.blobs[id] }))
        .filter(b => !b.deleted);

      const embedList = embeds.length
        ? embeds.map(b => `• **${b.id}** (${b.path})`).join('\n')
        : '⚠️ No saved embeds found.';

      const listEmbed = new EmbedBuilder()
        .setTitle('📂 Saved Embeds')
        .setDescription(embedList)
        .setColor('Blue');

      return interaction.reply({ embeds: [listEmbed], ephemeral: true });
    }

    if (selected === 'send_embed') {
      await DSS.ready();
      const meta = await DSS.loadMetadata();
      const embeds = Object.keys(meta.blobs)
        .map(id => ({ id, ...meta.blobs[id] }))
        .filter(b => !b.deleted);

      if (!embeds.length) {
        return interaction.reply({ content: '⚠️ No embeds available to send.', ephemeral: true });
      }

      const dropdown = new StringSelectMenuBuilder()
        .setCustomId('choose_embed_to_send')
        .setPlaceholder('Select an embed to send...')
        .addOptions(
          embeds.map(b => ({ label: b.id, value: b.id }))
        );

      const row = new ActionRowBuilder().addComponents(dropdown);
      return interaction.reply({ content: '📤 Choose an embed to send:', components: [row], ephemeral: true });
    }
  }

  if (interaction.customId === 'choose_embed_to_send') {
    const blobID = interaction.values[0];
    const blob = await DSS.readBlob(blobID);
    if (!blob?.data?.embed) {
      return interaction.reply({ content: `⚠️ Embed not found in blob ${blobID}.`, ephemeral: true });
    }

    await interaction.channel.send({ embeds: [blob.data.embed] });
    return interaction.reply({ content: `✅ Embed **${blobID}** sent!`, ephemeral: true });
  }
}

// ========================= BUTTON HANDLER =========================
async function handleButton(interaction) {
  if (interaction.customId === 'edit_embed') {
    const editEmbed = new EmbedBuilder()
      .setTitle('✏️ Edit Embed')
      .setDescription('Choose what you want to edit.')
      .setColor('Orange');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('edit_title').setLabel('Edit Title').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_description').setLabel('Edit Description').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_fields').setLabel('Edit Fields').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('back_to_create').setLabel('⬅️ Back').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [editEmbed], components: [row] });
  }

  if (interaction.customId === 'edit_fields') {
    const fieldUI = new EmbedBuilder()
      .setTitle('🧩 Manage Fields')
      .setDescription('Add, delete, or edit up to 6 fields.')
      .setColor('Purple');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_field').setLabel('Add Field').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('delete_field').setLabel('Delete Field').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('choose_field').setLabel('Edit Field').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('back_to_edit').setLabel('⬅️ Back').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [fieldUI], components: [row] });
  }

  if (interaction.customId === 'save_embed') {
    const modal = new ModalBuilder()
      .setCustomId('save_embed_modal')
      .setTitle('Save Embed')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_name')
            .setLabel('Enter a name for this embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    return interaction.showModal(modal);
  }
}

// ========================= MODAL HANDLER =========================
async function handleModal(interaction) {
  if (interaction.customId === 'save_embed_modal') {
    await DSS.ready();
    const name = interaction.fields.getTextInputValue('embed_name');
    const embed = interaction.message.embeds[0]?.toJSON();

    await DSS.createBlob({
      folder: 'embeds',
      userID: interaction.user.id,
      serverID: interaction.guild.id,
      from: 'embed_manager',
      type: 'embed',
      data: { name, embed },
    });

    return interaction.reply({ content: `✅ Embed saved as **${name}**!`, ephemeral: true });
  }
}

// ========================= UNIFIED HANDLER =========================
async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'embed') {
        return execute(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      return handleSelect(interaction);
    } else if (interaction.isButton()) {
      return handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      return handleModal(interaction);
    }
  } catch (err) {
    console.error('Embed Manager Interaction Error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '⚠️ Something went wrong in Embed Manager.', ephemeral: true });
    }
  }
}

// ========================= EXPORT =========================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Embed Manager')
    .addSubcommand(sub => sub.setName('manager').setDescription('Open Embed Manager')),
  execute,
  handleSelect,
  handleButton,
  handleModal,
  handleInteraction, // 👈 add this one for cleaner routing
};
