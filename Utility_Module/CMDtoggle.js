// Utility_Module/CMDtoggle.js

import {
  createCommandsJson,
  toggleCommand,
  listTogglableCommands,
  enableCommand,
  disableCommand,
  regenerateCommandJson,
  deleteSnapshots,
  listSnapshots,
  takeSnapshot,
  rollbackSnapshot
} from './FUNCTtoggle.js';

export async function handleToggleCommand(sub, arg, arg2) {
  switch (sub) {
    case 'list':
      listTogglableCommands();
      break;

    case 'on':
      if (!arg) return console.log('[TOGGLE] ❌ You must specify a command to enable.');
      enableCommand(arg);
      break;

    case 'off':
      if (!arg) return console.log('[TOGGLE] ❌ You must specify a command to disable.');
      disableCommand(arg);
      break;

    case 'fr':
      regenerateCommandJson();
      break;

    case 'snapshot':
      switch (arg) {
        case 'delete':
          deleteSnapshots();
          break;
        case 'list':
          listSnapshots();
          break;
        case 'backup':
          takeSnapshot();
          break;
        case 'rollback':
          if (!arg2) return console.log('[SNAPSHOT] ❌ You must specify a snapshot ID to rollback to.');
          rollbackSnapshot(arg2);
          break;
        default:
          console.log('[SNAPSHOT] ❌ Unknown snapshot subcommand. Use "# toggle snapshot <list|delete|backup|rollback>"');
      }
      break;

    default:
      console.log('[TOGGLE] ❌ Unknown toggle command. Use "# toggle list" or "# help".');
  }
}
