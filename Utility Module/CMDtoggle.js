const path = require('path');
const fs = require('fs');
const { commandsJsonPath, cmdPath } = require('../defined/path-define');
function createCommandsJson() {
  if (fs.existsSync(commandsJsonPath)) {
    fs.unlinkSync(commandsJsonPath);
    console.log('[CMD] 🗑 Existing commands.json file deleted.');
  }
  const commandsJson = {};
  const files = fs.readdirSync(cmdPath);
  files.forEach((file) => {
    const filePath = path.join(cmdPath, file);
    // Skip directories and non-JS files
    if (fs.statSync(filePath).isDirectory() || !file.endsWith('.js')) return;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const commandName = file.replace('.js', '');
    const setNameMatches = [...fileContent.matchAll(/\.setName\(['"](.*?)['"]\)/g)];
    if (setNameMatches.length === 0) return;
    const parentCommand = setNameMatches[0][1];
    commandsJson[parentCommand] = {};
    if (setNameMatches.length > 1) {
      for (let i = 1; i < setNameMatches.length; i++) {
        const sub = setNameMatches[i][1];
        commandsJson[parentCommand][`${parentCommand}.${sub}`] = true;
      }
    } else {
      commandsJson[parentCommand][parentCommand] = true;
    }
  });
  fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
  console.log('[CMD] ✅ Commands.json file created successfully!');
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
module.exports = { toggleCommand, createCommandsJson };