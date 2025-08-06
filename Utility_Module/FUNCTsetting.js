//````````````````````````````|
// START FUNCTsetting.js       |
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,|

import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';

import { exec } from 'child_process';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';


import {
  bcodePath,
  configPath,
  commandsJsonPath,
  tokenPath,
  utilsPath,
  cmdPath,
  cmdSnapshotPath
} from '../defined/path-define.js';

import { KNchecksum } from './KNchecksum.js';

class SettingsManager {
  static checkMissingFiles() {
    const required = ['ErrorCodes.js', 'CommandExecutor.js', 'Prompt.js'];
    const missing = [];
    for (const file of required) {
      if (!fs.existsSync(path.join(utilsPath, file))) {
        missing.push(file);
      }
    }
    return missing;
  }

  static async listSettings() {
    const settings = [];
    const commands = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf-8'));

    for (const [commandName, commandData] of Object.entries(commands)) {
      settings.push({
        command: commandName,
        enabled: commandData.toggle === true
      });
    }

    return settings;
  }

  static async getBotAboutInfo() {
    const commands = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf-8'));
    const commandFiles = fs.readdirSync(cmdPath);
    const utilsFiles = fs.readdirSync(utilsPath);
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

    const enabled = Object.values(commands).filter(cmd => cmd.toggle === true).length;
    const disabled = Object.values(commands).filter(cmd => cmd.toggle === false).length;

    const censoredToken = (tok) => tok ? tok.slice(0, 4) + '********' + tok.slice(-4) : 'undefined';
    const missingUtils = this.checkMissingFiles();

    return {
      commands: {
        enabled,
        disabled,
        files: commandFiles
      },
      token: {
        saved: censoredToken(tokenData.save),
        temp: censoredToken(tokenData.temp)
      },
      health: {
        utilsFiles,
        utilsCheck: {
          present: utilsFiles.length,
          missing: missingUtils,
          missingCount: missingUtils.length
        }
      }
    };
  }

  // ✅ Updated runErrorCheck with full workflow (init + checks + start.check)
  static async runErrorCheck(callback = console.log) {
    const scriptsDir = path.join(path.resolve(), 'Utility_Module/ERE_CHK');

    const checkScripts = [
      { name: 'init.runerror.js', path: path.join(scriptsDir, 'init.runerror.js') },
      { name: 'file.check.js', path: path.join(scriptsDir, 'file.check.js') },
      { name: 'json.check.js', path: path.join(scriptsDir, 'json.check.js') },
      { name: 'currupt.check.js', path: path.join(scriptsDir, 'currupt.check.js') },
      { name: 'start.check.js', path: path.join(scriptsDir, 'start.check.js') }
    ];

    callback('[RUNERROR] 🔍 Starting full bot diagnostics with new workflow...');
    this.updateRunErrorStatus('RUNNING');

    const runNextCheck = (index) => {
      if (index >= checkScripts.length) {
        callback('[RUNERROR] ✅ All checks completed.');
        this.updateRunErrorStatus('COMPLETED');
        return;
      }

      const script = checkScripts[index];
      callback(`[CHECK] ▶ Running ${script.name}...`);

      const child = spawn('node', [script.path], { stdio: ['ignore', 'pipe', 'pipe'] });

      child.stdout.on('data', (data) => callback(data.toString().trim()));
      child.stderr.on('data', (data) => callback(`[ERROR] ${data.toString().trim()}`));

      child.on('close', (code) => {
        callback(`[CHECK] ${script.name} finished with code ${code}`);
        runNextCheck(index + 1);
      });
    };

    runNextCheck(0);
  }

  // ✅ Update STATUS field in runerror.json
  static updateRunErrorStatus(status) {
    const runErrorFile = path.join(path.resolve(), 'Utility_Module/ERE_CHK/runerror.json');
    if (!fs.existsSync(runErrorFile)) return;

    const data = JSON.parse(fs.readFileSync(runErrorFile, 'utf8'));
    data.STATUS = status;
    data.LAST_UPDATED = new Date().toISOString();
    fs.writeFileSync(runErrorFile, JSON.stringify(data, null, 4));
  }

  static async cleanUpSettings() {
    const defaultToken = { temp: null, save: null };
    fs.writeFileSync(tokenPath, JSON.stringify(defaultToken, null, 2));
    fs.writeFileSync(commandsJsonPath, JSON.stringify({}, null, 2));

    if (fs.existsSync(cmdSnapshotPath)) {
      const files = fs.readdirSync(cmdSnapshotPath);
      for (const file of files) {
        fs.unlinkSync(path.join(cmdSnapshotPath, file));
      }
    }

    return '[CLEANUP] ✅ Token, commands, and snapshots cleaned.';
  }

  static async relaunchBot(kernelPath, callback = console.log) {
    try {
      const tempFile = path.join(configPath, '_relaunch-temp.js');

      const relaunchScript = `
        const fs = require('fs');
        const path = require('path');
        const { spawn } = require('child_process');
        const pidPath = path.resolve('./Utility_Module/PID.json');

        const child = spawn('node', ['${kernelPath}'], {
          detached: true,
          stdio: 'inherit'
        });

        const pidData = fs.existsSync(pidPath) ? JSON.parse(fs.readFileSync(pidPath, 'utf8')) : {};
        pidData.kernelpid = child.pid;
        fs.writeFileSync(pidPath, JSON.stringify(pidData, null, 2));

        child.unref();
      `;

      fs.writeFileSync(tempFile, relaunchScript);

      spawn('node', [tempFile], {
        detached: true,
        stdio: 'inherit'
      }).unref();

      callback('[RELAUNCH] 🔁 Relaunching KERNEL.js with logs and detached process...');
      process.exit(0);
    } catch (err) {
      callback(`[RELAUNCH ERROR] ❌ ${err.message}`);
    }
  }

