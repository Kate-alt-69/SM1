const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

// Helper function for embed choices autocomplete
async function getEmbedChoices(interaction) {
    try {
        const guildEmbeds = Object.entries(interaction.client.storedEmbeds)
            .filter(([_, v]) => v.guildId === interaction.guildId);
        
        return guildEmbeds.map(([embedId, data]) => ({
            name: `📄 ${data.title || 'Untitled'}`,
            value: embedId
        })).slice(0, 25);
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

    // ...rest of the EmbedCreator class implementation...
}

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
                .addSubcommand(subcommand =>
                    subcommand.setName('template')
                        .setDescription('Create from template')
                        .addStringOption(option =>
                            option.setName('id')
                                .setDescription('Template ID')
                                .setAutocomplete(true)
                                .setRequired(true)
                        )
                )
        ),

    async execute(interaction) {
        const creator = new EmbedCreator(interaction.client);
        // ...command execution logic...
    }
};
