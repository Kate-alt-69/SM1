const dns = require('dns');
const { promisify } = require('util');
const lookup = promisify(dns.lookup);

class ConnectionManager {
    static async checkInternet() {
        try {
            await lookup('google.com');
            return true;
        } catch (error) {
            return false;
        }
    }

    static async waitForInternet() {
        while (!(await this.checkInternet())) {
            console.log('\n❌ No internet connection detected!');
            console.log('Please check your internet connection and press Enter to retry...');
            await new Promise(resolve => process.stdin.once('data', resolve));
        }
        console.log('✅ Internet connection established!\n');
    }
}

module.exports = { ConnectionManager };
