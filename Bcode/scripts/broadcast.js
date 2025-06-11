const { Client, GatewayIntentBits } = require('discord.js');
const { TokenManager } = require('../utils/TokenManager');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

async function broadcast() {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    const tokenManager = new TokenManager();
    const token = await tokenManager.loadToken();

    try {
        await client.login(token);
        console.log(`\n✅ Logged in as ${client.user.tag}\n`);

        const message = await ask('Enter broadcast message: ');
        const targetType = await ask('Send to (all/specific): ');
        
        if (targetType.toLowerCase() === 'specific') {
            console.log('\nAvailable servers:');
            client.guilds.cache.forEach(guild => {
                console.log(`${guild.id}: ${guild.name}`);
            });
            
            const serverId = await ask('\nEnter server ID: ');
            const guild = client.guilds.cache.get(serverId);
            
            if (!guild) {
                throw new Error('Invalid server ID');
            }

            const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
            if (!channel) {
                throw new Error('No suitable channel found');
            }

            await channel.send(message);
            console.log(`\n✅ Message sent to ${guild.name}`);
        } else {
            let sent = 0;
            for (const guild of client.guilds.cache.values()) {
                try {
                    const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased());
                    if (channel) {
                        await channel.send(message);
                        sent++;
                        console.log(`✅ Sent to ${guild.name}`);
                    }
                } catch (err) {
                    console.error(`❌ Failed to send to ${guild.name}: ${err.message}`);
                }
            }
            console.log(`\n✅ Message sent to ${sent} servers`);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        rl.close();
        process.exit(0);
    }
}

broadcast();
