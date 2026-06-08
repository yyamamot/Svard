export async function buildTabsStartAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  const contextMenuText = context.contextMenuText;
  const editorOpenRequests = context.editorOpenRequests;
  const geometryReviewIds = context.geometryReviewIds;
  return {
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
  };
}
