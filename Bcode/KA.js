//``````````````|
//START OF KA.js|
//,,,,,,,,,,,,,,|

const express = require('express');
const net = require('net');

const server = express();

function findAvailablePort(start = 3000, end = 3100) {
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            if (port > end) return reject(new Error('No available ports found.'));
            const tester = net.createServer()
                .once('error', () => tryPort(port + 1))
                .once('listening', () => {
                    tester.close(() => resolve(port));
                })
                .listen(port);
        };
        tryPort(start);
    });
}

async function keepAlive() {
    server.all('/', (req, res) => {
        res.send('Bot is alive!');
    });

    try {
        const port = await findAvailablePort();
        server.listen(port, () => {
            console.log(`[KA] 🌐 Keep-alive server running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error('[KA] ❌ Failed to start keep-alive server:', err.message);
    }
}

module.exports = { keepAlive };

//,,,,,,,,,,,,|
//END OF KA.js|
//````````````|
