let botProcess = null;
let terminal = null;
let devMode = false;
let startTime = null;
let botData = null;

async function initApp() {
    await Neutralino.init();
    
    try {
        const token = await window.TokenService.loadToken();
        if (!token) {
            showTokenPrompt();
            return;
        }

        await setupUI();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize: ' + error.message);
    }
}

function showTokenPrompt() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Welcome to Server Manager</h2>
            <p>Please set a Discord Bot Token to continue.</p>
            <div class="token-input">
                <input type="password" id="tokenInput" placeholder="Enter bot token">
                <button onclick="saveToken()" class="primary-button">Save Token</button>
            </div>
            <button onclick="openTokenGuide()" class="secondary-button">How to get a token?</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function setupTerminal() {
    terminal = new Terminal({
        theme: {
            background: '#2f3136',
            foreground: '#ffffff',
        },
        fontSize: 14,
        fontFamily: 'Fira Code, monospace',
        cursorBlink: true
    });
    
    terminal.open(document.getElementById('terminal'));
    terminal.write('Server Manager Bot CLI\r\n$ ');
}

async function loadSavedToken() {
    try {
        const tokenFile = await Neutralino.filesystem.readFile('./Bcode/config/token.json');
        const { token } = JSON.parse(tokenFile);
        if (token) {
            document.getElementById('tokenInput').value = token;
        }
    } catch (error) {
        console.error('Failed to load token:', error);
    }
}

function setupEventHandlers() {
    // Window controls - check if elements exist before binding
    const minimizeBtn = document.getElementById('minimize');
    const maximizeBtn = document.getElementById('maximize');
    const closeBtn = document.getElementById('close');
    const startBtn = document.getElementById('startBot');
    const stopBtn = document.getElementById('stopBot');
    const cmdPanelBtn = document.getElementById('cmdPanel');

    if (minimizeBtn) minimizeBtn.onclick = () => Neutralino.window.minimize();
    if (maximizeBtn) maximizeBtn.onclick = () => Neutralino.window.maximize();
    if (closeBtn) closeBtn.onclick = () => Neutralino.app.exit();
    if (startBtn) startBtn.onclick = startBot;
    if (stopBtn) stopBtn.onclick = stopBot;
    if (cmdPanelBtn) cmdPanelBtn.onclick = toggleCommandPanel;
}

function toggleCommandPanel() {
    const panel = document.getElementById('commandPanel');
    panel.classList.toggle('hidden');
}

async function checkDevMode() {
    // Check if dev mode was activated via npm command
    try {
        const devFile = await Neutralino.filesystem.readFile('./.dev');
        devMode = true;
        document.body.classList.add('dev-mode');
        showDevTools();
    } catch {
        devMode = false;
    }
}

function showDevTools() {
    const devTools = document.createElement('div');
    devTools.className = 'dev-tools';
    devTools.innerHTML = `
        <h3>Dev Tools</h3>
        <button onclick="reloadApp()">Reload App</button>
        <button onclick="openLogs()">View Logs</button>
    `;
    document.body.appendChild(devTools);
}

