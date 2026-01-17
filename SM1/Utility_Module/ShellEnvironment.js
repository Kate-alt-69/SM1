// Utility_Module/ShellEnvironment.js

import { getTerminalUtility } from './TerminalUtility.js';

class ShellEnvironment {
  constructor() {
    this.terminal = getTerminalUtility({ prompt: '<<- ' });

    this.routes = new Map(); // prefix → handler
    this.foreground = null; // { controller, promise }
    this.shutdownHandler = null;
  }

  /* ---------- lifecycle ---------- */

  start() {
    this.terminal.start({
      onLine: (line) => this.#onLine(line),
      onInterrupt: () => this.#onInterrupt(),
    });
  }

  async shutdown() {
    if (this.foreground) {
      this.foreground.controller.abort();
      await this.foreground.promise.catch(() => {});
      this.foreground = null;
    }

    this.terminal.stop();
    await this.shutdownHandler?.();
    process.exit(0);
  }

  onShutdown(fn) {
    this.shutdownHandler = fn;
  }

  /* ---------- routing ---------- */

  register(prefix, handler) {
    this.routes.set(prefix, handler);
  }

  async #onLine(line) {
    if (!line) {
      this.terminal.promptLine();
      return;
    }

    if (line === 'exit') {
      if (this.foreground) {
        this.foreground.controller.abort();
        this.terminal.writeLine('[SHELL] Command cancelled');
        this.foreground = null;
        this.terminal.promptLine();
        return;
      }
    
      this.terminal.writeLine('[SHELL] Exit requested');
      await this.shutdown();
      return;
    }


    const prefix = line[0];
    const handler = this.routes.get(prefix);

    if (!handler) {
      this.terminal.writeLine(`[INPUT] ❌ Unknown prefix "${prefix}"`);
      this.terminal.promptLine();
      return;
    }

    const controller = new AbortController();
    const promise = Promise.resolve(
      handler(line.slice(1).trim(), controller.signal)
    );

    this.foreground = { controller, promise };

    try {
      await promise;
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.terminal.writeLine(`[ERROR] ${err.message}`);
      }
    }

    this.foreground = null;
    this.terminal.promptLine();
  }

  #onInterrupt() {
    if (this.foreground) {
      this.foreground.controller.abort();
      this.terminal.writeLine('[SHELL] Command cancelled');
      this.foreground = null;
      this.terminal.promptLine();
      return;
    }

    this.terminal.promptLine();
  }

  /* ---------- output ---------- */

  write(text) {
    this.terminal.write(text);
  }

  writeLine(text) {
    this.terminal.writeLine(text);
  }
}

let instance;
export function getShellEnvironment() {
  if (!instance) instance = new ShellEnvironment();
  return instance;
}

export default ShellEnvironment;
