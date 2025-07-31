//`````````````````````````````````|
// KNchecksum.js (Structure Check) |
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|

import fs from 'fs';
import path from 'path';
import { bcodePath, utilsPath, cmdPath, configPath, scriptsPath } from '../defined/path-define.js';

console.log('[CHECK] Structure Verification Started...');

class KNchecksum {
  static structureChecks = [
    { name: 'Bcode folder', path: bcodePath, type: 'folder', required: true, errorMsg: '❌ Bcode folder not found!\nThis is a critical error. Please reinstall the BCode package or check if it exists.' },
    { name: 'DCB.js script', path: path.join(bcodePath, 'DCB.js'), type: 'file', required: true, errorMsg: '❌ DCB.js script not found!\nThis is a critical error. Please reinstall the BCode package or check if the main script exists.' },
    { name: 'commands folder', path: cmdPath, type: 'folder', required: true, errorMsg: '❌ Commands folder not found!\nThis is a critical function error. Please reinstall the commands folder or check if it exists.' },
    { name: 'utils folder', path: utilsPath, type: 'folder', required: true, errorMsg: '❌ Utils folder not found!\nThis is a critical utility folder. Please reinstall the BCode package or check if it exists.' },
    { name: 'data folder', path: path.join(bcodePath, 'data'), type: 'folder', required: true, errorMsg: '❌ Data folder not found!\nPlease reinstall the BCode package or check if it exists.' },
    { name: 'config folder', path: configPath, type: 'folder', required: true, errorMsg: '❌ Config folder not found!\nThis is required for token and command settings. Please restore or reinstall.' },
    { name: 'scripts folder', path: scriptsPath, type: 'folder', required: false, errorMsg: '⚠️ Scripts folder not found. This folder is optional, but may impact script features.' },
    { name: 'moduleCHK.js', path: path.join(utilsPath, 'moduleCHK.js'), type: 'file', required: true, errorMsg: '❌ moduleCHK.js missing!\nCritical utility missing. This file is needed for validation.' }
  ];

  static getFileHealth(p) {
    try {
      const s = fs.statSync(p);
      if (!s.isFile()) return '❌ Not a valid file';
      if (s.size === 0) return '⚠️ File is empty';
      return '✅ File healthy';
    } catch (e) {
      return `❌ Error accessing file: ${e.message}`;
    }
  }

  static async checkBcodeStructure() {
    console.log('[CHECK] Checking results...');
    let allPass = true;
    for (const c of KNchecksum.structureChecks) {
      const exists = fs.existsSync(c.path);
      const typeOK = exists && (c.type === 'file' ? fs.lstatSync(c.path).isFile() : fs.lstatSync(c.path).isDirectory());
      if (!exists || !typeOK) {
        console.error(`{ERROR} ${c.errorMsg}`);
        if (c.required) allPass = false;
      } else {
        const msg = c.type === 'file' ? KNchecksum.getFileHealth(c.path) : '{OK}';
        console.log(`${c.type === 'file' ? '{FILE CHECK}' : '{OK}'} ${c.name} → ${msg}`);
      }
    }
    console.log(allPass ? '[CHECK] ✅ All required structure checks passed.' : '[CHECK] ❌ Some required components failed. Fix before continuing.');
    return allPass;
  }
}

export {KNchecksum};

//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,|
// END OF KNchecksum.js             |
//`````````````````````````````````|
