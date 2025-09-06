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
// Recursive extraction of parent/child relationships
// --------------------------------------------------------------------------
function extractRelationships(commandExport) {
  const parents = [];
  const children = [];
  const asArray = Array.isArray(commandExport) ? commandExport : [commandExport];

  function recurse(base, opts) {
    if (!Array.isArray(opts)) return;
    for (const o of opts) {
      if (o.type === 1) {
        // subcommand
        children.push({ parent: base, name: o.name });
      } else if (o.type === 2) {
        // group
        recurse(`${base} ${o.name}`, o.options);
      }
    }
  }

  for (const cmd of asArray) {
    if (!cmd) continue;
    const name = cmd?.data?.name || cmd?.name;
    if (!name) continue;
    const options = cmd?.data?.options || [];
    recurse(name, options);

    if (options.some(o => o.type === 1 || o.type === 2)) {
      parents.push(name);
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

    const failures = {};
    const perFile = {};
    const loadedCommands = [];
    const tree = {};
    let disabledCount = 0;
    let logicalCount = 0;

    // track duplicates
    const nameMap = new Map();

    for (const absPath of files) {
      const baseName = path.basename(absPath);

      // logical files
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
          if (name) {
            c.__file = baseName; // attach origin file
            commandsFromFile.push(c);
          }
        }
        const toggled = applyToggles(commandsFromFile, toggleMap);
        disabledCount += (commandsFromFile.length - toggled.length);

        if (toggled.length === 0) {
          perFile[baseName] = [];
          continue;
        }

        // detect duplicates
        for (const c of toggled) {
          const name = c?.data?.name || c?.name;
          if (nameMap.has(name)) {
            failures['[DUPLICATE-NAME]'] = failures['[DUPLICATE-NAME]'] || [];
            failures['[DUPLICATE-NAME]'].push(
              `${name} from ${nameMap.get(name)} and ${c.__file}`
            );
          } else {
            nameMap.set(name, c.__file);
          }
        }

        const rel = extractRelationships(toggled);
        for (const p of rel.parents) tree[p] = tree[p] || [];
        for (const { parent, name } of rel.children) {
          if (parent) {
            tree[parent] = tree[parent] || [];
            if (!tree[parent].includes(name)) tree[parent].push(name);
          }
        }

        loadedCommands.push(...toggled);

        perFile[baseName] = rel.parents.length
          ? rel.parents.map(p => ({ parent: p, children: tree[p] || [] }))
          : toggled.map(c => ({ parent: c?.data?.name || c?.name, children: [] }));
      } catch (err) {
        failures[baseName] = failures[baseName] || [];
        failures[baseName].push(err.message);
        perFile[baseName] = null; // mark as failed
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
      failures['[REGISTER-ERROR]'] = [err.message];
    }

    // summary object
    const summary = {
      loaded: {
        commandfile: Object.keys(perFile).length,
        commands: loadedCommands.length,
        childcommands: Object.values(tree).reduce((a, b) => a + b.length, 0),
        commandgroups: new Set(files.map(f => path.dirname(f))).size - 1,
        commanddisable: disabledCount,
        commandstotal: loadedCommands.length + disabledCount,
        logicfiles: logicalCount,
      },
    };
    writeJsonAtomic(this.paths.cloadJson, summary);

    // build text log
    const lines = [];
    lines.push('=============== CommandLoader ===============');
    lines.push(`Updated: ${new Date().toISOString()} (UTC)`);
    lines.push('');
    lines.push(`Totals: files=${summary.loaded.commandfile}, commands=${summary.loaded.commands}, parents=${Object.keys(tree).length}, children=${summary.loaded.childcommands}, logical=${logicalCount}, disabled=${disabledCount}`);
    lines.push('');
    lines.push('Files:');

    for (const [file, info] of Object.entries(perFile).sort()) {
      if (info === null) {
        lines.push(`❌ ${file} -> [FAILED]`);
      } else if (info.length === 0) {
        lines.push(`✔️ ${file} -> (no enabled commands)`);
      } else {
        for (const entry of info) {
          const children = entry.children.length ? `(${entry.children.join(', ')})` : '()';
          lines.push(`✔️ ${file} -> [${entry.parent} => ${children}]`);
        }
      }
    }

    if (Object.keys(failures).length) {
      lines.push('');
      lines.push('Failures:');
      for (const [file, errs] of Object.entries(failures)) {
        lines.push(`- ${file}:`);
        for (const e of errs) lines.push(`   ❌ ${e}`);
      }
    }

    lines.push('============================================');

    const logFile = path.join(this.paths.clogDir, `command_load_${Date.now()}.txt`);
    fs.writeFileSync(logFile, lines.join('\n'), 'utf8');

    return { count: appCommands.length, logFile, cloadJson: this.paths.cloadJson };
  }
}
module.exports = { CommandLoader };