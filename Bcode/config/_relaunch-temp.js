
        const fs = require('fs');
        const path = require('path');
        const { spawn } = require('child_process');
        const pidPath = path.resolve('./Utility_Module/PID.json');

        const child = spawn('node', ['/workspace/SM1/KERNEL.js'], {
          detached: true,
          stdio: 'inherit'
        });

        const pidData = fs.existsSync(pidPath) ? JSON.parse(fs.readFileSync(pidPath, 'utf8')) : {};
        pidData.kernelpid = child.pid;
        fs.writeFileSync(pidPath, JSON.stringify(pidData, null, 2));

        child.unref();
      