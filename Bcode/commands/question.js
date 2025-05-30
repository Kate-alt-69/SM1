const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');

const QUESTION_LIMIT = 256; // max question length

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create a question')
        .addSubcommand(sub =>
            sub.setName('question')
                .setDescription('Create a question (choices or custom answer)')
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.options.getSubcommand() !== 'question') return;

        // Stage 1: Ask for question and type
        const typeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('question_type_choices')
                .setLabel('Choices')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('question_type_custom')
                .setLabel('Custom Answer')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            content: `What is your question? (max ${QUESTION_LIMIT} characters)`,
            components: [typeRow],
            ephemeral: true
        });

        // Collect question and type
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async btnInt => {
            // Ask for the question text
            const modal = new ModalBuilder()
                .setCustomId(`question_modal_${btnInt.customId}`)
                .setTitle('Enter your question')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('question_text')
                            .setLabel('Question')
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(QUESTION_LIMIT)
                            .setRequired(true)
                    )
                );
            await btnInt.showModal(modal);

            // Modal submit
            const modalFilter = i => i.user.id === interaction.user.id;
            btnInt.awaitModalSubmit({ filter: modalFilter, time: 60000 })
                .then(async modalInt => {
                    const question = modalInt.fields.getTextInputValue('question_text');
                    if (btnInt.customId === 'question_type_choices') {
                        // Stage 2: Ask for choices
                        const choicesModal = new ModalBuilder()
                            .setCustomId('choices_modal')
                            .setTitle('Enter choices (comma separated)')
                            .addComponents(
                                new ActionRowBuilder().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('choices_text')
                                        .setLabel('Choices (e.g. A,B,C)')
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true)
                                )
                            );
                        await modalInt.showModal(choicesModal);

                        modalInt.awaitModalSubmit({ filter: modalFilter, time: 60000 })
                            .then(async choicesInt => {
                                const choices = choicesInt.fields.getTextInputValue('choices_text').split(',').map(s => s.trim()).filter(Boolean);
                                if (choices.length < 2) {
                                    await choicesInt.reply({ content: 'You must provide at least 2 choices.', ephemeral: true });
                                    return;
                                }
                                // Send question embed with choices as buttons
                                const row = new ActionRowBuilder().addComponents(
                                    choices.map((choice, idx) =>
                                        new ButtonBuilder()
                                            .setCustomId(`answer_choice_${idx}`)
                                            .setLabel(choice)
                                            .setStyle(ButtonStyle.Secondary)
                                    )
                                );
                                const embed = new EmbedBuilder()
                                    .setTitle('Question')
                                    .setDescription(question)
                                    .setColor(0x5865F2);
                                await choicesInt.reply({ embeds: [embed], components: [row] });
                            }).catch(() => {});
                    } else {
                        // Custom answer: send embed with "Answer" button
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('custom_answer')
                                .setLabel('Answer')
                                .setStyle(ButtonStyle.Secondary)
                        );
                        const embed = new EmbedBuilder()
                            .setTitle('Question')
                            .setDescription(question)
                            .setColor(0x5865F2);
                        await modalInt.reply({ embeds: [embed], components: [row] });
                    }
                }).catch(() => {});
        });
    },
    // Button and modal interaction handlers (to be registered in your main bot file)
    async handleInteraction(interaction) {
        // ...existing code...
        if (interaction.isButton()) {
            if (interaction.customId === 'custom_answer') {
                // Show modal for custom answer
                const modal = new ModalBuilder()
                    .setCustomId('submit_custom_answer')
                    .setTitle('Submit your answer')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('custom_answer_text')
                                .setLabel('Your Answer')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                        )
                    );
                await interaction.showModal(modal);
            }
            // ...handle other button interactions (choices, view answers, etc)...
        }
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'submit_custom_answer') {
                // Store answer somewhere (e.g. in memory or DB)
                // For demo, just acknowledge
                await interaction.reply({ content: 'Your answer has been submitted!', ephemeral: true });
                // Optionally, show "View Answers" button
                // ...add logic here...
            }
        }
        // ...existing code...
    }
};