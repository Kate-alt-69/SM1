//````````````````````|
//START PATH-DEFINE.js|
//,,,,,,,,,,,,,,,,,,,,|

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
  cmandStickyPath
};

//,,,,,,,,,,,,,,,,,,,,,,|
// END OF PATH-DEFINE.js|
//``````````````````````|