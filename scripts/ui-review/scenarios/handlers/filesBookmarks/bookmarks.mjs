export async function applyBookmarksScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-bookmarks") {
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmarks-panel"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-active"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-root"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-active"]').click();
    await page.locator('[data-review-id="bookmark-add-root"]').click();
    await page.locator('[data-review-id="bookmark-item"]').nth(1).waitFor();
    await page
      .locator('[data-review-id="bookmark-open"]')
      .filter({ hasText: "workspace" })
      .click();
    await page.locator('[data-review-id="sidebar-tab-files"]').waitFor();
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page
      .locator('[data-review-id="bookmark-open"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .click();
    await page.locator("text=Svard MVP Guide").waitFor();
    await page
      .locator('[data-review-id="bookmark-item"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .hover();
    await page
      .locator('[data-review-id="bookmark-item"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .locator('[data-review-id="bookmark-remove"]')
      .click();
    await page.locator('[data-review-id="inline-notice-close"]').click();
    await page
      .locator('[data-review-id="inline-notice"]')
      .waitFor({ state: "detached" });
  } else if (scenario === "viewer-drag-reorder-bookmarks") {
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmarks-panel"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-active"]').click();
    await page.locator('[data-review-id="bookmark-add-root"]').click();
    await page.locator('[data-review-id="bookmark-item"]').nth(1).waitFor();
    const firstBookmark = page
      .locator('[data-review-id="bookmark-item"]')
      .nth(0);
    await page
      .locator('[data-review-id="bookmark-item"] .bookmark-open')
      .nth(1)
      .dragTo(firstBookmark);
    await page.waitForFunction(() =>
      document
        .querySelectorAll('[data-review-id="bookmark-item"]')
        .item(0)
        ?.textContent?.includes("workspace"),
    );
  } else {
    return false;
  }
  return true;
}
