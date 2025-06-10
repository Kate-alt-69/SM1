const fs = require('fs').promises;
const path = require('path');

class CommandLoader {
    constructor(client) {
        this.client = client;
        this.commandsPath = path.join(__dirname, '../commands');
    }

    async loadCommands() {
        const files = await fs.readdir(this.commandsPath);
        const dupeCheck = new Map();

        for (const file of files) {
            if (!file.endsWith('.js')) continue;
            
            try {
                const command = require(path.join(this.commandsPath, file));
                if (dupeCheck.has(command.data.name)) {
                    console.error(`❌ Duplicate command "${command.data.name}" in ${file}`);
                    continue;
                }
                dupeCheck.set(command.data.name, file);
                this.client.commands.set(command.data.name, command);
            } catch (err) {
                console.error(`❌ Error loading ${file}:`, err);
            }
        }
    }

    async registerCommands() {
        const commands = [...this.client.commands.values()];
        await this.client.application?.commands.set(
            commands.map(cmd => cmd.data.toJSON())
        );
    }
}

module.exports = { CommandLoader };
