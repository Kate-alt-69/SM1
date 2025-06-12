const APP_PATHS = {
    resources: {
        icons: '/icons/',
        resources: '/resources/'
    }
};

const APP_RESOURCES = {
    icons: {
        server: 'server-manager.ico',
        error: 'error-icon.ico',
        settings: 'settings-icon.ico',
        down: 'down-arrow-icon.ico',
        loading: 'loading.ico',
        wrench: 'wrench-icon.ico'
    }
};

async function preloadResources() {
    try {
        console.log('🔍 Checking resource paths...');
        const appPath = await Neutralino.filesystem.getPath('.');
        
        // First ensure directories exist
        for (const path of Object.values(APP_PATHS)) {
            try {
                await Neutralino.filesystem.createDirectory(path);
                console.log(`✅ Created/verified directory: ${path}`);
            } catch (err) {
                console.warn(`⚠️ Directory error for ${path}:`, err);
            }
        }

        // Verify critical icons exist
        for (const [key, file] of Object.entries(APP_RESOURCES.icons)) {
            try {
                await Neutralino.filesystem.getStats(`${APP_PATHS.resources.icons}${file}`);
                console.log(`✅ Found icon: ${file}`);
            } catch (error) {
                console.warn(`⚠️ Missing icon: ${file}`);
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Resource check failed:', error);
        throw error;
    }
}

let botProcess = null;
let terminal = null;
let devMode = false;
let startTime = null;
let botData = null;

const LOADING_STAGES = [
    { text: 'Initializing...', status: 'Starting up', progress: 0 },
    { text: 'Checking resources...', status: 'Resource scan', progress: 20 },
    { text: 'Loading services...', status: 'Services setup', progress: 40 },
    { text: 'Setting up interface...', status: 'UI preparation', progress: 60 },
    { text: 'Configuring bot...', status: 'Bot setup', progress: 80 },
    { text: 'Ready!', status: 'Complete', progress: 100 }
];

async function updateLoadingStage(stage) {
    const progressBar = document.querySelector('.progress-fill');
    const loadingStatus = document.querySelector('.loading-status');
    const loadingText = document.querySelector('.loading-text');

    if (progressBar) progressBar.style.width = `${stage.progress}%`;
    if (loadingStatus) loadingStatus.textContent = stage.status;
    if (loadingText) loadingText.textContent = stage.text;

    // Add small delay for visual effect
    await new Promise(resolve => setTimeout(resolve, 500));
}

async function setupUI() {
    try {
        document.body.innerHTML = `
            <div class="main-window">
                <header class="titlebar">
                    <div class="title">
                        <img src="${window.AssetManager.getIconUrl('server')}" alt="Logo" class="title-logo">
                        Server Manager
                    </div>
                    <div class="titlebar-controls">
                        <button id="minimize" class="window-button">─</button>
                        <button id="maximize" class="window-button">□</button>
                        <button id="settings" class="frame-button settings-btn">
                            <img src="${window.AssetManager.getIconUrl('settings')}" alt="Settings" class="settings-icon">
                        </button>
                    </div>
                </header>

                <div class="content">
                    <div class="sidebar">
                        <div class="bot-status-panel">
                            <div class="profile-section">
                                <div class="profile-frame">
                                    <img id="botAvatar" src="assets/default-avatar.png" alt="Bot Avatar">
                                </div>
                                <div class="bot-info">
                                    <div id="botName">Server Manager</div>
                                    <div id="botId">Loading...</div>
                                    <div class="status-indicator">
                                        <span id="statusDot" class="status-dot offline"></span>
                                        <span id="statusText">Offline</span>
                                    </div>
                                </div>
                            </div>
                            <div class="control-buttons">
                                <button id="startBot" class="control-btn primary">Start Bot</button>
                                <button id="stopBot" class="control-btn danger" disabled>Stop Bot</button>
                            </div>
                        </div>
                    </div>

                    <div class="main-content">
                        <div class="stats-panel">
                            <div class="stat-item">
                                <div class="stat-label">Uptime</div>
                                <div id="uptime" class="stat-value">0:00:00</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Servers</div>
                                <div id="serverCount" class="stat-value">0</div>
                            </div>
                        </div>

                        <div class="commands-section">
                            <h3>Recent Commands</h3>
                            <div id="commandsGraph" class="graph-area"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Re-apply default images for missing ones
        document.querySelectorAll('img').forEach(img => {
            img.onerror = () => {
                if (img.id === 'botAvatar') {
                    img.src = window.AssetManager.getIconUrl('avatar');
                } else if (img.classList.contains('settings-icon')) {
                    img.src = window.AssetManager.getIconUrl('settings');
                }
            };
        });

        // Update commands section to use down arrow icon
        const commandsSection = document.querySelector('.commands-section');
        if (commandsSection) {
            const toggleBtn = commandsSection.querySelector('.show-commands-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = `
                    Commands
                    <img src="icons/down-arrow-icon.ico" alt="Toggle" class="toggle-icon">
                `;
            }
        }

        // Setup event handlers
        await setupEventHandlers();

        return true;
    } catch (error) {
        console.error('Failed to setup UI:', error);
        return false;
    }
}

async function initApp() {
    try {
        await Neutralino.init();
        
        // Update through each loading stage
        for (const stage of LOADING_STAGES) {
            await updateLoadingStage(stage);
            
            // Perform actual work for each stage
            switch (stage.progress) {
                case 0:
                    // Initialize basics
                    break;
                case 20:
                    await preloadResources();
                    break;
                case 40:
                    await window.AssetManager.initialize();
                    break;
                case 60:
                    await setupUI();
                    break;
                case 80:
                    // Configure bot services
                    break;
                case 100:
                    // Final setup complete
                    break;
            }
        }

        // Show main window after loading completes
        setTimeout(() => {
            const loadWindow = document.getElementById('loadWindow');
            const mainWindow = document.getElementById('mainWindow');
            
            if (loadWindow) loadWindow.style.opacity = '0';
            if (mainWindow) {
                mainWindow.classList.remove('hidden');
                mainWindow.style.opacity = '1';
            }
            
            setTimeout(() => {
                if (loadWindow) loadWindow.style.display = 'none';
            }, 500);
        }, 1000);

    } catch (error) {
        console.error('Initialization error:', error);
        document.querySelector('.loading-status').textContent = 'Error';
        document.querySelector('.loading-text').textContent = error.message;
    }
}

function showTokenPrompt() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="token-prompt-header">
                <h2>Welcome to Server Manager</h2>
                <button onclick="hideModal()" class="secondary-button do-later-btn">Do Later</button>
            </div>
            <p>Please set a Discord Bot Token to continue.</p>
            <div class="token-input">
                <input type="password" id="tokenInput" placeholder="Enter bot token">
                <button onclick="saveToken()" class="primary-button">Save Token</button>
            </div>
            <div class="token-actions">
                <button onclick="openTokenGuide()" class="link-button">How to get a token?</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function showNoTokenError() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>⚠️ No Token Found</h2>
            <p>Please configure your Discord Bot Token to use this feature.</p>
            <div class="error-actions">
                <button onclick="showSettingsModal()" class="primary-button">Settings</button>
                <button onclick="hideModal()" class="secondary-button">Cancel</button>
            </div>
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
        const token = await window.TokenService.loadToken();
        if (token) {
            return token;
        }
        console.log('No token found, continuing in setup mode...');
        return null;
    } catch (error) {
        console.log('Token not configured yet, continuing...');
        return null;
    }
}

function setupEventHandlers() {
    const minimizeBtn = document.getElementById('minimize');
    const maximizeBtn = document.getElementById('maximize');
    const closeBtn = document.getElementById('close');
    const startBtn = document.getElementById('startBot');
    const stopBtn = document.getElementById('stopBot');

    if (minimizeBtn) minimizeBtn.onclick = () => Neutralino.window.minimize();
    if (maximizeBtn) maximizeBtn.onclick = () => Neutralino.window.maximize();
    if (closeBtn) closeBtn.onclick = () => Neutralino.app.exit();
    if (startBtn) startBtn.onclick = startBot;
    if (stopBtn) stopBtn.onclick = stopBot;
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

async function updateMainWindow() {
    const mainWindow = document.getElementById('mainWindow');
    
    // Update stats every second
    setInterval(() => {
        if (startTime) {
            const now = Date.now();
            const diff = now - startTime;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            
            document.getElementById('uptime').textContent = 
                `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update other stats
        if (botData) {
            document.getElementById('serverCount').textContent = botData.servers || 0;
            document.getElementById('commandCount').textContent = botData.commands || 0;
            
            // Update status
            const statusDot = document.querySelector('.status-dot');
            const statusText = document.getElementById('statusText');
            if (botData.online) {
                statusDot.classList.add('online');
                statusText.textContent = 'Online';
            } else {
                statusDot.classList.remove('online');
                statusText.textContent = 'Offline';
            }
        }
    }, 1000);

    // Add activity log entries
    function addActivityEntry(text) {
        const activityLog = document.getElementById('activityLog');
        const entry = document.createElement('div');
        entry.className = 'activity-entry';
        entry.textContent = text;
        activityLog.insertBefore(entry, activityLog.firstChild);
        
        // Keep only last 50 entries
        while (activityLog.children.length > 50) {
            activityLog.removeChild(activityLog.lastChild);
        }
    }

    // Set up event handlers
    const startButton = document.getElementById('startBot');
    const stopButton = document.getElementById('stopBot');

    startButton.onclick = async () => {
        try {
            startButton.disabled = true;
            stopButton.disabled = false;
            startTime = Date.now();
            addActivityEntry('Bot started');
            // Add your bot start logic here
        } catch (error) {
            showError(error.message);
        }
    };

    stopButton.onclick = async () => {
        try {
            stopButton.disabled = true;
            startButton.disabled = false;
            startTime = null;
            addActivityEntry('Bot stopped');
            // Add your bot stop logic here
        } catch (error) {
            showError(error.message);
        }
    };
}

// Update the initApp function
async function initApp() {
    try {
        await Neutralino.init();
        
        // Update through each loading stage
        for (const stage of LOADING_STAGES) {
            await updateLoadingStage(stage);
            
            // Perform actual work for each stage
            switch (stage.progress) {
                case 0:
                    // Initialize basics
                    break;
                case 20:
                    await preloadResources();
                    break;
                case 40:
                    await window.AssetManager.initialize();
                    break;
                case 60:
                    await setupUI();
                    break;
                case 80:
                    // Configure bot services
                    break;
                case 100:
                    // Final setup complete
                    break;
            }
        }

        // Show main window after loading completes
        setTimeout(() => {
            const loadWindow = document.getElementById('loadWindow');
            const mainWindow = document.getElementById('mainWindow');
            
            if (loadWindow) loadWindow.style.opacity = '0';
            if (mainWindow) {
                mainWindow.classList.remove('hidden');
                mainWindow.style.opacity = '1';
            }
            
            setTimeout(() => {
                if (loadWindow) loadWindow.style.display = 'none';
            }, 500);
        }, 1000);

    } catch (error) {
        console.error('Initialization error:', error);
        document.querySelector('.loading-status').textContent = 'Error';
        document.querySelector('.loading-text').textContent = error.message;
    }
}

function showTokenGuide() {
    window.open('https://discord.com/developers/docs/topics/oauth2#bot-scope', '_blank');
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
    try {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content settings-panel">
                <h2>Settings</h2>
                
                <div class="settings-section">
                    <h3>Bot Configuration</h3>
                    <div class="setting-item">
                        <label>Bot Token</label>
                        <div class="token-display">
                            <input type="password" id="currentToken" readonly value="${getCurrentToken() || '[No token set]'}">
                            <button onclick="editToken()" class="secondary-button">Change</button>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3>Application</h3>
                    <div class="setting-item">
                        <label>Theme</label>
                        <select id="uiMode" onchange="changeTheme(this.value)">
                            <option value="discord">Discord</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                </div>

                <div class="modal-actions">
                    <button onclick="hideModal()" class="secondary-button">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        loadCurrentToken();
        loadCurrentTheme();
        
    } catch (error) {
        console.error('Failed to open settings:', error);
        showError('Failed to open settings');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(error => {
        console.error('App initialization error:', error);
        window.ErrorHandler?.showErrorWindow(
            'Startup Error',
            error.message,
            true
        );
    });
});

function confirmRestart() {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'modal-overlay confirmation-dialog';
    confirmDialog.innerHTML = `
        <div class="modal-content confirm-box">
            <h3>⚠️ Restart Application?</h3>
            <p>Are you sure you want to restart the application?</p>
            <div class="confirm-actions">
                <button onclick="hideConfirmDialog()" class="secondary-button">Nah</button>
                <button onclick="restartApp()" class="warning-button">Do IT</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmDialog);
}

function hideConfirmDialog() {
    const dialog = document.querySelector('.confirmation-dialog');
    if (dialog) dialog.remove();
}

async function restartApp() {
    try {
        await Neutralino.app.restartProcess();
    } catch (error) {
        console.error('Failed to restart:', error);
        showError('Failed to restart application');
    }
}

function showSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content settings-panel">
            <h2>Settings</h2>
            
            <div class="settings-section">
                <h3>Bot Configuration</h3>
                <div class="setting-item">
                    <label>Bot Token</label>
                    <div class="token-display">
                        <input type="password" id="currentToken" readonly value="${getCurrentToken() || '[No token set]'}">
                        <button onclick="editToken()" class="secondary-button">Change</button>
                    </div>
                </div>
            </div>

            <div class="modal-actions">
                <button onclick="hideModal()" class="secondary-button">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function hideModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Add this helper function to get current token
function getCurrentToken() {
    try {
        const tokenInput = document.getElementById('currentToken');
        return tokenInput ? tokenInput.value : null;
    } catch (error) {
        console.error('Error getting current token:', error);
        return null;
    }
}

async function verifyResources() {
    try {
        await Neutralino.filesystem.createDirectory('assets').catch(() => {});
        const requiredAssets = [
            'assets/default-avatar.png',
            'assets/wrench.png',
            'assets/settings.png'
        ];

        for (const asset of requiredAssets) {
            try {
                await Neutralino.filesystem.getStats(asset);
            } catch (error) {
                console.warn(`Asset not found: ${asset}, using fallback`);
            }
        }
    } catch (error) {
        console.warn('Resource verification failed:', error);
        // Don't throw, let the app continue
    }
}

async function showMainWindow() {
    const loadWindow = document.getElementById('loadWindow');
    const mainWindow = document.getElementById('mainWindow');

    // Fade out loading window
    loadWindow.style.opacity = '0';
    
    // Show main window after loading fades out
    setTimeout(() => {
        loadWindow.style.display = 'none';
        mainWindow.classList.remove('hidden');
        mainWindow.style.opacity = '1';
        
        // Initialize stats updater
        updateStats();
    }, 500);
}

function updateStats() {
    // Update every second
    setInterval(() => {
        if (botData?.online) {
            const now = Date.now();
            const uptime = now - startTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            
            document.getElementById('uptime').textContent = 
                `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            document.getElementById('serverCount').textContent = botData.servers || '0';
            document.getElementById('commandCount').textContent = botData.commands || '0';
        }
    }, 1000);
}

