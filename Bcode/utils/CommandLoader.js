// ==========================================================================
// CommandLoader.js — Loads commands, writes summary (CLOAD.json) + debug log
// ==========================================================================
'use strict';

const fs = require('fs');
const path = require('path');

// --------------------------------------------------------------------------
// JSON helpers with atomic write
// --------------------------------------------------------------------------
function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// --------------------------------------------------------------------------
// Require cache clearing
// --------------------------------------------------------------------------
function clearRequireCache(modulePath) {
  const resolved = require.resolve(modulePath);
  const visited = new Set();
  (function dfs(modId) {
    if (!require.cache[modId] || visited.has(modId)) return;
    visited.add(modId);
    const mod = require.cache[modId];
    for (const child of mod.children) dfs(child.id);
    delete require.cache[modId];
  })(resolved);
}

// --------------------------------------------------------------------------
// Walk a directory recursively for .js files
// --------------------------------------------------------------------------
function walkDir(dir, exts = ['.js', '.cjs', '.mjs']) {
  const out = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (exts.includes(path.extname(ent.name))) out.push(full);
    }
  })(dir);
  return out;
}

// --------------------------------------------------------------------------
// Extract parent/child relationships from SlashCommandBuilder
// --------------------------------------------------------------------------
function extractRelationships(commandExport) {
  const parents = [];
  const children = [];
  const asArray = Array.isArray(commandExport) ? commandExport : [commandExport];
  for (const cmd of asArray) {
    if (!cmd) continue;
    const name = cmd?.data?.name || cmd?.name;
    if (!name) continue;
    const options = cmd?.data?.options || [];
    const subcommands = options.filter(o => o.type === 1); // subcommand
    const groups = options.filter(o => o.type === 2); // group
    if (subcommands.length > 0 || groups.length > 0) {
      parents.push(name);
      for (const s of subcommands) children.push({ parent: name, name: s.name });
      for (const g of groups) {
        if (Array.isArray(g.options)) {
          for (const sc of g.options.filter(o => o.type === 1)) {
            children.push({ parent: `${name} ${g.name}`, name: sc.name });
          }
        }
      }
    } else {
      children.push({ parent: null, name });
    }
  }
  return { parents: Array.from(new Set(parents)), children };
}

// --------------------------------------------------------------------------
// Apply command toggles from commands.json
// --------------------------------------------------------------------------
function applyToggles(commands, toggles) {
  if (!toggles || typeof toggles !== 'object') return commands;
  return commands.filter(c => {
    const key = c.data?.name || c.name;
    return toggles[key]?.enabled !== false;
  });
}

// --------------------------------------------------------------------------
// CommandLoader
// --------------------------------------------------------------------------
class CommandLoader {
  constructor(client, opts = {}) {
    this.client = client;
    this.baseDir = opts.baseDir || path.resolve(__dirname, '..');
    this.paths = {
      commandsDir: path.join(this.baseDir, 'commands'),
      clogDir: path.join(this.baseDir, 'Clog'),
      configDir: path.join(this.baseDir, 'config'),
      cloadJson: path.join(this.baseDir, 'config', 'CLOAD.json'),
      togglesJson: path.join(this.baseDir, 'config', 'commands.json'),
    };
    if (!fs.existsSync(this.paths.clogDir)) fs.mkdirSync(this.paths.clogDir, { recursive: true });
    if (!fs.existsSync(this.paths.configDir)) fs.mkdirSync(this.paths.configDir, { recursive: true });
  }

