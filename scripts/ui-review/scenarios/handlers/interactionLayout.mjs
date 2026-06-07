export async function applyInteractionLayoutScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  const performRightButtonGesture = context.performRightButtonGesture;
  const setSidebarResizeOutcome = context.setSidebarResizeOutcome;
  const setOpenFilesSplitResizeOutcome = context.setOpenFilesSplitResizeOutcome;
  if (scenario === "viewer-mouse-gestures-disabled") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "guides" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "quick-start.adoc" })
      .click();
    await page.locator("text=Quick Start").waitFor();
    await performRightButtonGesture(["Left"]);
    await page.locator("text=Quick Start").waitFor();
  } else if (scenario === "viewer-mouse-gestures-navigation") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Mouse Gestures" })
      .click();
    await page
      .locator('[data-review-id="mouse-gestures-enabled"] input')
      .check();
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "guides" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "quick-start.adoc" })
      .click();
    await page.locator("text=Quick Start").waitFor();
    await performRightButtonGesture(["Left"]);
    await page.locator("text=Svard MVP Guide").waitFor();
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getCommandState("navigation.forward")
          .enabled === true,
    );
    await performRightButtonGesture(["Right"]);
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getLastMouseGesture()?.commandId ===
        "navigation.forward",
    );
    const navigationGesture = await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    );
    if (navigationGesture?.commandId !== "navigation.forward") {
      throw new Error(
        `Expected navigation.forward gesture, got ${JSON.stringify(navigationGesture)}`,
      );
    }
    await page.locator("text=Quick Start").waitFor();
  } else if (scenario === "viewer-mouse-gestures-tabs") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Mouse Gestures" })
      .click();
    await page
      .locator('[data-review-id="mouse-gestures-enabled"] input')
      .check();
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "preferences.adoc" })
      .click();
    await page.locator("text=Preferences Defaults").waitFor();
    await performRightButtonGesture(["Down", "Right"]);
    await page
      .locator("text=Preferences Defaults")
      .waitFor({ state: "detached" });
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getCommandState("tab.restoreClosed")
          .enabled === true,
    );
    await performRightButtonGesture(["Down", "Left"]);
    await page.locator("text=Preferences Defaults").waitFor();
  } else if (scenario === "viewer-mouse-gestures-custom-assignment") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Mouse Gestures" })
      .click();
    await page
      .locator('[data-review-id="mouse-gestures-enabled"] input')
      .check();
    const customRow = page
      .locator('[data-review-id="mouse-gesture-row"]')
      .filter({ hasText: "Quick Open" });
    await customRow.locator('[data-review-id="mouse-gesture-record"]').click();
    const pad = customRow.locator(
      '[data-review-id="mouse-gesture-record-pad"]',
    );
    const box = await pad.boundingBox();
    if (!box) {
      throw new Error("gesture record pad is not visible");
    }
    let x = box.x + box.width / 2;
    let y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    y += 70;
    await page.mouse.move(x, y, { steps: 6 });
    y -= 70;
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up({ button: "right" });
    await customRow.locator("text=Down Up").waitFor();
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await performRightButtonGesture(["Down", "Up"]);
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getLastMouseGesture()?.commandId ===
        "quickOpen.focus",
    );
    await page.locator('[data-review-id="quick-open-input"]').press("Escape");
    await page.locator('[data-review-id="quick-open"]').waitFor({
      state: "detached",
    });
    await page.locator('[data-review-id="right-sidebar-tab-contents"]').click();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Mouse Gestures" })
      .click();
    await page.locator('[data-review-id="mouse-gesture-table"]').waitFor();
  } else if (scenario === "viewer-resizable-sidebars") {
    await page.locator('[data-review-id="left-sidebar-resizer"]').waitFor();
    await page.locator('[data-review-id="right-sidebar-resizer"]').waitFor();
    const beforeResize = await page.evaluate(() => ({
      left:
        document
          .querySelector('[data-review-id="left-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
      right:
        document
          .querySelector('[data-review-id="right-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
    }));
    const leftHandle = page.locator('[data-review-id="left-sidebar-resizer"]');
    const leftSidebarBox = await page
      .locator('[data-review-id="left-sidebar"]')
      .boundingBox();
    const rightSidebarBox = await page
      .locator('[data-review-id="right-sidebar"]')
      .boundingBox();
    if (!leftSidebarBox || !rightSidebarBox) {
      throw new Error("sidebar resize handle is not visible");
    }
    const leftPoint = {
      x: leftSidebarBox.x + leftSidebarBox.width - 3,
      y: leftSidebarBox.y + 80,
    };
    const rightPoint = {
      x: rightSidebarBox.x + 3,
      y: rightSidebarBox.y + 80,
    };
    const hitTargets = await page.evaluate(
      ({ leftPoint, rightPoint }) => {
        const describe = (point) => {
          const element = document.elementFromPoint(point.x, point.y);
          return {
            tag: element?.tagName ?? null,
            reviewId:
              element instanceof HTMLElement
                ? (element.dataset.reviewId ?? null)
                : null,
            className:
              element instanceof HTMLElement ? element.className : null,
          };
        };
        return {
          left: describe(leftPoint),
          right: describe(rightPoint),
        };
      },
      { leftPoint, rightPoint },
    );
    await page.mouse.move(leftPoint.x, leftPoint.y);
    await page.mouse.down();
    await page.mouse.move(leftPoint.x + 92, leftPoint.y, { steps: 8 });
    await page.mouse.up();
    const afterLeftResize = await page.evaluate(() => ({
      left:
        document
          .querySelector('[data-review-id="left-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
      right:
        document
          .querySelector('[data-review-id="right-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
    }));
    await page.mouse.move(rightPoint.x, rightPoint.y);
    await page.mouse.down();
    await page.mouse.move(rightPoint.x + 72, rightPoint.y, { steps: 8 });
    await page.mouse.up();
    const afterRightResize = await page.evaluate(() => ({
      left:
        document
          .querySelector('[data-review-id="left-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
      right:
        document
          .querySelector('[data-review-id="right-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
    }));
    await leftHandle.dblclick();
    const afterLeftReset = await page.evaluate(() => ({
      left:
        document
          .querySelector('[data-review-id="left-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
      right:
        document
          .querySelector('[data-review-id="right-sidebar"]')
          ?.getBoundingClientRect().width ?? 0,
    }));
    setSidebarResizeOutcome({
      beforeResize,
      afterLeftResize,
      afterRightResize,
      afterLeftReset,
      hitTargets,
    });
  } else if (scenario === "viewer-resizable-left-sidebar-split") {
    await page.locator('[data-review-id="open-files"]').waitFor();
    await page.locator('[data-review-id="file-tree"]').waitFor();
    const beforeResize = await page.evaluate(() => ({
      openFiles:
        document
          .querySelector('[data-review-id="open-files"]')
          ?.getBoundingClientRect().height ?? 0,
      lowerPane:
        document
          .querySelector('[data-review-id="left-sidebar-lower-pane"]')
          ?.getBoundingClientRect().height ?? 0,
    }));
    const splitBox = await page
      .locator('[data-review-id="open-files-split-resizer"]')
      .boundingBox();
    if (!splitBox) {
      throw new Error("Open Files split resizer is not visible");
    }
    const splitPoint = {
      x: splitBox.x + splitBox.width / 2,
      y: splitBox.y + splitBox.height / 2,
    };
    const hitTarget = await page.evaluate((point) => {
      const element = document.elementFromPoint(point.x, point.y);
      return {
        tag: element?.tagName ?? null,
        reviewId:
          element instanceof HTMLElement
            ? (element.dataset.reviewId ?? null)
            : null,
        className: element instanceof HTMLElement ? element.className : null,
      };
    }, splitPoint);
    await page.mouse.move(splitPoint.x, splitPoint.y);
    await page.mouse.down();
    await page.mouse.move(splitPoint.x, splitPoint.y + 88, { steps: 8 });
    await page.mouse.up();
    const afterResize = await page.evaluate(() => ({
      openFiles:
        document
          .querySelector('[data-review-id="open-files"]')
          ?.getBoundingClientRect().height ?? 0,
      lowerPane:
        document
          .querySelector('[data-review-id="left-sidebar-lower-pane"]')
          ?.getBoundingClientRect().height ?? 0,
    }));
    await page
      .locator('[data-review-id="open-files-split-resizer"]')
      .dblclick();
    const afterReset = await page.evaluate(() => ({
      openFiles:
        document
          .querySelector('[data-review-id="open-files"]')
          ?.getBoundingClientRect().height ?? 0,
      lowerPane:
        document
          .querySelector('[data-review-id="left-sidebar-lower-pane"]')
          ?.getBoundingClientRect().height ?? 0,
    }));
    setOpenFilesSplitResizeOutcome({
      beforeResize,
      afterResize,
      afterReset,
      hitTarget,
    });
  } else if (
    scenario === "viewer-many-tabs" ||
    scenario === "viewer-many-tabs-horizontal"
  ) {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    const files = [
      "kroki-sample.adoc",
      "preferences.adoc",
      "copy-actions.adoc",
      "render-fixtures.adoc",
      "plantuml-large.adoc",
      "graphviz-diagnostic.adoc",
      "plantuml-japanese.adoc",
      "plantuml-japanese-long-text.adoc",
    ];
    for (const file of files) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator(
          '[data-review-id="active-tab"], [data-review-id="active-document-title"]',
        )
        .filter({ hasText: file })
        .waitFor();
    }
    await page.locator('[data-review-id="open-files"]').waitFor();
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" })
      .locator(".open-file-button")
      .click();
    await page
      .locator(
        '[data-review-id="active-tab"], [data-review-id="active-document-title"]',
      )
      .filter({ hasText: "preferences.adoc" })
      .waitFor();
    await page.locator("text=Preferences Defaults").waitFor();
    const tabCountBeforeMiddleClick = await page
      .locator('[data-review-id="open-file-item"]')
      .count();
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click({ button: "middle" });
    await page.waitForFunction(
      (expectedCount) =>
        document.querySelectorAll('[data-review-id="open-file-item"]')
          .length === expectedCount,
      tabCountBeforeMiddleClick - 1,
    );
    await page.locator("text=Preferences Defaults").waitFor();
    if (scenario === "viewer-many-tabs-horizontal") {
      await page.locator('[aria-label="Toggle left sidebar"]').click();
      await page.locator('[data-review-id="tab-more"]').waitFor();
      await page
        .locator('[data-review-id="tab"], [data-review-id="active-tab"]')
        .filter({ hasText: "graphviz-diagnostic.adoc" })
        .click({ button: "middle" });
      await page
        .locator('[data-review-id="tab"], [data-review-id="active-tab"]')
        .filter({ hasText: "graphviz-diagnostic.adoc" })
        .waitFor({ state: "detached" });
      await page.locator("text=Preferences Defaults").waitFor();
    }
  } else {
    return false;
  }
  return true;
}
