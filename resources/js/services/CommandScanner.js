class CommandScanner {
    constructor() {
        this.commandsPath = 'Bcode/commands';
        this.commands = new Map();
    }

    async scanCommands() {
        try {
            const files = await Neutralino.filesystem.readDirectory(this.commandsPath);
            const commands = [];

            for (const file of files) {
                if (file.type === 'FILE' && file.entry.endsWith('.js')) {
                    const content = await Neutralino.filesystem.readFile(`${this.commandsPath}/${file.entry}`);
                    const commandInfo = this.parseCommandFile(content, file.entry);
                    if (commandInfo) {
                        commands.push(commandInfo);
                    }
                }
            }

            return commands;
        } catch (error) {
            console.error('Failed to scan commands:', error);
            return [];
        }
    }

    parseCommandFile(content, filename) {
        try {
            // Basic command detection
            const name = filename.replace('.js', '');
            const description = content.match(/description:\s*['"`](.*?)['"`]/)?.[1] || 'No description';
            const isEnabled = !content.includes('disabled: true');
            
            return {
                name,
                description,
                isEnabled,
                filename
            };
        } catch (error) {
            console.error(`Failed to parse command ${filename}:`, error);
            return null;
        }
    }
}

window.CommandScanner = new CommandScanner();
