export async function buildFilesBookmarksAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  const contextMenuText = context.contextMenuText;
  const editorOpenRequests = context.editorOpenRequests;
  const geometryReviewIds = context.geometryReviewIds;
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
    hasBookmarks:
      scenario === "viewer-bookmarks"
        ? bodyText.includes("Svard MVP Guide") &&
          (await page.locator('[data-review-id="sidebar-tabs"]').count()) ===
            1 &&
          (await page.locator('[data-review-id="bookmarks-panel"]').count()) ===
            1 &&
          (await page.locator('[data-review-id="file-toolbar"]').count()) ===
            0 &&
          (await page.locator('[data-review-id="tree-root"]').count()) === 0 &&
          (await page.locator('[data-review-id="file-actions"]').count()) ===
            0 &&
          (await page
            .locator('[data-review-id="bookmark-add-active"]')
            .filter({ hasText: "Add file" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="bookmark-add-root"]')
            .filter({ hasText: "Added folder" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="bookmark-section"]')
            .filter({ hasText: "Folders" })
            .count()) === 1 &&
          !bodyText.includes("Add Active") &&
          !bodyText.includes("Add Root") &&
          (await page.locator('[data-review-id="bookmark-item"]').count()) >=
            1 &&
          (await page.locator('[data-review-id="bookmark-remove"]').count()) >=
            1 &&
          commandAutomation.availableCommands.includes(
            "bookmark.toggleActive",
          ) &&
          commandAutomation.availableCommands.includes("sidebar.showFiles") &&
          commandAutomation.availableCommands.includes("sidebar.showBookmarks")
        : true,
    hasOpenFilesDragReorder:
      scenario === "viewer-drag-reorder-open-files"
        ? (await page
            .locator('[data-review-id="open-file-drag-handle"]')
            .count()) === 0 &&
          (await page.locator('[data-review-id="open-file-item"]').count()) >=
            4 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .first()
            .textContent()
            .then((text) => text?.includes("preferences.adoc"))) === true &&
          bodyText.includes("Render Fixtures")
        : true,
    hasBookmarkDragReorder:
      scenario === "viewer-drag-reorder-bookmarks"
        ? (await page
            .locator('[data-review-id="bookmark-drag-handle"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="bookmark-move-up"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="bookmark-move-down"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="bookmark-item"]')
            .first()
            .textContent()
            .then((text) => text?.includes("workspace"))) === true
        : true,
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
    hasContextMenuNavigation:
      scenario === "viewer-context-menu-navigation"
        ? (await page.evaluate(() => {
            const sample = window.__SVARD_CONTEXT_MENU_NAVIGATION_CHECK__;
            const lacksPrimary = (labels) =>
              Array.isArray(labels) &&
              !labels.includes("Open") &&
              !labels.includes("Activate");
            const treeLabels = sample?.treeLabels ?? [];
            const openFileLabels = sample?.openFileLabels ?? [];
            const bookmarkLabels = sample?.bookmarkLabels ?? [];
            const tabLabels = sample?.tabLabels ?? [];
            return (
              lacksPrimary(treeLabels) &&
              lacksPrimary(openFileLabels) &&
              lacksPrimary(bookmarkLabels) &&
              lacksPrimary(tabLabels) &&
              treeLabels.at(-2) === "Copy Path" &&
              treeLabels.at(-1) === "Bookmark" &&
              bookmarkLabels.at(-2) === "Copy Path" &&
              bookmarkLabels.at(-1) === "Remove" &&
              openFileLabels.includes("Copy Path") &&
              openFileLabels.includes("Close") &&
              openFileLabels.includes("Close All Files") &&
              tabLabels.includes("Copy Path") &&
              tabLabels.includes("Close") &&
              tabLabels.includes("Close All Files")
            );
          })) &&
          geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-copy-path") &&
          geometryReviewIds.has("context-menu-item-close") &&
          geometryReviewIds.has("context-menu-item-close-all-files")
        : true,
    hasOpenInNewWindowContextMenu:
      scenario === "viewer-open-in-new-window-context-menu"
        ? await page.evaluate(() => {
            const sample =
              window.__SVARD_OPEN_IN_NEW_WINDOW_CONTEXT_CHECK__ ?? {};
            const includesOpenInNewWindow = (labels) =>
              Array.isArray(labels) && labels.includes("Open in New Window");
            const excludesOpenInNewWindow = (labels) =>
              Array.isArray(labels) && !labels.includes("Open in New Window");
            const excludesDuplicateWindow = (labels) =>
              Array.isArray(labels) && !labels.includes("Duplicate Window");
            const requests = sample.requests ?? [];
            return (
              includesOpenInNewWindow(sample.treeFileLabels) &&
              includesOpenInNewWindow(sample.openFileLabels) &&
              includesOpenInNewWindow(sample.tabLabels) &&
              includesOpenInNewWindow(sample.fileBookmarkLabels) &&
              excludesOpenInNewWindow(sample.directoryRowLabels) &&
              excludesOpenInNewWindow(sample.directoryBookmarkLabels) &&
              excludesDuplicateWindow(sample.treeFileLabels) &&
              excludesDuplicateWindow(sample.openFileLabels) &&
              excludesDuplicateWindow(sample.tabLabels) &&
              excludesDuplicateWindow(sample.fileBookmarkLabels) &&
              requests.length === 4 &&
              requests.every(
                (request) =>
                  request.path === "/workspace/docs/copy-actions.adoc" &&
                  request.rootDirectory === "/workspace" &&
                  Array.isArray(request.expandedDirectories) &&
                  request.expandedDirectories.includes("/workspace/docs") &&
                  typeof request.sidebarTab === "string" &&
                  typeof request.sidebarVisible === "boolean" &&
                  typeof request.rightSidebarVisible === "boolean" &&
                  request.layout !== null &&
                  Array.isArray(request.bookmarks),
              )
            );
          })
        : true,
    hasOpenLinkInNewWindow:
      scenario === "viewer-open-link-in-new-window"
        ? await page.evaluate(() => {
            const sample =
              window.__SVARD_OPEN_LINK_IN_NEW_WINDOW_CHECK__ ?? {};
            const labels = sample.labels ?? [];
            const requests = sample.requests ?? [];
            return (
              labels.includes("Open Link in New Window") &&
              labels.includes("Open Document") &&
              requests.length === 1 &&
              requests[0]?.path === "/workspace/docs/render-fixtures.adoc" &&
              requests[0]?.rootDirectory === "/workspace" &&
              Array.isArray(requests[0]?.expandedDirectories) &&
              requests[0].expandedDirectories.includes("/workspace/docs") &&
              Array.isArray(requests[0]?.bookmarks)
            );
          })
        : true,
    hasMoveTabToNewWindow:
      scenario === "viewer-move-tab-to-new-window"
        ? await page.evaluate(() => {
            const sample =
              window.__SVARD_MOVE_TAB_TO_NEW_WINDOW_CHECK__ ?? {};
            const openFileLabels = sample.openFileLabels ?? [];
            const tabLabels = sample.tabLabels ?? [];
            const requests = sample.requests ?? [];
            return (
              openFileLabels.includes("Move Tab to New Window") &&
              tabLabels.includes("Move Tab to New Window") &&
              !openFileLabels.includes("Duplicate Window") &&
              !tabLabels.includes("Duplicate Window") &&
              requests.length === 2 &&
              requests[0]?.path === "/workspace/docs/copy-actions.adoc" &&
              requests[0]?.pinned === true &&
              requests[1]?.path === "/workspace/docs/preferences.adoc" &&
              requests[1]?.pinned !== true &&
              sample.copyActionsRows === 0 &&
              sample.preferencesRows === 0
            );
          })
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
    hasOpenInEditor:
      scenario === "viewer-open-in-editor"
        ? geometryReviewIds.has("context-menu") &&
          geometryReviewIds.has("context-menu-item-open-in-editor") &&
          contextMenuText.includes("Open in Editor") &&
          editorOpenRequests.includes("/workspace/docs/mvp-guide.adoc") &&
          bodyText.includes("Open in Editor requested for mvp-guide.adoc")
        : true,
    hasReloadWatch:
      scenario === "viewer-reload-watch"
        ? (await page
            .locator(
              '[data-review-id="active-tab"], [data-review-id="active-document-title"]',
            )
            .count()) > 0 && bodyText.includes("Render Fixtures")
        : true,
    hasSmartScrollRestore:
      scenario === "viewer-smart-scroll-restore"
        ? (await page.evaluate(
            () =>
              window.__SVARD_SMART_SCROLL_RESTORE_CHECK__
                ?.restoredNearTarget === true,
          )) && bodyText.includes("Prepended update before target")
        : true,
    hasInactiveOpenFileAutoReload:
      scenario === "viewer-open-files-auto-reload-inactive"
        ? bodyText.includes("Markdown Sample Reloaded") &&
          (await page
            .locator(
              '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"][data-reload-status="reloaded"]',
            )
            .count()) === 0 &&
          (await page
            .locator(
              '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"] [data-review-id="open-file-reload-status"]',
            )
            .count()) === 0
        : true,
    hasOpenFileAutoReloadError:
      scenario === "viewer-open-files-auto-reload-error"
        ? (await page
            .locator(
              '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"][data-reload-status="error"] [data-review-id="open-file-reload-status"]',
            )
            .count()) === 1 && bodyText.includes("Reload failed")
        : true,
    hasStartPage:
      scenario === "viewer-start-page"
        ? (await page.locator('[data-review-id="start-page"]').count()) === 1 &&
          bodyText.toLowerCase().includes("recent documents") &&
          bodyText.toLowerCase().includes("recent folders") &&
          bodyText.toLowerCase().includes("bookmarks")
        : true,
    hasCloseAllTabs:
      scenario === "viewer-close-all-tabs"
        ? (await page.locator('[data-review-id="start-page"]').count()) === 1 &&
          (await page.locator('[data-review-id="open-file-item"]').count()) ===
            0 &&
          bodyText.includes("No open files") &&
          commandAutomation.availableCommands.includes("tab.restoreClosed") &&
          !commandAutomation.disabledCommands.includes("tab.restoreClosed")
        : true,
    hasCloseLastTab:
      scenario === "viewer-close-last-tab"
        ? (await page.locator('[data-review-id="start-page"]').count()) === 1 &&
          (await page.locator('[data-review-id="open-file-item"]').count()) ===
            0 &&
          (await page.locator('[data-review-id="toc"] a').count()) === 0 &&
          bodyText.includes("No open files") &&
          !commandAutomation.disabledCommands.includes("tab.restoreClosed")
        : true,
    hasPinnedTabs:
      scenario === "viewer-pinned-tabs"
        ? (await page
            .locator('[data-review-id="open-file-item"].pinned')
            .filter({ hasText: "preferences.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "render-fixtures.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "mvp-guide.adoc" })
            .count()) === 0 &&
          commandAutomation.availableCommands.includes("tab.togglePinned")
        : true,
    hasOpenFilesRowActions:
      scenario === "viewer-open-files-row-actions"
        ? await page.evaluate(() => {
            const result = window.__SVARD_OPEN_FILES_ROW_ACTIONS_CHECK__;
            const isHidden = (action) =>
              action?.visibility === "hidden" &&
              action?.pointerEvents === "none";
            const isVisible = (action) =>
              action?.visibility === "visible" &&
              action?.pointerEvents !== "none" &&
              action?.opacity >= 0.95;
            return (
              isHidden(result?.restingPin) &&
              isHidden(result?.restingClose) &&
              isVisible(result?.hoveredPin) &&
              isVisible(result?.hoveredClose) &&
              isVisible(result?.pinnedPin) &&
              isVisible(result?.pinnedClose) &&
              isVisible(result?.activeClose) &&
              result?.pinnedRowClass === true &&
              result?.activeRowClass === true &&
              result?.hoveredPin?.ariaLabel === "Pin copy-actions.adoc" &&
              result?.pinnedPin?.ariaLabel === "Unpin preferences.adoc" &&
              result?.activeClose?.ariaLabel === "Close render-fixtures.adoc"
            );
          })
        : true,
    hasOpenFilesFilter:
      scenario === "viewer-open-files-filter"
        ? (await page
            .locator('[data-review-id="open-files-filter"]')
            .count()) === 1 &&
          bodyText.includes("Preferences Defaults") &&
          commandAutomation.availableCommands.includes("tab.search")
        : true,
    hasOpenFilesGlobFilter:
      scenario === "viewer-open-files-glob-filter"
        ? (await page
            .locator('[data-review-id="open-files-filter"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-files-filter-mode"]')
            .filter({ hasText: "Glob" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "copy-actions.adoc" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-file-item"]')
            .filter({ hasText: "math-rendering.md" })
            .count()) === 0 &&
          bodyText.includes("Copy Actions") &&
          commandAutomation.availableCommands.includes("tab.search")
        : true,
    hasOpenFilesCollapse:
      scenario === "viewer-open-files-collapse"
        ? (await page
            .locator('[data-review-id="open-files-collapsed-bar"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-files-expand"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="open-files-filter"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="open-files-split-resizer"]')
            .count()) === 0 &&
          (await page.locator('[data-review-id="file-tree"]').count()) === 1 &&
          bodyText.includes("Copy Actions")
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
    hasSessionRestore:
      scenario === "viewer-session-restore"
        ? (await page.locator('[data-review-id="viewer-split"]').count()) ===
            1 &&
          (await page.locator('[data-review-id="toc"] a.active').count()) >= 1
        : true,
  };
}
