// ==========================================================================
// CommandLoader.js — Expanded version (with explicit arrays, A–Z sorting, JSON-like log format)
// ==========================================================================

const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const CLOAD_PATH = path.join(__dirname, '..', 'config', 'CLOAD.json');

class CommandLoader {
  constructor(commandsRootPath, client = null) {
    this.root = commandsRootPath || path.join(__dirname, '..', 'commands');
    this.client = client;
    this.loadedMap = new Map();
    this.clogFolder = path.join(__dirname, '..', 'Clog');
    this.stats = {
      fileCount: 0,
      mainCommands: 0,
      subCommands: 0,
      subCommandGroups: 0,
      totalCommands: 0,
      failedCommands: 0,
      skippedFiles: 0,
      disabledCommands: 0,
      categories: new Map()
    };

    this.cloadData = {
      lastUpdate: '',
      version: '1.0',
      stats: this.stats,
      loadedCommands: []
    };
  }

  async ensureClogFolder() {
    if (!fssync.existsSync(this.clogFolder)) {
      await fs.mkdir(this.clogFolder, { recursive: true });
      console.log('[Clog] 📁 Created Clog folder');
    }
  }

  _commandsJsonPath() {
    return path.join(__dirname, '..', 'config', 'commands.json');
  }

  async _readCommandsJson() {
    const p = this._commandsJsonPath();
    if (!fssync.existsSync(p)) throw new Error(`{ERROR} commands.json not found at ${p}`);
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  }

  _requireFresh(filePath) {
    try { delete require.cache[require.resolve(filePath)]; } catch {}
    const mod = require(filePath);
    return mod && mod.default ? mod.default : mod;
  }

  async _trackCommandStats(command, filePath) {
    this.stats.mainCommands++;
    const category = path.basename(path.dirname(filePath));
    if (!this.stats.categories.has(category)) {
      this.stats.categories.set(category, { count: 0, commands: [] });
    }
    this.stats.categories.get(category).count++;
    this.stats.categories.get(category).commands.push(command.data.name);

    if (command.data.options) {
      command.data.options.forEach(opt => {
        if (opt.type === 1) this.stats.subCommands++;
        if (opt.type === 2) {
          this.stats.subCommandGroups++;
          opt.options?.forEach(subOpt => { if (subOpt.type === 1) this.stats.subCommands++; });
        }
      });
    }

    this.stats.totalCommands = this.stats.mainCommands + this.stats.subCommands;
    this.stats.fileCount++;
  }

  async _saveCloadData() {
    const data = {
      ...this.cloadData,
      lastUpdate: new Date().toISOString(),
      stats: this.stats,
      categories: Object.fromEntries(this.stats.categories),
      loadedCommands: Array.from(this.loadedMap.keys())
    };
    await fs.writeFile(CLOAD_PATH, JSON.stringify(data, null, 2));
  }

