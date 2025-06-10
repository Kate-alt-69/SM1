const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActivityType } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const { keepAlive } = require('./KA.js');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

function validateToken(token) {
    if (!token) {
        console.error('❌ Error: No bot token found!');
        return false;
    }

    // More permissive regex pattern for token validation
    if (!token.match(/[\w-]{24,26}\.[\w-]{6}\.[\w-]{27,38}/)) {
        console.error('❌ Error: Invalid token format! Token should be in the format: XXXX.YYYY.ZZZZ');
        return false;
    }

    console.log('✅ Token validation passed');
    return true;
}

async function loadToken() {
    try {
        // Detect and clear GitHub environment
        if (process.env.GITHUB_ACTIONS || process.env.GITHUB_WORKSPACE) {
            console.warn('⚠️ GitHub Actions environment detected - forcing local token load');
            Object.keys(process.env).forEach(key => {
                if (key.startsWith('GITHUB_') || key === 'TOKEN_SM') {
                    delete process.env[key];
                }
            });
        }

        // Force local token load
        let token = null;
        try {
            const tokenFile = await fs.readFile(path.join(__dirname, 'config', 'token.json'), 'utf8');
            token = JSON.parse(tokenFile).token.trim();
            console.log('✅ Using local token.json');
        } catch (err) {
            console.log('⚠️ Fallback to local .env');
            dotenv.config({ path: path.join(__dirname, '.env'), override: true });
            token = process.env.TOKEN_SM?.trim();
        }

        if (!token) {
            throw new Error('No token found in local files');
        }

        console.log(`🔑 Using token: ${token.substring(0, 10)}...`);
        return token;
    } catch (err) {
        console.error('❌ Failed to load token:', err);
        return null;
    }
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
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.DirectMessages
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
            // Wait for application to be ready
            if (!this.application) {
                console.log('⌛ Waiting for application to be ready...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (!this.application?.commands) {
                throw new Error("Application commands not ready");
            }

            console.log('🔄 Starting command registration...');
            
            // Clear existing commands first
            console.log('🧹 Clearing old commands...');
            await this.application.commands.fetch()
                .then(async commands => {
                    for (const command of commands.values()) {
                        await command.delete();
                    }
                });

            const commandData = this.commands.map(cmd => {
                if (!cmd.data?.name || !cmd.data.description) {
                    console.error(`❌ Invalid command data:`, cmd.data);
                    throw new Error(`Invalid command data: ${JSON.stringify(cmd.data)}`);
                }
                return cmd.data.toJSON();
            });

            // Register new commands globally
            await this.application.commands.set(commandData);
            console.log(`✅ Registered ${commandData.length} commands globally`);

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
            // Add duplicate tracking
            const duplicateTracker = new Map();
            
            const commandFiles = await fs.readdir(this.commandsPath);
            for (const file of commandFiles) {
                if (!file.endsWith('.js')) continue;
                
                try {
                    const filePath = path.join(this.commandsPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);

                    if (!command.data?.name || !command.execute) {
                        console.warn(`⚠️ Skipping invalid command file: ${file}`);
                        continue;
                    }

                    // Track duplicates
                    const cmdName = command.data.name;
                    if (duplicateTracker.has(cmdName)) {
                        console.error(`❌ Duplicate command "${cmdName}" found in:`);
                        console.error(`   - ${duplicateTracker.get(cmdName)}`);
                        console.error(`   - ${file}`);
                        continue;
                    }

                    duplicateTracker.set(cmdName, file);
                    this.commands.set(cmdName, command);
                    console.log(`✅ Loaded command: ${cmdName}`);
                } catch (err) {
                    console.error(`❌ Error loading command ${file}:`, err);
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

    async start(token) {
        try {
            if (!validateToken(token)) {
                throw new Error('Failed to validate token - check token format');
            }
            await this.init();
            await this.login(token);
            
            console.log(`✅ Logged in as: ${this.user.tag}`);
            console.log(`🤖 Bot ID: ${this.user.id}`);
            
            // Add delay before registering commands
            console.log('⌛ Waiting for bot to be ready...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
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

    // Update interaction handling with more logging
    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;

        console.log(`🎯 Received command: ${interaction.commandName}`);
        console.log(`   From: ${interaction.user.tag}`);
        console.log(`   Guild: ${interaction.guild?.name ?? 'DM'}`);

        const command = this.commands.get(interaction.commandName);
        if (!command) {
            console.error(`❌ Command not found: ${interaction.commandName}`);
            await interaction.reply({ 
                content: 'Command not found or not loaded properly.',
                ephemeral: true 
            });
            return;
        }

        try {
            console.log(`🔨 Executing command: ${interaction.commandName}`);
            await command.execute(interaction);
            console.log(`✅ Command completed: ${interaction.commandName}`);
        } catch (error) {
            console.error(`❌ Command execution error for ${interaction.commandName}:`, error);
            const errorMessage = { 
                content: 'Error executing command! The error has been logged.',
                ephemeral: true 
            };
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (e) {
                console.error('Failed to send error message:', e);
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
        // Clear any existing bot instances
        if (global.bot) {
            await global.bot.destroy();
            delete global.bot;
        }
        
        const token = await loadToken();
        if (!token) {
            throw new Error('Failed to load token');
        }

        const bot = new Bot();
        global.bot = bot; // Store bot instance globally
        
        keepAlive();
        console.log("✅ Web server started!");
        console.log("✅ Starting bot with data persistence...");
        
        await bot.start(token);
    } catch (e) {
        console.error(`❌ Error starting bot: ${e}`);
        process.exit(1);
    }
})();