function initializeUI() {
    // View switching
    document.getElementById('settingsBtn').onclick = () => switchView('settingsView');
    document.getElementById('cliBtn').onclick = () => switchView('cliView');

    // Load token
    loadSavedToken();
    
    // Load command list
    loadCommandList();
    
    // Initialize terminal
    setupTerminal();
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

async function loadCommandList() {
    const commands = await Neutralino.filesystem.readFile('./Bcode/config/commands.json');
    const commandList = JSON.parse(commands);
    
    const container = document.getElementById('commandList');
    commandList.forEach(cmd => {
        const toggle = createCommandToggle(cmd);
        container.appendChild(toggle);
    });
}

async function startBot(token) {
    try {
        // Start bot process
        const process = await Neutralino.os.spawnProcess('node', ['Bcode/DCB.js']);
        startTime = Date.now();
        updateUptime();
        
        // Handle bot data events
        Neutralino.events.on('botData', (data) => {
            botData = data;
            updateBotInfo();
        });
    } catch (error) {
        showError('Failed to start bot: ' + error.message);
    }
}

async function stopBot() {
    if (botProcess) {
        await Neutralino.os.updateSpawnedProcess(botProcess, 'terminate');
        botProcess = null;
        terminal.writeln('Bot stopped');
    }
}

function updateUptime() {
    if (!startTime) return;
    
    const now = Date.now();
    const diff = now - startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    document.getElementById('uptime').textContent = 
        `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    setTimeout(updateUptime, 1000);
}

function updateBotInfo() {
    if (!botData) return;
    
    document.getElementById('botName').textContent = botData.username;
    document.getElementById('botId').textContent = `ID: ${botData.id}`;
    document.getElementById('botAvatar').src = botData.avatar;
    document.getElementById('status').className = 'status-online';
    document.getElementById('status').textContent = 'Online';
}

function createDefaultAvatar() {
    const img = document.getElementById('botAvatar');
    if (img) img.src = 'assets/default-avatar.png';
}

async function initializeWithToken(token) {
    try {
        // Save token data
        await saveToken(token);
        
        // Setup UI
        await setupUI();
        
        // Enable start button
        const startBtn = document.getElementById('startBot');
        if (startBtn) startBtn.disabled = false;
        
        return true;
    } catch (error) {
        console.error('Failed to initialize with token:', error);
        showError('Failed to initialize with token');
        return false;
    }
}

function openTokenGuide() {
    window.open('https://discord.com/developers/applications', '_blank');
}

function editToken() {
    const currentToken = document.getElementById('currentToken').value;
    showTokenPrompt();
    const tokenInput = document.getElementById('tokenInput');
    if (tokenInput && currentToken) {
        tokenInput.value = currentToken;
    }
}

async function saveToken() {
    try {
        const tokenInput = document.getElementById('tokenInput');
        const token = tokenInput.value.trim();
        
        await window.TokenService.saveToken(token);
        hideModal();
        showSuccess('Token saved successfully');
        await setupUI();

    } catch (error) {
        showError(error.message || 'Failed to save token');
        console.error('Token save error:', error);
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

async function toggleSettings() {
    const commands = await window.CommandScanner.scanCommands();
    
    const settingsView = document.createElement('div');
    settingsView.className = 'modal-overlay';
    settingsView.innerHTML = `
        <div class="modal-content settings-panel">
            <h2>Settings</h2>
            
            <div class="settings-section">
                <h3>Application</h3>
                <div class="setting-item">
                    <label>UI Mode</label>
                    <select id="uiMode" onchange="changeTheme(this.value)">
                        <option value="discord">Discord</option>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                    </select>
                </div>
            </div>

            <div class="settings-section">
                <h3>Bot Configuration</h3>
                <div class="setting-item">
                    <label>Bot Token</label>
                    <div class="token-display">
                        <input type="password" id="currentToken" readonly>
                        <button onclick="editToken()" class="secondary-button">Change</button>
                    </div>
                </div>
                <div class="setting-item">
                    <label>Development Mode</label>
                    <label class="switch">
                        <input type="checkbox" id="devModeToggle" ${devMode ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>

            <div class="settings-section collapsible">
                <div class="section-header" onclick="toggleSection(this)">
                    <h3>Commands</h3>
                    <span class="expand-icon">▼</span>
                </div>
                <div class="section-content commands-list hidden">
                    ${commands.map(cmd => `
                        <div class="command-item">
                            <div class="command-info">
                                <span class="command-name">/${cmd.name}</span>
                                <span class="command-description">${cmd.description}</span>
                            </div>
                            <label class="switch">
                                <input type="checkbox" 
                                    ${cmd.isEnabled ? 'checked' : ''} 
                                    onchange="toggleCommand('${cmd.name}', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-actions">
                <button onclick="hideModal()" class="secondary-button">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(settingsView);
    loadCurrentToken();
    loadCurrentTheme();
}

function toggleSection(header) {
    const section = header.parentElement;
    const content = section.querySelector('.section-content');
    const icon = header.querySelector('.expand-icon');
    
    content.classList.toggle('hidden');
    if (content.classList.contains('hidden')) {
        icon.textContent = '▼';
    } else {
        icon.textContent = '▲';
    }
}

function changeTheme(mode) {
    document.body.className = `theme-${mode}`;
    localStorage.setItem('uiTheme', mode);
}

function loadCurrentTheme() {
    const savedTheme = localStorage.getItem('uiTheme') || 'discord';
    const themeSelect = document.getElementById('uiMode');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
    changeTheme(savedTheme);
}

// Initialize app
window.onload = () => {
    initApp().catch(error => {
        console.error('App initialization error:', error);
        showError('Failed to initialize application');
    });
};
