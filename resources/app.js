let botProcess = null;
let terminal = null;

async function initApp() {
    await Neutralino.init();

    // Setup terminal
    setupTerminal();
    
    // Load saved token
    const token = await loadToken();
    if (token) {
        document.getElementById('tokenInput').value = token;
    }

    // Setup event handlers
    Neutralino.events.on('windowClose', () => {
        stopBot();
        Neutralino.app.exit();
    });

    // Start auto-updates
    startStatsUpdater();
}

async function startBot() {
    const token = document.getElementById('tokenInput').value;
    if (!token) {
        writeToTerminal('Error: No token provided');
        return;
    }

    await saveToken(token);
    
    try {
        const process = await Neutralino.os.spawnProcess('node', ['DCB.js'], {
            cwd: 'Bcode'
        });
        
        botProcess = process.id;
        writeToTerminal('Bot starting...');
    } catch (error) {
        writeToTerminal(`Error starting bot: ${error.message}`);
    }
}

async function stopBot() {
    if (botProcess) {
        await Neutralino.os.updateSpawnedProcess(botProcess, 'terminate');
        botProcess = null;
        writeToTerminal('Bot stopped');
    }
}

function setupTerminal() {
    const term = new Terminal({
        theme: {
            background: '#2f3136',
            foreground: '#ffffff'
        },
        fontSize: 14
    });

    term.open(document.getElementById('terminal'));
    terminal = term;
    
    term.onKey(({ key, domEvent }) => {
        handleTerminalInput(key, domEvent);
    });

    writeToTerminal('Server Manager CLI\r\n$ ');
}

// Initialize app
Neutralino.init();
initApp();
