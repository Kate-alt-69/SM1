const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const STICKY_DATA_FILE = path.join(__dirname, 'sticky-data.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Manage sticky messages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a sticky message')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Message to make sticky')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove sticky message from this channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Initialize maps if they don't exist to avoid undefined errors
        if (!interaction.client.stickyMessages) {
            interaction.client.stickyMessages = new Map();
        }
        if (!interaction.client.activeChannels) {
            interaction.client.activeChannels = new Set();
        }
        if (!interaction.client.stickyLastSent) {
            interaction.client.stickyLastSent = new Map();
        }

        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'set') {
            const message = interaction.options.getString('message');
            await this.setSticky(interaction, message);
        } else if (subcommand === 'remove') {
            await this.removeSticky(interaction);
        }
    },

    async setSticky(interaction, message) {
        const stickyMsg = await interaction.channel.send(message);
        interaction.client.stickyMessages.set(interaction.channel.id, {
            messageId: stickyMsg.id,
            content: message,
            lastSent: Date.now()
        });
        await interaction.reply({ content: 'Sticky message set!', ephemeral: true });
        await this.saveData(interaction.client);
    },

    async removeSticky(interaction) {
        const channelId = interaction.channel.id;
        // Use interaction.client instead of this.client
        interaction.client.stickyMessages.delete(channelId);
        interaction.client.activeChannels.delete(channelId); // Remove from active channels
        await interaction.reply({ content: 'Sticky message removed!', ephemeral: true });
    },

    async loadData(client) {
        try {
            const data = JSON.parse(await fs.readFile(STICKY_DATA_FILE, 'utf8'));
            client.stickyMessages = new Map(Object.entries(data.messages || {}));
            client.stickyLastSent = new Map(Object.entries(data.lastSent || {}));
            console.log('✅ Loaded sticky messages data');
        } catch (err) {
            if (err.code !== 'ENOENT') console.error('Error loading sticky data:', err);
            client.stickyMessages = new Map();
            client.stickyLastSent = new Map();
        }
    },

    async saveData(client) {
        const data = {
            messages: Object.fromEntries(client.stickyMessages),
            lastSent: Object.fromEntries(client.stickyLastSent)
        };
        await fs.writeFile(STICKY_DATA_FILE, JSON.stringify(data, null, 2));
    }
};

