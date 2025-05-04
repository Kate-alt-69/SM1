const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActivityType } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const { keepAlive } = require('./KA.js');

// Load environment variables
dotenv.config();
const TOKEN = process.env.TOKEN_SM;
if (!TOKEN) {
    throw new Error("❌ Bot token not found in .env file");
}

class DataStorage {
    constructor(bot) {
        this.bot = bot;
        this.dataFile = "bot_data.json";
        this.bot.storedEmbeds = {};
    }

    async saveData() {
        const data = {
            stickyMessages: this.bot.stickyMessages,
            stickyCooldowns: this.bot.stickyCooldowns,
            guildStickyMessages: this.bot.guildStickyMessages || {},
            serverInfo: this.bot.serverInfo,
            storedEmbeds: this.bot.storedEmbeds
        };

        try {
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 4));
        } catch (e) {
            console.error(`Error saving data: ${e}`);
        }
    }

    async loadData() {
        try {
            const data = JSON.parse(await fs.readFile(this.dataFile, 'utf8'));
            this.bot.stickyMessages = data.stickyMessages || {};
            this.bot.stickyCooldowns = data.stickyCooldowns || {};
            this.bot.guildStickyMessages = data.guildStickyMessages || {};
            this.bot.serverInfo = data.serverInfo || {};
            this.bot.storedEmbeds = data.storedEmbeds || {};
        } catch (e) {
            if (e.code === 'ENOENT') {
                console.log("No existing data file found, starting fresh");
                this.bot.storedEmbeds = {};
            } else {
                console.error(`Error loading data: ${e}`);
            }
        }
    }

    async autoSave() {
        setInterval(() => this.saveData(), 300000); // Save every 5 minutes
    }
}

class Bot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.serverInfo = new Map();
        this.stickyMessages = new Map();
        this.stickyCooldowns = new Map();
        this.stickyLastSent = {};
        this.guildStickyMessages = {};
        this.dataStorage = new DataStorage(this);
        this.commands = new Collection();
    }

    async reloadBot() {
        try {
            await this.application?.commands.set([...this.commands.values()]);
            console.log("✅ Commands synced!");
            return true;
        } catch (e) {
            console.error(`❌ Error syncing commands: ${e}`);
            return false;
        }
    }

    async updateStickyMessage(channelId, messageId, content) {
        this.stickyMessages.set(channelId, {
            messageId,
            content,
            isEmbed: typeof content === 'object'
        });
    }

    async init() {
        await this.dataStorage.loadData();
        
        // Load command files directly from commands folder first
        try {
            const mainCommandFiles = await fs.readdir(path.join(__dirname, 'commands'));
            for (const file of mainCommandFiles) {
                if (file.endsWith('.js')) {
                    const command = require(path.join(__dirname, 'commands', file));
                    if (command.data && command.execute) {
                        this.commands.set(command.data.name, command);
                        console.log(`✅ Loaded command/${file}`);
                    }
                }
            }
        } catch (e) {
            console.error(`❌ Error loading main commands: ${e}`);
        }

        // Load subfolders
        const commandFolders = [
            'moderation',
            'roles',
            'utility',
            'help',
            'embed',
            'sticky'
        ];

        for (const folder of commandFolders) {
            const folderPath = path.join(__dirname, 'commands', folder);
            try {
                await fs.mkdir(folderPath, { recursive: true });
                const files = await fs.readdir(folderPath);
                for (const file of files) {
                    if (file.endsWith('.js')) {
                        const command = require(path.join(folderPath, file));
                        if (command.data && command.execute) {
                            this.commands.set(command.data.name, command);
                            console.log(`✅ Loaded ${folder}/${file}`);
                        }
                    }
                }
            } catch (e) {
                console.error(`❌ Error loading ${folder}: ${e}`);
            }
        }

        // Start auto-save
        this.dataStorage.autoSave();
    }

    async updateServerInfo(guild) {
        this.serverInfo.set(guild.id, {
            name: guild.name,
            id: guild.id,
            memberCount: guild.memberCount,
            iconUrl: guild.iconURL(),
            bannerUrl: guild.bannerURL(),
            description: guild.description || "No description set",
            owner: guild.owner,
            createdAt: guild.createdAt,
            roles: guild.roles.cache.size,
            channels: guild.channels.cache.size,
            boostLevel: guild.premiumTier,
            boostCount: guild.premiumSubscriptionCount
        });
    }

    async start() {
        await this.init();
        await this.login(TOKEN);
        
        this.user.setActivity('/help | Server Manager', { type: ActivityType.Playing });
        console.log('✅ Bot is online!');
    }
}

const bot = new Bot();

// Message handling
bot.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const channelId = message.channel.id;
    if (bot.stickyMessages.has(channelId)) {
        const now = Date.now();
        const lastSent = bot.stickyLastSent[channelId];
        const cooldown = bot.stickyCooldowns.get(channelId) || 1;

        if (lastSent && (now - lastSent) < 5) return; // 5ms cooldown

        const stickyData = bot.stickyMessages.get(channelId);

        // Delete previous sticky messages
        const messages = await message.channel.messages.fetch({ limit: 50 });
        for (const [, oldMessage] of messages) {
            if (oldMessage.author.id === bot.user.id &&
                (oldMessage.id === stickyData.messageId ||
                 (oldMessage.embeds.length > 0 && stickyData.isEmbed) ||
                 (oldMessage.embeds.length === 0 && !stickyData.isEmbed))) {
                try {
                    await oldMessage.delete();
                } catch (e) {
                    if (e.code !== 10008) console.error(e);
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        let newSticky;
        const content = stickyData.content;

        if (typeof content === 'object' && content.type === 'stored_embed') {
            const embedData = content.original_data;
            const embed = new EmbedBuilder()
                .setTitle(embedData.title)
                .setDescription(embedData.description)
                .setColor(embedData.color);

            if (embedData.footer) {
                embed.setFooter({ text: `${embedData.footer} • 📌 Sticky message • ${message.guild.name}` });
            } else {
                embed.setFooter({ text: `📌 Sticky message • ${message.guild.name}` });
            }

            if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
            if (embedData.image) embed.setImage(embedData.image);

            newSticky = await message.channel.send({ embeds: [embed] });
        } else if (stickyData.isEmbed) {
            const embed = new EmbedBuilder()
                .setTitle(content.title || 'Sticky Message')
                .setDescription(content.description)
                .setColor(content.color || 'Blue')
                .setFooter({ text: `📌 Sticky message • ${message.guild.name}` })
                .setTimestamp();

            newSticky = await message.channel.send({ embeds: [embed] });
        } else {
            newSticky = await message.channel.send(stickyData.content);
        }

        bot.stickyLastSent[channelId] = now;
        await bot.updateStickyMessage(channelId, newSticky.id, stickyData.content);
    }
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Start the bot
(async () => {
    try {
        keepAlive();
        console.log("✅ Web server started!");
        console.log("✅ Starting bot with data persistence...");
        await bot.start();
    } catch (e) {
        console.error(`❌ Error starting bot: ${e}`);
        if (bot.dataStorage) {
            await bot.dataStorage.saveData();
        }
    }
})();
