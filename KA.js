const express = require('express');
const server = express();

function keepAlive() {
    server.all('/', (req, res) => {
        res.send('Bot is alive!');
    });
    
    server.listen(3000, () => {
        console.log('Server is ready.');
    });
}

module.exports = { keepAlive };
