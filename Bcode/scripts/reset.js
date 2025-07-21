const fs = require('fs').promises;
const path = require('path');

async function resetData() {
    console.log('\n🔄 Starting data reset...');
    
    const dataPath = path.join(__dirname, '../data');
    const configPath = path.join(__dirname, '../config');
    
    // Default empty structures
    const defaultData = {
        'static_emojis.json': {
            type: 'static',
            lastUpdated: new Date().toISOString(),
            count: 0,
            emojis: {}
        },
        'animated_emojis.json': {
            type: 'animated',
            lastUpdated: new Date().toISOString(),
            count: 0,
            emojis: {}
        },
        'emoji_data.json': {
            lastUpdated: new Date().toISOString(),
            emojis: []
        },
        'bot_info.json': {
            id: '',
            username: '',
            discriminator: '',
            avatar: '',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            servers: 0,
            presence: 'online'
        }
    };

    const configDefaults = {
        'commands.json': [],
        'bot_data.json': {
            stickyMessages: {},
            stickyCooldowns: {},
            guildStickyMessages: {},
            serverInfo: {},
            storedEmbeds: {}
        }
    };

    try {
        // Ensure directories exist
        await fs.mkdir(dataPath, { recursive: true });
        await fs.mkdir(configPath, { recursive: true });

        // Reset data files
        console.log('\n📝 Resetting data files...');
        for (const [filename, defaultContent] of Object.entries(defaultData)) {
            const filepath = path.join(dataPath, filename);
            await fs.writeFile(
                filepath,
                JSON.stringify(defaultContent, null, 2)
            );
            console.log(`   ✅ Reset ${filename}`);
        }

        // Reset config files
        console.log('\n📝 Resetting config files...');
        for (const [filename, defaultContent] of Object.entries(configDefaults)) {
            const filepath = path.join(configPath, filename);
            await fs.writeFile(
                filepath,
                JSON.stringify(defaultContent, null, 2)
            );
            console.log(`   ✅ Reset ${filename}`);
        }

        // Don't reset token files in dev mode
        if (process.argv.includes('--dev')) {
            console.log('\n⚠️ Development mode: Preserving token files');
        }

        console.log('\n✅ Data reset complete! Start the bot to regenerate data.\n');
    } catch (error) {
        console.error('\n❌ Error during reset:', error);
        process.exit(1);
    }
}

resetData();
