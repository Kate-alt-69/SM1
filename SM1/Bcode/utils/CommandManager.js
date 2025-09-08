// CommandManager.js
const path = require('path');
const fs = require('fs');
const CommandExcutor = require('./CommandExcutor');
const { CommandLoader } = require('./CommandLoader');
class CommandManager {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.stats = this.resetStats();
        this.commandsPath = path.join(__dirname, '../commands');
        this.isRegistering = false;
        this.loader = new CommandLoader(this.client, { baseDir: path.resolve(__dirname, '..') });
        this.checkCommandState = CommandExcutor.checkCommandState;
        console.log('[SYSTEM] 📝 CommandManager: Initializing...');
    }
    async loadCommands() {
        try {
            console.log('[SYSTEM] 📝 Loading commands...');
            if (!fs.existsSync(this.commandsPath)) {
                console.error(`{ERROR} Commands directory not found: ${this.commandsPath}`);
                return false;
            }
            // Use loader (this also registers with Discord once)
            const result = await this.loader.loadAll();
            if (!result || typeof result.count !== 'number') {
                console.error('{ERROR} Failed to load commands: Invalid response from loader');
                return false;
            }
            // Clear in-memory map
            this.commands.clear();
            this.resetStats();
            // Load actual command modules into memory for execution
            const files = fs.readdirSync(this.commandsPath);
            for (const file of files) {
                const fullPath = path.join(this.commandsPath, file);
                if (!file.endsWith('.js') || file.startsWith('--')) continue;
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const mod = require(fullPath);
                    const exported = mod?.default ?? mod;
                    const candidates = Array.isArray(exported) ? exported : [exported];
                    for (const command of candidates) {
                        if (!command?.data?.name || typeof command.execute !== 'function') {
                            this.stats.skippedFiles++;
                            continue;
                        }
                        const parent = command.data.name;
                        this.commands.set(parent, command);
                        this.stats.mainCommands++;
                        // Track subcommands / groups
                        if (command.data.options) {
                            command.data.options.forEach(opt => {
                                if (opt.type === 1) this.stats.subCommands++;
                                if (opt.type === 2) this.stats.subCommandGroups++;
                            });
                        }
                    }
                } catch (err) {
                    this.stats.failedCommands++;
                    console.error(`{ERROR} Failed to load ${file}: ${err.message}`);
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
        return {
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
            // Force wipe & re-register (even if same commands)
            const commands = [...this.commands.values()].map(cmd => cmd.data.toJSON());
            if (process.env.GUILD_ID) {
                await this.client.application?.commands.set([], process.env.GUILD_ID); // wipe
                await this.client.application?.commands.set(commands, process.env.GUILD_ID);
            } else {
                await this.client.application?.commands.set([]); // wipe
                await this.client.application?.commands.set(commands);
            }
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