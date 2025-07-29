import fs from 'fs';
import path from 'path';
import { commandsJsonPath, cmdPath, bcodePath } from '../defined/path-define.js';

const snapshotDir = path.join(bcodePath, 'config', 'cmd_snapshots');

class CommandToggleManager {
  static ensureSnapshotDir() {
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
  }

  static getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  static cleanupOldSnapshots() {
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => fs.statSync(path.join(snapshotDir, a)).mtimeMs - fs.statSync(path.join(snapshotDir, b)).mtimeMs);

    while (files.length > 5) {
      const oldest = files.shift();
      fs.unlinkSync(path.join(snapshotDir, oldest));
    }
  }

  static snapshotCommandsJson() {
    this.ensureSnapshotDir();
    const dateString = this.getDateString();
    const snapshotPath = path.join(snapshotDir, `commands_${dateString}.json`);
    if (!fs.existsSync(snapshotPath)) {
      fs.copyFileSync(commandsJsonPath, snapshotPath);
      this.cleanupOldSnapshots();
      console.log(`[CMD] 📦 Snapshot created: ${snapshotPath}`);
    }
  }

  static createCommandsJson(force = false) {
    if (fs.existsSync(commandsJsonPath)) {
      if (force) this.snapshotCommandsJson();
      fs.unlinkSync(commandsJsonPath);
      console.log('[CMD] 🗑 Existing commands.json file deleted.');
    }

    const commandsJson = {};
    const files = fs.readdirSync(cmdPath);

    files.forEach((file) => {
      const filePath = path.join(cmdPath, file);
      if (fs.statSync(filePath).isDirectory() || !file.endsWith('.js')) return;

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const mainMatch = fileContent.match(/new\s+SlashCommandBuilder\(\)[\s\S]*?\.setName\(['"](.+?)['"]\)/);
      if (!mainMatch) return;

      const parentCommand = mainMatch[1];
      const subMatches = [...fileContent.matchAll(/\.addSubcommand\([\s\S]*?\.setName\(['"](.+?)['"]\)/g)];

      if (subMatches.length > 0) {
        subMatches.forEach((match) => {
          const sub = match[1];
          commandsJson[`${parentCommand}.${sub}`] = true;
        });
      } else {
        commandsJson[parentCommand] = true;
      }
    });

    fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
    console.log('[CMD] ✅ commands.json file created successfully!');
    this.snapshotCommandsJson();
  }

  static toggleCommand(commandName) {
    const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));

    if (commandsJson[commandName]) {
      commandsJson[commandName] = false;
      console.log(`[CMD] ❌ Command "${commandName}" disabled.`);
    } else {
      commandsJson[commandName] = true;
      console.log(`[CMD] ✅ Command "${commandName}" enabled.`);
    }

    fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
    this.snapshotCommandsJson();
  }

  static listTogglableCommands() {
    const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));
    const commandTree = {};

    Object.keys(commandsJson).forEach(key => {
      const parts = key.split('.');
      const parent = parts[0];
      const sub = parts[1];

      if (!commandTree[parent]) commandTree[parent] = [];
      if (sub) commandTree[parent].push(`${parent}.${sub}`);
    });

    console.log('[CMD] 📋 Currently toggled commands:');
    const sortedParents = Object.keys(commandTree).sort();
    for (const parent of sortedParents) {
      console.log(`- ${parent}`);
      const subs = commandTree[parent].sort();
      if (subs.length === 0 && commandsJson[parent] !== undefined) {
        console.log(`    ${parent} = ${commandsJson[parent]}`);
      }
      for (const sub of subs) {
        console.log(`    ${sub} = ${commandsJson[sub]}`);
      }
    }
  }

  static enableCommand(name) {
    const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));
    commandsJson[name] = true;
    fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
    console.log(`[CMD] ✅ Command "${name}" enabled.`);
  }

  static disableCommand(name) {
    const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));
    if (commandsJson[name] !== undefined) {
      commandsJson[name] = false;
    } else {
      console.log(`[CMD] ⚠️ Command "${name}" does not exist in commands.json`);
    }
    fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
    console.log(`[CMD] ❌ Command "${name}" disabled.`);
  }

  static regenerateCommandJson() {
    this.createCommandsJson(true);
  }

  static deleteSnapshots() {
    if (fs.existsSync(snapshotDir)) {
      const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        fs.unlinkSync(path.join(snapshotDir, file));
      }
      console.log('[CMD] 🗑 All snapshots deleted.');
    }
  }

  static listSnapshots() {
    if (!fs.existsSync(snapshotDir)) return console.log('[CMD] No snapshot directory found.');
    const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) return console.log('[CMD] No snapshots found.');
    console.log('[CMD] 📂 Snapshots:');
    files.forEach(f => console.log(`- ${f}`));
  }

  static takeSnapshot() {
    this.snapshotCommandsJson();
  }

  static rollbackSnapshot(snapshotName) {
    const snapshotPath = path.join(snapshotDir, snapshotName);
    if (!fs.existsSync(snapshotPath)) {
      console.log(`[CMD] ❌ Snapshot "${snapshotName}" not found.`);
      return;
    }
    fs.copyFileSync(snapshotPath, commandsJsonPath);
    console.log(`[CMD] 🔁 Rolled back to snapshot: ${snapshotName}`);
  }

  static toggleHelp() {
    console.log('[# TOGGLE] List of Available # toggle Commands:');
    console.log('  # toggle list                 → Lists all currently enabled commands');
    console.log('  # toggle on <command.name>   → Enables a specific command');
    console.log('  # toggle off <command.name>  → Disables a specific command');
    console.log('  # toggle update              → Rebuilds commands.json from scratch');
    console.log('  # toggle cleanup             → Deletes all snapshots');
    console.log('  # toggle snapshot            → Takes a new snapshot');
    console.log('  # toggle rollback list       → Lists all available snapshots');
    console.log('  # toggle rollback <filename> → Rollback to a specific snapshot');
    console.log('  # toggle help                → Shows this help info');
  }
}

export default CommandToggleManager;
