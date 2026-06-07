import { applyAppShellScenario } from "./handlers/appShell.mjs";
import { applyDiagramsMarkdownScenario } from "./handlers/diagramsMarkdown.mjs";
import { applyFilesBookmarksScenario } from "./handlers/filesBookmarks.mjs";
import { applyGitDiffScenario } from "./handlers/gitDiff.mjs";
import { applyInteractionLayoutScenario } from "./handlers/interactionLayout.mjs";
import { applyRuntimeScenario } from "./handlers/runtime.mjs";

const scenarioHandlers = [
  applyAppShellScenario,
  applyInteractionLayoutScenario,
  applyFilesBookmarksScenario,
  applyDiagramsMarkdownScenario,
  applyGitDiffScenario,
  applyRuntimeScenario,
];

export async function applyScenario(context) {
  for (const handler of scenarioHandlers) {
    if (await handler(context)) {
      return;
    }
  }

  if (context.scenario !== "viewer-basic") {
    throw new Error(`Unknown UI review scenario: ${context.scenario}`);
  }
}
