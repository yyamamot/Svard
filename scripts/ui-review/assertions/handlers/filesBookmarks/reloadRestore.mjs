export async function buildReloadRestoreAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  return {
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
                ?.restoredNearTarget === true &&
              window.__SVARD_SMART_SCROLL_RESTORE_CHECK__?.articleRemounted ===
                true &&
              window.__SVARD_SMART_SCROLL_RESTORE_CHECK__
                ?.sourceBlockDoesNotOverlapParagraph === true,
          )) && bodyText.includes("Prepended update before target")
        : true,
    hasSessionRestore:
      scenario === "viewer-session-restore"
        ? (await page.locator('[data-review-id="viewer-split"]').count()) ===
            1 &&
          (await page.locator('[data-review-id="toc"] a.active').count()) >= 1
        : true,
  };
}
