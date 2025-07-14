import fs from 'fs';
import path from 'path';
import { commandsJsonPath, cmdPath } from '../defined/path-define.js';

function createCommandsJson() {
  if (fs.existsSync(commandsJsonPath)) {
    fs.unlinkSync(commandsJsonPath);
    console.log('[CMD] 🗑 Existing commands.json file deleted.');
  }

  const commandsJson = {};
  const files = fs.readdirSync(cmdPath);

  files.forEach((file) => {
    const filePath = path.join(cmdPath, file);
    if (fs.statSync(filePath).isDirectory() || !file.endsWith('.js')) return;

    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Match main command name from SlashCommandBuilder
    const mainMatch = fileContent.match(/new\s+SlashCommandBuilder\(\)[\s\S]*?\.setName\(['"](.+?)['"]\)/);
    if (!mainMatch) return;

    const parentCommand = mainMatch[1];
    commandsJson[parentCommand] = {};

    // Match subcommands
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
}

export { toggleCommand, createCommandsJson };