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

// ============================================================================
// 🟢 OLD SYSTEM — Active Editors (in-memory + embed.json)
// ============================================================================
const activeEditors = new Map();
const EMBED_SESSION_FILE = path.join(__dirname, '..', 'embed.json');

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

// ============================================================================
// 🔵 NEW SYSTEM — Session Management (JSON per session with page history)
// ============================================================================
const SESSION_DIR = path.join(__dirname, '--seasion');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

function getServerSessionDir(serverId) {
    const serverDir = path.join(SESSION_DIR, serverId);
    return serverDir;
}

function sessionFile(serverId, sessionId) {
    const serverDir = getServerSessionDir(serverId);
    return path.join(serverDir, `${sessionId}.json`);
}

function createDefaultEmbed() {
    return {
        title: 'New Embed',
        description: 'Start editing this embed using the buttons below',
        color: '#0099ff',
        fields: [],
        footer: null,
        timestamp: new Date().toISOString(),
        author: null,
        thumbnail: null,
        image: null
    };
}

function createSession(messageId, userId, channelId, serverId) {
    const serverDir = getServerSessionDir(serverId);
    if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
    }

    const session = {
        id: messageId,
        userId,
        channelId,
        serverId,
        startTime: Date.now(),
        lastActive: Date.now(),
        state: 'menu',
        data: {
            embed: createDefaultEmbed(), // Store default embed
            history: [], // Track edit history
            lastEdit: null
        },
        pages: ['menu']
    };

    writeSessionSafe(serverId, messageId, session);
    return session;
}

// Add safe file writing with backup
function writeSessionSafe(serverId, sessionId, data) {
    const filePath = sessionFile(serverId, sessionId);
    const backupPath = `${filePath}.backup`;
    
    try {
        // Write to backup first
        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
        // Then write to main file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        // Remove backup on success
        fs.unlinkSync(backupPath);
    } catch (err) {
        console.error('Session write error:', err);
        // Try to restore from backup if main write failed
        if (fs.existsSync(backupPath)) {
            try {
                fs.copyFileSync(backupPath, filePath);
            } catch (restoreErr) {
                console.error('Backup restore failed:', restoreErr);
            }
        }
    }
}

function getSession(messageId, serverId) {
    if (!serverId) return null;
    const file = sessionFile(serverId, messageId);
    if (!fs.existsSync(file)) return null;

    try {
        const session = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Date.now() - session.lastActive > 30 * 60 * 1000) {
            deleteSession(messageId, serverId);
            return null;
        }
        return session;
    } catch (err) {
        console.error('Session read error:', err);
        return null;
    }
}

function updateSession(messageId, serverId, changes) {
    const session = getSession(messageId, serverId);
    if (!session) return null;

    const updated = { ...session, ...changes, lastActive: Date.now() };
    fs.writeFileSync(sessionFile(serverId, messageId), JSON.stringify(updated, null, 2));
    return updated;
}

function deleteSession(messageId, serverId) {
    const file = sessionFile(serverId, messageId);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        
        // Check if server directory is empty
        const serverDir = getServerSessionDir(serverId);
        if (fs.existsSync(serverDir)) {
            const files = fs.readdirSync(serverDir);
            if (files.length === 0) {
                // Don't delete server directory, keep it cached
                console.log(`Server directory cached: ${serverId}`);
            }
        }
    }
}

