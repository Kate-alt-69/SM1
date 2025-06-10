const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { TokenManager } = require('./utils/TokenManager');
const { CommandManager } = require('./utils/CommandManager');
const { keepAlive } = require('./KA.js');

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
        this.stickyCooldowns = new Map();
        this.stickyLastSent = new Map();  // Changed to Map
        this.guildStickyMessages = new Map(); // Changed to Map
    }

    async start() {
        try {
            console.log('🔄 Starting bot initialization...');
            
            const token = await this.tokenManager.loadToken();
            if (!token) {
                throw new Error('No valid token found - Check token.json or .env');
            }

            // Add environment check
            console.log('🔍 Current working directory:', process.cwd());
            
            // Login first
            await this.login(token);
            console.log(`✅ Logged in as: ${this.user.tag}`);

            // Set up ready event handler before login
            const readyPromise = new Promise((resolve, reject) => {
                this.once('ready', () => {
                    console.log('✅ Bot is ready!');
                    resolve();
                });

                setTimeout(() => {
                    reject(new Error('Bot startup timed out after 60 seconds'));
                }, 60000);
            });

            await readyPromise;

            // Now load and register commands
            console.log('📝 Loading commands...');
            await this.commandManager.loadCommands();
            await this.commandManager.registerCommands();

            // Set activity after everything is ready
            this.user.setActivity('/help | Server Manager', { type: ActivityType.Playing });

            // Display final status
            const tokenInfo = this.tokenManager.getTokenInfo();
            console.log('\n===========================================');
            console.log('              BOT STATUS                   ');
            console.log('===========================================');
            console.log(`📊 Servers In     : ${this.guilds.cache.size}`);
            console.log(`🤖 Logged in As   : ${this.user.tag}`);
            console.log(`🆔 Bot ID         : ${this.user.id}`);
            console.log(`🔑 Logged in with : ${tokenInfo.maskedToken} [${tokenInfo.source}]`);
            console.log('===========================================\n');

            console.log('✅ Bot initialization complete!');
        } catch (error) {
            console.error('❌ Fatal startup error:', error.message);
            if (error.stack) console.error(error.stack);
            process.exit(1);
        }
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
            
            // Defer longer commands
            const longCommands = ['embed', 'help', 'about'];
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
            // ...rest of try block...
        } catch (error) {
            // Add specific sticky error handling
            if (interaction.commandName === 'sticky') {
                console.error('   • Sticky command error:', error.message);
                errorMessage = {
                    content: 'Failed to set sticky message. Please make sure you have the correct permissions and try again.',
                    ephemeral: true
                };
            }
            // ...rest of catch block...
        }
    }

    // Add sticky message handler
    async handleStickyMessage(channel) {
        const stickyData = this.stickyMessages.get(channel.id);
        if (!stickyData) return;

        try {
            const messages = await channel.messages.fetch({ limit: 5 });
            const lastSticky = messages.find(m => m.author.id === this.user.id && m.id === stickyData.messageId);
            
            // If no sticky found or 3+ messages after sticky
            if (!lastSticky || messages.filter(m => m.createdTimestamp > lastSticky.createdTimestamp).size >= 3) {
                // Delete old sticky if exists
                if (lastSticky) await lastSticky.delete().catch(() => {});
                
                // Send new sticky
                const newSticky = await channel.send(stickyData.content);
                await this.updateStickyMessage(channel.id, newSticky.id, stickyData.content);
                this.stickyLastSent.set(channel.id, Date.now());
            }
        } catch (error) {
            console.error(`Error handling sticky message: ${error.message}`);
        }
    }
}

// Start bot
(async () => {
    const bot = new Bot();
    bot.on('interactionCreate', i => bot.handleCommand(i));
    
    // Add message event handler for sticky messages
    bot.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        await bot.handleStickyMessage(message.channel);
    });

    keepAlive();
    await bot.start();
})();
