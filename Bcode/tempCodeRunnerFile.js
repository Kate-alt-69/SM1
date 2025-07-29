const path = require('path');
require('./utils/moduleCHK').checkAndInstallModules(__dirname);
const { Client, GatewayIntentBits, ActivityType, Collection } = require('discord.js');
const { TokenManager } = require('./utils/TokenManager');
const { CommandManager } = require('./utils/CommandManager');
const { keepAlive } = require('./KA.js');
//const { ConnectionManager } = require('./utils/ConnectionManager');
const DevScripts = require('./utils/devScripts');
const { devCheck } = require('./scripts/dev');
const { EmojiCache } = require('./utils/EmojiCache');
const { BotDataManager } = require('./utils/BotDataManager');
const { DataSavingSystem } = require('./utils/dataSAVINGsystem');
// Fix token loading and validation
//async function loadToken() {
//    try {
//        if (process.env.TOKEN_SM) {
//            console.log('Token [ENV] loaded using DEV mode');
//            return process.env.TOKEN_SM;      
//        }
//        console.log('[env] Token no found in .env, loading from config/token.json');
//        const data = await fs.readFile(
//            path.join(__dirname, 'config', 'token.json'),
//            'utf8'
//        ); 
//        const tokenData = JSON.parse(data);
//        return tokenData.token;
//    } catch (err) {
//        console.error('Failed to load token:', err);
//        return null;
//    }
//}
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
                console.log("[SYSTEM] 📝 No existing data file found, starting fresh");
                this.bot.storedEmbeds = {};
            } else {
                console.error(`{ERROR} loading data: ${e}`);
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

        this.tokenManager = new TokenManager();
        this.commandManager = new CommandManager(this);

        this.serverInfo = new Map();
        this.stickyMessages = new Map();
        this.stickyLastSent = new Map();
        this.chatRateTracker = new Map(); // Track message rates per channel
        this.stickyThresholds = new Map(); // Dynamic thresholds per channel

        this.buttonHandlers = new Collection();
        this.activeChannels = new Set(); // Track channels with sticky messages

        this.connectionCheckInterval = null;

        this.devMode = false;

        // Initialize bot stats
        this.botStats = {
            commands: 0,
            mainCommands: 0,
            subCommands: 0
        };

        this.emojiCache = null;
    }

    async start() {
        try {
            console.log('[SYSTEM]🔄 Starting bot initialization...');

            // Add startup timeout
            const startupTimeout = setTimeout(() => {
                throw new Error('[ERROR] Bot startup timed out after 60 seconds');
            }, 60000);

            // Get token
            const token = await this.tokenManager.loadToken();
            if (!token) {
                throw new Error('[ERRPR] Failed to load token');
            }

            // Single ready event with all initialization
            await new Promise((resolve, reject) => {
                this.once('ready', async () => {
                    try {
                        clearTimeout(startupTimeout);

                        // 1. Initialize emoji cache
                        this.emojiCache = new EmojiCache(this);
                        await this.emojiCache.loadEmojis();

                        // 2. Initialize commands
                        await this.commandManager.loadCommands();
                        await this.commandManager.registerCommands();

                        // 3. Initialize data saving system
                        if (this.dataSavingSystem) {
                            await this.dataSavingSystem.initialize();
                        }

                        // 4. Display final status
                        console.log('\n===========================================');
                        console.log('              BOT STATUS                   ');
                        console.log('===========================================');
                        console.log(`📊 Servers In     : ${this.guilds.cache.size}`);
                        console.log(`🤖 Logged in As   : ${this.user.tag}`);
                        console.log(`🆔 Bot ID         : ${this.user.id}`);
                        console.log(`🔑 Logged in with : ${this.tokenManager.getTokenInfo().maskedToken} ${this.tokenManager.getTokenInfo().source}`);
                        console.log(`📁 Loaded CF      : ${this.commandManager.stats.mainCommands}`);
                        console.log(`🎮 Commands Total : ${this.commandManager.stats.totalCommands} (${this.commandManager.stats.mainCommands} main, ${this.commandManager.stats.subCommands} sub)`);
                        console.log(`💾 Data System    : ${this.dataSavingSystem?.initialized ? 'Loaded ✅' : 'Not Loaded ❌'}`);
                        console.log('===========================================\n Type "# stop" to stop from hosting');

                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });

                this.login(token).catch(reject);
            });

        } catch (error) {
            console.error('{ERROR} ❌ Startup error:', error);
            process.exit(1);
        }
    }

    startConnectionMonitoring() {
        // Check connection every 30 seconds
        this.connectionCheckInterval = setInterval(async () => {
            const hasConnection = await ConnectionManager.checkInternet();
            if (!hasConnection) {
                console.log('{startupERROR} \n⚠️ Internet connection lost!');
                await ConnectionManager.waitForInternet();
                // Reconnect bot if needed
                if (!this.isReady()) {
                    console.log('[SYSTEM]🔄 Reconnecting bot...');
                    await this.login(this.token);
                }
            }
        }, 30000);
    }

    async handleCommand(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = this.commandManager.commands.get(interaction.commandName);
        if (!command) {
            console.error(`❌ Unknown command: ${interaction.commandName}`);
            await interaction.reply({ 
                content: 'Command not found.',
                ephemeral: true 
            });
            return;
        }

        try {
            const startTime = Date.now();
            const now = new Date();
            const utc = now.toUTCString();
            const local = now.toLocaleString();

            // Get full command name including subcommands
            let fullCommandName = interaction.commandName;
            if (interaction.options.getSubcommand(false)) {
                fullCommandName += ` ${interaction.options.getSubcommand()}`;
            }

            console.log(`\n[${utc}] UTC`);
            console.log(`[${local}] Local Time`);
            console.log(`[${interaction.user.tag}] /${fullCommandName}`);
            console.log(`   • Server: ${interaction.guild?.name ?? 'DM'}`);
            console.log(`   • Channel: #${interaction.channel.name}`);
            console.log('   • Status: Starting execution...');
            
            // Defer longer commands, but not for modal commands
            const longCommands = ['help', 'about'];  // Remove 'embed' from here
            if (longCommands.includes(interaction.commandName)) {
                await interaction.deferReply();
                console.log('   • Response: Deferred reply');
            }
            
            // Track interaction state
            const initialState = {
                deferred: interaction.deferred,
                replied: interaction.replied
            };

            // Execute with timeout and response tracking
            let responded = false;
            let interactionSuccess = false;
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Command timed out after 10s')), 10000);
            });

            await Promise.race([
                (async () => {
                    await command.execute(interaction);
                    // Check if interaction state changed
                    responded = interaction.deferred !== initialState.deferred || 
                              interaction.replied !== initialState.replied;
                    interactionSuccess = responded;
                })(),
                timeoutPromise
            ]);

            const executionTime = Date.now() - startTime;
            console.log(`   • Execution time: ${executionTime}ms`);
            console.log(`   • Interaction state: ${interactionSuccess ? 'Success' : 'No Response'}`);
            if (interaction.deferred) console.log('   • Reply was deferred');
            if (interaction.replied) console.log('   • Reply was sent');
            
            if (!responded) {
                console.warn('   ⚠️ Warning: Command did not interact with user');
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'Command failed to send a response.',
                        ephemeral: true 
                    });
                }
                return; // Exit early if no response
            }

            console.log(`   ✅ Command completed successfully with response\n`);
        } catch (error) {
            const errorTime = new Date().toLocaleString();
            console.error(`   ❌ Command error at ${errorTime}:`, error.message);
            console.error('   • Stack:', error.stack);
            console.error(`   • Command state when error occurred:`);
            console.error(`   • Deferred: ${interaction.deferred}`);
            console.error(`   • Replied: ${interaction.replied}`);
            
            let errorMessage = {
                content: error.message === 'Command timed out after 10s' 
                    ? 'This command is taking longer than expected. Please try again or contact the hosts if this persists.'
                    : 'Something went wrong while running this command. Please contact the hosts for assistance or try again later.',
                ephemeral: true
            };

            try {
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                    console.log('   • Response: Error sent via editReply');
                } else if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                    console.log('   • Response: Error sent via reply');
                } else {
                    await interaction.followUp(errorMessage);
                    console.log('   • Response: Error sent via followUp');
                }
            } catch (replyError) {
                console.error('   ❌ Failed to send error message:', replyError.message);
            }
        }

        try {
            // Add sticky command specific error handling
            if (interaction.commandName === 'sticky') {
                console.log('   • Sticky command detected, validating maps...');
                // Ensure maps exist
                if (!this.stickyMessages) this.stickyMessages = new Map();
                if (!this.stickyCooldowns) this.stickyCooldowns = new Map();
                if (!this.stickyLastSent) this.stickyLastSent = new Map();
            }
        } catch (error) {
            // Add specific sticky error handling
            if (interaction.commandName === 'sticky') {
                console.error('   • Sticky command error:', error.message);
                errorMessage = {
                    content: 'Failed to set sticky message. Please make sure you have the correct permissions and try again.',
                    ephemeral: true
                };
            }
        }
    }

    async handleInteraction(interaction) {
        if (interaction.isButton()) {
            const handler = this.buttonHandlers.get(interaction.customId);
            if (handler) {
                await handler(interaction);
                return;
            }
        } else if (interaction.isModalSubmit()) {
            const command = this.commandManager.commands.get('embed');
            if (command && interaction.customId.startsWith('embed-')) {
                await command.handleModalSubmit(interaction);
                return;
            }
        }

        if (interaction.isButton()) {
            const command = this.commandManager.commands.get('embed');
            if (command && interaction.customId.startsWith('edit_') || 
                interaction.customId === 'confirm' || 
                interaction.customId === 'add_file') {
                await command.handleButton(interaction);
                return;
            }
        }

        this.handleCommand(interaction);
    }

    async updateStickyMessage(channelId, messageId, content) {
        this.stickyMessages.set(channelId, {
            messageId: messageId,
            content: content,
            lastSent: Date.now()
        });
        this.activeChannels.add(channelId); // Mark channel as active
    }

    async handleMessageCreate(message) {
        // Ignore bot messages
        if (message.author.bot) return;

        // Only process channels that have sticky messages
        if (!this.activeChannels.has(message.channel.id)) return;

        // Process sticky message
        await this.handleStickyMessage(message.channel);
    }

    // Add sticky message handler
    async handleStickyMessage(channel) {
        const stickyData = this.stickyMessages.get(channel.id);
        if (!stickyData) return;

        try {
            // Get dynamic cooldown based on chat rate
            const lastSent = this.stickyLastSent.get(channel.id) || 0;
            const dynamicCooldown = this.getCooldownTime(channel.id);
            
            if (Date.now() - lastSent < dynamicCooldown) {
                return;
            }

            // Update chat rate tracking
            this.updateChatRate(channel.id);

            // Get dynamic threshold based on chat rate
            const threshold = this.getMessageThreshold(channel.id);

            // Fetch messages and check count
            const messages = await channel.messages.fetch({ limit: 20 });
            const lastSticky = messages.find(m => m.author.id === this.user.id && m.id === stickyData.messageId);
            
            if (!lastSticky) {
                await this.sendNewSticky(channel, stickyData);
                return;
            }

            // Count non-bot messages since last sticky
            const messagesSinceSticky = messages
                .filter(m => m.createdTimestamp > lastSticky.createdTimestamp && !m.author.bot)
                .size;

            // Only send if we hit the dynamic threshold
            if (messagesSinceSticky >= threshold) {
                console.log(`   • Found ${messagesSinceSticky} messages since last sticky (Threshold: ${threshold})`);
                await lastSticky.delete().catch(() => console.log('   • Old sticky already deleted'));
                await this.sendNewSticky(channel, stickyData);
            }
        } catch (error) {
            console.error(`   • Error handling sticky message: ${error.message}`);
        }
    }

    getCooldownTime(channelId) {
        const rateData = this.chatRateTracker.get(channelId);
        if (!rateData) return 3000; // Default 3 seconds

        const messagesPerMinute = rateData.messages.length;
        
        // Adjust cooldown based on chat rate
        if (messagesPerMinute > 20) { // Very active
            return 7000; // 7 seconds for fast chat
        } else if (messagesPerMinute > 10) { // Moderate
            return 5000; // 5 seconds for medium chat
        } else {
            return 3000; // 3 seconds for slower chat
        }
    }

    updateChatRate(channelId) {
        const now = Date.now();
        const rateData = this.chatRateTracker.get(channelId) || {
            messages: [],
            lastCalculation: now
        };

        // Add new message timestamp
        rateData.messages.push(now);

        // Remove messages older than 1 minute
        rateData.messages = rateData.messages.filter(time => now - time <= 60000);

        this.chatRateTracker.set(channelId, rateData);
    }

    getMessageThreshold(channelId) {
        const rateData = this.chatRateTracker.get(channelId);
        if (!rateData) return 3; // Default threshold

        const messagesPerMinute = rateData.messages.length;
        
        // Adjust threshold based on chat rate
        if (messagesPerMinute > 20) { // Very fast chat
            return 10;
        } else if (messagesPerMinute > 10) { // Medium speed chat
            return 5;
        } else {
            return 3; // Normal/slow chat
        }
    }

    async sendNewSticky(channel, stickyData) {
        const newSticky = await channel.send(stickyData.content);
        await this.updateStickyMessage(channel.id, newSticky.id, stickyData.content);
        this.stickyLastSent.set(channel.id, Date.now());
        console.log('   • Sent new sticky message');
    }

    // Clean up on shutdown
    async destroy() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        await super.destroy();
    }
}

// Start bot
(async () => {
    const bot = new Bot();
    
    bot.on('interactionCreate', async (interaction) => {
        try {
            await bot.handleInteraction(interaction);
        } catch (error) {
            console.error('Interaction error:', error);
        }
    });
    
    // Update message event handler
    bot.on('messageCreate', message => bot.handleMessageCreate(message));

    keepAlive();
    await bot.start();
})();
