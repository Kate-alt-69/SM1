const { EmbedBuilder } = require('discord.js');

function formatDescription(text) {
    // Replace Discord formatting markers
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/```(.*?)```/g, '$1')   // Code block
        .replace(/`(.*?)`/g, '$1')       // Inline code
        .replace(/__(.*?)__/g, '$1')     // Underline
        .replace(/~~(.*?)~~/g, '$1');    // Strikethrough
}

function validateHexColor(hex) {
    return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

function hexToDecimal(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

module.exports = {
    formatDescription,
    validateHexColor,
    hexToDecimal
};
