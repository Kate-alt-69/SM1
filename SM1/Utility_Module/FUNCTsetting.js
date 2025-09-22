//````````````````````````````|
// START FUNCTsetting.js       |
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
//
// Cleaned/refactored: single source of truth is SettingsManager (class).
// Exported named thin wrappers call the class methods to preserve compatibility.
// Logs cleanup re-added: lists logs (oldest → newest) and asks user to confirm
// before deleting all listed files. Uses logsPath from path-define.js (with fallback).
// Token and commands behavior adjusted per request:
//  - token.json: only modify 'save' and 'temp' (set to "empty-token"), preserve other keys.
//  - commands.json: rebuild using FUNCTtoggle (CommandToggleManager.regenerateCommandJson()) instead of wiping.
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,|

import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import Prompt from './Prompt.js';
import {
  bcodePath,
  configPath,
  commandsJsonPath,
  tokenPath,
  utilsPath,
  cmdPath,
  cmdSnapshotPath,
  logsPath
} from '../defined/path-define.js';
import { KNchecksum } from './KNchecksum.js';
import CommandToggleManager from './FUNCTtoggle.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

  // Updated runErrorCheck with full workflow (init + checks + start.check)
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

  // Update STATUS field in runerror.json
  static updateRunErrorStatus(status) {
    const runErrorFile = path.join(path.resolve(), 'Utility_Module/ERE_CHK/runerror.json');
    if (!fs.existsSync(runErrorFile)) return;

    const data = JSON.parse(fs.readFileSync(runErrorFile, 'utf8'));
    data.STATUS = status;
    data.LAST_UPDATED = new Date().toISOString();
    fs.writeFileSync(runErrorFile, JSON.stringify(data, null, 4));
  }

    static async cleanUpSettings() {
    const defaultToken = { temp: 'empty-token', save: 'empty-token', loadtokensave: false, loadtokentemp: false };
    let operationsPerformed = [];

    console.log('=====================CLEANUP=====================');

    // Token Cleanup (temp)
    const tempConfirm = await Prompt.new({
      promptID: 'cleanup-temp-token',
      title: 'CLEANUP CONFIRMATION',
      description: 'Are you sure you want to set temp token to "empty-token" in token.json (y/n)',
      defaultValue: 'n'
    });
    if (['y', 'yes'].includes(String(tempConfirm).toLowerCase())) {
      const tokenData = fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, 'utf-8')) : { ...defaultToken };
      tokenData.temp = 'empty-token';
      fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
      operationsPerformed.push('🧹 Temp token set to "empty-token".');
    }

    // Token Cleanup (save)
    const saveConfirm = await Prompt.new({
      promptID: 'cleanup-save-token',
      title: 'CLEANUP CONFIRMATION',
      description: 'Are you sure you want to set save token to "empty-token" in token.json (y/n)',
      defaultValue: 'n'
    });
    if (['y', 'yes'].includes(String(saveConfirm).toLowerCase())) {
      const tokenData = fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, 'utf-8')) : { ...defaultToken };
      tokenData.save = 'empty-token';
      fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
      operationsPerformed.push('🧹 Save token set to "empty-token".');
    }

    // Commands Cleanup
    const commandConfirm = await Prompt.new({
      promptID: 'cleanup-commands',
      title: 'CLEANUP CONFIRMATION',
      description: 'Are you sure you want to regenerate commands.json using toggle update (y/n)',
      defaultValue: 'n'
    });
    if (['y', 'yes'].includes(String(commandConfirm).toLowerCase())) {
      try {
        CommandToggleManager.regenerateCommandJson();
        operationsPerformed.push('🧹 commands.json regenerated using FUNCTtoggle.');
      } catch (err) {
        console.error(`[CMD] Failed to regenerate commands.json: ${err.message}`);
      }
    }

    // Snapshots Cleanup
    const snapshotConfirm = await Prompt.new({
      promptID: 'cleanup-snapshots',
      title: 'CLEANUP CONFIRMATION',
      description: 'Are you sure you want to delete all snapshot files in cmd_snapshots (y/n)',
      defaultValue: 'n'
    });
    if (['y', 'yes'].includes(String(snapshotConfirm).toLowerCase()) && fs.existsSync(cmdSnapshotPath)) {
      const files = fs.readdirSync(cmdSnapshotPath);
      for (const file of files) {
        const full = path.join(cmdSnapshotPath, file);
        try {
          if (fs.statSync(full).isFile()) fs.unlinkSync(full);
        } catch (err) {
          console.warn(`[SNAPSHOT] Failed to delete ${file}: ${err.message}`);
        }
      }
      operationsPerformed.push('🧹 Snapshots deleted.');
    }

    // Logs Cleanup
    const logsDir = logsPath && typeof logsPath === 'string' && logsPath.length ? logsPath : path.join(path.resolve(), 'logs');
    if (fs.existsSync(logsDir)) {
      try {
        const logFiles = fs.readdirSync(logsDir).filter(f => fs.statSync(path.join(logsDir, f)).isFile());
        if (logFiles.length > 0) {
          console.log('\n[LOGS] Found the following log files:');
          logFiles.forEach((f, i) => console.log(`${i + 1}. ${f}`));

          const delLogsConfirm = await Prompt.new({
            promptID: 'cleanup-delete-logs',
            title: 'DELETE LOG FILES',
            description: `Delete ALL ${logFiles.length} log files listed above? (y/n)`,
            defaultValue: 'n'
          });

          if (['y', 'yes'].includes(String(delLogsConfirm).toLowerCase())) {
            for (const f of logFiles) fs.unlinkSync(path.join(logsDir, f));
            operationsPerformed.push(`🧹 ${logFiles.length} log files deleted.`);
          } else {
            console.log('[LOGs] Skipped deleting logs.');
          }
        }
      } catch (err) {
        console.error('{ERROR} Error while listing or deleting logs:', err.message);
      }
    }

    // NEW: Clog Cleanup inside Bcode
    const clogDir = path.join(bcodePath, 'Clog');
    if (fs.existsSync(clogDir)) {
      try {
        const clogFiles = fs.readdirSync(clogDir).filter(f => fs.statSync(path.join(clogDir, f)).isFile());
        if (clogFiles.length > 0) {
          console.log('\n[CLOG] Found the following Clog files:');
          clogFiles.forEach((f, i) => console.log(`${i + 1}. ${f}`));

          const delClogConfirm = await Prompt.new({
            promptID: 'cleanup-delete-clog',
            title: 'DELETE CLOG FILES',
            description: `Delete ALL ${clogFiles.length} files in Bcode/Clog? (y/n)`,
            defaultValue: 'n'
          });

          if (['y', 'yes'].includes(String(delClogConfirm).toLowerCase())) {
            for (const f of clogFiles) fs.unlinkSync(path.join(clogDir, f));
            operationsPerformed.push(`🧹 ${clogFiles.length} files deleted from Bcode/Clog.`);
          } else {
            console.log('[CLOG] Skipped deleting Clog files.');
          }
        }
      } catch (err) {
        console.error('{ERROR} Error while listing or deleting Clog files:', err.message);
      }
    }

    if (operationsPerformed.length === 0) {
      return '{ERROR} ❌ No operations performed.';
    }

    return `[CLEANUP] ✅ Done.\n` + operationsPerformed.join('\n');
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
  // Add inside SettingsManager class
  static setRamLimit(valueMb) {
    const settingsPath = path.resolve(__dirname, '../config/settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    settings.alaRAM = valueMb;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`[SETTINGS] 💾 RAM limit set to ${valueMb} MB`);
  }

  static setCpuLimit(valuePercent) {
    const settingsPath = path.resolve(__dirname, '../config/settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    settings.alaCPU = valuePercent;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`[SETTINGS] 💾 CPU limit set to ${valuePercent}%`);
  }
  static helpCmd() {
    console.log('\n┌─────────┬───────────────────────────┬────────────────────────────────────────────────────────────────┐');
    console.log('│ (index) │ Command                   │ Description                                                    │');
    console.log('├─────────┼───────────────────────────┼──────────────────────────────────────────────────────────────────┤');
    console.log('│ 0       │ # setting list            │ Show all settings and their status                               │');
    console.log('│ 1       │ # setting about           │ Display bot metadata and configuration                           │');
    console.log('│ 2       │ # setting runerror        │ Run syntax and config validation checks                          │');
    console.log('│ 3       │ # setting cleanup         │ Reset tokens and clean settings                                  │');
    console.log('│ 4       │ # setting relaunch        │ Restart the bot process safely                                   │');
    console.log('│ 5       │ # setting help            │ Show this help menu                                              │');
    console.log('│ 5       │ # setting accountdetail   │ Show Account details                                             │');
    console.log('│ 5       │ # setting accountreset    │ Reset Account and erase account data                             │');
    console.log('│ 5       │ # setting lock            │ Locks Terminal Not View-able to any without Admin Password       │');
    console.log('└─────────┴───────────────────────────┴──────────────────────────────────────────────────────────────────┘\n');
  }
}
export default SettingsManager;
/* ------------------------------------------------------------------
   Thin wrappers to preserve previous named-function exports and
   keep backward compatibility. They simply call the class methods.
   ------------------------------------------------------------------ */
export function checkMissingFiles() {
  return SettingsManager.checkMissingFiles();
} export async function listSettings() {
  return SettingsManager.listSettings();
} export async function getBotAboutInfo() {
  return SettingsManager.getBotAboutInfo();
} export async function runErrorCheck(callback = console.log) {
  return SettingsManager.runErrorCheck(callback);
} export async function cleanUpSettings() {
  return SettingsManager.cleanUpSettings();
} export async function relaunchBot(kernelPath, callback = console.log) {
  return SettingsManager.relaunchBot(kernelPath, callback);
} export function setRamLimit(valueMb) {
  return SettingsManager.setRamLimit(valueMb);
} export function setCpuLimit(valuePercent) {
  return SettingsManager.setCpuLimit(valuePercent);
}
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// END FUNCTsetting.js         |
//````````````````````````````|