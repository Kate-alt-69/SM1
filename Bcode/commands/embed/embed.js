const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    Colors 
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { validateHexColor, hexToDecimal } = require('../../utils/embedHelpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage embeds')
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Send Any Embeds Made in Server.')
                .addStringOption(option =>
                    option.setName('ID')
                    .setRequired(true)
                )
                
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search For Embeds In The Sevrer.')
                .addStringOption(option =>
                    option.setName('search')
                        .setDescription('Search For Any Embed by Typing')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create Embed Using Embed Creation. (By K8)')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name/ID for the embed')
                        .setRequired(true))),

    embedCache: new Map(), // Store embed data during editing

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'create') {
            const embedName = interaction.options.getString('name');
            
            // Initialize embed state
            const embedData = {
                name: embedName,
                color: Colors.Blue, // Default color
                colorHistory: [Colors.Blue],
                content: {
                    title: 'New Embed',
                    description: 'Use the buttons below to customize this embed'
                }
            };

            // Save initial state
            this.embedCache.set(interaction.user.id, embedData);

            // Create initial embed
            const embed = this.createEmbed(embedData);
            const components = this.createEditorButtons();

            await interaction.reply({
                content: `Creating embed: ${embedName}`,
                embeds: [embed],
                components: components,
                ephemeral: true
            });
        }
    },

    createEmbed(data) {
        return new EmbedBuilder()
            .setTitle(data.content.title)
            .setDescription(data.content.description)
            .setColor(data.color);
    },

    createEditorButtons() {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('edit_title')
                .setLabel('Title')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_description')
                .setLabel('Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_color')
                .setLabel('Color')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('save_embed')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel_embed')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        return [row1, row2];
    },

    async handleButton(interaction) {
        const userData = this.embedCache.get(interaction.user.id);
        if (!userData) return;

        switch (interaction.customId) {
            case 'edit_color':
                await this.showColorEditor(interaction, userData);
                break;
            case 'edit_description':
                await this.showDescriptionModal(interaction, userData);
                break;
            // ... other button handlers
        }
    },

    async showColorEditor(interaction, userData) {
        // Create color picker with presets and HEX input
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('color_hex')
                .setLabel('Custom HEX')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('color_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        // Add preset colors
        const presetRows = Object.entries(Colors).slice(0, 8).map(([name, value]) => {
            return new ButtonBuilder()
                .setCustomId(`color_preset_${value}`)
                .setLabel(name)
                .setStyle(ButtonStyle.Secondary);
        });

        const row2 = new ActionRowBuilder().addComponents(presetRows.slice(0, 4));
        const row3 = new ActionRowBuilder().addComponents(presetRows.slice(4));

        await interaction.reply({
            content: 'Choose a color or enter a custom HEX code:',
            components: [row1, row2, row3],
            ephemeral: true
        });
    },

    async handleColorButton(interaction) {
        const userData = this.embedCache.get(interaction.user.id);
        if (!userData) return;

        const action = interaction.customId;

        if (action === 'color_hex') {
            const modal = new ModalBuilder()
                .setCustomId('color_hex_input')
                .setTitle('Enter HEX Color');

            const hexInput = new TextInputBuilder()
                .setCustomId('hex_value')
                .setLabel('HEX Color (e.g. #FF0000)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(hexInput));
            await interaction.showModal(modal);
        } else if (action === 'color_cancel') {
            // Revert to previous color
            userData.color = userData.colorHistory[userData.colorHistory.length - 2] || userData.color;
            await this.updateEmbed(interaction, userData);
        } else if (action.startsWith('color_preset_')) {
            const color = parseInt(action.split('_')[2]);
            userData.colorHistory.push(userData.color);
            userData.color = color;
            await this.updateEmbed(interaction, userData);
        }
    },

    async handleHexInput(interaction) {
        const userData = this.embedCache.get(interaction.user.id);
        if (!userData) return;

        const hex = interaction.fields.getTextInputValue('hex_value');
        if (validateHexColor(hex)) {
            userData.colorHistory.push(userData.color);
            userData.color = hexToDecimal(hex);
            await this.updateEmbed(interaction, userData);
        } else {
            await interaction.reply({
                content: 'Invalid HEX color! Please use format: #RRGGBB',
                ephemeral: true
            });
        }
    },

    async updateEmbed(interaction, userData) {
        const embed = this.createEmbed(userData);
        await interaction.message.edit({
            embeds: [embed],
            components: this.createEditorButtons()
        });
        await interaction.deferUpdate();
    }
};
