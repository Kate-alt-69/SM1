import fs from 'fs';
import path from 'path';
import { commandsJsonPath, cmdPath, bcodePath } from '../defined/path-define.js';

const snapshotDir = path.join(bcodePath, 'config', 'cmd_snapshots');

function ensureSnapshotDir() {
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }
}

function getDateString() {
  return new Date().toISOString().split('T')[0];
}

function cleanupOldSnapshots() {
  const files = fs.readdirSync(snapshotDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => fs.statSync(path.join(snapshotDir, a)).mtimeMs - fs.statSync(path.join(snapshotDir, b)).mtimeMs);

  while (files.length > 5) {
    const oldest = files.shift();
    fs.unlinkSync(path.join(snapshotDir, oldest));
  }
}

function snapshotCommandsJson() {
  ensureSnapshotDir();
  const dateString = getDateString();
  const snapshotPath = path.join(snapshotDir, `commands_${dateString}.json`);
  if (!fs.existsSync(snapshotPath)) {
    fs.copyFileSync(commandsJsonPath, snapshotPath);
    cleanupOldSnapshots();
    console.log(`[CMD] 📦 Snapshot created: ${snapshotPath}`);
  }
}

function createCommandsJson(force = false) {
  if (fs.existsSync(commandsJsonPath)) {
    if (force) snapshotCommandsJson();
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
    commandsJson[parentCommand] = {};

    const subMatches = [...fileContent.matchAll(/\.addSubcommand\([\s\S]*?\.setName\(['"](.+?)['"]\)/g)];

    if (subMatches.length > 0) {
      subMatches.forEach((match) => {
        const sub = match[1];
        commandsJson[parentCommand][`${parentCommand}.${sub}`] = true;
      });
    } else {
      commandsJson[parentCommand][parentCommand] = true;
    }
  });

  fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
  console.log('[CMD] ✅ commands.json file created successfully!');
  snapshotCommandsJson();
}

function toggleCommand(commandName) {
  const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));

  if (commandsJson[commandName]) {
    delete commandsJson[commandName];
    console.log(`[CMD] ❌ Command "${commandName}" disabled.`);
  } else {
    commandsJson[commandName] = { [commandName]: true };
    console.log(`[CMD] ✅ Command "${commandName}" enabled.`);
  }

  fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
  snapshotCommandsJson();
}

function listTogglableCommands() {
  const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));
  console.log('[CMD] 📋 Currently toggled commands:');
  for (const parent in commandsJson) {
    for (const sub in commandsJson[parent]) {
      console.log(`- ${sub}`);
    }
  }
}

function enableCommand(name) {
  const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));
  if (!commandsJson[name]) commandsJson[name] = {};
  commandsJson[name][name] = true;
  fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
  console.log(`[CMD] ✅ Command "${name}" enabled.`);
}

function disableCommand(name) {
  const commandsJson = JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'));
  if (commandsJson[name]) delete commandsJson[name];
  fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
  console.log(`[CMD] ❌ Command "${name}" disabled.`);
}

function regenerateCommandJson() {
  createCommandsJson(true);
}

function deleteSnapshots() {
  if (fs.existsSync(snapshotDir)) {
    const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      fs.unlinkSync(path.join(snapshotDir, file));
    }
    console.log('[CMD] 🗑 All snapshots deleted.');
  }
}

function listSnapshots() {
  if (!fs.existsSync(snapshotDir)) return console.log('[CMD] No snapshot directory found.');
  const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return console.log('[CMD] No snapshots found.');
  console.log('[CMD] 📂 Snapshots:');
  files.forEach(f => console.log(`- ${f}`));
}

function takeSnapshot() {
  snapshotCommandsJson();
}

function rollbackSnapshot(snapshotName) {
  const snapshotPath = path.join(snapshotDir, snapshotName);
  if (!fs.existsSync(snapshotPath)) {
    console.log(`[CMD] ❌ Snapshot "${snapshotName}" not found.`);
    return;
  }
  fs.copyFileSync(snapshotPath, commandsJsonPath);
  console.log(`[CMD] 🔁 Rolled back to snapshot: ${snapshotName}`);
}
export {
  createCommandsJson,
  toggleCommand,
  listTogglableCommands,
  enableCommand,
  disableCommand,
  regenerateCommandJson,
  deleteSnapshots,
  listSnapshots,
  takeSnapshot,
  rollbackSnapshot
};