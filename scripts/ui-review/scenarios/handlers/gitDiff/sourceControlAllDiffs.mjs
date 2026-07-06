export function isSourceControlAllDiffsScenario(scenario) {
  return (
    scenario === "viewer-source-control-all-diffs" ||
    scenario === "viewer-source-control-all-diffs-privacy"
  );
}

export async function applySourceControlAllDiffsScenario(page) {
  await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
  await page
    .locator('[data-review-id="source-control-changes-list"]')
    .waitFor();
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-file-section"]')
    .first()
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .click({ button: "right" });
  await page.locator('[data-review-id="context-menu"]').waitFor();
  await page.evaluate(() => {
    const panel = document.querySelector(
      '[data-review-id="source-control-all-diffs-panel"]',
    );
    const contextMenu = document.querySelector(
      '[data-review-id="context-menu"]',
    );
    const firstRenderedBlock = document.querySelector(
      '[data-review-id="diff-stream-rendered-block"]',
    );
    const firstRenderedBody = document.querySelector(
      '[data-review-id="diff-stream-rendered-body"]',
    );
    const firstRenderedSection = firstRenderedBlock?.closest(
      '[data-review-id="diff-stream-file-section"]',
    );
    const streamBody = document.querySelector(".diff-stream-body");
    const fullPreviewButton = document.querySelector(
      '[data-review-id="diff-stream-full-preview-view"]',
    );
    const firstRenderedScroll = firstRenderedBody?.querySelector(
      ".git-rendered-scroll",
    );
    const renderedBlockRect = firstRenderedBlock?.getBoundingClientRect();
    const renderedBodyRect = firstRenderedBody?.getBoundingClientRect();
    const renderedSectionRect = firstRenderedSection?.getBoundingClientRect();
    const streamBodyStyle = streamBody
      ? window.getComputedStyle(streamBody)
      : null;
    const renderedScrollStyle = firstRenderedScroll
      ? window.getComputedStyle(firstRenderedScroll)
      : null;
    window.__SVARD_ALL_DIFFS_STREAM_SAMPLE__ = {
      panelVisible: panel !== null,
      fileSections: document.querySelectorAll(
        '[data-review-id="diff-stream-file-section"]',
      ).length,
      renderedBlocks: document.querySelectorAll(
        '[data-review-id="diff-stream-rendered-block"]',
      ).length,
      renderedBlockHeight: renderedBlockRect?.height ?? 0,
      renderedBlockWidth: renderedBlockRect?.width ?? 0,
      renderedBodyHeight: renderedBodyRect?.height ?? 0,
      renderedBodyWidth: renderedBodyRect?.width ?? 0,
      renderedBlockVisibleInSection:
        renderedBlockRect && renderedSectionRect
          ? renderedBlockRect.bottom <= renderedSectionRect.bottom &&
            renderedBlockRect.top >= renderedSectionRect.top
          : false,
      renderedSectionHeight: renderedSectionRect?.height ?? 0,
      streamBodyOverflowY: streamBodyStyle?.overflowY ?? "",
      renderedScrollOverflowY: renderedScrollStyle?.overflowY ?? "",
      fullPreviewDefault:
        fullPreviewButton?.getAttribute("aria-pressed") === "true",
      contextMenuVisible: contextMenu !== null,
      contextMenuSourceReviewId:
        contextMenu?.getAttribute("data-source-review-id") ?? "",
      contextMenuItemCount: document.querySelectorAll(
        '[data-review-id^="context-menu-item-"]',
      ).length,
      blockerRows: document.querySelectorAll(
        '[data-review-id="diff-stream-blocker-row"]',
      ).length,
      navigationVisible:
        document.querySelector('[data-review-id="diff-stream-navigation"]') !==
        null,
      refreshVisible:
        document.querySelector('[data-review-id="diff-stream-refresh"]') !==
        null,
      assetVisible: panel?.textContent?.includes("assets/") ?? false,
      privatePathVisible: panel?.textContent?.includes("/workspace/") ?? false,
    };
  });
}
