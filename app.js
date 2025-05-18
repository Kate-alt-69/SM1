const { app, BrowserWindow, ipcMain } = require('electron');
const AutoLaunch = require('auto-launch');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const clipboard = require('electron').clipboard;

const autoLauncher = new AutoLaunch({
    name: 'Server Manager Bot',
    path: app.getPath('exe'),
});

let mainWindow;
let botProcess = null;
let startTime = null;
let commandsExecuted = 0;
let botInfo = {
    commands: 0,
    guilds: 0,
    registeredCommands: 0
};

async function saveToken(token) {
    try {
        // Create config directory if it doesn't exist
        const configDir = path.join(__dirname, 'Bcode', 'config');
        await fs.mkdir(configDir, { recursive: true });

        const tokenData = { token: token };
        await fs.writeFile(
            path.join(configDir, 'token.json'),
            JSON.stringify(tokenData, null, 2)
        );
        return true;
    } catch (err) {
        console.error('Error saving token:', err);
        return false;
    }
}

async function loadToken() {
    try {
        const data = await fs.readFile(
            path.join(__dirname, 'Bcode', 'config', 'token.json'),
            'utf8'
        );
        const tokenData = JSON.parse(data);
        return tokenData.token;
    } catch (err) {
        return null;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#36393f',
        icon: path.join(__dirname, 'assets', 'SM1.app.png'),
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Load the HTML content
    mainWindow.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
        <html>
        <head>
            <title>Server Manager Bot</title>
            <style>
                :root {
                    --background: #36393f;
                    --secondary-background: #2f3136;
                    --accent: #5865f2;
                    --text: #ffffff;
                    --secondary-text: #b9bbbe;
                }
                
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                    font-family: \'gg sans\', \'Helvetica Neue\', Helvetica, Arial, sans-serif;
                    background: var(--background);
                    color: var(--text);
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .titlebar {
                    -webkit-app-region: drag;
                    background: var(--secondary-background);
                    height: 32px;
                    display: flex;
                    align-items: center;
                    padding: 0 16px;
                }

                .titlebar-button {
                    -webkit-app-region: no-drag;
                    border: none;
                    background: transparent;
                    color: var(--secondary-text);
                    padding: 8px 12px;
                    margin-left: 8px;
                    cursor: pointer;
                }

                .content {
                    flex: 1;
                    padding: 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .card {
                    background: var(--secondary-background);
                    border-radius: 8px;
                    padding: 20px;
                }

                .input-group {
                    margin: 16px 0;
                }

                input {
                    width: 100%;
                    padding: 10px;
                    background: var(--background);
                    border: 1px solid #202225;
                    color: var(--text);
                    border-radius: 4px;
                    outline: none;
                }

                input:focus {
                    border-color: var(--accent);
                }

                button {
                    background: var(--accent);
                    color: var(--text);
                    border: none;
                    padding: 12px 24px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                button:hover {
                    background: #4752c4;
                }

                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                }

                .stat-card {
                    background: var(--background);
                    padding: 16px;
                    border-radius: 4px;
                    text-align: center;
                }

                .token-menu {
                    position: absolute;
                    top: 32px;
                    left: 0;
                    background: var(--secondary-background);
                    border-radius: 4px;
                    padding: 8px;
                    display: none;
                }
                .token-button {
                    position: relative;
                    margin-right: auto;
                }
                .bot-info {
                    text-align: center;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="titlebar">
                <div class="token-button">
                    <button onclick="toggleTokenMenu()" class="titlebar-button">Token ▾</button>
                    <div class="token-menu" id="tokenMenu">
                        <button onclick="changeToken()">Change Token</button>
                        <button onclick="copyToken()">Copy Token</button>
                        <button onclick="removeToken()">Remove Token</button>
                    </div>
                </div>
                <div class="bot-info" id="botInfo">Loading...</div>
                <div style="margin-left: auto;">
                    <button class="titlebar-button" onclick="minimizeWindow()">&#8212;</button>
                    <button class="titlebar-button" onclick="maximizeWindow()">&#9633;</button>
                    <button class="titlebar-button" onclick="closeWindow()">&#10005;</button>
                </div>
            </div>
            
            <div class="content">
                <div class="card">
                    <h2>Bot Configuration</h2>
                    <div class="input-group">
                        <label for="token">Bot Token</label>
                        <input type="password" id="token" placeholder="Enter your Discord bot token">
                    </div>
                    <button onclick="startBot()">Start Bot</button>
                    <button onclick="stopBot()" style="background: #ed4245;">Stop Bot</button>
                </div>

                <div class="card">
                    <h2>Statistics</h2>
                    <div class="stats">
                        <div class="stat-card">
                            <h3>Status</h3>
                            <p id="status">Stopped</p>
                        </div>
                        <div class="stat-card">
                            <h3>Uptime</h3>
                            <p id="uptime">0h 0m 0s</p>
                        </div>
                        <div class="stat-card">
                            <h3>Commands</h3>
                            <p id="commands">0</p>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                const { ipcRenderer } = require('electron');

                function toggleTokenMenu() {
                    const menu = document.getElementById('tokenMenu');
                    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                }

                function changeToken() {
                    ipcRenderer.send('change-token');
                }

                function copyToken() {
                    ipcRenderer.send('copy-token');
                }

                function removeToken() {
                    ipcRenderer.send('remove-token');
                }

                function startBot() {
                    const token = document.getElementById('token').value;
                    ipcRenderer.send('start-bot', token);
                }

                function stopBot() {
                    ipcRenderer.send('stop-bot');
                }

                function minimizeWindow() {
                    ipcRenderer.send('minimize-window');
                }

                function maximizeWindow() {
                    ipcRenderer.send('maximize-window');
                }

                function closeWindow() {
                    ipcRenderer.send('close-window');
                }

                ipcRenderer.on('update-stats', (event, stats) => {
                    document.getElementById('status').textContent = stats.status;
                    document.getElementById('uptime').textContent = stats.uptime;
                    document.getElementById('commands').textContent = stats.commands;
                });

                ipcRenderer.on('update-title', (event, info) => {
                    document.getElementById('botInfo').textContent = \`\${info.commands} Commands | \${info.guilds} Servers\`;
                });
            </script>
        </body>
        </html>
    `.trim());

    // Add this after window creation but before loadURL
    loadToken().then(savedToken => {
        if (savedToken) {
            mainWindow.webContents.once('did-finish-load', () => {
                mainWindow.webContents.executeJavaScript(`
                    document.getElementById('token').value = '${savedToken}';
                `);
            });
        }
    });
}

// Bot process management
async function startBot() {
    try {
        const token = await loadToken();
        if (!token) {
            createTokenPrompt();
            return;
        }

        if (botProcess) return;
        
        startTime = Date.now();
        botProcess = spawn('node', ['DCB.js'], { 
            shell: true,
            cwd: path.join(__dirname, 'Bcode')
        });

        // Add error handler for process
        botProcess.on('error', (err) => {
            console.error('Failed to start bot process:', err);
        });

        botProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(output);
            
            if (output.includes('commands registered')) {
                botInfo.registeredCommands = parseInt(output.match(/(\d+) commands/)[1]);
                updateTitleBar();
            }
            
            if (output.includes('servers joined')) {
                botInfo.guilds = parseInt(output.match(/(\d+) servers/)[1]);
                updateTitleBar();
            }

            if (output.includes('command executed')) {
                botInfo.commands++;
                updateStats();
            }
        });

        updateStats();
    } catch (err) {
        console.error('Error starting bot:', err);
    }
}

function stopBot() {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
        startTime = null;
    }
}

function updateStats() {
    if (!startTime) return;

    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    mainWindow.webContents.send('update-stats', {
        status: botProcess ? 'Running' : 'Stopped',
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        commands: commandsExecuted
    });

    setTimeout(updateStats, 1000);
}

async function createTokenPrompt() {
    const promptWindow = new BrowserWindow({
        width: 400,
        height: 200,
        modal: true,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    promptWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
            <head>
                <style>
                    body { font-family: Arial; padding: 20px; background: #36393f; color: white; }
                    input { width: 100%; padding: 10px; margin: 10px 0; }
                    button { padding: 10px 20px; margin: 5px; }
                </style>
            </head>
            <body>
                <h3>Enter Discord Bot Token</h3>
                <input type="password" id="token" placeholder="Enter token">
                <button onclick="submit()">Start Bot</button>
                <script>
                    const { ipcRenderer } = require('electron');
                    function submit() {
                        const token = document.getElementById('token').value;
                        ipcRenderer.send('token-submit', token);
                        window.close();
                    }
                </script>
            </body>
        </html>
    `);
}

function updateTitleBar() {
    mainWindow.webContents.send('update-title', {
        commands: botInfo.registeredCommands,
        guilds: botInfo.guilds
    });
}

// Electron app setup
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers
ipcMain.on('start-bot', (event, token) => startBot(token));
ipcMain.on('stop-bot', () => stopBot());

ipcMain.on('set-auto-start', async (event, enable) => {
    if (enable) {
        await autoLauncher.enable();
    } else {
        await autoLauncher.disable();
    }
});

ipcMain.on('set-background', async (event, enable) => {
    if (enable) {
        app.setLoginItemSettings({
            openAtLogin: true,
            openAsHidden: true
        });
    } else {
        app.setLoginItemSettings({
            openAtLogin: false
        });
    }
});

// Token management functions
ipcMain.on('change-token', () => createTokenPrompt());
ipcMain.on('copy-token', async () => {
    const token = await loadToken();
    if (token) {
        clipboard.writeText(token);
    }
});
ipcMain.on('remove-token', async () => {
    await fs.unlink(path.join(__dirname, 'Bcode', 'config', 'token.json')).catch(() => {});
    stopBot();
    createTokenPrompt();
});

// Window control handlers
ipcMain.on('minimize-window', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('maximize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
});
ipcMain.on('close-window', () => BrowserWindow.getFocusedWindow()?.close());
