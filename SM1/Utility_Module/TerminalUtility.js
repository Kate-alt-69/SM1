// Utility_Module/TerminalUtility.js

class TerminalUtility {
  constructor({ prompt = '<<- ' } = {}) {
    this.prompt = prompt;

    this.buffer = '';
    this.active = false;

    this.onLine = null;
    this.onInterrupt = null;
  }

  start({ onLine, onInterrupt }) {
    if (this.active) return;
    this.active = true;

    this.onLine = onLine;
    this.onInterrupt = onInterrupt;

    // HARD RESET stdin
    process.stdin.removeAllListeners();
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('data', (chunk) => this.#handle(chunk));

    this.promptLine();
  }

  stop() {
    this.active = false;
    process.stdin.removeAllListeners();
    process.stdin.pause();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  }

  #handle(chunk) {
    const char = String(chunk);

    // CTRL+C
    if (char === '\u0003') {
      process.stdout.write('^C\n');
      this.buffer = '';
      this.onInterrupt?.();
      return;
    }

    // ENTER
    if (char === '\r' || char === '\n') {
      const line = this.buffer;
      this.buffer = '';
      process.stdout.write('\n');

      // 🚨 dispatch ONLY ONCE, full line
      this.onLine?.(line.trim());
      return;
    }

    // BACKSPACE
    if (char === '\u007f') {
      if (this.buffer.length) {
        this.buffer = this.buffer.slice(0, -1);
        process.stdout.write('\b \b');
      }
      return;
    }

    // PRINTABLE
    if (char >= ' ' && char <= '~') {
      this.buffer += char;
      process.stdout.write(char);
    }
  }

  promptLine() {
    if (!this.active) return;
    process.stdout.write(this.prompt);
  }

  write(text) {
    process.stdout.write(text);
  }

  writeLine(text) {
    process.stdout.write(text + '\n');
  }
}

let instance;
export function getTerminalUtility(opts) {
  if (!instance) instance = new TerminalUtility(opts);
  return instance;
}

export default TerminalUtility;
