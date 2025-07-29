const fs = require('fs').promises;
const fssync = require('fs'); // for existsSync
const path = require('path');

class CommandLoader {
  constructor(client) {
    this.client = client;
    this.commands = {};
    this.clogFolder = path.join(__dirname, '..', 'Clog'); // One level up from utils
  }

  async ensureClogFolder() {
    if (!fssync.existsSync(this.clogFolder)) {
      await fs.mkdir(this.clogFolder, { recursive: true });
      console.log('[Clog] 📁 Created Clog folder');
    }
  }

  async loadCommands() {
    await this.ensureClogFolder();

    const logLines = [];
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-'); // For safe filename
    const logFileName = `load-log-${timestamp}.txt`;
    const logFilePath = path.join(this.clogFolder, logFileName);

    try {
      const commandsJsonPath = path.join(__dirname, '..', 'commands', 'commands.json');
      const commandsJsonRaw = await fs.readFile(commandsJsonPath, 'utf8');
      const enabledCommands = JSON.parse(commandsJsonRaw);

      for (const commandName of Object.keys(enabledCommands)) {
        const commandEntry = enabledCommands[commandName];

        if (typeof commandEntry === 'object') {
          for (const subcommandName of Object.keys(commandEntry)) {
            if (commandEntry[subcommandName]) {
              const filePath = path.join(__dirname, '..', 'commands', `${commandName}.js`);
              const commandModule = require(filePath);
              this.commands[subcommandName] = commandModule;

              logLines.push(`Loaded subcommand: ${subcommandName} from ${commandName}.js`);
            }
          }
        } else {
          const filePath = path.join(__dirname, '..', 'commands', `${commandName}.js`);
          const commandModule = require(filePath);
          this.commands[commandName] = commandModule;

          logLines.push(`Loaded command: ${commandName}`);
        }
      }

      const header = [
        `Command Load Log`,
        `==================`,
        `Bot Name: ${this.client?.user?.username || 'Unknown'}`,
        `Bot ID: ${this.client?.user?.id || 'Unknown'}`,
        `Server Count: ${this.client?.guilds?.cache?.size ?? 0}`,
        `Startup Time: ${now.toLocaleString()} (local)`,
        `UTC Time: ${now.toUTCString()}`,
        `==================`,
        ``
      ];

      const finalLog = header.concat(logLines).join('\n');
      await fs.writeFile(logFilePath, finalLog, 'utf8');
      console.log(`[Clog] ✅ Commands logged to ${logFileName}`);

    } catch (error) {
      console.error(`[Clog] ❌ Error loading commands or writing log: ${error.message}`);
    }
  }

  getCommand(commandName) {
    return this.commands[commandName];
  }
}
module.exports = { CommandLoader };