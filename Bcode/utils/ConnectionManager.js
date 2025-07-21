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
            console.log('{ERROR}\n❌ No internet connection detected!');
            console.log('1.Please check your internet connection and press Enter to retry...');
            await new Promise(resolve => process.stdin.once('data', resolve));
        }
        console.log('[SYSTEM] ✅ Internet connection established!\n');
    }
}

module.exports = { ConnectionManager };
