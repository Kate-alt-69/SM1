const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    SlashCommandBuilder
} = require('discord.js');

// Autocomplete helper function
async function getEmbedChoices(interaction) {
    try {
        const guildEmbeds = Object.entries(interaction.client.storedEmbeds)
            .filter(([_, v]) => v.guildId === interaction.guildId);
        
        const choices = guildEmbeds.map(([embedId, data]) => ({
            name: `📄 ${data.title || 'Untitled'}`,
            value: embedId
        })).slice(0, 25);
        
        return choices;
    } catch (error) {
        console.error(`Error in getEmbedChoices: ${error}`);
        return [];
    }
}

class EmbedCreator {
    constructor(client) {
        this.client = client;
        this.embedData = this.getDefaultEmbedData();
    }

    getDefaultEmbedData() {
        return {
            title: 'New Embed',
            description: 'Use the buttons below to customize this embed',
            color: 0x0099ff,
            footer: null,
            thumbnail: null,
            image: null,
            author: {
                name: null,
                iconUrl: null,
                url: null
            },
            timestamp: false,
            fields: []
        };
    }

    createPreviewEmbed() {
        const embed = new EmbedBuilder()
            .setTitle(this.embedData.title)
            .setDescription(this.embedData.description)
            .setColor(this.embedData.color);

        if (this.embedData.footer) embed.setFooter({ text: this.embedData.footer });
        if (this.embedData.thumbnail) embed.setThumbnail(this.embedData.thumbnail);
        if (this.embedData.image) embed.setImage(this.embedData.image);
        if (this.embedData.author.name) {
            embed.setAuthor({
                name: this.embedData.author.name,
                iconURL: this.embedData.author.iconUrl,
                url: this.embedData.author.url
            });
        }
        if (this.embedData.timestamp) embed.setTimestamp();
        
        this.embedData.fields.forEach(field => {
            embed.addFields({ 
                name: field.name, 
                value: field.value, 
                inline: field.inline ?? true 
            });
        });

        return embed;
    }

    createComponents() {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('color')
                .setLabel('Color')
                .setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('save')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        return [row1, row2];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage embeds')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new embed')
                .addStringOption(option =>
                    option.setName('template')
                        .setDescription('Optional template ID to start from')
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Send a saved embed')
                .addStringOption(option =>
                    option.setName('embed_id')
                        .setDescription('The embed to send')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send the embed to')
                )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'create') {
            const creator = new EmbedCreator(interaction.client);
            const embed = creator.createPreviewEmbed();
            const components = creator.createComponents();

            await interaction.reply({
                content: '🔨 Embed Creator - Use the buttons below to customize your embed',
                embeds: [embed],
                components,
                ephemeral: true
            });
        }
        // Additional subcommand handling here
    }
};
