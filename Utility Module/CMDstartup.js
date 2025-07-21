import { createCommandsJson } from './CMDtoggle.js';
import { bcodePath } from '../defined/path-define.js';
import fs from 'fs';
import path from 'path';

function tokenExists() {
  const tokenJsonPath = path.join(bcodePath, 'config', 'token.json');
  try {
    const tokenJson = JSON.parse(fs.readFileSync(tokenJsonPath, 'utf8'));
    return tokenJson.token !== '';
  } catch {
    return false;
  }
}

async function startup() {
  if (!tokenExists()) {
    console.log('[STARTUP] 🚨 No token found in token.json. Please create one using the command:');
    console.log('  # token save <YOUR_TOKEN>');
    return;
  }

  await createCommandsJson();
  console.log('[STARTUP] ✅ commands.json file generated successfully!');
}

export default startup;
