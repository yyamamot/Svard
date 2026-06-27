export async function buildFilesAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  return {
    hasFileTree:
      scenario === "viewer-files" || scenario === "viewer-files-tree"
        ? (await page.locator('[data-review-id="file-tree"]').count()) > 0 &&
          (await page.locator('[data-review-id="file-toolbar"]').count()) ===
            1 &&
          (await page.locator('[data-review-id="tree-root"]').count()) === 1 &&
          (await page.locator('[data-review-id="file-actions"]').count()) ===
            0 &&
          (await page.locator('[data-review-id="sidebar-tabs"]').count()) ===
            1 &&
          (await page
            .locator('[data-review-id="file-tree-open-menu-trigger"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="tree-refresh"]').count()) > 0 &&
          (await page.locator('[data-review-id="tree-collapse-all"]').count()) >
            0
        : true,
    hasTreeRootHierarchy:
      scenario === "viewer-files-tree"
        ? await page.evaluate(() => {
            const root = document.querySelector('[data-review-id="tree-root"]');
            const row = document.querySelector(
              '[data-review-id="tree-folder-toggle"], [data-review-id="tree-file"]',
            );
            if (
              !(root instanceof HTMLElement) ||
              !(row instanceof HTMLElement)
            ) {
              return false;
            }
            const rootStyle = window.getComputedStyle(root);
            const rowStyle = window.getComputedStyle(row);
            const rootFontSize = Number.parseFloat(rootStyle.fontSize);
            const rowFontSize = Number.parseFloat(rowStyle.fontSize);
            const rootWeight = Number.parseFloat(rootStyle.fontWeight);
            return (
              root.querySelector("svg") !== null &&
              rootFontSize >= rowFontSize &&
              rootWeight >= 700
            );
          })
        : true,
    hasTreeScenario:
      scenario === "viewer-files-tree"
        ? bodyText.includes("Quick Start") &&
          (await page.locator('[data-review-id="tree-file"].active').count()) >
            0
        : true,
    hasFileTreeAutoRefresh:
      scenario === "viewer-files-tree-auto-refresh"
        ? bodyText.includes("auto-created.md") &&
          (await page
            .locator(
              '[data-review-id="tree-file"][data-git-status="untracked"]',
            )
            .filter({ hasText: "auto-created.md" })
            .count()) === 1
        : true,
    hasFileTreeNewFileWatchRefresh:
      scenario === "viewer-file-tree-new-file-watch-refresh"
        ? bodyText.includes("new-watch-file.md") &&
          (await page
            .locator('[data-review-id="tree-file"]')
            .filter({ hasText: "new-watch-file.md" })
            .count()) === 1
        : true,
    hasFileTreeToolbarActions:
      scenario === "viewer-file-tree-toolbar-actions"
        ? (await page.evaluate(() => {
            const result = window.__SVARD_FILE_TREE_TOOLBAR_ACTIONS_CHECK__;
            return (
              result?.trigger?.text === "" &&
              result?.trigger?.ariaLabel === "Open file or folder" &&
              result?.trigger?.title === "Open file or folder" &&
              result?.toolbarStyle?.display === "grid" &&
              result?.toolbar?.rect?.height <= 48 &&
              result?.root?.rect?.y >= result?.toolbar?.rect?.y &&
              result?.root?.rect?.bottom <= result?.toolbar?.rect?.bottom + 1 &&
              result?.trigger?.rect?.y >= result?.toolbar?.rect?.y &&
              result?.trigger?.rect?.bottom <=
                result?.toolbar?.rect?.bottom + 1 &&
              result?.firstTreeRow?.rect?.y > result?.toolbar?.rect?.y &&
              result?.openMenu?.role === "menu" &&
              result?.openFile?.text === "Open File..." &&
              result?.openFile?.role === "menuitem" &&
              result?.openFolder?.text === "Open Folder..." &&
              result?.openFolder?.role === "menuitem" &&
              result?.refresh?.ariaLabel === "Refresh file tree" &&
              result?.refresh?.title === "Refresh file tree" &&
              result?.collapse?.ariaLabel === "Collapse all folders" &&
              result?.collapse?.title === "Collapse all folders" &&
              Array.isArray(result?.itemOrder) &&
              result.itemOrder.join(" / ") === "Open File... / Open Folder..."
            );
          })) && bodyText.includes("copy-actions.adoc")
        : true,
    hasDocumentsView:
      scenario === "viewer-files-documents-view"
        ? bodyText.includes("Git Diff Modified Fixture") &&
          (await page.evaluate(() => {
            const result = window.__SVARD_DOCUMENTS_VIEW_CHECK__;
            return (
              result?.collapseAriaLabel === "Collapse all document sections" &&
              result?.collapseTitle === "Collapse all document sections" &&
              result?.activeRowText?.includes("Git Diff Modified Fixture") &&
              result?.revealCommandTitle ===
                "Reveal Current Document in Docs Order" &&
              result?.revealCommandEnabled === false
            );
          }))
        : true,
    hasDocumentsSourceControl:
      scenario === "viewer-files-documents-source-control"
        ? bodyText.includes("git-modified.md") &&
          (await page.evaluate(() => {
            const result = window.__SVARD_DOCUMENTS_SOURCE_CONTROL_CHECK__;
            return (
              result?.panelOpened === true &&
              result?.badgeLabel ===
                "Modified in Git. Open rendered diff for git-modified.md" &&
              result?.suggestionLabel === "Docs: MkDocs detected"
            );
          })) &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 0
        : true,
    hasDocumentsSourceControlFilter:
      scenario === "viewer-files-documents-source-control-filter"
        ? (await page
            .locator('[data-review-id="documents-source-filter"]')
            .count()) === 1 &&
          ((await page
            .locator('[data-review-id="documents-source-filter-changed"]')
            .getAttribute("aria-pressed")) ?? "") === "true" &&
          (await page
            .locator('[data-review-id="documents-view-row"]')
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="documents-view-row"]:not([data-git-status])',
            )
            .count()) === 0
        : true,
    hasDocumentsSourceControlPrivacy:
      scenario === "viewer-files-documents-source-control-privacy"
        ? await page.evaluate(() => {
            const result =
              window.__SVARD_DOCUMENTS_SOURCE_CONTROL_PRIVACY_CHECK__;
            return (
              result?.bodyHasPrivatePath === false &&
              result?.bodyHasDiffHunk === false &&
              Array.isArray(result?.rowStatuses) &&
              result.rowStatuses.every((status) => Boolean(status)) &&
              result?.rowCount > 0 &&
              result?.rowCount === result?.changedRowCount
            );
          })
        : true,
  };
}
