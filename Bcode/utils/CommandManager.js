// CommandManager.js
const path = require('path');
const fs = require('fs');
const CommandExcutor = require('./CommandExcutor');
const { CommandLoader } = require('./CommandLoader');

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
            skippedFiles: 0,
            disabledCommands: 0
        };
        this.commandsPath = path.join(__dirname, '../commands');
        this.isRegistering = false;
        this.loader = null;
        this.checkCommandState = CommandExcutor.checkCommandState;
        console.log('[SYSTEM] 📝 CommandManager: Initializing...');
    }

    async loadCommands() {
        try {
            console.log('[SYSTEM] 📝 Loading commands...');
            
            // Initialize loader with client reference
            this.loader = new CommandLoader(this.commandsPath, this.client);
            
            // Ensure commands directory exists
            if (!fs.existsSync(this.commandsPath)) {
                console.error(`{ERROR} Commands directory not found: ${this.commandsPath}`);
                return false;
            }

            let loadedCommands = await this.loader.loadCommands();
            if (!loadedCommands || !Array.isArray(loadedCommands)) {
                console.error('{ERROR} Failed to load commands: Invalid response from loader');
                return false;
            }

            // 🔧 Wrap plain commands into { command, filePath }
            if (loadedCommands.length && !loadedCommands[0].command) {
                loadedCommands = loadedCommands.map(c => ({
                    command: c,
                    filePath: c?.filePath || 'unknown'
                }));
            }

            // Clear existing commands and stats
            this.commands.clear();
            this.resetStats();

            // Process loaded commands
            for (const { command, filePath } of loadedCommands) {
                try {
                    if (!command?.data?.name || typeof command.execute !== 'function') {
                        this.stats.skippedFiles++;
                        continue;
                    }

                    const parent = command.data.name;
                    this.commands.set(parent, command);
                    this.stats.mainCommands++;

                    // Count subcommands
                    if (command.data.options) {
                        command.data.options.forEach(opt => {
                            if (opt.type === 1) this.stats.subCommands++;
                            if (opt.type === 2) this.stats.subCommandGroups++;
                        });
                    }
                } catch (err) {
                    this.stats.failedCommands++;
                }
            }

            this.stats.totalCommands = this.stats.mainCommands + this.stats.subCommands;

            console.log(`[SYSTEM] ✅ Loaded ${this.commands.size} commands into CommandManager`);
            for (const key of this.commands.keys()) {
                console.log(`   • ${key}`);
            }

            return true;

        } catch (error) {
            console.error(`{ERROR} ❌ Failed to load commands: ${error.message}`);
            return false;
        }
    }

    resetStats() {
        this.stats = {
            totalCommands: 0,
            mainCommands: 0,
            subCommands: 0,
            subCommandGroups: 0,
            failedCommands: 0,
            skippedFiles: 0,
            disabledCommands: 0
        };
    }

    async registerCommands() {
        if (this.isRegistering) return;
        this.isRegistering = true;

        try {
            console.log('[SYSTEM] 🔄 Registering commands...');
            const commands = [...this.commands.values()].map(cmd => cmd.data.toJSON());
            await this.client.application?.commands.set(commands);
            console.log(`[SYSTEM] ✅ Registered ${commands.length} commands globally`);

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
            console.error(`{ERROR} ❌ Failed to register commands: ${error.message}`);
            return false;
        }
    }
}
module.exports = { CommandManager };