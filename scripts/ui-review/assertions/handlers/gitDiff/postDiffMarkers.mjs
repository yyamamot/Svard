const markerScenarios = new Set([
  "viewer-normal-git-markers-initial-working-tree-opt-in",
  "viewer-normal-git-markers-after-diff-opt-in",
  "viewer-normal-git-markers-disabled",
  "viewer-normal-git-markers-no-prior-diff",
  "viewer-normal-git-markers-context-clear",
  "viewer-normal-git-markers-privacy",
  "viewer-normal-git-markers-list-item-initial-working-tree",
  "viewer-normal-git-markers-list-item-after-diff",
  "viewer-normal-git-markers-list-item-deletion-fallback",
  "viewer-normal-git-markers-list-item-privacy",
  "viewer-normal-git-markers-table-row-cell-initial-working-tree",
  "viewer-normal-git-markers-table-row-cell-after-diff",
  "viewer-normal-git-markers-table-cell-markdown-diagnosis",
  "viewer-normal-git-markers-table-cell-asciidoc-regression",
  "viewer-normal-git-markers-table-cell-untracked-not-applicable",
  "viewer-normal-git-markers-table-cell-complex-fallback",
  "viewer-git-change-visual-contract-block",
  "viewer-git-change-visual-contract-list-item",
  "viewer-git-change-visual-contract-inline",
  "viewer-git-change-visual-contract-deletion-fallback",
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
  const visualContract = await page.evaluate(
    () => window.__SVARD_GIT_CHANGE_VISUAL_CONTRACT__ ?? null,
  );
  const visualContractPrivate = !JSON.stringify(visualContract).includes(
    "/workspace/",
  );

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
    hasInitialWorkingTreeListItemGitMarkers:
      scenario === "viewer-normal-git-markers-list-item-initial-working-tree"
        ? summary?.visible === true &&
          summary?.initialWorkingTree === true &&
          summary?.listItemMarker === true &&
          summary?.itemHighlightCount > 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    hasPostDiffListItemGitMarkers:
      scenario === "viewer-normal-git-markers-list-item-after-diff"
        ? summary?.visible === true &&
          summary?.listItemMarker === true &&
          summary?.itemHighlightCount > 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    fallsBackForHiddenDeletedListItems:
      scenario === "viewer-normal-git-markers-list-item-deletion-fallback"
        ? summary?.visible === true &&
          summary?.deletionFallback === true &&
          summary?.itemHighlightCount === 0 &&
          summary?.blockHighlightCount === 0 &&
          summary?.markerCount > 0
        : true,
    keepsPostDiffListItemMarkerArtifactPrivacySafe:
      scenario === "viewer-normal-git-markers-list-item-privacy"
        ? privacySafe &&
          summary?.listItemMarker === true &&
          summary?.itemHighlightCount > 0
        : true,
    hasInitialWorkingTreeTableCellGitMarkers:
      scenario === "viewer-normal-git-markers-table-row-cell-initial-working-tree"
        ? summary?.visible === true &&
          summary?.initialWorkingTree === true &&
          summary?.tableMarker === true &&
          summary?.tableCellMarkerCount > 0 &&
          summary?.tableReasonCounts?.["same-schema-cell-change"] > 0 &&
          summary?.tableRowHighlightCount > 0 &&
          summary?.tableCellHighlightCount > 0 &&
          summary?.parentTableHighlightCount === 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    hasPostDiffTableCellGitMarkers:
      scenario === "viewer-normal-git-markers-table-row-cell-after-diff"
        ? summary?.visible === true &&
          summary?.afterDiffHandoff === true &&
          summary?.tableMarker === true &&
          summary?.tableCellMarkerCount > 0 &&
          summary?.tableReasonCounts?.["same-schema-cell-change"] > 0 &&
          summary?.tableRowHighlightCount > 0 &&
          summary?.tableCellHighlightCount > 0 &&
          summary?.parentTableHighlightCount === 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    diagnosesMarkdownTableCellGitMarkers:
      scenario === "viewer-normal-git-markers-table-cell-markdown-diagnosis"
        ? privacySafe &&
          summary?.visible === true &&
          summary?.markdownTableDiagnosis === true &&
          summary?.tableMarker === true &&
          summary?.tableCellMarkerCount > 0 &&
          summary?.tableReasonCounts?.["same-schema-cell-change"] > 0 &&
          summary?.tableRowHighlightCount > 0 &&
          summary?.tableCellHighlightCount > 0 &&
          summary?.parentTableHighlightCount === 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    keepsAsciiDocTableCellGitMarkers:
      scenario === "viewer-normal-git-markers-table-cell-asciidoc-regression"
        ? privacySafe &&
          summary?.visible === true &&
          summary?.asciidocTableRegression === true &&
          summary?.tableMarker === true &&
          summary?.tableCellMarkerCount > 0 &&
          summary?.tableReasonCounts?.["same-schema-cell-change"] > 0 &&
          summary?.tableRowHighlightCount > 0 &&
          summary?.tableCellHighlightCount > 0 &&
          summary?.parentTableHighlightCount === 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    rendersUntrackedTableAsAddedRowMarkers:
      scenario === "viewer-normal-git-markers-table-cell-untracked-not-applicable"
        ? privacySafe &&
          summary?.visible === true &&
          summary?.wholeFileAddedTableRows === true &&
          summary?.tableAddedRowMarkerCount > 0 &&
          summary?.tableNotApplicableCount === 0 &&
          summary?.tableReasonCounts?.["untracked-or-whole-file-added"] > 0 &&
          summary?.tableRowHighlightCount > 0 &&
          summary?.tableCellHighlightCount > 0 &&
          summary?.parentTableHighlightCount === 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    fallsBackForComplexTableCellMarkers:
      scenario === "viewer-normal-git-markers-table-cell-complex-fallback"
        ? privacySafe &&
          summary?.visible === true &&
          summary?.complexTableFallback === true &&
          summary?.tableBlockFallbackCount > 0 &&
          summary?.tableReasonCounts?.["complex-or-shape-mismatch"] > 0 &&
          summary?.tableRowHighlightCount === 0 &&
          summary?.tableCellHighlightCount === 0 &&
          summary?.markerCount > 0 &&
          summary?.clickResult === true
        : true,
    hasGitChangeVisualContractBlock:
      scenario === "viewer-git-change-visual-contract-block"
        ? visualContractPrivate &&
          visualContract?.rendered?.blockCount > 0 &&
          visualContract?.normal?.blockCount > 0 &&
          visualContract?.normal?.tokenCount === 5 &&
          visualContract?.rendered?.blockBar?.width ===
            visualContract?.normal?.blockBar?.width &&
          visualContract?.rendered?.blockBar?.left ===
            visualContract?.normal?.blockBar?.left
        : true,
    hasGitChangeVisualContractListItem:
      scenario === "viewer-git-change-visual-contract-list-item"
        ? visualContractPrivate &&
          visualContract?.rendered?.itemCount > 0 &&
          visualContract?.normal?.itemCount > 0 &&
          visualContract?.rendered?.parentListTargetCount === 0 &&
          visualContract?.normal?.parentListTargetCount === 0 &&
          visualContract?.rendered?.itemBar?.width ===
            visualContract?.normal?.itemBar?.width &&
          visualContract?.rendered?.itemBar?.left ===
            visualContract?.normal?.itemBar?.left
        : true,
    hasGitChangeVisualContractInline:
      scenario === "viewer-git-change-visual-contract-inline"
        ? visualContractPrivate &&
          visualContract?.rendered?.inlineCount > 0 &&
          visualContract?.normal?.inlineCount > 0 &&
          visualContract?.rendered?.inline?.backgroundColor ===
            visualContract?.normal?.inline?.backgroundColor
        : true,
    hasGitChangeVisualContractDeletionFallback:
      scenario === "viewer-git-change-visual-contract-deletion-fallback"
        ? visualContractPrivate &&
          visualContract?.rendered === null &&
          visualContract?.normal?.markerCount > 0 &&
          visualContract?.normal?.blockCount === 0 &&
          visualContract?.normal?.itemCount === 0 &&
          visualContract?.normal?.inlineCount === 0
        : true,
  };
}
