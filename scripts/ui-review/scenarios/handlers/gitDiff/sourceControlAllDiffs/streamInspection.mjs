export async function inspectAllDiffsStream(page) {
  await page
    .locator('[data-review-id="diff-stream-navigation"] button', {
      hasText: "Next",
    })
    .click();
  await page.waitForFunction(() => {
    const streamBody = document.querySelector(".diff-stream-body");
    const activeRenderedTarget = document.querySelector(
      '.diff-stream-rendered-body [data-active-change="true"]',
    );
    const activeRenderedTargetRect =
      activeRenderedTarget?.getBoundingClientRect();
    const streamBodyRect = streamBody?.getBoundingClientRect();
    return Boolean(
      activeRenderedTargetRect &&
      streamBodyRect &&
      activeRenderedTargetRect.bottom > streamBodyRect.top &&
      activeRenderedTargetRect.top < streamBodyRect.bottom,
    );
  });
  await page.evaluate(() => {
    const streamBody = document.querySelector(".diff-stream-body");
    const activeRenderedTarget = document.querySelector(
      '.diff-stream-rendered-body [data-active-change="true"]',
    );
    const activeTargetIndex =
      activeRenderedTarget?.getAttribute("data-change-index") ?? "";
    const activeTargetStreamIndex =
      activeRenderedTarget
        ?.closest('[data-review-id="diff-stream-file-section"]')
        ?.getAttribute("data-stream-index") ?? "";
    const activeRenderedTargetRect =
      activeRenderedTarget?.getBoundingClientRect();
    const streamBodyRect = streamBody?.getBoundingClientRect();
    window.__SVARD_ALL_DIFFS_ACTIVE_TARGET_AFTER_NAVIGATION__ = {
      index: activeTargetIndex,
      streamIndex: activeTargetStreamIndex,
      targetIndex:
        activeRenderedTarget?.getAttribute("data-change-index") ?? "",
      targetStreamIndex:
        activeRenderedTarget
          ?.closest('[data-review-id="diff-stream-file-section"]')
          ?.getAttribute("data-stream-index") ?? "",
      visible:
        activeRenderedTargetRect && streamBodyRect
          ? activeRenderedTargetRect.bottom > streamBodyRect.top &&
            activeRenderedTargetRect.top < streamBodyRect.bottom
          : false,
    };
  });
  await page
    .locator('[data-review-id="diff-stream-right-pane"]')
    .first()
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-right-pane"]')
    .first()
    .scrollIntoViewIfNeeded();
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const contextPane = page
    .locator('[data-review-id="diff-stream-right-pane"]')
    .first();
  const contextPaneBox = await contextPane.boundingBox();
  if (!contextPaneBox) {
    throw new Error("All diffs context pane is not visible");
  }
  await contextPane.click({
    button: "right",
    position: { x: contextPaneBox.width - 4, y: 4 },
  });
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
    const activeRenderedTarget = panel?.querySelector(
      '.diff-stream-rendered-body [data-active-change="true"]',
    );
    const activeTargetIndex =
      activeRenderedTarget?.getAttribute("data-change-index") ?? "";
    const activeTargetStreamIndex =
      activeRenderedTarget
        ?.closest('[data-review-id="diff-stream-file-section"]')
        ?.getAttribute("data-stream-index") ?? "";
    const renderedBlockRect = firstRenderedBlock?.getBoundingClientRect();
    const renderedBodyRect = firstRenderedBody?.getBoundingClientRect();
    const renderedSectionRect = firstRenderedSection?.getBoundingClientRect();
    const activeRenderedTargetRect =
      activeRenderedTarget?.getBoundingClientRect();
    const streamBodyRect = streamBody?.getBoundingClientRect();
    const streamBodyStyle = streamBody
      ? window.getComputedStyle(streamBody)
      : null;
    const renderedScrollStyle = firstRenderedScroll
      ? window.getComputedStyle(firstRenderedScroll)
      : null;
    const contextMenuLabels = Array.from(
      document.querySelectorAll('[data-review-id^="context-menu-item-"]'),
    ).map((item) => item.textContent?.trim() ?? "");
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
      rulerVisible:
        document.querySelector(
          '[data-review-id="diff-stream-change-ruler"]',
        ) !== null,
      rulerMarkerCount: document.querySelectorAll(
        '[data-review-id="diff-stream-change-ruler-marker"]',
      ).length,
      marginMarkerCount: document.querySelectorAll(
        '[data-review-id="git-rendered-margin-marker"]',
      ).length,
      marginMarkersAtPaneLeft: (() => {
        const section = document.querySelector(".diff-stream-rendered-body");
        const leftLayer = section?.querySelector(
          '[data-review-id="git-rendered-margin-markers"][data-marker-side="left"]',
        );
        const rightLayer = section?.querySelector(
          '[data-review-id="git-rendered-margin-markers"][data-marker-side="right"]',
        );
        const leftPane = leftLayer?.closest(".git-rendered-pane");
        const rightPane = rightLayer?.closest(".git-rendered-pane");
        const leftMarker = leftLayer?.querySelector(
          '[data-review-id="git-rendered-margin-marker"]',
        );
        const rightMarker = rightLayer?.querySelector(
          '[data-review-id="git-rendered-margin-marker"]',
        );
        if (!leftPane || !rightPane || !leftMarker || !rightMarker) {
          return false;
        }
        return (
          Math.abs(
            leftPane.getBoundingClientRect().left -
              leftMarker.getBoundingClientRect().left,
          ) <= 8 &&
          Math.abs(
            rightPane.getBoundingClientRect().left -
              rightMarker.getBoundingClientRect().left,
          ) <= 8
        );
      })(),
      marginMarkersCoverFineTargetIndexes: Array.from(
        document.querySelectorAll(
          ".diff-stream-rendered-body .git-rendered-pane",
        ),
      ).every((pane) => {
        const layer = pane.querySelector(
          '[data-review-id="git-rendered-margin-markers"]',
        );
        if (!layer) {
          return false;
        }
        return Array.from(
          pane.querySelectorAll(
            ".git-rendered-list-item-change[data-change-index], .git-rendered-structured-child-change[data-change-index], .git-rendered-table-row-change[data-change-index]",
          ),
        ).every((target) => {
          const changeIndex = target.getAttribute("data-change-index");
          const marker = layer.querySelector(
            `[data-review-id="git-rendered-margin-marker"][data-change-index="${changeIndex}"]`,
          );
          if (!marker) {
            return false;
          }
          return marker !== null;
        });
      }),
      activeTargetVisible: activeRenderedTarget !== null,
      activeTargetIndex,
      activeTargetStreamIndex,
      activeRenderedTargetIndex:
        activeRenderedTarget?.getAttribute("data-change-index") ?? "",
      activeRenderedTargetStreamIndex:
        activeRenderedTarget
          ?.closest('[data-review-id="diff-stream-file-section"]')
          ?.getAttribute("data-stream-index") ?? "",
      activeRenderedTargetVisible:
        activeRenderedTargetRect && streamBodyRect
          ? activeRenderedTargetRect.bottom > streamBodyRect.top &&
            activeRenderedTargetRect.top < streamBodyRect.bottom
          : false,
      activeRenderedTargetVisibleAfterNavigation:
        window.__SVARD_ALL_DIFFS_ACTIVE_TARGET_AFTER_NAVIGATION__?.visible ===
        true,
      contextMenuVisible: contextMenu !== null,
      contextMenuSourceReviewId:
        contextMenu?.getAttribute("data-source-review-id") ?? "",
      contextMenuItemCount: document.querySelectorAll(
        '[data-review-id^="context-menu-item-"]',
      ).length,
      contextMenuHasCaptureArea: contextMenuLabels.includes("Capture Area…"),
      contextMenuHasReferencedCapture: contextMenuLabels.includes(
        "Capture Area with Reference…",
      ),
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
