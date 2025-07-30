//,,,,,,,,,,,,,
// CMDstartup.js |
//``````````````
import { bcodePath } from '../defined/path-define.js';
import fs from 'fs'; import path from 'path';

const tokenExists = () => {
  const tokenJsonPath = path.join(bcodePath, 'config', 'token.json');
  try { return JSON.parse(fs.readFileSync(tokenJsonPath, 'utf8')).token !== ''; }
  catch { return false; }
};

export default async function startup() {
  if (!tokenExists()) {
    console.log('[STARTUP] 🚨 No token found in token.json. Please create one using the command:');
    console.log('  # token save <YOUR_TOKEN>'); return;
  }
  const { default: ToggleManager } = await import('./FUNCTtoggle.js');
  ToggleManager.regenerateCommandJson();
  console.log('[STARTUP] ✅ commands.json file generated successfully!');
}
//,,,,,,,,,,,,,,,,,
// END OF CMDstartup.js |
//`````````````````````
