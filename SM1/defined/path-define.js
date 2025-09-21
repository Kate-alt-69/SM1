//````````````````````|
//START PATH-DEFINE.js|
//,,,,,,,,,,,,,,,,,,,,|
//``````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````|
//   NOTE : this file is only used to markdown paths to folders or spacific files that are importent and is generally good to edit  |
//          this file can be edited by anyone if forked and editing on there own version for KERNEL updates or mod intergration     |
//          this file can have commands files if needed and be defined by any Utility_Module Module or Any Other Types Of FILE      |
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bcodePath = path.join(__dirname, '../Bcode');
const data = path.join(bcodePath, 'data');
const utilsPath = path.join(bcodePath, 'utils');
const moduleCHKpath = path.join(utilsPath, 'moduleCHK.js');
const scriptsPath = path.join(bcodePath, 'scripts');
const maindcbPath = path.join(bcodePath, 'DCB.js');
const cmdPath = path.join(bcodePath, 'commands');
const configPath = path.join(bcodePath, 'config');
const tokenPath = path.join(configPath, 'token.json');
const commandsJsonPath = path.join(configPath, 'commands.json');
const dcbPathPath = path.join(bcodePath, 'DCB.js');
const utilsEmbedPath = path.join(utilsPath, 'embed');
const cmdSnapshotPath = path.join(configPath, 'cmd_snapshots');
const cmandEmbedPath = path.join(cmdPath, 'embeded');
const cmandStickyPath = path.join(cmdPath, 'sticky');
const logsPath = path.join('../logs')
export {
  bcodePath,
  configPath,
  commandsJsonPath,
  data,
  utilsPath,
  scriptsPath,
  maindcbPath,
  cmdPath,
  tokenPath,
  moduleCHKpath,
  dcbPathPath,
  utilsEmbedPath,
  cmdSnapshotPath,
  cmandEmbedPath,
  cmandStickyPath,
  logsPath
};

//,,,,,,,,,,,,,,,,,,,,,,|
// END OF PATH-DEFINE.js|
//``````````````````````|