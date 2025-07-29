import fs from 'fs';
import path from 'path';
import { bcodePath } from '../defined/path-define.js';

console.log('[CHECK] Structure Verification Started...');

const structureChecks = [
  {
    name: 'Bcode folder',
    path: bcodePath,
    type: 'folder',
    required: true,
    errorMsg: '❌ Bcode folder not found!\nThis is a critical error. Please reinstall the BCode package or check if it exists.'
  },
  {
    name: 'DCB.js script',
    path: path.join(bcodePath, 'DCB.js'),
    type: 'file',
    required: true,
    errorMsg: '❌ DCB.js script not found!\nThis is a critical error. Please reinstall the BCode package or check if the main script exists.'
  },
  {
    name: 'commands folder',
    path: path.join(bcodePath, 'commands'),
    type: 'folder',
    required: true,
    errorMsg: '❌ Commands folder not found!\nThis is a critical function error. Please reinstall the commands folder or check if it exists.'
  },
  {
    name: 'utils folder',
    path: path.join(bcodePath, 'utils'),
    type: 'folder',
    required: true,
    errorMsg: '❌ Utils folder not found!\nThis is a critical utility folder. Please reinstall the BCode package or check if it exists.'
  },
  {
    name: 'data folder',
    path: path.join(bcodePath, 'data'),
    type: 'folder',
    required: true,
    errorMsg: '❌ Data folder not found!\nPlease reinstall the BCode package or check if it exists.'
  }
  // token.json removed: handled by TokenEditorUtility if missing
];
export async function checkBcodeStructure() {
  console.log('[CHECK] Checking results...');
  for (const check of structureChecks) {
    const exists = fs.existsSync(check.path);
    const isCorrectType = check.type === 'file' ? fs.existsSync(check.path) && fs.lstatSync(check.path).isFile()
                                               : fs.existsSync(check.path) && fs.lstatSync(check.path).isDirectory();
    if (!exists || !isCorrectType) {
      console.error(`{ERROR} ${check.errorMsg}`);
      return false;
    }
  }
  return true;
}