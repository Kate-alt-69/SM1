const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActivityType } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const { keepAlive } = require('./KA.js');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix token loading and validation
async function loadToken() {
    try {
        if (process.env.TOKEN_SM) {
            console.log('Token [ENV] loaded using DEV mode');
            return process.env.TOKEN_SM;      
        }
        console.log('[env] Token no found in .env, loading from config/token.json');
        const data = await fs.readFile(
            path.join(__dirname, 'config', 'token.json'),
            'utf8'
        ); 
        const tokenData = JSON.parse(data);
        return tokenData.token;
    } catch (err) {
        console.error('Failed to load token:', err);
        return null;
    }
}

function validateToken(token) {
    if (!token) {
        console.error('❌ Error: No bot token found!');
        console.log('Looking for token in config/token.json');
        return false;
    }

    if (!token.match(/^[\w-]{24}\.[\w-]{6}\.[\w-]{27}$/)) {
        console.error('❌ Error: Invalid token format!');
        return false;
    }

    return true;
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

        // Add path resolution for commands
        this.commandsPath = path.join(__dirname, 'commands');
        this.utilsPath = path.join(__dirname, 'utils');
    }

    async reloadBot() {
        try {
            if (!this.application?.commands) {
                throw new Error("Application commands not ready");
            }

            const guildCommands = this.commands.map(cmd => {
                if (!cmd.data || !cmd.data.name || !cmd.data.description) {
                    console.error(`❌ Invalid command data detected:`, cmd.data);
                    throw new Error(`Invalid command data: ${JSON.stringify(cmd.data)}`);
                }
                return cmd.data;
            });

            await this.application.commands.set(guildCommands);
            console.log(`✅ Successfully registered ${guildCommands.length} commands!`);
            return true;
        } catch (e) {
            console.error(`❌ Error syncing commands:`, e);
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
        this.commands.clear();

        try {
            // Check if commands directory exists
            try {
                await fs.access(this.commandsPath);
            } catch (e) {
                await fs.mkdir(this.commandsPath, { recursive: true });
                console.log('✅ Created commands directory');
            }

            // Load main commands with better error handling
            const commandFiles = await fs.readdir(this.commandsPath);
            for (const file of commandFiles) {
                if (file.endsWith('.js')) {
                    try {
                        const filePath = path.join(this.commandsPath, file);
                        delete require.cache[require.resolve(filePath)];
                        const command = require(filePath);
                        
                        if (!command.data?.name || !command.execute) {
                            console.warn(`⚠️ Command ${file} missing required properties`);
                            continue;
                        }

                        this.commands.set(command.data.name, command);
                        console.log(`✅ Loaded command: ${command.data.name}`);
                    } catch (err) {
                        console.error(`❌ Error loading command ${file}:`, err);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error loading commands:', error);
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
        try {
            validateToken();
            await this.init();
            await this.login(TOKEN);
            await this.reloadBot();
            
            // Log info for the UI to parse
            console.log(`✅ ${this.commands.size} commands registered`);
            console.log(`✅ ${this.guilds.cache.size} servers joined`);
            
            this.user.setActivity('/help | Server Manager', { type: ActivityType.Playing });
            console.log('✅ Bot is online!');
        } catch (error) {
            console.error('❌ Failed to start bot:', error.message);
            process.exit(1);
        }
    }

    // Add proper interaction handling
    async handleInteraction(interaction) {
        if (!interaction.isCommand()) return;

        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorMessage = { 
                content: 'Error executing command!', 
                ephemeral: true 
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
}

const bot = new Bot();

// Add interaction event handler
bot.on('interactionCreate', interaction => bot.handleInteraction(interaction));

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

// Add better error handling for startup
process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
});

// Initialize bot
(async () => {
    try {
        const token = await loadToken();
        if (!validateToken(token)) {
            throw new Error('Invalid or missing token');
        }

        const bot = new Bot();
        keepAlive();
        console.log("✅ Web server started!");
        console.log("✅ Starting bot with data persistence...");
        
        await bot.start(token);
    } catch (e) {
        console.error(`❌ Error starting bot: ${e}`);
        process.exit(1);
    }
})();
