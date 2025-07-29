// CommandManager.js
const fs = require('fs').promises;
const path = require('path');
const { checkCommandState } = require('./CommandExcutor');
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
        console.log('[SYSTEM] 📝 CommandManager: Initializing...');
    }

    async loadCommands() {
        try {
            console.log('[SYSTEM] 📝 Loading commands...');
            console.log('[SYSTEM] 🔄 Scanning command files...');

            const files = await fs.readdir(this.commandsPath);

            for (const file of files) {
                if (!file.endsWith('.js')) continue;

                try {
                    const filePath = path.join(this.commandsPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);

                    if (command.data?.name && command.execute) {
                        const parent = command.data.name;
                        const sub = parent;

                        const state = checkCommandState({ parent, full: sub });

                        // ONLY skip if state is FALSE or contains disable code
                        if (state && state.disabled === true) {
                            console.warn(`[COMMAND.DISABLED] ⛔ Skipped "${sub}": ${state.code}`);
                            this.stats.disabledCommands++;
                            continue;
                        }

                        this.stats.mainCommands++;

                        if (command.data.options) {
                            command.data.options.forEach(opt => {
                                if (opt.type === 1) this.stats.subCommands++;
                                if (opt.type === 2) {
                                    this.stats.subCommandGroups++;
                                    opt.options?.forEach(subOpt => {
                                        if (subOpt.type === 1) this.stats.subCommands++;
                                    });
                                }
                            });
                        }

                        this.commands.set(parent, command);
                        console.log(`[SYSTEM] ✅ Loaded command: ${parent}`);
                    } else {
                        console.warn(`{ERROR} ⚠️ Invalid command structure in ${file}`);
                        this.stats.skippedFiles++;
                    }
                } catch (error) {
                    console.error(`{FILE.ERROR} ❌ Failed to load ${file}:`, error.message);
                    this.stats.failedCommands++;

                    const commandLoader = new CommandLoader(this);
                    const detailedError = await commandLoader.getDetailedError(file, error);
                    console.error(detailedError);
                }
            }

            this.stats.totalCommands = this.stats.mainCommands + this.stats.subCommands;

            console.log('[SYSTEM]\n📊 Command loading complete:');
            console.log(`            ✅ Loaded: ${this.stats.totalCommands} (${this.stats.mainCommands} main, ${this.stats.subCommands} sub)`);
            console.log(`            ⛔ Disabled: ${this.stats.disabledCommands}`);
            console.log(`            ❌ Failed: ${this.stats.failedCommands}`);
            console.log(`            ⏭️ Skipped: ${this.stats.skippedFiles}\n`);

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
