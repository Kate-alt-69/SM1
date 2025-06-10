const fs = require('fs').promises;
const path = require('path');

class CommandManager {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.commandsPath = path.join(__dirname, '../commands');
        console.log('📝 CommandManager: Initializing...');
    }

    async loadCommands() {
        console.log('🔄 Loading commands...');

        try {
            // Check if commands directory exists
            try {
                await fs.access(this.commandsPath);
            } catch {
                console.error('❌ Commands directory not found!');
                await fs.mkdir(this.commandsPath, { recursive: true });
                console.log('✅ Created commands directory');
            }

            const commandFiles = await this.getCommandFiles(this.commandsPath);
            if (commandFiles.length === 0) {
                console.warn('⚠️ No command files found');
                return;
            }

            let stats = { loaded: 0, failed: 0, skipped: 0 };

            for (const filePath of commandFiles) {
                try {
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);
                    
                    if (!command.data?.name || !command.execute) {
                        console.warn(`⚠️ Invalid command structure in ${filePath}`);
                        stats.skipped++;
                        continue;
                    }

                    this.commands.set(command.data.name, command);
                    console.log(`✅ Loaded command: ${command.data.name}`);
                    stats.loaded++;
                } catch (err) {
                    console.error(`❌ Error loading ${filePath}:`, err.message);
                    stats.failed++;
                }
            }

            console.log(`📊 Command loading complete:
            ✅ Loaded: ${stats.loaded}
            ❌ Failed: ${stats.failed}
            ⏭️ Skipped: ${stats.skipped}`);
        } catch (err) {
            console.error('❌ Fatal error loading commands:', err);
            throw err;
        }
    }

    async getCommandFiles(dir) {
        const files = await fs.readdir(dir, { withFileTypes: true });
        let commands = [];

        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                const subCommands = await this.getCommandFiles(fullPath);
                commands = [...commands, ...subCommands];
            } else if (file.name.endsWith('.js')) {
                commands.push(fullPath);
            }
        }

        return commands;
    }

    async registerCommands() {
        console.log('🔄 Registering commands...');

        if (!this.client.application?.commands) {
            throw new Error('❌ Application commands not ready');
        }

        try {
            const commands = Array.from(this.commands.values());
            
            // Add small delay between registrations
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await this.client.application.commands.set(
                commands.map(cmd => cmd.data.toJSON())
            );
            
            console.log(`✅ Registered ${this.commands.size} commands globally`);
        } catch (err) {
            console.error('❌ Failed to register commands:', err);
            throw err;
        }
    }
}

module.exports = { CommandManager };
