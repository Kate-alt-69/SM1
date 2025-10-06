#!/usr/bin/env node

/**
 * SM1 Installer - Single File Electron-Based Installer
 * -----------------------------------------------------
 * Features:
 * - Step-by-step UI (auto theme detection)
 * - Node.js version check (>= v20)
 * - Downloads & runs Node.js 22.x installer if missing/outdated
 * - Copies project files excluding node_modules
 * - Runs npm install in SM1/, SM1/SM1/, and SM1/SM1/Bcode/
 * - Compatible with pkg for .exe/.deb/.app packaging
 */

const { app, BrowserWindow, dialog, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { exec, execSync, spawn } = require('child_process');
const fetch = require('node-fetch');

let mainWindow;

// ---------- Utility Functions ----------
async function checkNodeVersion() {
  try {
    const version = execSync('node -v').toString().trim();
    const vnum = parseInt(version.replace('v', '').split('.')[0]);
    return { exists: true, version, major: vnum };
  } catch {
    return { exists: false, version: null, major: 0 };
  }
}

async function downloadNodeInstaller(platform, dest) {
  let url = '';
  if (platform === 'win32') url = 'https://nodejs.org/dist/latest-v22.x/node-v22.9.0-x64.msi';
  else if (platform === 'darwin') url = 'https://nodejs.org/dist/latest-v22.x/node-v22.9.0.pkg';
  else url = 'https://nodejs.org/dist/latest-v22.x/node-v22.9.0-linux-x64.tar.xz';

  const res = await fetch(url);
  const filePath = path.join(dest, path.basename(url));
  const fileStream = fs.createWriteStream(filePath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  return filePath;
}

async function copyFiles(srcDir, destDir) {
  await fs.copy(srcDir, destDir, {
    filter: (src) => !src.includes('node_modules')
  });
}

async function runNpmInstall(targetDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['install'], { cwd: targetDir, shell: true });
    proc.stdout.on('data', (d) => mainWindow.webContents.send('log', d.toString()));
    proc.stderr.on('data', (d) => mainWindow.webContents.send('log', d.toString()));
    proc.on('close', (code) => (code === 0 ? resolve() : reject()));
  });
}

// ---------- Electron UI ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 520,
    resizable: false,
    title: "SM1 Installer",
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  loadStep("welcome");
}

function loadStep(step) {
  const pages = {
    welcome: buildStepHTML(
      "Welcome to SM1 Installer",
      "This installer will guide you through setting up SM1. It will copy files, verify Node.js, and install dependencies.",
      "Let's Begin",
      "select-destination"
    ),
    "select-destination": buildStepHTML(
      "Please Select a Location to Install the Package",
      "This will install the package to a location of your choice via your file manager or explorer.",
      "Select Location",
      "choose-location"
    ),
    "checking-node": buildStepHTML(
      "Checking for Node.js Installation",
      "Please wait while we check if Node.js 22.x is installed.",
      "Continue",
      "check-node"
    ),
    "installing": buildStepHTML(
      "Installing SM1 Package",
      "Please wait while the installation completes...",
      "Installing...",
      "start-install"
    ),
    "complete": buildStepHTML(
      "Installation Done",
      "You can now close this window and start using SM1.",
      "Close Installer",
      "exit"
    )
  };

  mainWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(pages[step] || pages.welcome)
  );
}
// Continue from Part 1
app.whenReady().then(createWindow);

// --------------- IPC Step Flow ---------------
let installDir = null;
ipcMain.on('next-step', async (event, step) => {
  switch (step) {
    case "select-destination":
      loadStep("select-destination");
      break;

    case "choose-location":
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"]
      });
      if (!result.canceled && result.filePaths.length > 0) {
        installDir = result.filePaths[0];
        loadStep("checking-node");
        setTimeout(() => checkNodeFlow(), 1000);
      }
      break;

    case "check-node":
      loadStep("checking-node");
      await checkNodeFlow();
      break;

    case "start-install":
      loadStep("installing");
      await beginInstallation();
      break;

    case "exit":
      app.quit();
      break;

    default:
      loadStep("welcome");
  }
});
// --------------- Node.js Check Flow ---------------
async function checkNodeFlow() {
  mainWindow.webContents.send('log', 'Checking Node.js installation...');
  const node = await checkNodeVersion();
  if (!node.exists) {
    await promptNodeInstall("Node.js is not installed. Would you like to install Node.js 22.x LTS?");
  } else if (node.major < 20) {
    await promptNodeInstall(`You have Node.js ${node.version}. Update to Node.js 22.x for best performance?`);
  } else {
    mainWindow.webContents.send('progress', 25);
    beginInstallation();
  }
}

async function promptNodeInstall(message) {
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Node.js Required',
    message,
    buttons: ['Yes, install Node.js', 'No, continue anyway']
  });
  if (choice.response === 0) {
    try {
      mainWindow.webContents.send('log', 'Downloading Node.js installer...');
      const installerPath = await downloadNodeInstaller(os.platform(), os.tmpdir());
      mainWindow.webContents.send('log', `Downloaded installer: ${installerPath}`);
      installNode(installerPath);
    } catch (err) {
      mainWindow.webContents.send('log', 'Node.js download failed: ' + err.message);
      warnContinue();
    }
  } else {
    warnContinue();
  }
}

async function installNode(installerPath) {
  const platform = os.platform();
  mainWindow.webContents.send('log', 'Running Node.js installer...');
  try {
    if (platform === 'win32') {
      exec(`msiexec /i "${installerPath}" /passive`, (e) => afterNodeInstall(e));
    } else if (platform === 'darwin') {
      exec(`sudo installer -pkg "${installerPath}" -target /`, (e) => afterNodeInstall(e));
    } else {
      exec(`sudo tar -xJf "${installerPath}" -C /usr/local --strip-components=1`, (e) => afterNodeInstall(e));
    }
  } catch (e) {
    mainWindow.webContents.send('log', 'Installer launch failed: ' + e.message);
    warnContinue();
  }
}

