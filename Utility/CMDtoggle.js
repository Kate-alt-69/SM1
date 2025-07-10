const fs = require('fs');
const path = require('path');
const parentDir = path.dirname(__dirname);
const bCodeDir = path.join(parentDir, 'BCode');
const commandsDir = path.join(bCodeDir, 'commands');
const commands = {};

const createCommandsJson = () => {
  const commandsJson = {};

  const commandsDir = path.join(bcodePath, 'commands');
  const files = fs.readdirSync(commandsDir);

  files.forEach((file) => {
    const filePath = path.join(commandsDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    const commandName = file.replace('.js', '');
    const subcommands = [];

    const lines = fileContent.split('\n');
    lines.forEach((line) => {
      if (line.includes('.setName(')) {
        const parentCommand = line.match(/\.setName\('(.+)'\)/)[1];
        commandsJson[parentCommand] = {};
      } else if (line.includes('.addSubcommand(')) {
        const subcommandName = line.match(/\.addSubcommand\('(.+)'\)/)[1];
        subcommands.push(subcommandName);
      }
    });

    if (subcommands.length > 0) {
      commandsJson[commandName] = {};
      subcommands.forEach((subcommand) => {
        commandsJson[commandName][`${commandName}.${subcommand}`] = true;
      });
    } else {
      commandsJson[commandName] = { [commandName]: true };
    }
  });
  const commandsJsonPath = path.join(bcodePath, 'commands', 'commands.json');
  fs.writeFileSync(commandsJsonPath, JSON.stringify(commandsJson, null, 2));
  console.log('[CMD] Commands.json file created successfully!');
};
module.exports = { createCommandsJson };
const jsonData = JSON.stringify(commands, null, 2);
fs.writeFileSync(path.join(commandsDir, 'commands.json'), jsonData);
console.log('[CMD] ✔️ commands.json file created successfully!');