  static helpCmd() {
    console.log('\n┌─────────┬───────────────────────────┬──────────────────────────────────────────┐');
    console.log('│ (index) │ Command                   │ Description                              │');
    console.log('├─────────┼───────────────────────────┼──────────────────────────────────────────┤');
    console.log('│ 0       │ # setting list            │ Show all settings and their status       │');
    console.log('│ 1       │ # setting about           │ Display bot metadata and configuration   │');
    console.log('│ 2       │ # setting runerror        │ Run syntax and config validation checks  │');
    console.log('│ 3       │ # setting cleanup         │ Reset tokens and clean settings          │');
    console.log('│ 4       │ # setting relaunch        │ Restart the bot process safely           │');
    console.log('│ 5       │ # setting help            │ Show this help menu                      │');
    console.log('└─────────┴───────────────────────────┴──────────────────────────────────────────┘\n');
  }
}

export default SettingsManager;
import { KNchecksum} from "./KNchecksum.js";

function checkMissingFiles() {
  const required = [
    'ErrorCodes.js',
    'CommandExecutor.js',
    'Prompt.js'
  ];

  const missing = [];
  for (const file of required) {
    if (!fs.existsSync(path.join(utilsPath, file))) {
      missing.push(file);
    }
  }
  return missing;
}

// List all command settings from commands.json
export async function listSettings() {
  const settings = [];
  const commands = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf-8'));

  for (const [commandName, commandData] of Object.entries(commands)) {
    settings.push({
      command: commandName,
      enabled: commandData.toggle === true
    });
  }

  return settings;
}

// Display bot metadata, structure status, and token info
export async function getBotAboutInfo() {
  const commands = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf-8'));
  const commandFiles = fs.readdirSync(cmdPath);
  const utilsFiles = fs.readdirSync(utilsPath);
  const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

  const enabled = Object.values(commands).filter(cmd => cmd.toggle === true).length;
  const disabled = Object.values(commands).filter(cmd => cmd.toggle === false).length;

  const censoredToken = (tok) => tok ? tok.slice(0, 4) + '********' + tok.slice(-4) : 'undefined';
  const missingUtils = checkMissingFiles();

  return {
    commands: {
      enabled,
      disabled,
      files: commandFiles
    },
    token: {
      saved: censoredToken(tokenData.save),
      temp: censoredToken(tokenData.temp)
    },
    health: {
      utilsFiles,
      utilsCheck: {
        present: utilsFiles.length,
        missing: missingUtils,
        missingCount: missingUtils.length
      }
    }
  };
}

// Run full bot diagnostics using KNchecksum.js + child exec
export async function runErrorCheck(callback = console.log) {
  const mainBotFile = path.join(bcodePath, 'DCB.js');

  exec(`node ${mainBotFile}`, async (error, stdout, stderr) => {
    if (error) {
      callback('[ERROR CHECK] ❌ Error detected while executing main bot file');
      callback(`File: ${mainBotFile}`);
      callback(`Problem: ${stderr.trim() || error.message}`);
      return;
    }

    try {
    const structure = await KNchecksum.checkBcodeStructure();
    const health = {
      allFilesHealthy: true, // You can refine this logic
      errors: []
      };

      if (structure && missing.length === 0 && health.allFilesHealthy) {
        callback('[CHECK COMPLETE] ✅ No issues found.');
      } else {
        callback('[CHECK RESULTS]');
        if (missing.length > 0) {
          missing.forEach(file => callback(`Missing File: ${file}`));
        }
        health.errors.forEach(({ file, issue, line }) => {
          callback(`File: ${file}`);
          callback(`Problem: ${issue} at line ${line}`);
        });
      }
    } catch (err) {
      callback(`[CHECK ERROR] ❌ Failed to complete structure or health check: ${err.message}`);
    }
  });
}

// Reset token and commands, and clean snapshots folder
export async function cleanUpSettings() {
  const defaultToken = { temp: null, save: null };
  fs.writeFileSync(tokenPath, JSON.stringify(defaultToken, null, 2));
  fs.writeFileSync(commandsJsonPath, JSON.stringify({}, null, 2));

  if (fs.existsSync(cmdSnapshotPath)) {
    const files = fs.readdirSync(cmdSnapshotPath);
    for (const file of files) {
      fs.unlinkSync(path.join(cmdSnapshotPath, file));
    }
  }

  return '[CLEANUP] ✅ Token, commands, and snapshots cleaned.';
}

// Relaunch KERNEL.js with visible logs and persistent state
export async function relaunchBot(kernelPath, callback = console.log) {
  try {
    const tempFile = path.join(configPath, '_relaunch-temp.js');

    const relaunchScript = `
      const fs = require('fs');
      const path = require('path');
      const { spawn } = require('child_process');
      const pidPath = path.resolve('./Utility_Module/PID.json');

      const child = spawn('node', ['${kernelPath}'], {
        detached: true,
        stdio: 'inherit'
      });

      const pidData = fs.existsSync(pidPath) ? JSON.parse(fs.readFileSync(pidPath, 'utf8')) : {};
      pidData.kernelpid = child.pid;
      fs.writeFileSync(pidPath, JSON.stringify(pidData, null, 2));

      child.unref();
    `;

    fs.writeFileSync(tempFile, relaunchScript);

    spawn('node', [tempFile], {
      detached: true,
      stdio: 'inherit'
    }).unref();

    callback('[RELAUNCH] 🔁 Relaunching KERNEL.js with logs and detached process...');
    process.exit(0);
  } catch (err) {
    callback(`[RELAUNCH ERROR] ❌ ${err.message}`);
  }
}

//,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// END FUNCTsetting.js         |
//````````````````````````````|
