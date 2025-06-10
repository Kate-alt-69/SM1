const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder 
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage embeds')
        .addSubcommandGroup(group =>
            group.setName('create')
                .setDescription('Create a new embed')
                .addSubcommand(subcommand =>
                    subcommand.setName('new')
                        .setDescription('Create a new embed from scratch')
                )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommandGroup() === 'create') {
            // Stage 1: Ask for embed name
            const modal = new ModalBuilder()
                .setCustomId('embed-name-input')
                .setTitle('Name Your Embed');

            const nameInput = new TextInputBuilder()
                .setCustomId('embedName')
                .setLabel('Give your embed a name (for saving)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            await interaction.showModal(modal);
        }
    },

    async handleModalSubmit(interaction) {
        if (interaction.customId === 'embed-name-input') {
            const embedName = interaction.fields.getTextInputValue('embedName');
            
            // Stage 2: Show embed preview with edit buttons
            const embed = new EmbedBuilder()
                .setTitle('New Embed')
                .setDescription('Use the buttons below to customize your embed')
                .setColor(0x0099ff);

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_title')
                    .setLabel('Set Title')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('edit_description')
                    .setLabel('Set Description')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('edit_color')
                    .setLabel('Set Color')
                    .setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_footer')
                    .setLabel('Add Footer')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('edit_image')
                    .setLabel('Add Image')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('preview_send')
                    .setLabel('Preview & Send')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.reply({
                content: `Creating embed: ${embedName}`,
                embeds: [embed],
                components: [row1, row2],
                ephemeral: true
            });

            // Store temporary embed data
            interaction.client.embedCache = interaction.client.embedCache || new Map();
            interaction.client.embedCache.set(interaction.user.id, {
                name: embedName,
                embed: embed.toJSON(),
                stage: 'editing'
            });
        }
    },

    async handleButton(interaction) {
        const action = interaction.customId;
        const userData = interaction.client.embedCache?.get(interaction.user.id);

        if (!userData) return;

        switch(action) {
            case 'edit_title':
            case 'edit_description':
            case 'edit_color':
            case 'edit_footer':
            case 'edit_image':
                await this.showEditModal(interaction, action.split('_')[1]);
                break;
            
            case 'preview_send':
                await this.showPreviewButtons(interaction);
                break;
        }
    },

    async saveEmbed(interaction, embedData) {
        const filePath = path.join(__dirname, 'embeds.json');
        try {
            let data = { embeds: { serverEmbeds: {} } };
            try {
                data = JSON.parse(await fs.readFile(filePath, 'utf8'));
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }

            if (!data.embeds.serverEmbeds[interaction.guildId]) {
                data.embeds.serverEmbeds[interaction.guildId] = { embeds: {} };
            }

            data.embeds.serverEmbeds[interaction.guildId].embeds[embedData.name] = {
                ...embedData.embed,
                createdBy: interaction.user.id,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            };

            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (err) {
            console.error('Error saving embed:', err);
            return false;
        }
    }
};
