const fs = require('fs');
const path = require('path');

module.exports = {
    loadCommands: (client) => {
        global.client = client; // Make client globally accessible for stats
        const commandFiles = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.js') && file !== 'index.js');
        
        for (const file of commandFiles) {
            try {
                const command = require(path.join(__dirname, file));
                if ('data' in command && 'execute' in command) {
                    // Wrap execute function to track usage
                    const originalExecute = command.execute;
                    command.execute = async (...args) => {
                        await originalExecute.apply(command, args);
                        console.log('command executed');
                    };
                    
                    client.commands.set(command.data.name, command);
                    console.log(`✅ Loaded command: ${command.data.name}`);
                }
            } catch (error) {
                console.error(`❌ Error loading command ${file}:`, error);
            }
        }
    }
};
