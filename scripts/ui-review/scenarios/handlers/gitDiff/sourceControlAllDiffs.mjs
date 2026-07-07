export function isSourceControlAllDiffsScenario(scenario) {
  return (
    scenario === "viewer-source-control-all-diffs" ||
    scenario === "viewer-source-control-all-diffs-mouse-gestures" ||
    scenario === "viewer-source-control-all-diffs-keybindings" ||
    scenario === "viewer-source-control-all-diffs-privacy"
  );
}

export async function applySourceControlAllDiffsScenario(page, context) {
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
  await page.locator('[data-review-id="diff-stream-change-ruler"]').waitFor();
  await page
    .locator('[data-review-id="diff-stream-change-ruler-marker"]')
    .first()
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-change-ruler-marker"]')
    .last()
    .click();
  await page.waitForFunction(() => {
    const panel = document.querySelector(
      '[data-review-id="source-control-all-diffs-panel"]',
    );
    const streamBody = document.querySelector(".diff-stream-body");
    const activeRulerMarker = document.querySelector(
      '[data-review-id="diff-stream-change-ruler-marker"].active',
    );
    const activeRulerMarkerIndex =
      activeRulerMarker?.getAttribute("data-change-index") ?? "";
    const activeRulerMarkerStreamIndex =
      activeRulerMarker?.getAttribute("data-stream-index") ?? "";
    const activeRenderedTarget =
      activeRulerMarkerIndex !== "" && activeRulerMarkerStreamIndex !== ""
        ? panel
            ?.querySelector(
              `[data-review-id="diff-stream-file-section"][data-stream-index="${activeRulerMarkerStreamIndex}"]`,
            )
            ?.querySelector(
              `[data-active-change="true"][data-change-index="${activeRulerMarkerIndex}"]`,
            )
        : null;
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
    const panel = document.querySelector(
      '[data-review-id="source-control-all-diffs-panel"]',
    );
    const streamBody = document.querySelector(".diff-stream-body");
    const activeRulerMarker = document.querySelector(
      '[data-review-id="diff-stream-change-ruler-marker"].active',
    );
    const activeRulerMarkerIndex =
      activeRulerMarker?.getAttribute("data-change-index") ?? "";
    const activeRulerMarkerStreamIndex =
      activeRulerMarker?.getAttribute("data-stream-index") ?? "";
    const activeRenderedTarget =
      activeRulerMarkerIndex !== "" && activeRulerMarkerStreamIndex !== ""
        ? panel
            ?.querySelector(
              `[data-review-id="diff-stream-file-section"][data-stream-index="${activeRulerMarkerStreamIndex}"]`,
            )
            ?.querySelector(
              `[data-active-change="true"][data-change-index="${activeRulerMarkerIndex}"]`,
            )
        : null;
    const activeRenderedTargetRect =
      activeRenderedTarget?.getBoundingClientRect();
    const streamBodyRect = streamBody?.getBoundingClientRect();
    window.__SVARD_ALL_DIFFS_ACTIVE_TARGET_AFTER_MARKER__ = {
      index: activeRulerMarkerIndex,
      streamIndex: activeRulerMarkerStreamIndex,
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
  await page
    .locator('[data-review-id="diff-stream-right-pane"]')
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
    const activeRulerMarker = document.querySelector(
      '[data-review-id="diff-stream-change-ruler-marker"].active',
    );
    const activeRulerMarkerIndex =
      activeRulerMarker?.getAttribute("data-change-index") ?? "";
    const activeRulerMarkerStreamIndex =
      activeRulerMarker?.getAttribute("data-stream-index") ?? "";
    const activeRenderedTarget =
      activeRulerMarkerIndex !== "" && activeRulerMarkerStreamIndex !== ""
        ? panel
            ?.querySelector(
              `[data-review-id="diff-stream-file-section"][data-stream-index="${activeRulerMarkerStreamIndex}"]`,
            )
            ?.querySelector(
              `[data-active-change="true"][data-change-index="${activeRulerMarkerIndex}"]`,
            )
        : null;
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
      rulerMarkers: document.querySelectorAll(
        '[data-review-id="diff-stream-change-ruler-marker"]',
      ).length,
      activeRulerMarkerVisible: activeRulerMarker !== null,
      activeRulerMarkerIndex,
      activeRulerMarkerStreamIndex,
      activeRenderedTargetIndex:
        activeRenderedTarget?.getAttribute("data-change-index") ?? "",
      activeRenderedTargetStreamIndex:
        activeRenderedTarget
          ?.closest('[data-review-id="diff-stream-file-section"]')
          ?.getAttribute("data-stream-index") ?? "",
      activeRenderedTargetIndexMatchesMarker:
        activeRenderedTarget?.getAttribute("data-change-index") ===
        activeRulerMarkerIndex,
      activeRenderedTargetStreamIndexMatchesMarker:
        activeRenderedTarget
          ?.closest('[data-review-id="diff-stream-file-section"]')
          ?.getAttribute("data-stream-index") === activeRulerMarkerStreamIndex,
      activeRenderedTargetVisible:
        activeRenderedTargetRect && streamBodyRect
          ? activeRenderedTargetRect.bottom > streamBodyRect.top &&
            activeRenderedTargetRect.top < streamBodyRect.bottom
          : false,
      activeRenderedTargetVisibleAfterMarker:
        window.__SVARD_ALL_DIFFS_ACTIVE_TARGET_AFTER_MARKER__?.visible === true,
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

  if (context?.scenario === "viewer-source-control-all-diffs-keybindings") {
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .click({ position: { x: 20, y: 20 } });
    await page
      .locator('[data-review-id="diff-stream-change-ruler-marker"]')
      .first()
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector(
          '[data-review-id="diff-stream-change-ruler-marker"].active',
        )
        ?.getAttribute("aria-label")
        ?.includes("1"),
    );
    await page.keyboard.press("Alt+ArrowDown");
    await page.waitForFunction(() =>
      document
        .querySelector(
          '[data-review-id="diff-stream-change-ruler-marker"].active',
        )
        ?.getAttribute("aria-label")
        ?.includes("2"),
    );
    await page.keyboard.press("Alt+ArrowUp");
    await page.waitForFunction(() =>
      document
        .querySelector(
          '[data-review-id="diff-stream-change-ruler-marker"].active',
        )
        ?.getAttribute("aria-label")
        ?.includes("1"),
    );
    await page.evaluate(async () => {
      const streamBody = document.querySelector(".diff-stream-body");
      const scrollable =
        streamBody instanceof HTMLElement
          ? streamBody.scrollHeight > streamBody.clientHeight
          : false;
      const bottomResult =
        await window.__SVARD_COMMANDS__?.dispatch("viewer.bottom");
      const afterBottom = streamBody?.scrollTop ?? 0;
      const topResult = await window.__SVARD_COMMANDS__?.dispatch("viewer.top");
      const afterTop = streamBody?.scrollTop ?? -1;
      const activeLabel =
        document
          .querySelector(
            '[data-review-id="diff-stream-change-ruler-marker"].active',
          )
          ?.getAttribute("aria-label") ?? "";
      const closeResult =
        await window.__SVARD_COMMANDS__?.dispatch("tab.close");
      window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__ = {
        afterBottom,
        afterTop,
        activeLabel,
        bottomStatus: bottomResult?.status ?? "",
        closeStatus: closeResult?.status ?? "",
        closeCommand: window.__SVARD_COMMANDS__?.getLastCommand(),
        scrollable,
        topStatus: topResult?.status ?? "",
      };
    });
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .waitFor({ state: "detached" });
    await page.evaluate(() => {
      window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__ = {
        ...window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__,
        panelCount: document.querySelectorAll(
          '[data-review-id="source-control-all-diffs-panel"]',
        ).length,
      };
    });
    return;
  }

  if (context?.scenario !== "viewer-source-control-all-diffs-mouse-gestures") {
    return;
  }

  await page.keyboard.press("Escape");
  await page.locator('button[aria-label="Close all diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor({ state: "detached" });
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
  });
  await page.locator('[data-review-id="preferences-page"]').waitFor();
  await page
    .locator('[data-review-id="preferences-nav"] button')
    .filter({ hasText: "Mouse Gestures" })
    .click();
  await page.locator('[data-review-id="mouse-gestures-enabled"] input').check();
  await page
    .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
    .click();
  await page.waitForTimeout(750);
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-change-ruler-marker"]')
    .first()
    .waitFor();

  const streamSelector = ".diff-stream-body";
  const gestureSelector =
    '[data-review-id="diff-stream-file-section"][data-stream-index="0"] [data-review-id="diff-stream-right-pane"]';
  let lastGesturePoint = null;
  async function performStreamGesture(directions) {
    const box = await page.locator(gestureSelector).boundingBox();
    if (!box) {
      throw new Error("All diffs gesture pane is not visible");
    }
    let x = box.x + Math.min(180, box.width / 2);
    let y = box.y + 18;
    lastGesturePoint = { x, y };
    const pane = page.locator(gestureSelector);
    const mouse = {
      bubbles: true,
      button: 2,
      buttons: 2,
      cancelable: true,
      clientX: x,
      clientY: y,
    };
    await pane.dispatchEvent("mousedown", mouse);
    for (const direction of directions) {
      if (direction === "Left") {
        x -= 90;
      } else if (direction === "Right") {
        x += 90;
      } else if (direction === "Up") {
        y -= 90;
      } else if (direction === "Down") {
        y += 90;
      }
      await pane.dispatchEvent("mousemove", {
        ...mouse,
        clientX: x,
        clientY: y,
      });
    }
    await pane.dispatchEvent("mouseup", {
      ...mouse,
      buttons: 0,
      clientX: x,
      clientY: y,
    });
  }
  await page.waitForFunction(() =>
    document
      .querySelector(
        '[data-review-id="diff-stream-change-ruler-marker"].active',
      )
      ?.getAttribute("aria-label")
      ?.includes("1"),
  );
  await performStreamGesture(["Right"]);
  await page
    .waitForFunction(
      () =>
        document
          .querySelector(
            '[data-review-id="diff-stream-change-ruler-marker"].active',
          )
          ?.getAttribute("aria-label")
          ?.includes("2"),
      undefined,
      { timeout: 5000 },
    )
    .catch(async () => {
      const debug = await page.evaluate((point) => {
        const hit =
          point && typeof point.x === "number" && typeof point.y === "number"
            ? document.elementFromPoint(point.x, point.y)
            : null;
        return {
          activeLabel:
            document
              .querySelector(
                '[data-review-id="diff-stream-change-ruler-marker"].active',
              )
              ?.getAttribute("aria-label") ?? "",
          hitClass: hit instanceof HTMLElement ? hit.className : "",
          hitReviewId:
            hit instanceof HTMLElement
              ? (hit
                  .closest("[data-review-id]")
                  ?.getAttribute("data-review-id") ?? "")
              : "",
          mouseGesturesEnabled:
            document
              .querySelector(
                '[data-review-id="source-control-all-diffs-panel"]',
              )
              ?.getAttribute("data-mouse-gestures-enabled") ?? "",
          lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
        };
      }, lastGesturePoint);
      throw new Error(
        `All diffs Right gesture did not advance: ${JSON.stringify(debug)}`,
      );
    });
  const afterRight = await page.evaluate(() => ({
    activeLabel:
      document
        .querySelector(
          '[data-review-id="diff-stream-change-ruler-marker"].active',
        )
        ?.getAttribute("aria-label") ?? "",
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await performStreamGesture(["Left"]);
  await page.waitForFunction(() =>
    document
      .querySelector(
        '[data-review-id="diff-stream-change-ruler-marker"].active',
      )
      ?.getAttribute("aria-label")
      ?.includes("1"),
  );
  const afterLeft = await page.evaluate(() => ({
    activeLabel:
      document
        .querySelector(
          '[data-review-id="diff-stream-change-ruler-marker"].active',
        )
        ?.getAttribute("aria-label") ?? "",
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await performStreamGesture(["Down"]);
  await page.waitForFunction((selector) => {
    const stream = document.querySelector(selector);
    return stream instanceof HTMLElement && stream.scrollTop > 0;
  }, streamSelector);
  const afterDown = await page.evaluate((selector) => {
    const stream = document.querySelector(selector);
    return {
      scrollTop: stream instanceof HTMLElement ? stream.scrollTop : 0,
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    };
  }, streamSelector);

  await performStreamGesture(["Up"]);
  await page.waitForFunction((selector) => {
    const stream = document.querySelector(selector);
    return stream instanceof HTMLElement && stream.scrollTop === 0;
  }, streamSelector);
  const afterUp = await page.evaluate((selector) => {
    const stream = document.querySelector(selector);
    return {
      scrollTop: stream instanceof HTMLElement ? stream.scrollTop : -1,
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    };
  }, streamSelector);

  await performStreamGesture(["Down", "Right"]);
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor({ state: "detached" });
  const afterClose = await page.evaluate(() => ({
    panelCount: document.querySelectorAll(
      '[data-review-id="source-control-all-diffs-panel"]',
    ).length,
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await page.evaluate(
    ({ afterRight, afterLeft, afterDown, afterUp, afterClose }) => {
      window.__SVARD_ALL_DIFFS_MOUSE_GESTURE_SAMPLE__ = {
        afterRight,
        afterLeft,
        afterDown,
        afterUp,
        afterClose,
      };
    },
    { afterRight, afterLeft, afterDown, afterUp, afterClose },
  );
}
