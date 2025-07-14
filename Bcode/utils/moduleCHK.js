const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
function checkAndInstallModules(baseDir) {
    const nodeModulesPath = path.join(baseDir, 'node_modules');
    const packageJsonPath = path.join(baseDir, 'package.json');

    // Check for package.json first
    if (!fs.existsSync(packageJsonPath)) {
        console.error('[SYSTEM]❌ package.json not found!');
        console.error('[HINT] Please make sure you are running the bot from the correct directory and that package.json exists.');
        process.exit(1);
    }

    // Check for node_modules
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('[SYSTEM]📦 node_modules not found. Running npm install...\n npm install');
        try {
            execSync('npm install', { stdio: 'inherit', cwd: baseDir });
            console.log('[SYSTEM]✅ npm install completed');
        } catch (err) {
            console.error('{ERROR} ❌ npm install failed:', err);
            console.error('[HINT] Please check your internet connection and package.json for errors.');
            process.exit(1);
        }
    } else {
        console.log('[SYSTEM] 📦 node_modules found. Skipping npm install.');
    }
}
module.exports = { checkAndInstallModules };