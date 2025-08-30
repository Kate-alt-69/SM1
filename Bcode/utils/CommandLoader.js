// ==========================================================================
// CommandLoader.js — Loads parent command modules with folder scanning and detailed logging
//  - Scans top-level files in commands/ and .js files in immediate subfolders
//  - Does NOT recurse into child-child folders
//  - Skips files whose base name starts with "--"
//  - Preserves original behaviors (logging, commands.json parsing, detailed errors)
// ==========================================================================

const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

class CommandLoader {
  constructor(commandsRootPath, client = null) {
    this.root = commandsRootPath || path.join(__dirname, '..', 'commands');
    this.client = client;
    this.loadedMap = new Map(); // parentName -> { command, filePath }
    this.clogFolder = path.join(__dirname, '..', 'Clog');
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
    try { return JSON.parse(raw); } catch (err) {
      throw new Error(`{ERROR} Failed to parse commands.json -> ${err.message}`);
    }
  }

  _parentFromKey(cmdKey) {
    const i = cmdKey.indexOf('.');
    return i === -1 ? cmdKey : cmdKey.slice(0, i);
  }

  _requireFresh(filePath) {
    try { delete require.cache[require.resolve(filePath)]; } catch {}
    const mod = require(filePath);
    return mod && mod.default ? mod.default : mod;
  }

  // legacy helper: recursive scan (kept for compatibility but NOT used by loadCommands)
  async _scanFolderCommands(folderPath) {
    const commands = [];
    const entries = await fs.readdir(folderPath);
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry);
      const stat = fssync.statSync(fullPath);
      if (stat.isFile() && entry.endsWith('.js')) commands.push(fullPath);
      if (stat.isDirectory()) commands.push(...await this._scanFolderCommands(fullPath));
    }
    return commands;
  }

  async getDetailedError(filePath, err) {
    const rel = path.relative(this.root, filePath);
    return [
      '────────────────────────────────────────────────────────────────',
      '{ERROR} CommandLoader Detailed Error',
      `Module: ${rel}`,
      `Path:   ${filePath}`,
      `Error:  ${err?.stack || err?.message || String(err)}`,
      'Suggestions:',
      '- Ensure the file exports { data, execute }',
      '- Ensure "data" is a SlashCommandBuilder with .name set',
      '- Fix any syntax/runtime errors in the command file',
      '────────────────────────────────────────────────────────────────'
    ].join('\n');
  }

  // Primary command loading entrypoint. Scans only one directory depth.
  async loadCommands() {
    await this.ensureClogFolder();
    const logLines = [];
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const logFileName = `load-log-${timestamp}.txt`;
    const logFilePath = path.join(this.clogFolder, logFileName);

    try {
      const cfg = await this._readCommandsJson();
      const enabledKeys = new Set(Object.keys(cfg).filter(k => k !== '__folders' && !k.endsWith('.folder')));

      // Build list of command files to load: top-level .js files and .js files in immediate subfolders
      const rootEntries = await fs.readdir(this.root);
      let allCommandFiles = [];

      for (const entry of rootEntries) {
        const fullPath = path.join(this.root, entry);
        const stat = fssync.statSync(fullPath);

        // Skip files or folders whose name starts with '--' (only applies to file basenames)
        if (stat.isFile() && entry.endsWith('.js')) {
          if (path.basename(entry).startsWith('--')) {
            logLines.push(`{SKIP} Skipped file (prefixed with --): ${entry}`);
            continue;
          }
          allCommandFiles.push(fullPath);
        }

        if (stat.isDirectory()) {
          // Read immediate children only (do NOT recurse into sub-subfolders)
          const subEntries = await fs.readdir(fullPath);
          for (const subEntry of subEntries) {
            const subFull = path.join(fullPath, subEntry);
            const subStat = fssync.statSync(subFull);
            if (subStat.isFile() && subEntry.endsWith('.js')) {
              if (path.basename(subEntry).startsWith('--')) {
                logLines.push(`{SKIP} Skipped file (prefixed with --): ${path.relative(this.root, subFull)}`);
                continue;
              }
              allCommandFiles.push(subFull);
            }
            // If subEntry is a directory, we intentionally DO NOT descend here (no child-child folders)
          }
        }
      }

      // Load each discovered command file
      for (const filePath of allCommandFiles) {
        try {
          const command = this._requireFresh(filePath);
          if (!command || !command.data || !command.data.name || typeof command.execute !== 'function') {
            logLines.push(`{ERROR} INVALID EXPORT: ${path.relative(this.root, filePath)}`);
            continue;
          }
          this.loadedMap.set(command.data.name, { command, filePath });
          const matchedKeys = [...enabledKeys].filter(k => this._parentFromKey(k) === command.data.name);
          logLines.push(`Loaded parent: ${command.data.name} -> ${path.relative(this.root, filePath)} | subkeys: [${matchedKeys.join(', ')}]`);
        } catch (err) {
          // Provide a succinct load error in the main log and preserve the stack in detailed error if needed
          logLines.push(`{ERROR} LOAD ERROR: ${path.relative(this.root, filePath)} -> ${err.message}`);
        }
      }

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

      await fs.writeFile(logFilePath, header.concat(logLines).join('\n'), 'utf8');
      console.log(`[Clog] ✅ Commands logged to ${logFileName}`);
      return Array.from(this.loadedMap.values());
    } catch (err) {
      console.error(`{ERROR} ❌ Error loading commands: ${err.message}`);
      return [];
    }
  }

  getCommand(parentName) {
    return this.loadedMap.get(parentName)?.command;
  }
}

module.exports = { CommandLoader };