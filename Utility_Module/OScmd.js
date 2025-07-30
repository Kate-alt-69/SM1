//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// OSCommandHelper.js – OS utilities |
//```````````````````````````````````
import os from 'os';
import process from 'process';

class OSCommandHelper {
  constructor() {
    this.osType = this.getOSType();
  }

  getOSType() {
    switch (process.platform) {
      case 'win32': return 'Windows';
      case 'darwin': return 'macOS';
      case 'linux': return 'Linux';
      default: return 'Unknown';
    }
  }

  getNodeProcessListCommand() {
    return this.osType === 'Windows' ? 'tasklist' : 'ps -ef';
  }

  getKillCommand(pid) {
    return this.osType === 'Windows' ? `taskkill /F /PID ${pid}` : `kill ${pid}`;
  }

  getInfoMessage() {
    return `[STARTUP] 🖥 Detected OS: ${this.osType}`;
  }

  getShellUsageNote() {
    return this.osType === 'Windows'
      ? '[STARTUP] 💡 Use Command Prompt or PowerShell for Windows compatibility.'
      : '[STARTUP] 💡 Use bash/zsh terminal for best experience on Linux/macOS.';
  }
}

export default OSCommandHelper;
//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// END OF OSCommandHelper.js |
//````````````````````````````
