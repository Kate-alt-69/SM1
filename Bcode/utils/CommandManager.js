const fs = require('fs').promises;
const path = require('path');

class CommandManager {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.stats = {
            totalCommands: 0,
            mainCommands: 0,
            subCommands: 0,
            subCommandGroups: 0,
            failedCommands: 0,
            skippedFiles: 0
        };
        this.commandsPath = path.join(__dirname, '../commands');
        this.isRegistering = false;
        console.log('[SYSTEM] 📝 CommandManager: Initializing...');
    }

    async loadCommands() {
        try {
            console.log('[SYSTEM] 📝 Loading commands...');
            console.log('[SYSTEM] 🔄 Loading commands...');
            
            const files = await fs.readdir(this.commandsPath);
            let validFiles = 0;
            
            for (const file of files) {
                if (!file.endsWith('.js')) continue;
                
                try {
                    const filePath = path.join(this.commandsPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);
                    
                    if (command.data?.name && command.execute) {
                        validFiles++;
                        // Count main command
                        this.stats.mainCommands++;
                        
                        // Count subcommands if they exist
                        if (command.data.options) {
                            command.data.options.forEach(opt => {
                                if (opt.type === 1) this.stats.subCommands++; // Subcommand
                                if (opt.type === 2) { // Subcommand group
                                    this.stats.subCommandGroups++;
                                    opt.options?.forEach(subOpt => {
                                        if (subOpt.type === 1) this.stats.subCommands++;
                                    });
                                }
                            });
                        }

                        this.commands.set(command.data.name, command);
                        console.log(`[SYSTEM] ✅ Loaded command: ${command.data.name}`);
                    } else {
                        console.warn(`{ERROR}⚠️ Invalid command structure in ${file}`);
                        this.stats.skippedFiles++;
                    }
                } catch (error) {
                    console.error(`{FILE.ERROR}❌ Failed to load ${file}:`, error.message);
                    this.stats.failedCommands++;

                    // Use CommandLoader to get detailed error information
                    const commandLoader = new CommandLoader(this);
                    const detailedError = await commandLoader.getDetailedError(file, error);
                    console.error(detailedError);
                }
            }

            // Calculate total commands
            this.stats.totalCommands = this.stats.mainCommands + this.stats.subCommands;

            // Print loading stats
            console.log('[SYSTEM]\n📊 Command loading complete:');
            console.log(`            ✅ Loaded: ${this.stats.totalCommands} (${this.stats.mainCommands} main, ${this.stats.subCommands} sub)`);
            console.log(`            ❌ Failed: ${this.stats.failedCommands}`);
            console.log(`            ⏭️ Skipped: ${this.stats.skippedFiles}\n`);

            // Register commands only once
            return await this.registerCommands();
        } catch (error) {
            console.error('{ERROR} ❌ Failed to load commands:', error);
            return false;
        }
    }
  
    async registerCommands() {
        if (this.isRegistering) return;
        this.isRegistering = true;

        try {
            console.log('[SYSTEM] 🔄 Registering commands...');
            const commands = [...this.commands.values()].map(cmd => cmd.data.toJSON());
            await this.client.application?.commands.set(commands);
            console.log(`[SYSTEM] ✅ Registered ${commands.length} commands globally`);
            
            // Update bot stats safely
            if (this.client) {
                this.client.botStats = {
                    commands: this.stats.totalCommands,
                    mainCommands: this.stats.mainCommands,
                    subCommands: this.stats.subCommands
                };
            }

            this.isRegistering = false;
            return true;
        } catch (error) {
            this.isRegistering = false;
            console.error('[ERROR] ❌ Failed to register commands:', error);
            return false;
        }
    }
}

module.exports = { CommandManager };
