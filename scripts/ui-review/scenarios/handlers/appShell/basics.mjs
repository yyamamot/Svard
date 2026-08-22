export async function applyAppShellBasicsScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  const performMouseNavigationButton = context.performMouseNavigationButton;
  const collectThemeContrast = context.collectThemeContrast;
  const setThemeContrastOutcome = context.setThemeContrastOutcome;
  if (scenario === "viewer-theme-contrast-light") {
    setThemeContrastOutcome(await collectThemeContrast("light"));
  } else if (scenario === "viewer-theme-contrast-dark") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
    });
    await page.locator(".app-shell.theme-dark").waitFor();
    setThemeContrastOutcome(await collectThemeContrast("dark"));
  } else if (scenario === "viewer-browser-keybindings-tabs") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "kroki-sample.adoc",
      "preferences.adoc",
      "render-fixtures.adoc",
    ]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }
    await page.keyboard.press("Control+1");
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .waitFor();
    await page.keyboard.press("Control+9");
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("tab.close");
    });
    await page.locator("text=Render Fixtures").waitFor({ state: "detached" });
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getCommandState("tab.restoreClosed")
          .enabled === true,
    );
    await page.keyboard.press("Control+Shift+T");
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .waitFor();
    await page.locator("text=Render Fixtures").waitFor();
  } else if (scenario === "viewer-browser-keybindings-navigation") {
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
    await page.keyboard.press("Alt+ArrowLeft");
    await page.locator("text=Svard MVP Guide").waitFor();
    await page.keyboard.press("Alt+ArrowRight");
    await page.locator("text=Quick Start").waitFor();
  } else if (scenario === "viewer-browser-mouse-navigation") {
    await page.locator('[data-review-id="toc"] a').nth(2).waitFor();
    const firstToc = page.locator('[data-review-id="toc"] a').nth(1);
    const secondToc = page.locator('[data-review-id="toc"] a').nth(2);
    const firstText = (await firstToc.textContent())?.trim();
    const secondText = (await secondToc.textContent())?.trim();
    if (!firstText || !secondText) {
      throw new Error("TOC headings are not available");
    }
    await firstToc.click();
    await page.waitForFunction(
      (text) =>
        document
          .querySelector('[data-review-id="toc"] a.active')
          ?.textContent?.trim() === text,
      firstText,
    );
    await secondToc.click();
    await page.waitForFunction(
      (text) =>
        document
          .querySelector('[data-review-id="toc"] a.active')
          ?.textContent?.trim() === text,
      secondText,
    );
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getCommandState("navigation.back")
          .enabled === true,
    );
    await performMouseNavigationButton(3);
    await page.waitForFunction(
      (text) =>
        document
          .querySelector('[data-review-id="toc"] a.active')
          ?.textContent?.trim() === text,
      firstText,
    );
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getCommandState("navigation.forward")
          .enabled === true,
    );
    await performMouseNavigationButton(4);
    await page.waitForFunction(
      (text) =>
        document
          .querySelector('[data-review-id="toc"] a.active')
          ?.textContent?.trim() === text,
      secondText,
    );
  } else if (scenario === "viewer-topbar-direct-layout-controls") {
    await page.locator('[data-review-id="left-sidebar-toggle"]').click();
    await page.locator('[data-review-id="left-sidebar"]').waitFor({
      state: "detached",
    });
    await page.locator('[data-review-id="split-view-toggle"]').click();
    await page.locator('[data-review-id="viewer-split"]').waitFor();
    await page.evaluate(() => {
      window.__SVARD_LAYOUT_MENU_CHECK__ = {
        triggerCount: document.querySelectorAll(
          '[data-review-id="layout-menu-trigger"]',
        ).length,
        menuCount: document.querySelectorAll('[data-review-id="layout-menu"]')
          .length,
        historyTriggerCount: document.querySelectorAll(
          '[data-review-id="history-menu-trigger"]',
        ).length,
        splitButtonCount: document.querySelectorAll(
          '[data-review-id="split-view-toggle"]',
        ).length,
        zenButtonCount: document.querySelectorAll(
          '[data-review-id="zen-mode-toggle"]',
        ).length,
        leftToggleCount: document.querySelectorAll(
          '[data-review-id="left-sidebar-toggle"]',
        ).length,
        rightToggleCount: document.querySelectorAll(
          '[data-review-id="right-sidebar-toggle"]',
        ).length,
        quickOpenTriggerCount: document.querySelectorAll(
          '[data-review-id="quick-open-trigger"]',
        ).length,
        preferencesButtonCount: document.querySelectorAll(
          '[data-review-id="preferences-open"]',
        ).length,
        leftSidebarCount: document.querySelectorAll(
          '[data-review-id="left-sidebar"]',
        ).length,
        splitChecked:
          document
            .querySelector('[data-review-id="split-view-toggle"]')
            ?.getAttribute("aria-pressed") ?? "",
        zenChecked:
          document
            .querySelector('[data-review-id="zen-mode-toggle"]')
            ?.getAttribute("aria-pressed") ?? "",
        leftChecked:
          document
            .querySelector('[data-review-id="left-sidebar-toggle"]')
            ?.getAttribute("aria-pressed") ?? "",
        rightChecked:
          document
            .querySelector('[data-review-id="right-sidebar-toggle"]')
            ?.getAttribute("aria-pressed") ?? "",
      };
    });
  } else if (scenario === "viewer-selection-extraction") {
    await page.evaluate(() => {
      history.replaceState(null, "", "?scenario=viewer-selection-extraction");
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        ...(window.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
        "/workspace/docs/preferences.adoc": {
          source: String.raw`= Selection Math

本章は単一ヘッドなので、stem:[D_{\mathrm{head}}=D_{\mathrm{model}}=3]です。`,
        },
      };
    });
    await page
      .locator(
        '[data-review-id="tree-file"][data-path="/workspace/docs/preferences.adoc"]',
      )
      .click();
    await page.locator('[data-review-id="document-body"] p .katex').waitFor();
    await page
      .locator('[data-review-id="document-body"] p')
      .first()
      .evaluate((paragraph) => {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      });
    await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
    const toolbarAvoidsSelection = await page.evaluate(() => {
      const toolbar = document.querySelector(
        '[data-review-id="selection-mini-toolbar"]',
      );
      const selection = window.getSelection();
      if (!(toolbar instanceof HTMLElement) || !selection?.rangeCount) {
        return false;
      }
      const toolbarRect = toolbar.getBoundingClientRect();
      return Array.from(selection.getRangeAt(0).getClientRects()).every(
        (selectionRect) =>
          toolbarRect.right <= selectionRect.left ||
          toolbarRect.left >= selectionRect.right ||
          toolbarRect.bottom <= selectionRect.top ||
          toolbarRect.top >= selectionRect.bottom,
      );
    });
    await page.getByRole("button", { name: "More selection actions" }).click();
    await page.getByRole("menuitem", { name: "Inspect Selection" }).click();
    await page.locator('[data-review-id="selection-inspector"]').waitFor();
    const inspector = page.locator('[data-review-id="selection-inspector"]');
    const visibleText =
      (await inspector.locator("details pre").nth(0).textContent()) ?? "";
    const modelText =
      (await inspector.locator("details pre").nth(1).textContent()) ?? "";
    await page.evaluate(
      ({ modelText, toolbarAvoidsSelection, visibleText }) => {
        window.__SVARD_SELECTION_EXTRACTION_CHECK__ = {
          inspectorVisible:
            document.querySelector('[data-review-id="selection-inspector"]') !==
            null,
          toolbarVisible:
            document.querySelector(
              '[data-review-id="selection-mini-toolbar"]',
            ) !== null,
          toolbarAvoidsSelection,
          mathVisibleOnce:
            visibleText.match(/D_\{\\mathrm\{head\}\}/gu)?.length === 1 &&
            modelText.match(/D_\{\\mathrm\{head\}\}/gu)?.length === 1 &&
            modelText.includes("$D_{\\mathrm{head}}=D_{\\mathrm{model}}=3$") &&
            !modelText.includes("katex-html"),
        };
      },
      { modelText, toolbarAvoidsSelection, visibleText },
    );
  } else {
    return false;
  }
  return true;
}