// Modify initApp to use the new transition
async function initApp() {
    try {
        await Neutralino.init();
        
        // Update through each loading stage
        for (const stage of LOADING_STAGES) {
            await updateLoadingStage(stage);
            
            // Perform actual work for each stage
            switch (stage.progress) {
                case 0:
                    // Initialize basics
                    break;
                case 20:
                    await preloadResources();
                    break;
                case 40:
                    await window.AssetManager.initialize();
                    break;
                case 60:
                    await setupUI();
                    break;
                case 80:
                    // Configure bot services
                    break;
                case 100:
                    // Final setup complete
                    break;
            }
        }

        // Show main window after loading completes
        setTimeout(() => {
            const loadWindow = document.getElementById('loadWindow');
            const mainWindow = document.getElementById('mainWindow');
            
            if (loadWindow) loadWindow.style.opacity = '0';
            if (mainWindow) {
                mainWindow.classList.remove('hidden');
                mainWindow.style.opacity = '1';
            }
            
            setTimeout(() => {
                if (loadWindow) loadWindow.style.display = 'none';
            }, 500);
        }, 1000);

    } catch (error) {
        console.error('Initialization error:', error);
        document.querySelector('.loading-status').textContent = 'Error';
        document.querySelector('.loading-text').textContent = error.message;
    }
}
