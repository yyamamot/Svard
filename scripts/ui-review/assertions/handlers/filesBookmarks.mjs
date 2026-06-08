import { buildBookmarksAssertions } from "./filesBookmarks/bookmarks.mjs";
import { buildFilesAssertions } from "./filesBookmarks/files.mjs";
import { buildOpenFilesAssertions } from "./filesBookmarks/openFiles.mjs";
import { buildReaderActionsAssertions } from "./filesBookmarks/readerActions.mjs";
import { buildReloadRestoreAssertions } from "./filesBookmarks/reloadRestore.mjs";
import { buildTabsStartAssertions } from "./filesBookmarks/tabsStart.mjs";
import { buildWindowActionsAssertions } from "./filesBookmarks/windowActions.mjs";

const filesBookmarksAssertionBuilders = [
  buildFilesAssertions,
  buildBookmarksAssertions,
  buildOpenFilesAssertions,
  buildReaderActionsAssertions,
  buildWindowActionsAssertions,
  buildReloadRestoreAssertions,
  buildTabsStartAssertions,
];

export async function buildFilesBookmarksAssertions(context) {
  const assertions = {};
  for (const buildAssertions of filesBookmarksAssertionBuilders) {
    Object.assign(assertions, await buildAssertions(context));
  }
  return assertions;
}
