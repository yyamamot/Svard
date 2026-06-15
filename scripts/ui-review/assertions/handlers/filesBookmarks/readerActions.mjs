export async function buildReaderActionsAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  const contextMenuText = context.contextMenuText;
  const editorOpenRequests = context.editorOpenRequests;
  const geometryReviewIds = context.geometryReviewIds;
  return {
    hasCopyActions:
      scenario === "viewer-copy-actions"
        ? bodyText.includes("Copy Actions") &&
          (await page
            .locator('[data-review-id="source-copy-button"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="source-reference-copy-button"]')
            .count()) > 0 &&
          (await page.locator('[data-review-id="inline-notice"]').count()) === 0
        : true,
    hasCodeBlockActions:
      scenario === "viewer-code-block-actions"
        ? bodyText.includes("Copy Actions") &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_CODE_BLOCK_ACTIONS_SEEN__),
          )) &&
          geometryReviewIds.has("source-block-toolbar") &&
          geometryReviewIds.has("source-block-language") &&
          geometryReviewIds.has("source-copy-button") &&
          geometryReviewIds.has("source-reference-copy-button") &&
          geometryReviewIds.has("source-wrap-toggle") &&
          geometryReviewIds.has("source-collapse-toggle")
        : true,
    hasAsciiDocCodeHighlight:
      scenario === "viewer-asciidoc-code-highlight"
        ? bodyText.includes("Copy Actions") &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_ASCIIDOC_CODE_HIGHLIGHT_SEEN__),
          )) &&
          geometryReviewIds.has("source-block-toolbar") &&
          geometryReviewIds.has("source-block-language")
        : true,
    hasSectionCollapse:
      scenario === "viewer-section-collapse"
        ? bodyText.includes("Copy Actions") &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_SECTION_COLLAPSE_SEEN__),
          )) &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_SECTION_COLLAPSE_EXPANDED__),
          )) &&
          geometryReviewIds.has("section-collapse-toggle")
        : true,
    hasSectionCollapseSearchAutoExpand:
      scenario === "viewer-section-collapse-search-auto-expand"
        ? bodyText.includes("Copy Actions") &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_SECTION_COLLAPSE_SEARCH_EXPANDED__),
          )) &&
          geometryReviewIds.has("section-collapse-toggle") &&
          geometryReviewIds.has("search-hit")
        : true,
    hasSectionCopy:
      scenario === "viewer-section-copy"
        ? (await page.evaluate(() =>
            Boolean(window.__SVARD_SECTION_COPY_MENU_SEEN__),
          )) &&
          geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-copy-section-reference") &&
          !geometryReviewIds.has("context-menu-item-copy-section")
        : true,
    hasLightweightActionFeedback:
      scenario === "viewer-lightweight-action-feedback"
        ? geometryReviewIds.has("lightweight-action-feedback") &&
          (await page.locator('[data-review-id="inline-notice"]').count()) === 0
        : true,
    hasLinkHoverStatus:
      scenario === "viewer-link-hover-status"
        ? bodyText.includes("Copy Actions") &&
          (await page
            .locator('[data-review-id="link-hover-status"]')
            .filter({ hasText: "/workspace/docs/render-fixtures.adoc" })
            .count()) === 1
        : true,
    hasLocalLinkPreview:
      scenario === "viewer-local-link-preview"
        ? await page.evaluate(() => {
            const check = window.__SVARD_LOCAL_LINK_PREVIEW_CHECK__;
            return (
              check?.sameDocumentPreviewSeen === true &&
              check?.localPreviewSeen === true &&
              check?.externalPreviewSuppressed === true
            );
          })
        : true,
    hasLocalLinkDedupTabs:
      scenario === "viewer-local-link-dedup-tabs"
        ? bodyText.includes("Render Fixtures") &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "render-fixtures.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"].active')
            .filter({ hasText: "render-fixtures.adoc" })
            .count()) === 1
        : true,
    hasContextMenuDocument:
      scenario === "viewer-context-menu-document"
        ? geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-copy-source") &&
          geometryReviewIds.has("context-menu-item-copy-source-reference")
        : true,
    hasTableCopy:
      scenario === "viewer-table-copy"
        ? (await page.evaluate(() =>
            Boolean(window.__SVARD_TABLE_COPY_MENU_SEEN__),
          )) &&
          geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-copy-table-tsv") &&
          geometryReviewIds.has("context-menu-item-copy-table-csv") &&
          geometryReviewIds.has("context-menu-item-copy-table-markdown") &&
          geometryReviewIds.has("context-menu-item-copy-table-reference") &&
          contextMenuText.includes("Copy as TSV") &&
          contextMenuText.includes("Copy as CSV") &&
          contextMenuText.includes("Copy as Markdown Table")
        : true,
    hasContextMenuSearchToc:
      scenario === "viewer-context-menu-search-toc"
        ? geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-open-result") &&
          geometryReviewIds.has("context-menu-item-copy-source-reference")
        : true,
    hasWorkspaceSearch:
      scenario === "viewer-workspace-search"
        ? (await page.evaluate(() => {
            const result = window.__SVARD_WORKSPACE_SEARCH_CHECK__;
            return (
              result?.hasScope === true &&
              result?.inputValue === "Graphviz" &&
              result?.resultCount >= 1 &&
              result?.activePath ===
                "/workspace/docs/graphviz-diagnostic.adoc" &&
              result?.hasSourceLineTarget === true &&
              result?.hasRawSourceDump === false
            );
          })) &&
          geometryReviewIds.has("search-scope-control") &&
          geometryReviewIds.has("workspace-search-result-item")
        : true,
    hasWorkspaceSearchPerformance:
      scenario === "viewer-workspace-search-performance"
        ? (await page.evaluate(() => {
            const result = window.__SVARD_WORKSPACE_SEARCH_PERF_CHECK__;
            return (
              result?.hasScope === true &&
              result?.inputValue === "Graphviz" &&
              result?.resultCount >= 1
            );
          })) &&
          geometryReviewIds.has("search-scope-control") &&
          geometryReviewIds.has("workspace-search-result-item")
        : true,
    hasOpenInEditor:
      scenario === "viewer-open-in-editor"
        ? geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-open-in-editor") &&
          contextMenuText.includes("Open in Editor") &&
          editorOpenRequests.includes("/workspace/docs/mvp-guide.adoc") &&
          bodyText.includes("Open in Editor requested for mvp-guide.adoc")
        : true,
    hasCopyHeadingLink:
      scenario === "viewer-copy-heading-link"
        ? (await page
            .locator('[data-review-id="heading-link-copy"]')
            .count()) === 0 &&
          (await page.evaluate(
            () =>
              window.__SVARD_COPY_HEADING_LINK_CHECK__
                ?.copiedFromTocContextMenu === true,
          )) &&
          commandAutomation.availableCommands.includes("heading.copyLink")
        : true,
  };
}
