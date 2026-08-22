import { exerciseAttachCurrentChange } from "./attachCurrentChange.mjs";

export function isSourceControlAllDiffsScenario(scenario) {
  return (
    scenario === "viewer-all-diffs" ||
    scenario === "viewer-source-control-all-diffs" ||
    scenario === "viewer-source-control-all-diffs-mouse-gestures" ||
    scenario === "viewer-source-control-all-diffs-keybindings" ||
    scenario === "viewer-source-control-all-diffs-privacy" ||
    scenario === "viewer-source-control-all-diffs-selection" ||
    scenario === "viewer-source-control-all-diffs-media-context" ||
    scenario === "viewer-agent-chat-diff-context-reliability" ||
    scenario === "viewer-agent-chat-attach-current-change" ||
    scenario === "viewer-git-diff-too-complex-source-fallback"
  );
}

export async function applySourceControlAllDiffsScenario(page, context) {
  if (context?.scenario === "viewer-git-diff-too-complex-source-fallback") {
    await applyTooComplexSourceFallbackScenario(page);
    return;
  }
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
  if (context?.scenario === "viewer-all-diffs") {
    let externalRequestCount = 0;
    let mainFrameNavigationCount = 0;
    let popupCount = 0;
    const handleRequest = (request) => {
      try {
        if (new URL(request.url()).hostname === "example.invalid") {
          externalRequestCount += 1;
        }
      } catch {
        // Non-URL browser events do not authorize navigation.
      }
    };
    const handleFrameNavigation = (frame) => {
      if (frame === page.mainFrame()) {
        mainFrameNavigationCount += 1;
      }
    };
    const handlePopup = () => {
      popupCount += 1;
    };
    page.on("request", handleRequest);
    page.on("framenavigated", handleFrameNavigation);
    page.on("popup", handlePopup);
    const setup = await page.evaluate(() => {
      const pane = document.querySelector(
        '[data-review-id="diff-stream-right-pane"]',
      );
      if (!(pane instanceof HTMLElement)) {
        throw new Error("All Diffs rendered pane is unavailable");
      }
      const outside = document.createElement("h2");
      outside.id = "imp-544-fragment";
      document.body.append(outside);
      const fixture = document.createElement("p");
      fixture.dataset.reviewId = "imp-544-link-boundary";
      fixture.innerHTML = [
        '<a data-link-category="external" href="https://example.invalid/imp-544">External</a>',
        '<a data-link-category="mailto" href="mailto:blocked@example.invalid">Mail</a>',
        '<a data-link-category="protocol-relative" href="//example.invalid/imp-544">Protocol relative</a>',
        '<a data-link-category="custom" href="custom:imp-544">Custom</a>',
        '<a data-link-category="fragment" href="#imp-544-fragment">Fragment</a>',
        '<h2 id="imp-544-fragment">Inside fragment</h2>',
      ].join(" ");
      pane.append(fixture);
      outside.scrollIntoView = () => {
        outside.dataset.scrolled = "true";
      };
      const inside = fixture.querySelector("h2");
      if (inside instanceof HTMLElement) {
        inside.scrollIntoView = () => {
          inside.dataset.scrolled = "true";
        };
      }
      return {
        externalOpenCount: window.__SVARD_EXTERNAL_URL_OPEN_COUNT__ ?? 0,
        navigationPath: window.location.pathname,
      };
    });
    const dispatch = (category, init = {}) =>
      page
        .locator(`[data-link-category="${category}"]`)
        .evaluate((link, eventInit) => {
          const event = new MouseEvent(eventInit.type ?? "click", {
            bubbles: true,
            cancelable: true,
            button: eventInit.button ?? 0,
            metaKey: eventInit.metaKey ?? false,
          });
          link.dispatchEvent(event);
          return event.defaultPrevented;
        }, init);
    const externalPrevented = await dispatch("external");
    await page
      .locator('[data-review-id="external-link-confirmation-dialog"]')
      .waitFor();
    await page.getByRole("button", { name: "Cancel" }).click();
    const mailtoPrevented = await dispatch("mailto");
    const protocolRelativePrevented = await dispatch("protocol-relative");
    const customPrevented = await dispatch("custom");
    const modifierPrevented = await dispatch("external", { metaKey: true });
    const middlePrevented = await dispatch("external", {
      type: "auxclick",
      button: 1,
    });
    const fragmentPrevented = await dispatch("fragment");
    page.off("request", handleRequest);
    page.off("framenavigated", handleFrameNavigation);
    page.off("popup", handlePopup);
    const externalOpenCount = await page.evaluate(
      () => window.__SVARD_EXTERNAL_URL_OPEN_COUNT__ ?? 0,
    );
    await page.evaluate(
      ({
        customPrevented,
        externalPrevented,
        fragmentPrevented,
        mailtoPrevented,
        middlePrevented,
        modifierPrevented,
        externalRequestCount,
        externalOpenCount,
        initialExternalOpenCount,
        mainFrameNavigationCount,
        navigationPath,
        popupCount,
        protocolRelativePrevented,
      }) => {
        const fixture = document.querySelector(
          '[data-review-id="imp-544-link-boundary"]',
        );
        const inside = fixture?.querySelector("#imp-544-fragment");
        const outside = Array.from(
          document.querySelectorAll("#imp-544-fragment"),
        ).find((element) => !fixture?.contains(element));
        window.__SVARD_ALL_DIFFS_LINK_BOUNDARY_CHECK__ = {
          blockedPrevented:
            mailtoPrevented && protocolRelativePrevented && customPrevented,
          externalConfirmationCancelled: externalPrevented,
          hostOpenCountUnchanged:
            externalOpenCount === initialExternalOpenCount,
          fragmentScoped:
            inside?.getAttribute("data-scrolled") === "true" &&
            outside?.getAttribute("data-scrolled") !== "true",
          middlePrevented,
          modifierPrevented,
          navigationUnchanged:
            mainFrameNavigationCount === 0 &&
            window.location.pathname === navigationPath,
          requestCountUnchanged: externalRequestCount === 0,
          popupCountUnchanged: popupCount === 0,
          fragmentPrevented,
        };
        fixture?.remove();
        outside?.remove();
      },
      {
        customPrevented,
        externalPrevented,
        fragmentPrevented,
        mailtoPrevented,
        middlePrevented,
        modifierPrevented,
        externalRequestCount,
        externalOpenCount,
        initialExternalOpenCount: setup.externalOpenCount,
        mainFrameNavigationCount,
        navigationPath: setup.navigationPath,
        popupCount,
        protocolRelativePrevented,
      },
    );
    return;
  }
  if (context?.scenario === "viewer-agent-chat-attach-current-change") {
    await exerciseAttachCurrentChange(page);
    return;
  }
  if (context?.scenario === "viewer-agent-chat-diff-context-reliability") {
    const pane = page
      .locator('[data-review-id="diff-stream-right-pane"]')
      .first();
    await pane.scrollIntoViewIfNeeded();
    const selectionPoint = await pane.evaluate((element) => {
      const text = Array.from(element.querySelectorAll("p,li,pre"))
        .flatMap((candidate) => Array.from(candidate.childNodes))
        .find((node) => node instanceof Text && node.data.trim().length > 4);
      if (!(text instanceof Text)) throw new Error("No selectable diff text");
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, Math.min(text.data.length, 60));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      const rect = range.getClientRects()[0];
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null;
    });
    if (!selectionPoint) throw new Error("Diff selection was not visible");
    await page.waitForTimeout(100);
    await page.mouse.click(selectionPoint.x, selectionPoint.y, {
      button: "right",
    });
    await page
      .locator('[data-review-id="context-menu"]')
      .getByRole("menuitem", { name: "Ask AI about selection" })
      .click();
    await page.waitForTimeout(200);
    const agentPanel = page.locator('[data-review-id="agent-panel"]');
    if (!(await agentPanel.isVisible())) {
      const notice = await page
        .locator('[data-review-id="inline-notice"]')
        .allTextContents();
      throw new Error(
        `AI Chat did not open after the Diff selection: ${notice.join(" | ")}`,
      );
    }
    const selectionCard = page.locator(".agent-selection-card");
    await selectionCard.waitFor();
    const dock = page.locator('[data-review-id="git-diff-agent-dock"]');
    await dock.waitFor();
    const composer = dock.locator("textarea");
    const questionBlank = (await composer.inputValue()) === "";
    await composer.fill("選択した変更の前提を説明してください");
    const draft = await composer.inputValue();
    await selectionCard
      .getByRole("button", { name: "Return to selected content" })
      .click();
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .waitFor();
    await dock.waitFor();
    const diagram = page
      .locator(
        '[data-review-id="diff-stream-right-pane"] [data-diagram-id] svg, [data-review-id="diff-stream-right-pane"] [data-diagram-id] img',
      )
      .first();
    await diagram.waitFor();
    await diagram.scrollIntoViewIfNeeded();
    await diagram.click({ button: "right" });
    await page
      .locator('[data-review-id="context-menu"]')
      .getByRole("menuitem", { name: "Ask AI" })
      .click();
    const mediaCard = page.locator(".agent-media-card");
    await mediaCard.waitFor();
    const orderedKinds = await page
      .locator('[data-review-id="agent-selection-attachments"] > *')
      .evaluateAll((items) =>
        items.map((item) =>
          item.classList.contains("agent-selection-card")
            ? "selection"
            : item.classList.contains("agent-media-card")
              ? "media"
              : "unknown",
        ),
      );
    const modeCount = await mediaCard
      .locator(".agent-media-mode button")
      .count();
    await mediaCard.getByRole("button", { name: "Show" }).click();
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .waitFor();
    await dock.waitFor();
    const draftAfterContext = await composer.inputValue();
    await page.evaluate(
      ({
        draft,
        draftAfterContext,
        modeCount,
        orderedKinds,
        questionBlank,
      }) => {
        window.__SVARD_DIFF_CONTEXT_RELIABILITY_CHECK__ = {
          dockVisible: true,
          draftPreserved: draftAfterContext === draft,
          modeCount,
          orderedKinds,
          overlayMaintained: true,
          questionBlank,
        };
      },
      { draft, draftAfterContext, modeCount, orderedKinds, questionBlank },
    );
    if (modeCount !== 3 || orderedKinds.join(",") !== "selection,media") {
      throw new Error(
        `Unexpected ordered Diff context: ${JSON.stringify({
          modeCount,
          orderedKinds,
        })}`,
      );
    }
    await page.getByRole("button", { name: "Close all diffs" }).click();
    await agentPanel.waitFor();
    return;
  }
  if (context?.scenario === "viewer-source-control-all-diffs-selection") {
    const pane = page
      .locator('[data-review-id="diff-stream-right-pane"]')
      .first();
    await pane.evaluate((element) => {
      const text = Array.from(element.querySelectorAll("p,li,pre"))
        .flatMap((candidate) => Array.from(candidate.childNodes))
        .find((node) => node instanceof Text && node.data.trim().length > 4);
      if (!(text instanceof Text)) throw new Error("No selectable diff text");
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, Math.min(text.data.length, 60));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
    await page
      .locator('[data-review-id="selection-mini-toolbar"]')
      .getByRole("button", { name: "Ask AI" })
      .click();
    await page.locator(".agent-selection-card").waitFor();
    const revisionVisible = await page
      .locator(".agent-selection-card")
      .getByText(/After|Working tree/u)
      .count();
    await page
      .locator(".agent-selection-card")
      .getByRole("button", { name: "Return to selected content" })
      .click();
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .waitFor();
    await page.evaluate(
      ({ revisionVisible }) => {
        window.__SVARD_ALL_DIFFS_AGENT_SELECTION_CHECK__ = {
          overlayRestored: true,
          revisionVisible: revisionVisible > 0,
        };
      },
      { revisionVisible },
    );
    return;
  }
  if (context?.scenario === "viewer-source-control-all-diffs-media-context") {
    const diagram = page
      .locator(
        '[data-review-id="diff-stream-right-pane"] [data-diagram-id] svg, [data-review-id="diff-stream-right-pane"] [data-diagram-id] img',
      )
      .first();
    await diagram.waitFor();
    await diagram.scrollIntoViewIfNeeded();
    await diagram.click({ button: "right" });
    await page
      .locator('[data-review-id="context-menu"]')
      .getByRole("menuitem", { name: "Ask AI" })
      .click();
    const card = page.locator(".agent-media-card");
    await card.waitFor();
    const revisionVisible = await card.getByText(/After|Working tree/u).count();
    const modeCount = await card.locator(".agent-media-mode button").count();
    await card.getByRole("button", { name: "Show" }).click();
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .waitFor();
    await page.evaluate(
      ({ modeCount, revisionVisible }) => {
        window.__SVARD_ALL_DIFFS_AGENT_MEDIA_CHECK__ = {
          modeCount,
          overlayRestored: true,
          revisionVisible: revisionVisible > 0,
        };
      },
      { modeCount, revisionVisible },
    );
    return;
  }
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

  if (context?.scenario === "viewer-source-control-all-diffs-keybindings") {
    await page
      .locator('[data-review-id="source-control-all-diffs-panel"]')
      .click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '.diff-stream-rendered-body [data-active-change="true"]',
          )
          ?.getAttribute("data-change-index") === "0",
    );
    await page.keyboard.press("Alt+ArrowDown");
    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '.diff-stream-rendered-body [data-active-change="true"]',
          )
          ?.getAttribute("data-change-index") === "1",
    );
    await page.keyboard.press("Alt+ArrowUp");
    await page.waitForFunction(
      () =>
        document
          .querySelector(
            '.diff-stream-rendered-body [data-active-change="true"]',
          )
          ?.getAttribute("data-change-index") === "0",
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
      const activeChangeIndex =
        document
          .querySelector(
            '.diff-stream-rendered-body [data-active-change="true"]',
          )
          ?.getAttribute("data-change-index") ?? "";
      const closeResult =
        await window.__SVARD_COMMANDS__?.dispatch("tab.close");
      window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__ = {
        afterBottom,
        afterTop,
        activeChangeIndex,
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
    .locator('.diff-stream-rendered-body [data-active-change="true"]')
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
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "0",
  );
  await performStreamGesture(["Right"]);
  await page
    .waitForFunction(
      () =>
        document
          .querySelector(
            '.diff-stream-rendered-body [data-active-change="true"]',
          )
          ?.getAttribute("data-change-index") === "1",
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
          activeChangeIndex:
            document
              .querySelector(
                '.diff-stream-rendered-body [data-active-change="true"]',
              )
              ?.getAttribute("data-change-index") ?? "",
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
    activeChangeIndex:
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") ?? "",
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await performStreamGesture(["Left"]);
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "0",
  );
  const afterLeft = await page.evaluate(() => ({
    activeChangeIndex:
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") ?? "",
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

async function applyTooComplexSourceFallbackScenario(page) {
  await page.evaluate(() => {
    window.__SVARD_TOO_COMPLEX_GIT_DIFF_FIXTURE__ = true;
    window.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ = 0;
  });
  await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
  await page
    .locator('[data-review-id="source-control-changes-list"]')
    .waitFor();
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  const blocker = page.locator(
    '[data-review-id="diff-stream-too-complex-blocker"]',
  );
  await blocker.waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .waitFor();
  await page.waitForTimeout(850);

  const blockerSection = blocker.locator(
    'xpath=ancestor::*[@data-review-id="diff-stream-file-section"]',
  );
  const reviewState =
    (await blockerSection
      .locator('[data-review-id="document-review-state"]')
      .textContent()) ?? "";
  const allDiffsState = {
    blockerVisible: await blocker.isVisible(),
    otherSectionRendered:
      (await page
        .locator('[data-review-id="diff-stream-rendered-block"]')
        .count()) > 0,
    remainedUnreviewed: reviewState.trim() === "Unreviewed",
    requestCount: await page.evaluate(
      () => window.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ ?? 0,
    ),
  };

  await blocker
    .locator('[data-review-id="diff-stream-open-source-fallback"]')
    .click();
  await page.locator('[data-review-id="git-diff-source-only"]').waitFor();
  await page
    .locator('[data-review-id="git-diff-source-only-banner"]')
    .waitFor();
  await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
  await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();

  await page.evaluate((streamState) => {
    const leftPane = document.querySelector(
      '[data-review-id="git-diff-left-pane"]',
    );
    const rightPane = document.querySelector(
      '[data-review-id="git-diff-right-pane"]',
    );
    const disabledViewIds = [
      "git-diff-overview-view",
      "git-diff-full-preview-view",
      "git-diff-rendered-view",
      "git-diff-table-view",
    ];
    const navigationButtons = Array.from(
      document.querySelectorAll(
        '[data-review-id="git-diff-change-navigation"] button',
      ),
    );
    window.__SVARD_TOO_COMPLEX_DIFF_FALLBACK_SAMPLE__ = {
      ...streamState,
      allDiffsClosed:
        document.querySelectorAll(
          '[data-review-id="source-control-all-diffs-panel"]',
        ).length === 0,
      bannerVisible:
        document
          .querySelector('[data-review-id="git-diff-source-only-banner"]')
          ?.textContent?.trim() ===
        "Change highlighting is unavailable for this comparison.",
      controlsDisabled: disabledViewIds.every((id) => {
        const control = document.querySelector(`[data-review-id="${id}"]`);
        return control instanceof HTMLButtonElement && control.disabled;
      }),
      leftLineNumbers:
        leftPane?.querySelectorAll(".git-diff-line-number").length ?? 0,
      leftSourceVisible:
        leftPane?.textContent?.includes("Original source remains readable.") ===
        true,
      navigationDisabled:
        navigationButtons.length === 2 &&
        navigationButtons.every(
          (button) => button instanceof HTMLButtonElement && button.disabled,
        ),
      requestCountAfterOpen:
        window.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ ?? 0,
      rightLineNumbers:
        rightPane?.querySelectorAll(".git-diff-line-number").length ?? 0,
      rightSourceVisible:
        rightPane?.textContent?.includes("Updated source remains readable.") ===
        true,
      rulerAbsent:
        document.querySelectorAll('[data-review-id="git-diff-change-ruler"]')
          .length === 0,
      sourceOnlyLabel:
        document
          .querySelector('[data-review-id="git-diff-change-count"]')
          ?.textContent?.trim() === "Source only",
      sourceOnlyVisible:
        document.querySelectorAll('[data-review-id="git-diff-source-only"]')
          .length === 1,
    };
  }, allDiffsState);
}
