import { applyBookmarksScenario } from "./filesBookmarks/bookmarks.mjs";
import { applyFilesScenario } from "./filesBookmarks/files.mjs";
import { applyOpenFilesScenario } from "./filesBookmarks/openFiles.mjs";
import { applyReaderActionsScenario } from "./filesBookmarks/readerActions.mjs";
import { applyReloadRestoreScenario } from "./filesBookmarks/reloadRestore.mjs";
import { applyWindowActionsScenario } from "./filesBookmarks/windowActions.mjs";

const filesBookmarksScenarioHandlers = [
  applyFilesScenario,
  applyBookmarksScenario,
  applyOpenFilesScenario,
  applyReaderActionsScenario,
  applyWindowActionsScenario,
  applyReloadRestoreScenario,
];

export async function applyFilesBookmarksScenario(context) {
  for (const handler of filesBookmarksScenarioHandlers) {
    if (await handler(context)) {
      return true;
    }
  }
  return false;
}
