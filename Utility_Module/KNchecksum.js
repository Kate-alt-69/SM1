import fs from 'fs';
import path from 'path';
import { bcodePath } from '../defined/path-define.js';
console.log('[CHECK] Structure Verification Started...');
const checkBcodeFolder = () => {
  if (!fs.existsSync(bcodePath)) {
    console.error('{ERROR} ❌ Bcode folder not found!\nThis is a critical error. Please reinstall the BCode package or check if it exists.');
    return false;
  }
  return true;
};
const checkDCBScript = () => {
  const dcbPath = path.join(bcodePath, 'DCB.js');
  if (!fs.existsSync(dcbPath)) {
    console.error('{ERROR} ❌ DCB.js script not found!\nThis is a critical error. Please reinstall the BCode package or check if main script exists.');
    return false;
  }
  return true;
};
const checkCommandsFolder = () => {
  const commandsPath = path.join(bcodePath, 'commands');
  if (!fs.existsSync(commandsPath)) {
    console.error('{ERROR} ❌ Commands folder not found!\nThis is a critical function error. Please reinstall the commands folder or check if it exists.');
    return false;
  }
  return true;
};
const checkUtilsFolder = () => {
  const utilsPath = path.join(bcodePath, 'utils');
  if (!fs.existsSync(utilsPath)) {
    console.error('{ERROR} ❌ Utils folder not found!\nThis is a critical utility folder. Please reinstall the BCode package or check if it exists.');
    return false;
  }
  return true;
};
const checkTokenFile = () => {
  const tokenPath = path.join(bcodePath, 'config/token.json');
  if (!fs.existsSync(tokenPath)) {
    console.error('{ERROR} ❌ token.json file not found!\nPlease recreate the file using the command: dcb token save <YOUR_TOKEN>');
    return false;
  }
  return true;
};
const checkDataFolder = () => {
  const dataPath = path.join(bcodePath, 'data');
  if (!fs.existsSync(dataPath)) {
    console.error('{ERROR} ❌ data folder not found!\nPlease reinstall the BCode package or check if it exists.');
    return false;
  }
  return true;
};
export async function checkBcodeStructure() {
  console.log('[CHECK] Checking results...');
  if (!checkBcodeFolder()) return false;
  if (!checkDCBScript()) return false;
  if (!checkCommandsFolder()) return false;
  if (!checkUtilsFolder()) return false;
  if (!checkTokenFile()) return false;
  if (!checkDataFolder()) return false;

  return true;
}
