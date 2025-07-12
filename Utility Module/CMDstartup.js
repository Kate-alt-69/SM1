const createCommandsJson = require('./CMDtoggle');
async function startup() {
  if (!tokenEditor.tokenExists()) {
    console.log('[STARTUP] No token found in token.json. Please create one using the following command:');
    console.log('  # token save <YOUR_TOKEN>');
    return;
  }

  await createCommandsJson();
  console.log('Commands.json file generated successfully!');
}
module.exports = startup;