function afterNodeInstall(err) {
  if (err) {
    mainWindow.webContents.send('log', 'Node.js installation failed or aborted.');
    warnContinue();
  } else {
    mainWindow.webContents.send('log', 'Node.js installed successfully!');
    beginInstallation();
  }
}

function warnContinue() {
  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Continue Without Node.js 22',
    message: 'Using outdated or missing Node.js may affect performance or prevent SM1 from running properly.',
    buttons: ['I understand, continue']
  }).then(() => beginInstallation());
}

// --------------- Installation Process ---------------
async function beginInstallation() {
  try {
    mainWindow.webContents.send('log', 'Starting SM1 installation...');
    const src = path.resolve(process.cwd(), 'SM1');
    const dest = path.join(installDir, 'SM1');
    mainWindow.webContents.send('log', 'Copying files (excluding node_modules)...');
    await copyFiles(src, dest);
    mainWindow.webContents.send('log', 'Files copied successfully.');
    await installDependencies(dest);
  } catch (e) {
    mainWindow.webContents.send('log', 'Error during installation: ' + e.message);
  }
}

async function installDependencies(baseDir) {
  const targets = [
    baseDir,
    path.join(baseDir, 'SM1'),
    path.join(baseDir, 'SM1', 'Bcode')
  ];
  for (const dir of targets) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'package.json'))) {
      mainWindow.webContents.send('log', `Installing npm packages in ${dir}...`);
      await runNpmInstall(dir);
    } else {
      mainWindow.webContents.send('log', `Skipping ${dir} (no package.json found).`);
    }
  }
  finishScreen();
}

// --------------- Completion UI ---------------
function finishScreen() {
  loadStep("complete");
}

ipcMain.on('exit', () => app.quit());
// === UI Enhancement Layer ===
// You can optionally set a logo image path (PNG/JPG/SVG) here:
const LOGO_PATH = path.join(process.cwd(), 'sm1-logo.png'); // optional

function buildStepHTML(title, subtitle, buttonLabel, nextStep) {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  const bg = theme === 'dark'
    ? 'linear-gradient(145deg, #0d0d0d, #1a1a1a)'
    : 'linear-gradient(145deg, #fefefe, #e9e9e9)';
  const text = theme === 'dark' ? '#fff' : '#111';
  const accent = theme === 'dark' ? '#00aaff' : '#0077cc';

  return `
  <html>
  <head>
    <style>
      body {
        margin: 0;
        font-family: 'Segoe UI', Roboto, sans-serif;
        background: ${bg};
        color: ${text};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        overflow: hidden;
      }
      .card {
        background: ${theme === 'dark' ? '#1c1c1c' : '#ffffff'};
        box-shadow: 0 0 20px rgba(0,0,0,0.15);
        border-radius: 16px;
        width: 70%;
        max-width: 600px;
        padding: 2rem;
        text-align: center;
        animation: fadein 0.5s ease-in;
      }
      @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      h1 { color: ${accent}; margin-bottom: 0.5rem; }
      p { opacity: 0.85; }
      button {
        margin-top: 1.5rem;
        background: ${accent};
        border: none;
        color: white;
        padding: 0.8rem 1.8rem;
        border-radius: 10px;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      button:hover { background: ${theme === 'dark' ? '#0091dd' : '#0066aa'}; }
      .logo {
        width: 80px;
        height: 80px;
        margin-bottom: 1rem;
        border-radius: 12px;
        box-shadow: 0 0 10px rgba(0,0,0,0.25);
        object-fit: contain;
      }
      .progress {
        width: 100%;
        height: 8px;
        background: rgba(0,0,0,0.1);
        border-radius: 4px;
        margin-top: 2rem;
        overflow: hidden;
      }
      .bar {
        width: 0%;
        height: 100%;
        background: ${accent};
        transition: width 0.4s ease-in-out;
      }
    </style>
  </head>
  <body>
    <div class="card">
      ${fs.existsSync(LOGO_PATH) ? `<img src="file://${LOGO_PATH}" class="logo"/>` : ''}
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <button id="next">${buttonLabel}</button>
      <div class="progress"><div class="bar" id="bar"></div></div>
    </div>
    <script>
      const { ipcRenderer } = require('electron');
      document.getElementById('next').addEventListener('click', () => ipcRenderer.send('next-step', '${nextStep}'));
      ipcRenderer.on('progress', (_, pct) => {
        document.getElementById('bar').style.width = pct + '%';
      });
    </script>
  </body>
  </html>`;
}

// Example: replace welcome HTML call in createWindow()
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 520,
    resizable: false,
    title: "SM1 Installer",
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  mainWindow.loadURL('data:text/html;charset=utf-8,' +
    encodeURIComponent(
      buildStepHTML(
        'Welcome to SM1 Installer',
        'This installer will guide you through the setup process.',
        'Let’s Begin',
        'select-destination'
      )
    )
  );
}

// Example progress emission during install:
async function beginInstallation() {
  try {
    mainWindow.webContents.send('log', 'Starting SM1 installation...');
    const src = path.resolve(process.cwd(), 'SM1');
    const dest = path.join(installDir, 'SM1');
    mainWindow.webContents.send('progress', 10);
    await copyFiles(src, dest);
    mainWindow.webContents.send('log', 'Files copied successfully.');
    mainWindow.webContents.send('progress', 50);
    await installDependencies(dest);
    mainWindow.webContents.send('progress', 100);
  } catch (e) {
    mainWindow.webContents.send('log', 'Error during installation: ' + e.message);
  }
}