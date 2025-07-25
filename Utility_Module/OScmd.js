// OSCommandHelper.js
import os from 'os';
import process from 'process';

class OSCommandHelper {
  constructor() {
    this.osType = this.getOSType();
  }

  getOSType() {
    const platform = process.platform;
    switch (platform) {
      case 'win32': return 'Windows';
      case 'darwin': return 'macOS';
      case 'linux': return 'Linux';
      default: return 'Unknown';
    }
  }

  /**
   * Returns the appropriate shell command to get running Node.js processes.
   */
  getNodeProcessListCommand() {
    switch (this.osType) {
      case 'Windows': return 'tasklist';
      case 'macOS':
      case 'Linux': return 'ps -ef';
      default: return null;
    }
  }

  /**
   * Returns the command to kill a process by PID.
   * @param {number|string} pid
   */
  getKillCommand(pid) {
    switch (this.osType) {
      case 'Windows': return `taskkill /F /PID ${pid}`;
      case 'macOS':
      case 'Linux': return `kill ${pid}`;
      default: return null;
    }
  }

  /**
   * Returns a generic info message for displaying to user.
   */
  getInfoMessage() {
    return `[SYSTEM] 🖥 Detected OS: ${this.osType}`;
  }

  /**
   * Suggest proper shell usage
   */
  getShellUsageNote() {
    if (this.osType === 'Windows') {
      return '[SYSTEM] 💡 Use Command Prompt or PowerShell for Windows compatibility.';
    }
    return '[SYSTEM] 💡 Use bash/zsh terminal for best experience on Linux/macOS.';
  }
}
export default OSCommandHelper;