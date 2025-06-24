const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

class DevScripts {
    static async checkEnvSetup() {
        const envPath = path.join(__dirname, '../.env');
        const tokenPath = path.join(__dirname, '../config/token.json');

        try {
            // Check for .env file
            await fs.access(envPath);
            console.log('✓ Found .env file');
            
            // Load .env
            const envConfig = dotenv.config({ path: envPath });
            if (envConfig.error) {
                throw new Error('Invalid .env file format');
            }

            // Verify TOKEN exists
            if (!process.env.TOKEN) {
                throw new Error('TOKEN not found in .env file');
            }

            // Save token to config if in dev mode
            if (process.env.NODE_ENV === 'development') {
                await fs.mkdir(path.dirname(tokenPath), { recursive: true });
                await fs.writeFile(tokenPath, JSON.stringify({ token: process.env.TOKEN }));
                console.log('✓ Saved token to config/token.json');
            }

            return true;
        } catch (error) {
            console.error('\n❌ Development setup error:');
            console.error(`   • ${error.message}`);
            console.error('\n📝 Please create a .env file in the Bcode folder with:');
            console.error('   TOKEN=your_bot_token_here');
            console.error('   NODE_ENV=development\n');
            return false;
        }
    }
}

module.exports = DevScripts;
