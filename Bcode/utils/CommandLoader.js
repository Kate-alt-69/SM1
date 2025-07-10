const fs = require('fs').promises;
const path = require('path');
const Clogs = require('./Clogs');
class CommandLoader {
  constructor(client) {
    this.client = client;
    this.commands = {};
  }

  async loadCommands() {
    const commandsJson = fs.readFileSync(path.join(__dirname, 'commands', 'commands.json'), 'utf8');
    const enabledCommands = JSON.parse(commandsJson);

    Object.keys(enabledCommands).forEach((commandName) => {
      const command = enabledCommands[commandName];
      if (typeof command === 'object') {
        Object.keys(command).forEach((subcommandName) => {
          const subcommand = command[subcommandName];
          if (subcommand) {
            const filePath = path.join(__dirname, 'commands', `${commandName}.js`);
            const file = require(filePath);
            this.commands[subcommandName] = file;
          }
        });
      } else {
        const filePath = path.join(__dirname, 'commands', `${commandName}.js`);
        const file = require(filePath);
        this.commands[commandName] = file;
      }
    });
  }

  getCommand(commandName) {
    return this.commands[commandName];
  }
}
module.exports = { CommandLoader };