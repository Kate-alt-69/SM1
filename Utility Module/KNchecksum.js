const fs = require('fs');
const path = require('path');

const bcodePath = path.join(__dirname, '../Bcode');
console.log('[CHECK] Structure Verification Started...');
const checkBcodeFolder = () => {
  if (!fs.existsSync(bcodePath)) {
    console.error('{ERROR} ❌ Bcode folder not found! \n this is a critical error, please reinstall the BCode package.\n or check if it exists.');
    return false;
  }
  return true;
};

const checkDCBScript = () => {
  const dcbPath = path.join(bcodePath, 'DCB.js');
  if (!fs.existsSync(dcbPath)) {
    console.error('{ERROR}❌ DCB.js script not found!\n this is a critical error, please reinstall the BCode package.\n or check if main script exists.');
    return false;
  }
  return true;
};

const checkCommandsFolder = () => {
  const commandsPath = path.join(bcodePath, 'commands');
  if (!fs.existsSync(commandsPath)) {
    console.error('{ERROR} ❌ Commands folder not found! \n this is a critical function error please reinstall the commands folder. from installation or check if it exists.');
    return false;
  }
  return true;
};

const checkUtilsFolder = () => {
  const utilsPath = path.join(bcodePath, 'utils');
  if (!fs.existsSync(utilsPath)) {
    console.error('{ERROR} ❌ Utils folder not found!\n this is a critical utility folder please reinstall Bcode package.\n or check if it exists.');
    return false;
  }
  return true;
};

const checktknjsfile = () => {
    const tokenPath = path.join(bcodePath, 'config/token.json');
    if (!fs.existsSync(tokenPath)) {
        console.error('{ERROR} ❌ token.json file not found!\n please recreate the file using the command: dcb token save <YOUR_TOKEN>');
        return false;
    }
    return true;
};

const checkdatafolder = () => {
    const dataPath = path.join(bcodePath, 'data');
    if (!fs.existsSync(dataPath)) {
        console.error('{ERROR} ❌ data folder not found!.\n please reinstall the BCode package or check if it exists.');
        return false;
    }
    return true;
}
const checkBcodeStructure = () => {
    console.log('[CHECK] checking resoults...');
  if (!checkBcodeFolder()) return false;
  if (!checkDCBScript()) return false;
  if (!checkCommandsFolder()) return false;
  if (!checkUtilsFolder()) return false;
  if (!checktknjsfile()) return false;
  if (!checkdatafolder()) return false;

  return true;
};
// ./Utility/KNchecksum.js
module.exports = {
  checkBcodeStructure: async () => {
  }
};