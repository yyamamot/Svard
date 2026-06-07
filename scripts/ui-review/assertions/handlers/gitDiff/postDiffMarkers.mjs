const markerScenarios = new Set([
  "viewer-normal-git-markers-initial-working-tree-opt-in",
  "viewer-normal-git-markers-after-diff-opt-in",
  "viewer-normal-git-markers-disabled",
  "viewer-normal-git-markers-no-prior-diff",
  "viewer-normal-git-markers-context-clear",
  "viewer-normal-git-markers-privacy",
]);

export async function buildGitDiffPostDiffMarkerAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (!markerScenarios.has(scenario)) {
    return {};
  }

  const summary = await page.evaluate(
    () => window.__SVARD_POST_DIFF_MARKER_SUMMARY__ ?? null,
  );
  const serialized = JSON.stringify(summary);
  const privacySafe =
    !serialized.includes("/Users/") &&
    !serialized.includes("/workspace/") &&
    !serialized.includes("diff --git") &&
    !serialized.includes("diagramSource") &&
    !serialized.includes("endpointUrl");

  return {
    hasPostDiffGitMarkerSummary: Boolean(summary),
    hasInitialWorkingTreeGitMarkersWhenOptedIn:
      scenario === "viewer-normal-git-markers-initial-working-tree-opt-in"
        ? summary?.visible === true &&
          summary?.initialWorkingTree === true &&
          summary?.markerCount > 0 &&
          summary?.renderedMarkerCount > 0 &&
          summary?.blockHighlightCount > 0 &&
          summary?.inlineAddedCount > 0 &&
          summary?.clickResult === true
        : true,
    hasPostDiffGitMarkersWhenOptedIn:
      scenario === "viewer-normal-git-markers-after-diff-opt-in"
        ? summary?.visible === true &&
          summary?.markerCount > 0 &&
          summary?.renderedMarkerCount > 0 &&
          summary?.blockHighlightCount > 0 &&
          summary?.inlineAddedCount > 0 &&
          summary?.clickResult === true
        : true,
    hidesPostDiffGitMarkersWhenDisabled:
      scenario === "viewer-normal-git-markers-disabled"
        ? summary?.visible === false && summary?.disabled === true
        : true,
    hidesPostDiffGitMarkersWithoutPriorDiff:
      scenario === "viewer-normal-git-markers-no-prior-diff"
        ? summary?.visible === false &&
          summary?.noPriorDiff === true &&
          summary?.cleanWorkingTree === true
        : true,
    clearsPostDiffGitMarkersOnContextChange:
      scenario === "viewer-normal-git-markers-context-clear"
        ? summary?.visible === true &&
          summary?.hiddenOnOtherDocument === true &&
          summary?.restoredAfterReturn === true &&
          summary?.blockHighlightCount > 0 &&
          summary?.inlineAddedCount > 0
        : true,
    keepsPostDiffGitMarkerArtifactPrivacySafe:
      scenario === "viewer-normal-git-markers-privacy" ? privacySafe : true,
  };
}
