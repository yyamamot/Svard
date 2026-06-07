import { applyGitDiffFileCompareScenario } from "./gitDiff/fileCompare.mjs";
import { applyGitDiffNavigationScenario } from "./gitDiff/navigation.mjs";
import { applyGitDiffRenderedCoreScenario } from "./gitDiff/renderedCore.mjs";
import { applyGitDiffRichPreviewScenario } from "./gitDiff/richPreview.mjs";
import { applyGitDiffSourceControlScenario } from "./gitDiff/sourceControl.mjs";

const gitDiffScenarioHandlers = [
  applyGitDiffSourceControlScenario,
  applyGitDiffRenderedCoreScenario,
  applyGitDiffRichPreviewScenario,
  applyGitDiffNavigationScenario,
  applyGitDiffFileCompareScenario,
];

export async function applyGitDiffScenario(context) {
  for (const applyScenario of gitDiffScenarioHandlers) {
    if (await applyScenario(context)) {
      return true;
    }
  }
  return false;
}
