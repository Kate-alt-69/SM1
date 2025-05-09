const { SlashCommandBuilder } = require('@discordjs/builders');
const { CommandInteraction } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fun')
        .setDescription('Fun commands for entertainment') // Add this description
        .addSubcommand(subcommand =>
            subcommand
                .setName('8ball')
                .setDescription('Ask the magic 8-ball a question :)')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('The question to ask')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('flip')
                .setDescription('Flip a coin, lets see who wins!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('roll')
                .setDescription('Roll a dice and action')
                .addIntegerOption(option =>
                    option.setName('sides')
                        .setDescription('Number of sides on the dice')
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case '8ball':
                const responses = [
                    "It is certain.", "Without a doubt.", "Yes, definitely.",
                    "Better not tell you now.", "Ask again later.", "Cannot predict now.",
                    "Don't count on it.", "My reply is no.", "Very doubtful."
                ];
                const question = interaction.options.getString('question');
                await interaction.reply(`Question: ${question}\n🎱 Answer: ${responses[Math.floor(Math.random() * responses.length)]}`);
                break;

            case 'flip':
                const result = Math.random() < 0.5 ? "Heads" : "Tails";
                await interaction.reply(`🪙 The coin landed on: **${result}**!`);
                break;

            case 'roll':
                const sides = interaction.options.getInteger('sides') || 6;
                if (sides < 1) {
                    await interaction.reply("Please specify a positive number of sides!");
                    return;
                }
                const diceResult = Math.floor(Math.random() * sides) + 1;
                await interaction.reply(`🎲 You rolled a d${sides} and got: **${diceResult}**!`);
                break;
        }
    },
};
