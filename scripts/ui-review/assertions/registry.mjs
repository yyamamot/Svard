import { buildAppShellAssertions } from "./handlers/appShell.mjs";
import { buildCoreAssertions } from "./handlers/core.mjs";
import { buildDiagramsMarkdownAssertions } from "./handlers/diagramsMarkdown.mjs";
import { buildFilesBookmarksAssertions } from "./handlers/filesBookmarks.mjs";
import { buildGitDiffAssertions } from "./handlers/gitDiff.mjs";

const assertionBuilders = [
  buildCoreAssertions,
  buildAppShellAssertions,
  buildFilesBookmarksAssertions,
  buildDiagramsMarkdownAssertions,
  buildGitDiffAssertions,
];

export async function buildAssertions(context) {
  const assertions = {};
  for (const buildGroupAssertions of assertionBuilders) {
    Object.assign(assertions, await buildGroupAssertions(context));
  }
  return assertions;
}
