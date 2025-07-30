import fs from 'fs';
import path from 'path';
import { commandsJsonPath, cmdPath, bcodePath } from '../defined/path-define.js';

const snapshotDir = path.join(bcodePath, 'config', 'cmd_snapshots');

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
    if (!fs.existsSync(target)) {
      fs.copyFileSync(commandsJsonPath, target);
      this.cleanupOldSnapshots();
      console.log(`[CMD] 📦 Snapshot created: ${file}`);
    }
  }

  static cleanupOldSnapshots() {
    const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.json'))
      .sort((a, b) => fs.statSync(path.join(snapshotDir, a)).mtimeMs - fs.statSync(path.join(snapshotDir, b)).mtimeMs);
    while (files.length > 5) fs.unlinkSync(path.join(snapshotDir, files.shift()));
  }

  static createCommandsJson(force = false) {
    if (fs.existsSync(commandsJsonPath) && force) {
      this.snapshotCommandsJson();
      fs.unlinkSync(commandsJsonPath);
    }

    const commandsJson = {};
    for (const file of fs.readdirSync(cmdPath)) {
      const filePath = path.join(cmdPath, file);
      if (!file.endsWith('.js') || fs.statSync(filePath).isDirectory()) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const main = content.match(/new\s+SlashCommandBuilder\(\)[\s\S]*?\.setName\(['"](.+?)['"]\)/);
      if (!main) continue;
      const parent = main[1];
      const subs = [...content.matchAll(/\.addSubcommand\([\s\S]*?\.setName\(['"](.+?)['"]\)/g)];

      if (subs.length) subs.forEach(m => commandsJson[`${parent}.${m[1]}`] = true);
      else commandsJson[parent] = true;
    }

    this.saveCommands(commandsJson);
    console.log('[CMD] ✅ commands.json generated.');
    this.snapshotCommandsJson();
  }

  static toggleCommand(cmd) {
    const data = this.commands;
    data[cmd] = !data[cmd];
    this.saveCommands(data);
    console.log(`[CMD] ${data[cmd] ? '✅ Enabled' : '❌ Disabled'}: ${cmd}`);
    this.snapshotCommandsJson();
  }

  static enableCommand(cmd) {
    const data = this.commands;
    data[cmd] = true;
    this.saveCommands(data);
    console.log(`[CMD] ✅ Enabled: ${cmd}`);
  }

  static disableCommand(cmd) {
    const data = this.commands;
    if (data.hasOwnProperty(cmd)) {
      data[cmd] = false;
      this.saveCommands(data);
      console.log(`[CMD] ❌ Disabled: ${cmd}`);
    } else {
      console.log(`[CMD] ⚠️ Not Found: ${cmd}`);
    }
  }

  static listTogglableCommands() {
    const data = this.commands;
    const tree = {};
    for (const k in data) {
      const [p, s] = k.split('.');
      if (!tree[p]) tree[p] = [];
      if (s) tree[p].push(`${p}.${s}`);
    }

    console.log('[CMD] 📋 Togglable Commands:');
    Object.keys(tree).sort().forEach(p => {
      console.log(`- ${p}`);
      const subs = tree[p].sort();
      if (!subs.length && data[p] !== undefined) console.log(`    ${p} = ${data[p]}`);
      subs.forEach(sub => console.log(`    ${sub} = ${data[sub]}`));
    });
  }

  static regenerateCommandJson() {
    this.createCommandsJson(true);
  }

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

  static takeSnapshot() {
    this.snapshotCommandsJson();
  }

  static toggleHelp() {
    console.log('[# TOGGLE] Available # toggle Commands:\n' +
      '  # toggle list                 → List enabled commands\n' +
      '  # toggle on <cmd>            → Enable command\n' +
      '  # toggle off <cmd>           → Disable command\n' +
      '  # toggle update              → Rebuild commands.json\n' +
      '  # toggle cleanup             → Delete snapshots\n' +
      '  # toggle snapshot            → Take snapshot\n' +
      '  # toggle rollback list       → List snapshots\n' +
      '  # toggle rollback <file>     → Rollback snapshot\n' +
      '  # toggle help                → Show help');
  }
}

export default CommandToggleManager;
