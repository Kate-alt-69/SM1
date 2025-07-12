const path = require('path');

const bcodePath = path.join(__dirname, '../Bcode');
const data = path.join(bcodePath, 'data');
const utilsPath = path.join(bcodePath, 'utils');
const scriptsPath = path.join(bcodePath, 'scripts');
const maindcbPath = path.join(bcodePath, 'DCB.js');
const cmdPath = path.join(bcodePath, 'commands');
const configPath = path.join(bcodePath, 'config');
const tokenPath = path.join(configPath,'token.json');
const commandsJsonPath = path.join(configPath, 'commands.json');

module.exports = { bcodePath, configPath, commandsJsonPath, data, utilsPath, scriptsPath, maindcbPath, cmdPath, tokenPath };