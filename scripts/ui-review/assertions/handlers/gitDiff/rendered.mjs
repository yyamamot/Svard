export async function buildGitDiffRenderedAssertions(context, samples) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const geometryReviewIds = context.geometryReviewIds;
  const diffRegressionSuite = samples.diffRegressionSuite;
  const renderedPlaceholderGrouping = samples.renderedPlaceholderGrouping;
  return {
    hasGitDiffRenderedMarkdown:
      scenario === "viewer-git-diff-rendered-markdown"
        ? (await page
            .locator('[data-review-id="git-rendered-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-rendered-left-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-rendered-right-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-rendered-block"]')
            .count()) > 0
        : true,
    hasDiffRenderedContextMenu:
      scenario === "viewer-diff-context-menu-rendered"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_CONTEXT_MENU_RENDERED__;
            const layering = result?.contextMenuLayering;
            return (
              result?.sourceContextMenuText?.includes("Copy Source") &&
              (result?.backgroundContextMenuText?.includes("Open in Editor") ||
                result?.backgroundContextMenuText?.includes(
                  "Copy Pane Text",
                )) &&
              Number.isFinite(layering?.menuZIndex) &&
              Number.isFinite(layering?.backdropZIndex) &&
              layering.menuZIndex > layering.backdropZIndex
            );
          })
        : true,
    hasGitDiffRenderedAsciiDoc:
      scenario === "viewer-git-diff-rendered-asciidoc"
        ? bodyText.includes("Git Rendered AsciiDoc Diff Fixture") &&
          bodyText.includes("Rendered admonitions are compared as blocks") &&
          bodyText.includes("Changed") &&
          (await page
            .locator('[data-review-id="git-rendered-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-rendered-block"]')
            .count()) > 0
        : true,
    hasGitDiffRenderedDiagramPlaceholder:
      scenario === "viewer-git-diff-rendered-diagram-placeholder"
        ? bodyText.includes("Git Rendered Diagram Diff Fixture") &&
          !bodyText.includes("Diagram placeholder") &&
          !bodyText.includes("A[Start]") &&
          (await page
            .locator('[data-review-id="git-rendered-diff"]')
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="git-rendered-diff"] [data-review-id="mermaid-render"] [data-review-id="diagram-inline-image"] svg',
            )
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="git-rendered-diff"] [data-review-id="plantuml-render"] [data-review-id="diagram-inline-image"] svg',
            )
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="git-rendered-diff"] [data-review-id="graphviz-render"] [data-review-id="diagram-inline-image"] svg',
            )
            .count()) > 0
        : true,
    hasGitDiffMarkdownTable:
      scenario === "viewer-git-diff-markdown-table"
        ? bodyText.includes("docs/git-table.md") &&
          bodyText.includes("$10") &&
          bodyText.includes("$12") &&
          bodyText.includes("Enterprise") &&
          (await page
            .locator('[data-review-id="git-diff-table-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-table-cell"]')
            .count()) > 0
        : true,
    hasDiffTableContextMenu:
      scenario === "viewer-diff-context-menu-table"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_CONTEXT_MENU_TABLE__;
            const text = result?.tableCellContextMenuText;
            return (
              text?.includes("Copy as TSV") &&
              text?.includes("Copy as CSV") &&
              text?.includes("Copy as Markdown Table") &&
              result?.tableBackgroundContextMenuText?.includes("Open in Editor")
            );
          })
        : true,
    hasGitDiffAsciiDocTableDom:
      scenario === "viewer-git-diff-asciidoc-table-dom"
        ? bodyText.includes("Git AsciiDoc Table Diff Fixture") &&
          bodyText.includes("Rendered") &&
          bodyText.includes("Changed") &&
          (await page
            .locator('[data-review-id="git-diff-table-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-table-cell"]')
            .count()) > 0
        : true,
    hasGitDiffAsciiDocTableMarker:
      scenario === "viewer-git-diff-asciidoc-table-marker"
        ? bodyText.includes("Git AsciiDoc Complex Table Diff Fixture") &&
          bodyText.includes("Table block changed") &&
          (await page
            .locator('[data-review-id="git-diff-asciidoc-table-badge"]')
            .count()) > 0
        : true,
    hasRenderedDiffQuality:
      scenario === "viewer-rendered-diff-quality"
        ? bodyText.includes("Diff Preview Regression Gallery") &&
          bodyText.includes("changes") &&
          (await page
            .locator('[data-review-id="git-full-preview-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-change-ruler-marker"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-diff-word-highlight"]')
            .count()) > 0
        : true,
    hasRenderedVisualDiffMarkdown:
      scenario === "viewer-rendered-visual-diff-markdown"
        ? bodyText.includes("Git Rendered Markdown Diff Fixture") &&
          bodyText.includes("was stable in HEAD") &&
          bodyText.includes("changed in the working tree") &&
          (await page
            .locator('[data-review-id="git-rendered-block"].changed.left-side')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-rendered-block"].changed.right-side')
            .count()) > 0
        : true,
    hasRenderedVisualDiffAsciiDoc:
      scenario === "viewer-rendered-visual-diff-asciidoc"
        ? bodyText.includes("Git Rendered AsciiDoc Diff Fixture") &&
          bodyText.includes("Rendered admonitions are compared as blocks") &&
          bodyText.includes("Changed") &&
          (await page
            .locator('[data-review-id="git-rendered-block"].changed.right-side')
            .count()) > 0
        : true,
    hasRenderedVisualDiffInlineHighlight:
      scenario === "viewer-rendered-visual-diff-inline-highlight"
        ? (await page
            .locator('[data-review-id="git-diff-word-highlight"].added')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-diff-word-highlight"].removed')
            .count()) > 0
        : true,
    hasRenderedVisualDiffMinimap:
      scenario === "viewer-rendered-visual-diff-minimap"
        ? (await page
            .locator('[data-review-id="git-diff-change-ruler-marker"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-diff-change-ruler-marker"].active')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-change-ruler"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-change-ruler-marker"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-diff-change-ruler-marker"].active')
            .count()) === 1
        : true,
    hasRenderedVisualDiffSectionOutline:
      scenario === "viewer-rendered-visual-diff-section-outline"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_SECTION_OUTLINE__;
            return (
              result?.sectionCount > 0 &&
              result?.totalChangeCount > 0 &&
              result?.activeSectionCount === 1
            );
          })
        : true,
    hasRenderedVisualDiffSectionOutlineListTable:
      scenario === "viewer-rendered-visual-diff-section-outline-list-table"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_SECTION_OUTLINE__;
            return (
              result?.sectionCount > 0 &&
              result?.totalChangeCount > 0 &&
              result?.listTargetCount > 0 &&
              result?.tableRowTargetCount > 0
            );
          })
        : true,
    hasRenderedVisualDiffSectionOutlinePrivacy:
      scenario === "viewer-rendered-visual-diff-section-outline-privacy"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_SECTION_OUTLINE__;
            if (!result) {
              return false;
            }
            const serialized = JSON.stringify(result);
            return (
              result.sectionCount > 0 &&
              !serialized.includes("Diff Preview Regression Gallery") &&
              !serialized.includes("/workspace/") &&
              !serialized.includes("@@")
            );
          })
        : true,
    hasRenderedVisualDiffListItemHighlight:
      scenario === "viewer-rendered-visual-diff-list-item-highlight-basic"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_LIST_ITEM_DIFF__;
            return (
              result?.highlightCount > 0 &&
              result?.itemTargetCount > 0 &&
              result?.parentTargetCount === 0 &&
              result?.fallback === false
            );
          })
        : true,
    hasRenderedVisualDiffListItemNavigation:
      scenario === "viewer-rendered-visual-diff-list-item-navigation"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_LIST_ITEM_DIFF__;
            return (
              result?.highlightCount > 0 &&
              result?.itemTargetCount > 0 &&
              result?.parentTargetCount === 0 &&
              result?.activeMarkerCount === 1
            );
          })
        : true,
    hasRenderedVisualDiffListItemFallback:
      scenario ===
      "viewer-rendered-visual-diff-list-item-low-confidence-fallback"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_LIST_ITEM_DIFF__;
            return (
              result?.highlightCount === 0 &&
              result?.itemTargetCount === 0 &&
              result?.fallback === true
            );
          })
        : true,
    hasRenderedVisualDiffListItemPrivacy:
      scenario === "viewer-rendered-visual-diff-list-item-privacy"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RENDERED_LIST_ITEM_DIFF__;
            if (!result) {
              return false;
            }
            const serialized = JSON.stringify(result);
            return (
              result.highlightCount > 0 &&
              !serialized.includes("Added working-tree item") &&
              !serialized.includes("/workspace/") &&
              !serialized.includes("@@")
            );
          })
        : true,
    hasDiffFullPreviewMarkdown:
      scenario === "viewer-diff-full-preview-markdown"
        ? bodyText.includes("Git Rendered Markdown Diff Fixture") &&
          bodyText.includes("was stable in HEAD") &&
          bodyText.includes("changed in the working tree") &&
          (await page
            .locator('[data-review-id="git-full-preview-diff"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-full-preview-block"].unchanged')
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].changed.right-side',
            )
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-diff-word-highlight"]')
            .count()) > 0 &&
          (await page.locator(".git-rendered-block-meta").count()) === 0
        : true,
    hasDiffCodeSyntaxHighlight:
      scenario === "viewer-diff-code-syntax-highlight"
        ? bodyText.includes("Git Rendered Markdown Diff Fixture") &&
          bodyText.includes("readLabel") &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-diff"] .git-rendered-block-content pre.hljs .hljs-keyword',
            )
            .count()) > 0 &&
          (await page.evaluate(() => {
            const check = window.__SVARD_DIFF_CODE_HIGHLIGHT_CHECK__ ?? {};
            return Boolean(check.fullPreviewCheck && check.changesOnlyCheck);
          }))
        : true,
    hasDiffCodeFenceWordHighlight:
      scenario === "viewer-diff-code-fence-word-highlight"
        ? bodyText.includes("Git Rendered Markdown Diff Fixture") &&
          (await page.evaluate(() => {
            const result =
              window.__SVARD_DIFF_CODE_FENCE_WORD_HIGHLIGHT__ ?? {};
            const samples = [
              result.fullPreviewCheck,
              result.changesOnlyCheck,
            ].filter(Boolean);
            return (
              samples.length === 2 &&
              samples.every(
                (sample) =>
                  sample.hasCodeWordHighlight === true &&
                  sample.codeHighlightCount > 0 &&
                  sample.codeHighlightsHaveNoReviewId === true &&
                  sample.preservesSyntaxTokens === true &&
                  sample.hasNoMathHighlight === true &&
                  sample.hasNoSvgHighlight === true,
              )
            );
          }))
        : true,
    hasDiffFullPreviewBacklogResync:
      scenario === "viewer-diff-full-preview-backlog-resync"
        ? bodyText.includes("Backlog Resync Diff Fixture") &&
          bodyText.includes("IMP-096: Lightweight action feedback") &&
          bodyText.includes("IMP-097: Pinned search color model polish") &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].unchanged:has-text("IMP-096: Lightweight action feedback")',
            )
            .count()) === 2 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].unchanged:has-text("IMP-097: Pinned search color model polish")',
            )
            .count()) === 2 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].removed:has-text("IMP-095: Content cursor for technical documents")',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].added:has-text("IMP-096: Lightweight action feedback"), [data-review-id="git-full-preview-block"].removed:has-text("IMP-096: Lightweight action feedback"), [data-review-id="git-full-preview-block"].changed:has-text("IMP-096: Lightweight action feedback")',
            )
            .count()) === 0
        : true,
    hasDiffDiagramUnchangedWithImageChange:
      scenario === "viewer-diff-diagram-unchanged-with-image-change"
        ? bodyText.includes("Diagram Image Diff Fixture") &&
          !bodyText.includes("flowchart TD") &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].unchanged [data-review-id="mermaid-render"]',
            )
            .count()) === 2 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].changed [data-review-id="mermaid-render"], [data-review-id="git-full-preview-block"].added [data-review-id="mermaid-render"], [data-review-id="git-full-preview-block"].removed [data-review-id="mermaid-render"]',
            )
            .count()) === 0 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].added.right-side img[alt="Added image"]',
            )
            .count()) === 1
        : true,
    hasDiffImagePlaceholderSourceChange:
      scenario === "viewer-diff-image-placeholder-source-change"
        ? bodyText.includes("Image Placeholder Source Diff Fixture") &&
          bodyText.includes("Image: Shared remote image") &&
          !bodyText.includes("old-remote-image.png") &&
          !bodyText.includes("new-remote-image.png") &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].changed.left-side:has-text("Image: Shared remote image")',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].changed.right-side:has-text("Image: Shared remote image")',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-block"].unchanged:has-text("Image: Shared remote image")',
            )
            .count()) === 0
        : true,
    hasDiffExternalImagesSecurityPolicy:
      scenario === "viewer-diff-external-images-security-policy"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIFF_EXTERNAL_IMAGE_POLICY__;
            return (
              result?.blockedSample?.remoteImages === 0 &&
              result?.blockedSample?.rawUrlVisible === false &&
              result?.enabledSample?.remoteImages >= 2
            );
          })
        : true,
    hasContentCursorDiffPreview:
      scenario === "viewer-content-cursor-diff-preview" ||
      scenario === "viewer-content-cursor-diff-change-only"
        ? geometryReviewIds.has("content-cursor-active") &&
          (await page
            .locator(
              '[data-review-id="git-full-preview-right-pane"] [data-review-id="content-cursor-active"]',
            )
            .count()) === 1 &&
          (scenario === "viewer-content-cursor-diff-change-only"
            ? (await page
                .locator(
                  '[data-review-id="content-cursor-active"].change-target',
                )
                .count()) === 1 &&
              (await page
                .locator('[data-review-id="content-cursor-active"].unchanged')
                .count()) === 0
            : true)
        : true,
    hasDiffPreviewRegressionSuite:
      scenario === "viewer-diff-preview-regression-suite"
        ? diffRegressionSuite?.hasGalleryTitle === true &&
          diffRegressionSuite?.hasJapaneseChange === true &&
          diffRegressionSuite?.hasPreviewBasedDiff === true &&
          diffRegressionSuite?.hasFullPreview === true &&
          diffRegressionSuite?.hasNoPreviewMeta === true &&
          (diffRegressionSuite?.highlightCount ?? 0) > 0 &&
          diffRegressionSuite?.hasOnlyTextHighlights === true &&
          diffRegressionSuite?.hasOnlyVisibleHighlights === true &&
          (diffRegressionSuite?.nestedListCount ?? 0) > 0 &&
          diffRegressionSuite?.hasChangedBlock === true &&
          diffRegressionSuite?.hasAddedBlock === true &&
          diffRegressionSuite?.hasRemovedBlock === true &&
          diffRegressionSuite?.hasReadableTableCells === true &&
          (diffRegressionSuite?.unrelatedBlocks ?? []).length > 0 &&
          (diffRegressionSuite?.unrelatedBlocks ?? []).every(
            (block) => !block.changed && (block.added || block.removed),
          )
        : true,
    hasRenderedDiffPlaceholderGrouping:
      scenario === "viewer-rendered-diff-placeholder-grouping"
        ? (renderedPlaceholderGrouping?.groupCount ?? 0) > 0 &&
          (renderedPlaceholderGrouping?.groupTexts ?? []).some((text) =>
            /(Added on right|Removed on left)/.test(text),
          ) &&
          (renderedPlaceholderGrouping?.groupLabels ?? []).some((label) =>
            /Added (section|content)\s*·\s*\d+ blocks/.test(label),
          ) &&
          (renderedPlaceholderGrouping?.groupLabels ?? []).every(
            (label) => !/heading added \d+ blocks/i.test(label),
          ) &&
          renderedPlaceholderGrouping?.groupChangeTargetCount === 0 &&
          renderedPlaceholderGrouping?.activeTargetText !== ""
        : true,
  };
}
