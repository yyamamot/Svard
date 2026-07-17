export async function buildWindowActionsAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  const contextMenuText = context.contextMenuText;
  const editorOpenRequests = context.editorOpenRequests;
  const geometryReviewIds = context.geometryReviewIds;
  return {
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
            const sample = window.__SVARD_OPEN_LINK_IN_NEW_WINDOW_CHECK__ ?? {};
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
            const sample = window.__SVARD_MOVE_TAB_TO_NEW_WINDOW_CHECK__ ?? {};
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
  };
}
