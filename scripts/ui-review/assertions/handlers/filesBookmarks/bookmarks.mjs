export async function buildBookmarksAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  return {
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
  };
}