// cleanup expired sessions every 5s
function cleanupExpiredSessions() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            const serverDirs = fs.readdirSync(SESSION_DIR);
            for (const serverId of serverDirs) {
                const serverPath = path.join(SESSION_DIR, serverId);
                if (fs.statSync(serverPath).isDirectory()) {
                    const files = fs.readdirSync(serverPath);
                    files.forEach(file => {
                        try {
                            const filePath = path.join(serverPath, file);
                            if (file.endsWith('.json')) {
                                const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                                if (Date.now() - session.lastActive > 30 * 60 * 1000) {
                                    fs.unlinkSync(filePath);
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to process session file: ${file}`, err);
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('Session cleanup error:', err);
    }
}

setInterval(cleanupExpiredSessions, 5000);

// ============================================================================
// 🟣 DSS HELPERS
// ============================================================================
async function createDSSPacket(interaction, embedData, name) {
    const blobId = await DataSavingSystem.allocateBlobID();
    
    // Create the packet for both systems
    const packet = {
        blobId,
        folder: 'embeds',
        userID: interaction.user.id,
        serverID: interaction.guild.id,
        time: Date.now(),
        from: 'embed_manager',
        type: 'save',
        data: {
            name: name || embedData.title,
            author: {
                name: interaction.user.tag,
                id: interaction.user.id,
            },
            embed: embedData,
            version: '1.0'
        }
    };

    return { packet, blobId };
}

async function saveEmbedToDSS(interaction, embedData, name) {
    try {
        await DSS.ready();
        const { packet, blobId } = await createDSSPacket(interaction, embedData, name);

        // Save to both systems for redundancy
        await DSS.createBlob(packet);
        DSSIO.API.save('embeds', blobId, packet.data, name);

        return {
            success: true,
            blobId,
            name,
            data: packet.data
        };
    } catch (err) {
        console.error('Failed to save embed:', err);
        throw new Error('Failed to save embed data');
    }
}

async function loadEmbedFromDSS(blobId) {
    try {
        // Try DSS-I-O first (faster)
        let data = DSSIO.API.load('embeds', blobId);
        
        // Fallback to DSS if needed
        if (!data) {
            const blob = await DSS.readBlob(blobId);
            data = blob.data;
        }

        return data;
    } catch (err) {
        console.error('Failed to load embed:', err);
        return null;
    }
}

async function listServerEmbeds(serverId) {
    try {
        const allEmbeds = DSSIO.API.list('embeds');
        return allEmbeds.filter(embed => {
            const data = DSSIO.API.request('embeds', { blobId: embed.blobId, metaOnly: true });
            return data && data.serverID === serverId;
        });
    } catch (err) {
        console.error('Failed to list embeds:', err);
        return [];
    }
}

// ============================================================================
// 🟡 MAIN COMMAND
// ============================================================================
async function execute(interaction) {
  // Handle slash command
  if (interaction.isChatInputCommand() && interaction.options?.getSubcommand() === 'manager') {
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

      const filter = (i) => i.user.id === interaction.user.id;
      const collector = reply.createMessageComponentCollector({
        filter,
        time: 21600000,
      });

      collector.on('collect', async (i) => {
        try {
          const serverId = i.guild.id;
          if (i.customId === 'embed_options') {
            const selected = i.values[0];
            if (selected === 'create_new') {
              // Only create session when starting a new embed
              createSession(
                reply.id,
                interaction.user.id,
                interaction.channelId,
                serverId
              );
              
              const createEmbed = defaultEmbeds.creating.embed;
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('edit_embed').setLabel('Edit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('save_embed').setLabel('Save').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cancel_embed').setLabel('Cancel').setStyle(ButtonStyle.Danger),
              );
              await i.update({ embeds: [createEmbed], components: [row] });
            }

            // List and Send options don't need sessions
            if (selected === 'list_embeds') {
              const allEmbeds = await listServerEmbeds(serverId);
              const embedList = allEmbeds.length
                ? allEmbeds.map((e) => `• **${e.name || e.blobId}** (ID: ${e.blobId})`).join('\n')
                : '⚠️ No saved embeds found.';
              const listEmbed = new EmbedBuilder()
                .setTitle('📂 Saved Embeds')
                .setDescription(embedList)
                .setColor('Blue');
              await i.update({ embeds: [listEmbed], ephemeral: true });
            }

            if (selected === 'send_embed') {
              pushPage(reply.id, serverId, 'send_embed');
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
                .addOptions(serverEmbeds.map((e) => ({
                  label: e.name || `Embed ${e.blobId}`,
                  value: e.blobId,
                })));
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
          if (!i.replied && !i.deferred) {
            await i.reply({
              content: '⚠️ An error occurred while processing your selection.',
              ephemeral: true
            });
          }
        }
      });

      collector.on('end', (collected) => {
        // Only try to delete session if one was created
        const session = getSession(reply.id, interaction.guild.id);
        if (session) {
          deleteSession(reply.id, interaction.guild.id);
        }
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
        await interaction.reply({ content: '⚠️ Failed to initialize embed manager.', ephemeral: true });
      }
    }
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    const messageId = interaction.message.id;
    const session = getSession(messageId) || activeEditors.get(messageId);
    
    if (!session) {
      return interaction.reply({
        content: '⚠️ Session expired',
        ephemeral: true
      });
    }

    try {
      switch (interaction.customId) {
        case 'embed_options':
          const selected = interaction.values[0];
          if (selected === 'create_new') {
            pushPage(messageId, 'create_new');
            const createEmbed = defaultEmbeds.creating.embed;
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('edit_embed').setLabel('Edit').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('save_embed').setLabel('Save').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('cancel_embed').setLabel('Cancel').setStyle(ButtonStyle.Danger),
            );
            return interaction.update({ embeds: [createEmbed], components: [row] });
          }

          if (selected === 'list_embeds') {
            pushPage(messageId, 'list_embeds');
            const serverEmbeds = await listServerEmbeds(interaction.guild.id);
            const embedList = serverEmbeds.length
              ? serverEmbeds.map((e) => `• **${e.name || e.blobId}** (ID: ${e.blobId})`).join('\n')
              : '⚠️ No saved embeds found.';
            const listEmbed = new EmbedBuilder()
              .setTitle('📂 Saved Embeds')
              .setDescription(embedList)
              .setColor('Blue');
            return interaction.update({ embeds: [listEmbed], ephemeral: true });
          }

          if (selected === 'send_embed') {
            pushPage(messageId, 'send_embed');
            const allEmbeds = DSSIO.API.list('embeds');
            const serverEmbeds = allEmbeds.filter((e) => {
              const blob = DSSIO.API.request('embeds', { blobId: e.blobId });
              return blob && blob.serverID === interaction.guild.id;
            });
            if (!serverEmbeds.length) {
              await interaction.update({ content: '⚠️ No embeds available to send.', ephemeral: true });
              return;
            }
            const dropdown = new StringSelectMenuBuilder()
              .setCustomId('choose_embed_to_send')
              .setPlaceholder('Select an embed to send...')
              .addOptions(serverEmbeds.map((e) => ({
                label: e.name || `Embed ${e.blobId}`,
                value: e.blobId,
              })));
            const row = new ActionRowBuilder().addComponents(dropdown);
            return interaction.update({ content: '📤 Choose an embed to send:', components: [row], ephemeral: true });
          }
          break;

        case 'choose_embed_to_send':
          const blobId = interaction.values[0];
          const blob = DSSIO.API.load('embeds', blobId);
          if (!blob?.data?.embed) {
            await interaction.reply({ content: '⚠️ Could not load embed.', ephemeral: true });
            return;
          }
          const embed = new EmbedBuilder(blob.data.embed);
          await interaction.channel.send({ embeds: [embed] });
          await interaction.reply({ content: `✅ Sent embed **${blob.data.name || blobId}**`, ephemeral: true });
          break;
      }
    } catch (error) {
      console.error('Select menu error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ An error occurred',
          ephemeral: true
        });
      }
    }
  }
}

// ============================================================================
// 🟤 EDITOR
// ============================================================================
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

// ============================================================================
// 🔴 BUTTON HANDLER
// ============================================================================
async function handleButton(interaction) {
  const messageId = interaction.message.id;
  const serverId = interaction.guild.id;
  const session = getSession(messageId, serverId);

  if (!session) {
    return interaction.reply({ 
      content: '⚠️ Session expired', 
      ephemeral: true 
    });
  }

  // Update session activity
  updateSession(messageId, serverId, { lastActive: Date.now() });

  switch (interaction.customId) {
    case 'edit_embed':
      // Create edit menu
      const editRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('edit_title')
          .setLabel('Title')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('edit_description')
          .setLabel('Description')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('edit_fields')
          .setLabel('Fields')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('edit_appearance')
          .setLabel('Appearance')
          .setStyle(ButtonStyle.Secondary)
      );

      const navigationRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('back_page')
          .setLabel('⬅️ Back')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('save_embed')
          .setLabel('💾 Save')
          .setStyle(ButtonStyle.Success)
      );

      session.pages.push('edit');
      updateSession(messageId, serverId, session);
      await updateEmbedPreview(interaction, session.data.embed, [editRow, navigationRow]);
      break;

    case 'back_page':
      const updatedSession = popPage(messageId, serverId);
      if (!updatedSession) {
        return interaction.reply({
          content: '⚠️ Session expired',
          ephemeral: true
        });
      }
      const uiState = await getUIStateForPage(updatedSession.state, updatedSession);
      return interaction.update(uiState);
      break;

    case 'save_embed':
      const modal = new ModalBuilder()
        .setCustomId('save_embed_modal')
        .setTitle('Save Embed')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_name').setLabel('Enter a name for this embed').setStyle(TextInputStyle.Short).setRequired(true),
          ),
        );
      return interaction.showModal(modal);

    case 'send_saved_embed':
      const embed = interaction.message.embeds[0];
      await interaction.channel.send({ embeds: [embed] });
      return interaction.reply({ content: '✅ Embed sent!', ephemeral: true });

    case 'edit_saved_embed':
      return interaction.reply({ content: 'Edit functionality coming soon!', ephemeral: true });

    case 'add_field':
      pushPage(messageId, 'add_field');
      const fieldModal = new ModalBuilder()
        .setCustomId('add_field_modal')
        .setTitle('Add Field')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('field_name')
              .setLabel('Field Name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('field_value')
              .setLabel('Field Value')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
      return interaction.showModal(fieldModal);

    case 'delete_field':
    case 'choose_field':
      return interaction.reply({ 
        content: 'This feature is coming soon!', 
        ephemeral: true 
      });
  }
}

// ============================================================================
// 🟢 MODAL HANDLER
// ============================================================================
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

    if (interaction.message?.id) {
      const session = activeEditors.get(interaction.message.id) || {};
      activeEditors.set(interaction.message.id, { ...session, data: embedData, state: 'editing' });
      updateSession(interaction.message.id, { data: embedData, state: 'editing' });
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
      updateSession(interaction.message.id, { blobID: blob.blobID });
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

// ============================================================================
// ⚫ UNIFIED HANDLER
// ============================================================================
async function handleInteraction(interaction) {
  try {
    const messageId = interaction.message?.id;
    
    // Session validation
    if (messageId) {
      const session = getSession(messageId) || activeEditors.get(messageId);
      if (!session) {
        return interaction.reply({ 
          content: '⚠️ This embed editor has expired. Please start a new session.', 
          ephemeral: true 
        });
      }
    }

    // Command handling
    if (interaction.isChatInputCommand()) {
      return execute(interaction);
    }

    // Button handling
    if (interaction.isButton()) {
      const customId = interaction.customId;
      // Check if this is an embed-related button
      const isEmbedInteraction = embedInteractionPatterns.some(pattern => {
        if (pattern.type === 'startsWith') return customId.startsWith(pattern.value);
        if (pattern.type === 'equals') return customId === pattern.value;
        return false;
      });

      if (isEmbedInteraction) {
        return handleButton(interaction);
      }
    }

    // Modal handling
    if (interaction.isModalSubmit()) {
      if (interaction.customId.includes('embed')) {
        return handleModal(interaction);
      }
    }

    // Select menu handling
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('embed_') || 
          interaction.customId === 'choose_embed_to_send') {
        // Update session
        if (messageId) {
          updateSession(messageId, { lastActive: Date.now() });
        }
        return execute(interaction);
      }
    }

  } catch (err) {
    console.error('Embed Manager Interaction Error:', err);
    const errorReply = { 
      content: '⚠️ Something went wrong in Embed Manager.', 
      ephemeral: true 
    };

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(errorReply);
    } else if (interaction.deferred) {
      await interaction.editReply(errorReply);
    } else {
      await interaction.followUp(errorReply);
    }
  }
}

// Add after session management code and before DSS helpers
function pushPage(messageId, serverId, page) {
    const session = getSession(messageId, serverId);
    if (!session) return null;
    session.pages.push(page);
    session.state = page;
    updateSession(messageId, serverId, session);
    return session;
}

function popPage(messageId, serverId) {
    const session = getSession(messageId, serverId);
    if (!session || session.pages.length <= 1) return null;
    session.pages.pop();
    session.state = session.pages[session.pages.length - 1];
    updateSession(messageId, serverId, session);
    return session;
}

async function updateEmbedPreview(interaction, embedData, components = null) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(embedData.title || '\u200b')
            .setDescription(embedData.description || '\u200b')
            .setColor(embedData.color || '#0099ff');

        if (embedData.fields?.length > 0) {
            embed.addFields(embedData.fields);
        }
        if (embedData.footer) {
            embed.setFooter(embedData.footer);
        }
        if (embedData.timestamp) {
            embed.setTimestamp(new Date(embedData.timestamp));
        }

        const updateData = { embeds: [embed] };
        if (components) {
            updateData.components = components;
        }

        await interaction.update(updateData);
        return true;
    } catch (error) {
        console.error('Preview update error:', error);
        return false;
    }
}

// Add before the handleInteraction function
const embedInteractionPatterns = [
    { type: 'startsWith', value: 'embed_' },
    { type: 'startsWith', value: 'edit_' },
    { type: 'equals', value: 'save_embed' },
    { type: 'equals', value: 'cancel_embed' },
    { type: 'equals', value: 'back_page' },
    { type: 'equals', value: 'add_field' },
    { type: 'equals', value: 'delete_field' },
    { type: 'equals', value: 'choose_field' }
];



// ============================================================================
// 🟢 EXPORT
// ============================================================================
const cleanupAllSessions = () => {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            const serverDirs = fs.readdirSync(SESSION_DIR);
            for (const serverId of serverDirs) {
                const serverDir = path.join(SESSION_DIR, serverId);
                if (fs.statSync(serverDir).isDirectory()) {
                    const files = fs.readdirSync(serverDir);
                    files.forEach(file => {
                        try {
                            fs.unlinkSync(path.join(serverDir, file));
                        } catch (err) {
                            console.error(`Failed to delete session file: ${file}`, err);
                        }
                    });
                }
            }
        }
        // Clear in-memory sessions
        activeEditors.clear();
        console.log('All embed sessions cleaned up');
        return true;
    } catch (err) {
        console.error('Cleanup error:', err);
        return false;
    }
};

module.exports = {
    cleanupAllSessions,
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
};