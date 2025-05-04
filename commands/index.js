const { Collection } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    async loadCommands(client) {
        client.commands = new Collection();

        // First load commands directly in the commands folder
        try {
            const mainCommands = await fs.readdir(__dirname);
            for (const file of mainCommands) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const command = require(path.join(__dirname, file));
                    if (command.data && command.execute) {
                        client.commands.set(command.data.name, command);
                        console.log(`✅ Loaded command/${file}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading main commands: ${error}`);
        }

        // Then load commands from subfolders
        const commandFolders = [
            'moderation',
            'roles',
            'utility',
            'help',
            'embed',
            'sticky'
        ];

        for (const folder of commandFolders) {
            const folderPath = path.join(__dirname, folder);
            try {
                // Create folder if it doesn't exist
                await fs.mkdir(folderPath, { recursive: true });
                
                const files = await fs.readdir(folderPath);
                for (const file of files) {
                    if (file.endsWith('.js')) {
                        const command = require(path.join(folderPath, file));
                        if (command.data && command.execute) {
                            client.commands.set(command.data.name, command);
                            console.log(`✅ Loaded ${folder}/${file}`);
                        }
                    }
                }
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error(`Error loading ${folder}: ${error}`);
                }
            }
        }
    }
};
