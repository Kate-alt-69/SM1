// ============================================================================
// --command-manager.js — Embed Manager Command (with DSS + DSSIO integration)
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
const fs = require('fs');
const path = require('path');
const { DataSavingSystem: DSS } = require('../../../utils/DataSavingSystem.js');
const { DSSIO } = require('../../../utils/DSS-I-O.js');
const { defaultEmbeds } = require('../--default-embed-Logic.js');

// Track active editor sessions in memory
const activeEditors = new Map();
const EMBED_SESSION_FILE = path.join(__dirname, '..', 'embed.json');

// ========================= FILE HELPERS =========================
function readSessionFile() {
  if (!fs.existsSync(EMBED_SESSION_FILE)) {
    return { activeEditors: {}, metadata: { lastCleanup: Date.now() } };
  }
  return JSON.parse(fs.readFileSync(EMBED_SESSION_FILE, 'utf8'));
}

function writeSessionFile(data) {
  fs.writeFileSync(EMBED_SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function saveEditorSession(messageId, session) {
  const data = readSessionFile();
  data.activeEditors[messageId] = session;
  writeSessionFile(data);
}

function getEditorSession(messageId) {
  const data = readSessionFile();
  const session = data.activeEditors[messageId];
  if (!session) return null;

  // Expiration check
  if (Date.now() > session.expiresAt) {
    delete data.activeEditors[messageId];
    writeSessionFile(data);
    return null;
  }
  return session;
}

function updateEditorSession(messageId, changes) {
  const data = readSessionFile();
  if (!data.activeEditors[messageId]) return null;
  data.activeEditors[messageId] = {
    ...data.activeEditors[messageId],
    ...changes,
  };
  writeSessionFile(data);
  return data.activeEditors[messageId];
}

// ========================= SESSION HELPERS =========================
function isValidEditor(messageId) {
  if (!activeEditors.has(messageId)) return false;
  const editor = activeEditors.get(messageId);

  // Expired after 6h
  if (Date.now() - editor.startTime > 21600000) {
    activeEditors.delete(messageId);
    return false;
  }
  return true;
}

// Build DSS packet
function createDSSPacket(interaction, embedData, name, type = 'save') {
  return {
    folder: 'embeds',
    userID: interaction.user.id,
    serverID: interaction.guild.id,
    time: Date.now(),
    from: 'embed_manager',
    type: type,
    dataID: null, // DSS allocates
    data: {
      name: name || embedData.title,
      author: {
        name: interaction.user.tag,
        id: interaction.user.id,
      },
      embed: embedData,
    },
    markerdata: {
      isEmbed: true,
      version: '1.0',
    },
  };
}

// Save helper
async function saveEmbedToDSS(interaction, embedData, name) {
  await DSS.ready();
  const packet = createDSSPacket(interaction, embedData, name, 'save');
  const blob = await DSS.createBlob(packet);
  return blob;
}

// ========================= MAIN COMMAND =========================
async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'manager') {
    try {
      await DSS.ready();
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

      const reply = await interaction.reply({
        embeds: [managerEmbed],
        components: [row],
        fetchReply: true,
      });

      // Save editor session
      activeEditors.set(reply.id, {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        startTime: Date.now(),
        state: 'menu',
      });

      const filter = (i) => i.user.id === interaction.user.id;
      const collector = reply.createMessageComponentCollector({
        filter,
        time: 21600000, // 6h
      });

      collector.on('collect', async (i) => {
        try {
          if (i.customId === 'embed_options') {
            const selected = i.values[0];

            if (selected === 'create_new') {
              const createEmbed = defaultEmbeds.creating.embed;
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('edit_embed').setLabel('Edit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('save_embed').setLabel('Save').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cancel_embed').setLabel('Cancel').setStyle(ButtonStyle.Danger),
              );
              await i.update({ embeds: [createEmbed], components: [row] });
            }

            if (selected === 'list_embeds') {
              const allEmbeds = DSSIO.API.list('embeds');
              const serverEmbeds = allEmbeds.filter((e) => {
                const blob = DSSIO.API.request('embeds', { blobId: e.blobId });
                return blob && blob.serverID === interaction.guild.id;
              });

              const embedList = serverEmbeds.length
                ? serverEmbeds.map((e) => `• **${e.name || e.blobId}** (ID: ${e.blobId})`).join('\n')
                : '⚠️ No saved embeds found.';

              const listEmbed = new EmbedBuilder()
                .setTitle('📂 Saved Embeds')
                .setDescription(embedList)
                .setColor('Blue');

              await i.update({ embeds: [listEmbed], ephemeral: true });
            }

            if (selected === 'send_embed') {
              const allEmbeds = DSSIO.API.list('embeds');
              const serverEmbeds = allEmbeds.filter((e) => {
                const blob = DSSIO.API.request('embeds', { blobId: e.blobId });
                return blob && blob.serverID === interaction.guild.id;
              });

              if (!serverEmbeds.length) {
                await i.update({ content: '⚠️ No embeds available to send.', ephemeral: true });
                return;
              }

              const dropdown = new StringSelectMenuBuilder()
                .setCustomId('choose_embed_to_send')
                .setPlaceholder('Select an embed to send...')
                .addOptions(
                  serverEmbeds.map((e) => ({
                    label: e.name || `Embed ${e.blobId}`,
                    value: e.blobId,
                  }))
                );

              const row = new ActionRowBuilder().addComponents(dropdown);
              await i.update({ content: '📤 Choose an embed to send:', components: [row], ephemeral: true });
            }
          }

          if (i.customId === 'choose_embed_to_send') {
            const blobId = i.values[0];
            const blob = DSSIO.API.load('embeds', blobId);

            if (!blob?.data?.embed) {
              await i.reply({ content: '⚠️ Could not load embed.', ephemeral: true });
              return;
            }

            const embed = new EmbedBuilder(blob.data.embed);
            await i.channel.send({ embeds: [embed] });

            await i.reply({ content: `✅ Sent embed **${blob.data.name || blobId}**`, ephemeral: true });
          }
        } catch (error) {
          console.error('Collector Error:', error);
          await i.reply({ content: '⚠️ An error occurred while processing your selection.', ephemeral: true });
        }
      });

      collector.on('end', (collected) => {
        activeEditors.delete(reply.id);
        if (collected.size === 0) {
          interaction.editReply({
            content: 'Embed manager timed out after 6 hours.',
            components: [],
          }).catch(console.error);
        }
      });
    } catch (err) {
      console.error('Embed Manager Error:', err);
      if (!interaction.replied) {
        await interaction.reply({
          content: '⚠️ Failed to initialize embed manager.',
          ephemeral: true,
        });
      }
    }
  }
}

