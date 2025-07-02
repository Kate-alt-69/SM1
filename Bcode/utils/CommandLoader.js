const fs = require('fs').promises;
const path = require('path');
const Clogs = require('./Clogs');
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
              Clogs.logCommandLoadStart(file);
                  const command = require(path.join(this.commandsPath, file));

              if (!command.data || !command.data.name || !command.data.description || !command.run) {
                Clogs.logError(`Invalid command structure in ${file}`);
                continue;
              }

              if (dupeCheck.has(command.data.name)) {
                Clogs.logWarning(`Duplicate command: ${command.data.name} in ${file}`);
                continue;
              }

              dupeCheck.set(command.data.name, file);
              this.client.commands.set(command.data.name, command);
              Clogs.logSuccess(`Loaded command: ${command.data.name}`);
            } catch (err) {
              Clogs.logError(`Error loading command: ${err.message}`);
              Clogs.logError(`File: ${path.join(this.commandsPath, file)}`);
              Clogs.logError(`Stack: ${err.stack}`);

              if (err instanceof SyntaxError) {
                Clogs.logError(`Syntax error in command: ${err.message}`);
              } else if (err.message.includes('Invalid command structure')) {
                Clogs.logError(`Invalid command structure in: ${file}`);
                Clogs.logError(`Error: ${err.message}`);
            }
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
