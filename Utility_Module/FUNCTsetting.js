//````````````````````````````|
// START FUNCTsetting.js       |
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,|

import fs from 'fs';
import path from 'path';
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