// ========================= EDITOR =========================
async function startEmbedEditor(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('embed_editor_modal')
    .setTitle('Create Embed')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('embed_title').setLabel('Embed Title').setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('embed_description').setLabel('Embed Description').setStyle(TextInputStyle.Paragraph).setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

// ========================= BUTTON HANDLER =========================
async function handleButton(interaction) {
  if (interaction.customId === 'edit_embed') {
    const editEmbed = new EmbedBuilder().setTitle('✏️ Edit Embed').setDescription('Choose what you want to edit.').setColor('Orange');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('edit_title').setLabel('Edit Title').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_description').setLabel('Edit Description').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit_fields').setLabel('Edit Fields').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('back_to_create').setLabel('⬅️ Back').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [editEmbed], components: [row] });
  }

  if (interaction.customId === 'edit_fields') {
    const fieldUI = new EmbedBuilder().setTitle('🧩 Manage Fields').setDescription('Add, delete, or edit up to 6 fields.').setColor('Purple');
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
          new TextInputBuilder().setCustomId('embed_name').setLabel('Enter a name for this embed').setStyle(TextInputStyle.Short).setRequired(true),
        ),
      );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'send_saved_embed') {
    const embed = interaction.message.embeds[0];
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Embed sent!', ephemeral: true });
  }

  if (interaction.customId === 'edit_saved_embed') {
    return interaction.reply({ content: 'Edit functionality coming soon!', ephemeral: true });
  }
}

// ========================= MODAL HANDLER =========================
async function handleModal(interaction) {
  if (interaction.customId === 'embed_editor_modal') {
    const embedData = {
      title: interaction.fields.getTextInputValue('embed_title'),
      description: interaction.fields.getTextInputValue('embed_description'),
      color: '#0099ff',
      timestamp: new Date().toISOString(),
      fields: [],
    };

    const embed = new EmbedBuilder().setTitle(embedData.title).setDescription(embedData.description).setColor(embedData.color).setTimestamp();

    // Store in session
    if (interaction.message?.id) {
      const session = activeEditors.get(interaction.message.id) || {};
      activeEditors.set(interaction.message.id, { ...session, data: embedData, state: 'editing' });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('edit_saved_embed').setLabel('Edit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('save_embed').setLabel('Save').setStyle(ButtonStyle.Success),
    );

    return interaction.reply({
      content: `✏️ Embed ready. Use **Save** when done.`,
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  }

  if (interaction.customId === 'save_embed_modal') {
    const name = interaction.fields.getTextInputValue('embed_name');
    const session = interaction.message?.id ? activeEditors.get(interaction.message.id) : null;

    if (!session?.data) {
      return interaction.reply({ content: '⚠️ No embed data found to save. Please edit first.', ephemeral: true });
    }

    try {
      const blob = await saveEmbedToDSS(interaction, session.data, name);

      activeEditors.set(interaction.message.id, { ...session, blobID: blob.blobID });

      return interaction.reply({
        content: `✅ Embed saved as **${name}** in folder **embeds** with ID: **${blob.blobID}**`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('DSS Save Error:', err);
      return interaction.reply({ content: '⚠️ Failed to save embed to DSS.', ephemeral: true });
    }
  }
}

// ========================= UNIFIED HANDLER =========================
async function handleInteraction(interaction) {
  try {
    const messageId = interaction.message?.id;
    if (messageId && !isValidEditor(messageId)) {
      return interaction.reply({ content: '⚠️ This embed editor has expired. Please start a new session.', ephemeral: true });
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'embed') return execute(interaction);
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
    .addSubcommand((sub) =>
      sub.setName('manager').setDescription('Open Embed Manager')
    ),
  execute,
  handleButton,
  handleModal,
  handleInteraction,
  startEmbedEditor,
};