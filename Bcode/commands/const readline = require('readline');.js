const readline = require('readline');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

let startTime;
let commandsExecuted = 0;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function initializeBot() {
    console.clear();
    console.log('=== Discord Bot Launcher ===\n');

    // Check for existing token
    let token = '';
    try {
        if (fs.existsSync('.env')) {
            token = fs.readFileSync('.env', 'utf8').match(/TOKEN_SM=(.*)/)[1];
        }
    } catch (err) {}

    if (!token) {
        token = await new Promise(resolve => {
            rl.question('Please enter your Discord bot token: ', answer => {
                resolve(answer.trim());
            });
        });

        // Save token to .env
        fs.writeFileSync('.env', `TOKEN_SM=${token}`);
    }

    console.clear();
    console.log('Initializing bot...');
    startTime = Date.now();

    // Start the bot process
    const botProcess = exec('node DCB.js', (error) => {
        if (error) {
            console.error('Error starting bot:', error);
            process.exit(1);
        }
    });

    // Handle bot output
    botProcess.stdout.on('data', (data) => {
        console.log(data.toString());
        if (data.includes('command executed')) {
            commandsExecuted++;
        }
    });

    // Start statistics display
    setInterval(displayStats, 1000);
}

function displayStats() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    console.clear();
    console.log('=== Bot Statistics ===');
    console.log(`Uptime: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`Commands Executed: ${commandsExecuted}`);
    console.log(`Servers: ${global.client?.guilds.cache.size || 'Loading...'}`);
    console.log(`Users: ${global.client?.users.cache.size || 'Loading...'}`);
    console.log('\nPress Ctrl+C to exit');
}

initializeBot();
