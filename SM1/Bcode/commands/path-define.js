import path from 'path';
import { fileURLToPath } from 'url';

// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root_dir = path.join(__dirname, '..')
const commands_root = path.join(root_dir,'commands')
class commandslist {
    constructor() {
      this.folderembed = path.join(commands_root,'embed')
      this.foldersticky = path.join(commands_root,'sticky')
      this.about = path.join(commands_root,'about.js')
      this.console = path.join(commands_root,'consol.js')
      this.fun = path.join(commands_root,'fun.js')
      this.help = path.join(commands_root,'help.js')
      this.moderation = path.join(commands_root,'moderation.js')
      this.ping = path.join(commands_root,'ping.js')
      this.question = path.join(commands_root,'question.js')
      this.role = path.join(commands_root,'roles.js')
      this.utility = path.join(commands_root,'utility.js')
    }
}
export {commandslist}