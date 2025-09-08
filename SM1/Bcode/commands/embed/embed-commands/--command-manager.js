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

// Add active editors tracking
const activeEditors = new Map();

// Add validation helper
function isValidEditor(messageId) {
  if (!activeEditors.has(messageId)) return false;
  const editor = activeEditors.get(messageId);
  
  // Check if expired (6 hours = 21600000ms)
  if (Date.now() - editor.startTime > 21600000) {
    activeEditors.delete(messageId);
    return false;
  }
  return true;
}

// Packet helper matches DSS interface requirements
function createDSSPacket(interaction, embedData, type = 'create') {
  return {
    folder: 'embeds',
    userID: interaction.user.id,
    serverID: interaction.guild.id,
    time: Date.now(),
    from: 'embed_manager',
    type: type,
    dataID: null,  // For DSS to allocate
    data: {
      name: embedData.title,
      author: {
        name: interaction.user.tag,
        id: interaction.user.id
      },
      embed: embedData
    },
    markerdata: {
      isEmbed: true,
      version: '1.0'
    }
  };
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
        fetchReply: true 
      });

      // Save editor session
      activeEditors.set(reply.id, {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        startTime: Date.now(),
        state: 'menu'
      });

      const filter = i => i.user.id === interaction.user.id;
      const collector = reply.createMessageComponentCollector({ 
        filter, 
        time: 21600000 // 6 hours
      });

      collector.on('collect', async i => {
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

              await i.update({ embeds: [listEmbed], ephemeral: true });
            }

            if (selected === 'send_embed') {
              const embeds = await DSS.loadMetadata();
              if (!embeds?.blobs) {
                await i.update({ content: '⚠️ No embeds available to send.', ephemeral: true });
                return;
              }

              const dropdown = new StringSelectMenuBuilder()
                .setCustomId('choose_embed_to_send')
                .setPlaceholder('Select an embed to send...')
                .addOptions(
                  Object.keys(embeds.blobs).map(id => ({ label: id, value: id }))
                );

              const row = new ActionRowBuilder().addComponents(dropdown);
              await i.update({ content: '📤 Choose an embed to send:', components: [row], ephemeral: true });
            }
          }
        } catch (error) {
          console.error('Collector Error:', error);
          await i.reply({ content: '⚠️ An error occurred while processing your selection.', ephemeral: true });
        }
      });

      collector.on('end', collected => {
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
          ephemeral: true 
        });
      }
    }
  }
}

let currentEmbedData = null; // Temporary storage for embed being edited

async function startEmbedEditor(interaction) {
  currentEmbedData = {
    title: '',
    description: '',
    color: '#0099ff',
    fields: [],
    timestamp: new Date().toISOString()
  };

  const modal = new ModalBuilder()
    .setCustomId('embed_editor_modal')
    .setTitle('Create Embed')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_title')
          .setLabel('Embed Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_description')
          .setLabel('Embed Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
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

  if (interaction.customId === 'send_saved_embed') {
    const embed = interaction.message.embeds[0];
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Embed sent!', ephemeral: true });
  }

  if (interaction.customId === 'edit_saved_embed') {
    // Add edit functionality here if needed
    return interaction.reply({ 
      content: 'Edit functionality coming soon!', 
      ephemeral: true 
    });
  }
}

// ========================= MODAL HANDLER =========================
async function handleModal(interaction) {
  if (interaction.customId === 'embed_editor_modal') {
    await DSS.ready();
    
    const embedData = {
      title: interaction.fields.getTextInputValue('embed_title'),
      description: interaction.fields.getTextInputValue('embed_description'),
      color: '#0099ff',
      timestamp: new Date().toISOString(),
      fields: []
    };

    const embed = new EmbedBuilder()
      .setTitle(embedData.title)
      .setDescription(embedData.description)
      .setColor(embedData.color)
      .setTimestamp();

    // Create proper DSS packet
    const packet = createDSSPacket(interaction, embedData);
    const blob = await DSS.createBlob(packet);

    // Update active editor data
    if (interaction.message?.id) {
      activeEditors.set(interaction.message.id, {
        ...activeEditors.get(interaction.message.id),
        blobID: blob.blobID,
        state: 'editing'
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_saved_embed')
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('send_saved_embed')
        .setLabel('Send')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ 
      content: `✅ Embed saved with ID: **${blob.blobID}**`,
      embeds: [embed],
      components: [row],
      ephemeral: true 
    });
  }

  if (interaction.customId === 'save_embed_modal') {
    await DSS.ready();
    const name = interaction.fields.getTextInputValue('embed_name');
    const embedData = interaction.message.embeds[0]?.toJSON();
    
    // Create proper DSS packet for saving
    const packet = createDSSPacket(interaction, {
      ...embedData,
      title: name
    }, 'save');
    
    await DSS.createBlob(packet);
    return interaction.reply({ content: `✅ Embed saved as **${name}**!`, ephemeral: true });
  }
}

// ========================= UNIFIED HANDLER =========================
async function handleInteraction(interaction) {
  try {
    // Check if this is a valid editor interaction
    const messageId = interaction.message?.id;
    if (messageId && !isValidEditor(messageId)) {
      return interaction.reply({ 
        content: '⚠️ This embed editor has expired. Please start a new session.',
        ephemeral: true 
      });
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'embed') {
        return execute(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      return;
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
  handleButton,
  handleModal,
  handleInteraction,
  startEmbedEditor
};