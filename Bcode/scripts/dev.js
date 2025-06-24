const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function devCheck() {
    try {
        if (process.argv.includes('--dev')) {
            // Dev mode - check for token directly
            const envPath = path.join(__dirname, '../.env');
            
            try {
                await fs.access(envPath);
                if (!process.env.TOKEN) {
                    throw new Error('TOKEN not found in .env file');
                }
                return process.env.TOKEN;
            } catch (err) {
                console.error('\n❌ Development setup error:');
                console.error('   Please create a .env file in Bcode folder with:');
                console.error('   TOKEN=your_bot_token_here\n');
                process.exit(1);
            }
        }
        return null; // Not in dev mode
    } catch (error) {
        console.error('Dev check failed:', error);
        process.exit(1);
    }
}

module.exports = { devCheck };