  async loadAll() {
    const files = walkDir(this.paths.commandsDir);
    const toggleMap = readJsonSafe(this.paths.togglesJson, {});

    const logs = [];
    const perFile = {};
    const tree = {};
    const loadedCommands = [];
    let disabledCount = 0;
    let logicalCount = 0;

    for (const absPath of files) {
      const relPath = path.relative(this.baseDir, absPath).replace(/\\/g, '/');
      const baseName = path.basename(relPath);

      // logical files start with `--`
      if (baseName.startsWith('--')) {
        logicalCount++;
        continue;
      }

      try {
        clearRequireCache(absPath);
        const mod = require(absPath);
        const exported = mod?.default ?? mod;
        const candidates = Array.isArray(exported) ? exported : [exported];
        const commandsFromFile = [];
        for (const c of candidates) {
          if (!c) continue;
          const name = c?.data?.name || c?.name;
          if (name) commandsFromFile.push(c);
        }
        const toggled = applyToggles(commandsFromFile, toggleMap);
        disabledCount += (commandsFromFile.length - toggled.length);
        if (toggled.length === 0) {
          perFile[relPath] = [];
          continue;
        }
        const rel = extractRelationships(toggled);
        for (const p of rel.parents) tree[p] = tree[p] || [];
        for (const { parent, name } of rel.children) {
          if (parent) {
            tree[parent] = tree[parent] || [];
            if (!tree[parent].includes(name)) tree[parent].push(name);
          }
        }

        for (const cmd of toggled) {
          loadedCommands.push(cmd);
        }

        perFile[relPath] = toggled.map(c => c?.data?.name || c?.name).filter(Boolean);
      } catch (err) {
        logs.push(`[ERROR] ${relPath}: ${err.message}`);
      }
    }

    // build REST payload
    const appCommands = loadedCommands
      .map(c => (c?.data?.toJSON ? c.data.toJSON() : c?.data || c))
      .filter(Boolean);

    try {
      if (!this.client?.application) throw new Error('client.application not ready');
      if (process.env.GUILD_ID) {
        await this.client.application.commands.set(appCommands, process.env.GUILD_ID);
      } else {
        await this.client.application.commands.set(appCommands);
      }
    } catch (err) {
      logs.push(`[REGISTER-ERROR] ${err.message}`);
    }

    // build summary object
    const summary = {
      loaded: {
        commandfile: Object.keys(perFile).length,
        commands: loadedCommands.length,
        childcommands: Object.values(tree).reduce((a, b) => a + b.length, 0),
        commandgroups: new Set(files.map(f => path.dirname(f))).size - 1, // minus root
        commanddisable: disabledCount,
        commandstotal: loadedCommands.length + disabledCount,
        logicfiles: logicalCount,
      },
    };

    writeJsonAtomic(this.paths.cloadJson, summary);

    // write human-readable debug log
    const txtLines = [];
    txtLines.push(`== Command Load Report ==`);
    txtLines.push(`Updated: ${new Date().toISOString()}`);
    txtLines.push('');
    txtLines.push(`Totals: files=${summary.loaded.commandfile}, commands=${summary.loaded.commands}, parents=${Object.keys(tree).length}, children=${summary.loaded.childcommands}, logical=${logicalCount}, disabled=${disabledCount}`);
    txtLines.push('');

    txtLines.push('By File:');
    for (const [file, list] of Object.entries(perFile).sort()) {
      txtLines.push(`- ${file}`);
      if (list.length === 0) txtLines.push('  (no enabled commands)');
      for (const name of list) txtLines.push(`  • ${name}`);
    }

    txtLines.push('');
    txtLines.push('Parent → Children:');
    const parents = Object.keys(tree).sort();
    if (parents.length === 0) txtLines.push('(none)');
    for (const p of parents) {
      const kids = tree[p];
      if (kids.length === 0) continue;
      txtLines.push(`- ${p}`);
      for (const c of kids) txtLines.push(`  • ${c}`);
    }

    if (logs.length) {
      txtLines.push('');
      txtLines.push('Errors/Warnings:');
      for (const l of logs) txtLines.push(`- ${l}`);
    }

    const logFile = path.join(this.paths.clogDir, `command_load_${Date.now()}.txt`);
    fs.writeFileSync(logFile, txtLines.join('\n'), 'utf8');

    return { count: appCommands.length, logFile, cloadJson: this.paths.cloadJson };
  }
}
module.exports = { CommandLoader };