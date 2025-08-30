// Bcode/commands/embed/default-embed-logic.js
import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";

// Default embed templates used by the embed manager UI
export const defaultEmbeds = {
  manager: {
    id: "EMB.manager-page",
    embed: new EmbedBuilder()
      .setTitle("Thenks For Using Embed Manager")
      .setDescription(`Embed Manager lets you edit embeds created in your server and send them as examples.\nUpdate this embed to your desire or click list embed below from the drop down for showing what embeds your server holds\nfind out more about DCB [here](https://github.com/Kate-alt-69/SM1)`)
      .setColor(0x2f3136)
      .setFooter({
         text: "Embed Manager • Default Page From Server Manager 1",
         iconURL:'https://cdn.discordapp.com/attachments/1381534144944803893/1407315482238914590/discotools-xyz-icon.png?ex=68a5a82d&is=68a456ad&hm=14d4a583dc52a0f485182a1951df40a483cf5d7488d95f5bf19424c1040760c7'
         }),
    components: []
  },
  creating: {
    id: "EMB.creating-page",
    embed: new EmbedBuilder()
      .setTitle("Creating New Embed")
      .setDescription(
        `this is a default embed you can edit this\n- embed moment`
      )
      .setColor(0x5865f2),
    components: [],
  },
};