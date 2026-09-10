import { exerciseAttachCurrentChange } from "./attachCurrentChange.mjs";
import {
  exerciseDiffContextReliability,
  exerciseAllDiffsSelection,
  exerciseAllDiffsMediaContext,
} from "./sourceControlAllDiffs/agentContext.mjs";
import { exerciseAllDiffsLinkBoundary } from "./sourceControlAllDiffs/linkBoundary.mjs";
import { inspectAllDiffsStream } from "./sourceControlAllDiffs/streamInspection.mjs";
import { exerciseAllDiffsKeybindings } from "./sourceControlAllDiffs/keybindings.mjs";
import { exerciseAllDiffsMouseGestures } from "./sourceControlAllDiffs/mouseGestures.mjs";
import { applyTooComplexSourceFallbackScenario } from "./sourceControlAllDiffs/sourceFallback.mjs";

export function isSourceControlAllDiffsScenario(scenario) {
  return (
    scenario === "viewer-all-diffs" ||
    scenario === "viewer-source-control-all-diffs" ||
    scenario === "viewer-source-control-all-diffs-mouse-gestures" ||
    scenario === "viewer-source-control-all-diffs-keybindings" ||
    scenario === "viewer-source-control-all-diffs-privacy" ||
    scenario === "viewer-source-control-all-diffs-selection" ||
    scenario === "viewer-source-control-all-diffs-media-context" ||
    scenario === "viewer-agent-chat-diff-context-reliability" ||
    scenario === "viewer-agent-chat-attach-current-change" ||
    scenario === "viewer-git-diff-too-complex-source-fallback"
  );
}

export async function applySourceControlAllDiffsScenario(page, context) {
  if (context?.scenario === "viewer-git-diff-too-complex-source-fallback") {
    await applyTooComplexSourceFallbackScenario(page);
    return;
  }
  await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
  await page
    .locator('[data-review-id="source-control-changes-list"]')
    .waitFor();
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-file-section"]')
    .first()
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .waitFor();
  if (context?.scenario === "viewer-all-diffs") {
    await exerciseAllDiffsLinkBoundary(page);
    return;
  }
  if (context?.scenario === "viewer-agent-chat-attach-current-change") {
    await exerciseAttachCurrentChange(page);
    return;
  }
  if (context?.scenario === "viewer-agent-chat-diff-context-reliability") {
    await exerciseDiffContextReliability(page);
    return;
  }
  if (context?.scenario === "viewer-source-control-all-diffs-selection") {
    await exerciseAllDiffsSelection(page);
    return;
  }
  if (context?.scenario === "viewer-source-control-all-diffs-media-context") {
    await exerciseAllDiffsMediaContext(page);
    return;
  }
  await inspectAllDiffsStream(page);
  if (context?.scenario === "viewer-source-control-all-diffs-keybindings") {
    await exerciseAllDiffsKeybindings(page);
    return;
  }
  if (context?.scenario !== "viewer-source-control-all-diffs-mouse-gestures") {
    return;
  }
  await exerciseAllDiffsMouseGestures(page);
}
