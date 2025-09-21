import fs from 'fs';
import path from 'path';
import { commandsJsonPath, cmdPath, bcodePath } from '../defined/path-define.js';

const snapshotDir = path.join(bcodePath, 'config', 'cmd_snapshots');
const isLogicOrNonJs = (filename) => {
  const lower = filename.toLowerCase();
  return !lower.endsWith('.js') || lower.includes('logic');
};

const readFileSafe = (p) => {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
};

const parseSlashCommands = (source) => {
  if (!source) return [];
  const parents = [...source.matchAll(/new\s+SlashCommandBuilder\(\)[\s\S]*?\.setName\(['"](.+?)['"]\)/g)].map(m => m[1]);
  if (!parents.length) return [];
  const subs = [...source.matchAll(/\.addSubcommand\([\s\S]*?\.setName\(['"](.+?)['"]\)/g)].map(m => m[1]);

  const out = new Set();
  for (const parent of parents) {
    if (subs.length) subs.forEach(s => out.add(`${parent}.${s}`));
    else out.add(parent);
  }
  return [...out];
};
const scanCommandsTree = (rootDir) => {
  const folderCommands = new Map();
  const importantFolders = new Set();

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(rootDir, ent.name);

    if (ent.isDirectory()) {
      const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      let subHasCommand = false;
      for (const subEnt of subEntries) {
        if (subEnt.isFile() && !isLogicOrNonJs(subEnt.name)) {
          const src = readFileSafe(path.join(fullPath, subEnt.name));
          const cmds = parseSlashCommands(src);
          if (cmds.length) {
            const folderKey = ent.name;
            if (!folderCommands.has(folderKey)) folderCommands.set(folderKey, new Set());
            cmds.forEach(c => folderCommands.get(folderKey).add(c));
            importantFolders.add(folderKey);
            subHasCommand = true;
          }
        }
      }
      if (subHasCommand) continue;
    }

    if (ent.isFile() && !isLogicOrNonJs(ent.name)) {
      const src = readFileSafe(fullPath);
      const cmds = parseSlashCommands(src);
      if (cmds.length) {
        if (!folderCommands.has('')) folderCommands.set('', new Set());
        cmds.forEach(c => folderCommands.get('').add(c));
      }
    }
  }

  return { folderCommands, importantFolders };
};

const serializeFolderMap = (folderCommands) => {
  const obj = {};
  for (const [k, set] of folderCommands.entries()) {
    if (k === '') continue;
    obj[k] = Array.from(set).sort();
  }
  return obj;
};  
class CommandToggleManager {
  static get commands() {
    return fs.existsSync(commandsJsonPath)
      ? JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'))
      : {};
  }

  static saveCommands(data) {
    fs.writeFileSync(commandsJsonPath, JSON.stringify(data, null, 2));
  }

  static ensureSnapshotDir() {
    if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
  }

  static snapshotCommandsJson() {
    this.ensureSnapshotDir();
    const file = `commands_${new Date().toISOString().split('T')[0]}.json`;
    const target = path.join(snapshotDir, file);
    if (!fs.existsSync(target) && fs.existsSync(commandsJsonPath)) {
      fs.copyFileSync(commandsJsonPath, target);
      this.cleanupOldSnapshots();
      console.log(`[CMD] 📦 Snapshot created: ${file}`);
    }
  }

  static cleanupOldSnapshots() {
    if (!fs.existsSync(snapshotDir)) return;
    const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'))
      .sort((a, b) => fs.statSync(path.join(snapshotDir, a)).mtimeMs - fs.statSync(path.join(snapshotDir, b)).mtimeMs);
    while (files.length > 5) fs.unlinkSync(path.join(snapshotDir, files.shift()));
  }

  static createCommandsJson(force = false) {
    if (fs.existsSync(commandsJsonPath) && force) {
      this.snapshotCommandsJson();
      fs.unlinkSync(commandsJsonPath);
    }

    const previous = fs.existsSync(commandsJsonPath)
      ? JSON.parse(fs.readFileSync(commandsJsonPath, 'utf8'))
      : {};

    const { folderCommands, importantFolders } = scanCommandsTree(cmdPath);

    const out = {};
    const foldersMeta = serializeFolderMap(folderCommands);
    out['__folders'] = foldersMeta;

    for (const folderKey of importantFolders) {
      const folderToggleKey = `${folderKey}.folder`;
      out[folderToggleKey] = Object.prototype.hasOwnProperty.call(previous, folderToggleKey)
        ? previous[folderToggleKey]
        : true;
    }

    for (const [folderKey, cmdsSet] of folderCommands.entries()) {
      for (const cmdKey of cmdsSet) {
        out[cmdKey] = Object.prototype.hasOwnProperty.call(previous, cmdKey)
          ? previous[cmdKey]
          : true;
      }
    }

    for (const [k, v] of Object.entries(previous)) {
      if (!(k in out) && k !== '__folders') out[k] = v;
    }

    this.saveCommands(out);
    console.log('[CMD] ✅ commands.json generated (child folder only; states preserved).');
    this.snapshotCommandsJson();
  }

  static parseKey(input) {
    if (!input) return { folder: null, key: null };
    if (input.includes('>')) {
      const [folderSpec, rawKey] = input.split('>', 2);
      return { folder: folderSpec.trim(), key: rawKey.trim() };
    }
    return { folder: null, key: input.trim() };
  }

  static toggleCommand(raw) {
    const data = this.commands;
    const { folder, key } = this.parseKey(raw);

    if (!folder && key.endsWith('.folder')) {
      if (!(key in data)) return console.log(`[CMD] ⚠️ Folder toggle not found: ${key}`);
      data[key] = !data[key];
      this.saveCommands(data);
      console.log(`[CMD] ${data[key] ? '✅ Enabled' : '❌ Disabled'}: ${key}`);
      this.snapshotCommandsJson();
      return;
    }

    if (folder) {
      const foldersMeta = data['__folders'] || {};
      if (!foldersMeta[folder] || !foldersMeta[folder].includes(key)) return console.log(`[CMD] ⚠️ Not found: ${folder}>${key}`);
      data[key] = !data[key];
      this.saveCommands(data);
      console.log(`[CMD] ${data[key] ? '✅ Enabled' : '❌ Disabled'}: ${folder}>${key}`);
      this.snapshotCommandsJson();
      return;
    }

    if (!(key in data)) return console.log(`[CMD] ⚠️ Command not found: ${key}`);
    data[key] = !data[key];
    this.saveCommands(data);
    console.log(`[CMD] ${data[key] ? '✅ Enabled' : '❌ Disabled'}: ${key}`);
    this.snapshotCommandsJson();
  }

  static enableCommand(raw) {
    const data = this.commands;
    const { folder, key } = this.parseKey(raw);

    if (!folder && key.endsWith('.folder')) {
      if (!(key in data)) return console.log(`[CMD] ⚠️ Folder toggle not found: ${key}`);
      data[key] = true;
      this.saveCommands(data);
      console.log(`[CMD] ✅ Enabled: ${key}`);
      return;
    }

    if (folder) {
      const foldersMeta = data['__folders'] || {};
      if (!foldersMeta[folder] || !foldersMeta[folder].includes(key)) return console.log(`[CMD] ⚠️ Not found: ${folder}>${key}`);
      data[key] = true;
      this.saveCommands(data);
      console.log(`[CMD] ✅ Enabled: ${folder}>${key}`);
      return;
    }

    if (!(key in data)) return console.log(`[CMD] ⚠️ Not found: ${key}`);
    data[key] = true;
    this.saveCommands(data);
    console.log(`[CMD] ✅ Enabled: ${key}`);
  }

  static disableCommand(raw) {
    const data = this.commands;
    const { folder, key } = this.parseKey(raw);

    if (!folder && key.endsWith('.folder')) {
      if (!(key in data)) return console.log(`[CMD] ⚠️ Folder toggle not found: ${key}`);
      data[key] = false;
      this.saveCommands(data);
      console.log(`[CMD] ❌ Disabled: ${key}`);
      return;
    }

    if (folder) {
      const foldersMeta = data['__folders'] || {};
      if (!foldersMeta[folder] || !foldersMeta[folder].includes(key)) return console.log(`[CMD] ⚠️ Not found: ${folder}>${key}`);
      data[key] = false;
      this.saveCommands(data);
      console.log(`[CMD] ❌ Disabled: ${folder}>${key}`);
      return;
    }

    if (!(key in data)) return console.log(`[CMD] ⚠️ Not found: ${key}`);
    data[key] = false;
    this.saveCommands(data);
    console.log(`[CMD] ❌ Disabled: ${key}`);
  }

  static listTogglableCommands() {
    const data = this.commands;
    const foldersMeta = data['__folders'] || {};
    const folderNames = Object.keys(foldersMeta).sort();

    console.log('[CMD] 📋 Togglable Commands:');
    for (const folder of folderNames) {
      const folderToggleKey = `${folder}.folder`;
      const ft = folderToggleKey in data ? data[folderToggleKey] : true;
      console.log(`${folder}.folder = ${ft}`);
      const cmds = [...foldersMeta[folder]].sort();
      for (const c of cmds) console.log(`  ${c} = ${c in data ? data[c] : true}`);
    }

    const inAnyFolder = new Set(Object.values(foldersMeta).flat());
    const rootKeys = Object.keys(data)
      .filter(k => k !== '__folders' && !k.endsWith('.folder') && !inAnyFolder.has(k))
      .sort();

    if (rootKeys.length) {
      console.log('root.folder = true');
      rootKeys.forEach(k => console.log(`  ${k} = ${data[k]}`));
    }
  }

  static regenerateCommandJson() { this.createCommandsJson(true); }
  static deleteSnapshots() {
    if (!fs.existsSync(snapshotDir)) return;
    fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json')).forEach(f =>
      fs.unlinkSync(path.join(snapshotDir, f))
    );
    console.log('[CMD] 🗑 Snapshots deleted.');
  }

  static listSnapshots() {
    if (!fs.existsSync(snapshotDir)) return console.log('[CMD] No snapshot directory.');
    const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'));
    if (!files.length) return console.log('[CMD] No snapshots found.');
    console.log('[CMD] 📂 Snapshots:'); files.forEach(f => console.log(`- ${f}`));
  }

  static rollbackSnapshot(name) {
    const target = path.join(snapshotDir, name);
    if (!fs.existsSync(target)) return console.log(`[CMD] ❌ Not found: ${name}`);
    fs.copyFileSync(target, commandsJsonPath);
    console.log(`[CMD] 🔁 Rolled back to: ${name}`);
  }

  static takeSnapshot() { this.snapshotCommandsJson(); }

  static toggleHelp() {
    const commands = [
      { command: '# toggle list', info: 'List toggle-able commands (grouped by folder first)' },
      { command: '# toggle on <cmd>', info: 'Enable a command, e.g., "embed.manager" or "embed>embed.manager"' },
      { command: '# toggle off <cmd>', info: 'Disable a command, e.g., "embed.manager" or "embed>embed.manager"' },
      { command: '# toggle on <folder>.folder', info: 'Enable all commands under a folder at registration time' },
      { command: '# toggle off <folder>.folder', info: 'Disable an entire folder group at registration time' },
      { command: '# toggle update', info: 'Rescan command tree and regenerate commands.json' },
      { command: '# toggle cleanup', info: 'Delete all snapshots' },
      { command: '# toggle snapshot', info: 'Take a snapshot of commands.json' },
      { command: '# toggle rollback list', info: 'List all snapshots' },
      { command: '# toggle rollback <file>', info: 'Rollback to a snapshot file' },
      { command: '# toggle help', info: 'Show this help menu' }
    ];

    console.log('\n┌─────────┬──────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ (index) │ Command                              │ Description                                                                        │');
    console.log('├─────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤');
    commands.forEach((cmd, index) => {
      const idx = String(index).padEnd(7);
      const cmdText = cmd.command.padEnd(36);
      const infoText = cmd.info.padEnd(82);
      console.log(`│ ${idx} │ ${cmdText} │ ${infoText} │`);
    });
    console.log('└─────────┴──────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────┘');
  }
}

export default CommandToggleManager;
