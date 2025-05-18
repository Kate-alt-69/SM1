const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot\'s ping'),

    async execute(interaction) {
        const latency = Math.round(interaction.client.ws.ping);
        await interaction.reply(`🏓 Pong! ${latency}ms`);
    }
};