  async loadCommands() {
    await this.ensureClogFolder();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const logFileName = `load-log-${timestamp}.txt`;
    const logFilePath = path.join(this.clogFolder, logFileName);

    const loadedLogs = [];
    const failedLogs = [];
    const skippedLogs = [];

    try {
      await this._readCommandsJson();

      const rootEntries = await fs.readdir(this.root);
      let allCommandFiles = [];

      for (const entry of rootEntries) {
        const fullPath = path.join(this.root, entry);
        const stat = fssync.statSync(fullPath);

        if (stat.isFile() && entry.endsWith('.js')) {
          if (entry.startsWith('--')) {
            skippedLogs.push({ name: entry, line: `{SKIP} Skipped file (logic): ${entry}` });
            continue;
          }
          allCommandFiles.push(fullPath);
        }

        if (stat.isDirectory()) {
          const subEntries = await fs.readdir(fullPath);
          for (const subEntry of subEntries) {
            const subFull = path.join(fullPath, subEntry);
            const subStat = fssync.statSync(subFull);
            if (subStat.isFile() && subEntry.endsWith('.js')) {
              if (subEntry.startsWith('--')) {
                skippedLogs.push({ name: subEntry, line: `{SKIP} Skipped file (logic): ${path.relative(this.root, subFull)}` });
                continue;
              }
              allCommandFiles.push(subFull);
            }
          }
        }
      }

      this.stats.fileCount = allCommandFiles.length;
      this.stats.mainCommands = 0;
      this.stats.subCommands = 0;

      for (const filePath of allCommandFiles) {
        try {
          const command = this._requireFresh(filePath);
          if (this._validateCommand(command, filePath)) {
            await this._trackCommandStats(command, filePath);
            this.loadedMap.set(command.data.name, { command, filePath });

            // Collect parent + subcommand structure
            const parent = command.data.name;
            const subs = [];
            if (command.data.options) {
              command.data.options.forEach(opt => {
                if (opt.type === 1) subs.push(opt.name);
                if (opt.type === 2) {
                  subs.push(`${opt.name}`);
                  opt.options?.forEach(subOpt => { if (subOpt.type === 1) subs.push(`${opt.name}.${subOpt.name}`); });
                }
              });
            }

            const fileLabel = path.basename(filePath);
            const jsonLike = `${fileLabel} { ${parent} [${subs.join(', ')}] }`;
            loadedLogs.push({ name: fileLabel, line: jsonLike });
          } else {
            this.stats.skippedFiles++;
            failedLogs.push({ name: path.basename(filePath), line: `⚠️ Skipped invalid command: ${path.basename(filePath)}` });
          }
        } catch (err) {
          this.stats.failedCommands++;
          failedLogs.push({ name: path.basename(filePath), line: `❌ Failed: ${path.basename(filePath)} (${err.message})` });
        }
      }

      await this._saveCloadData();

      const sortByName = arr => arr.sort((a, b) => a.name.localeCompare(b.name));
      sortByName(loadedLogs);
      sortByName(failedLogs);
      sortByName(skippedLogs);

      const header = [
        'Command Load Log',
        '==================',
        `Bot Name: ${this.client?.user?.username || 'Unknown'}`,
        `Bot ID: ${this.client?.user?.id || 'Unknown'}`,
        `Server Count: ${this.client?.guilds?.cache?.size ?? 0}`,
        `Startup Time: ${now.toLocaleString()} (local)`,
        `UTC Time: ${now.toUTCString()}`,
        '==================',
        ''
      ];

      const logLines = [];
      logLines.push('=== ✅ Loaded Commands (JSON Style) ===');
      logLines.push(...loadedLogs.map(x => x.line));
      logLines.push('');
      logLines.push('=== ❌ Failed Commands ===');
      logLines.push(...failedLogs.map(x => x.line));
      logLines.push('');
      logLines.push('=== ⚠️ Skipped Logic Files ===');
      logLines.push(...skippedLogs.map(x => x.line));

      await fs.writeFile(logFilePath, header.concat(logLines).join('\n'), 'utf8');
      console.log(`[Clog] ✅ Commands logged to ${logFileName}`);

      const statsPath = path.join(this.clogFolder, 'command-stats.json');
      await fs.writeFile(statsPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        stats: this.stats,
        categories: Object.fromEntries(this.stats.categories)
      }, null, 2));

      return Array.from(this.loadedMap.values());
    } catch (err) {
      console.error(`{ERROR} ❌ Error in command loading: ${err.message}`);
      return [];
    }
  }

  _validateCommand(command, filePath) {
    try {
      if (!command || !command.data || typeof command.execute !== 'function') return false;
      if (!command.data.name || typeof command.data.name !== 'string') return false;
      if (command.data.options && Array.isArray(command.data.options)) {
        command.data.options.forEach(opt => {
          if (opt.type === 1) this.stats.subCommands++;
          if (opt.type === 2) {
            this.stats.subCommandGroups++;
            if (opt.options && Array.isArray(opt.options)) {
              opt.options.forEach(subOpt => { if (subOpt.type === 1) this.stats.subCommands++; });
            }
          }
        });
      }
      return true;
    } catch (err) {
      console.error(`{ERROR} Command validation error for ${path.basename(filePath)}: ${err.message}`);
      return false;
    }
  }

  getCommand(parentName) {
    return this.loadedMap.get(parentName)?.command;
  }

  getStats() {
    return { ...this.stats, categories: Object.fromEntries(this.cloadData.categories) };
  }
}
module.exports = { CommandLoader };