const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');

class ColorPickerView {
    constructor(parentView) {
        this.parent = parentView;
        this.components = this.createColorButtons();
    }

    createColorButtons() {
        const colors = [
            ["Red", Colors.Red],
            ["Blue", Colors.Blue],
            ["Green", Colors.Green],
            ["Purple", Colors.Purple],
            ["Gold", Colors.Yellow], // Discord.js uses Yellow for gold
            ["Orange", Colors.Orange]
        ];

        const rows = [];
        let currentRow = [];

        colors.forEach(([name, color], i) => {
            const button = new ButtonBuilder()
                .setCustomId(`color_${name.toLowerCase()}`)
                .setLabel(name)
                .setStyle(ButtonStyle.Secondary);

            currentRow.push(button);

            if (currentRow.length === 4 || i === colors.length - 1) {
                rows.push(new ActionRowBuilder().addComponents(currentRow));
                currentRow = [];
            }
        });

        return rows;
    }

    async handleInteraction(interaction) {
        const colorName = interaction.customId.split('_')[1];
        const colorMap = {
            'red': Colors.Red,
            'blue': Colors.Blue,
            'green': Colors.Green,
            'purple': Colors.Purple,
            'gold': Colors.Yellow,
            'orange': Colors.Orange
        };

        this.parent.embedData.color = colorMap[colorName];
        await this.parent.updatePreview(interaction);
        await interaction.message.delete();
    }
}

module.exports = ColorPickerView;
