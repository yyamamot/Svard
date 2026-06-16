import { applyAppShellPreferencesScenario } from "./appShell/preferences.mjs";

export async function applyAppShellScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  const performMouseNavigationButton = context.performMouseNavigationButton;
  const collectThemeContrast = context.collectThemeContrast;
  const setThemeContrastOutcome = context.setThemeContrastOutcome;
  if (await applyAppShellPreferencesScenario(context)) {
    return true;
  }
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
  } else if (scenario === "viewer-split-basic") {
    await openSplitViewFromTopbar(page);
    await page.locator('[data-review-id="viewer-split"]').waitFor();
    await page.locator('[data-pane-id="right"].focused').waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .click();
    await page
      .locator('[data-pane-id="right"] [data-review-id="document-body"]')
      .filter({ hasText: "Render Fixtures" })
      .waitFor();
    await page.locator('[data-review-id="right-sidebar-tab-contents"]').click();
  } else if (scenario === "viewer-split-search") {
    await openSplitViewFromTopbar(page);
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .click();
    await page
      .locator('[data-pane-id="right"] [data-review-id="document-body"]')
      .filter({ hasText: "Render Fixtures" })
      .waitFor();
    await page.locator('[data-pane-id="left"]').click();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("search.focus");
    });
    await page.locator('[data-review-id="search-input"]').fill("workflow");
    await page
      .locator('[data-review-id="search-result-list"]')
      .filter({ hasText: "workflow" })
      .waitFor();
    await page.locator('[data-pane-id="right"]').click();
    await page.locator('[data-review-id="search-input"]').fill("Render");
    await page
      .locator('[data-review-id="search-result-list"]')
      .filter({ hasText: "Render" })
      .waitFor();
  } else if (scenario === "viewer-split-navigation") {
    await openSplitViewFromTopbar(page);
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .click();
    await page.locator('[data-review-id="toc"] a').nth(2).waitFor();
    const firstToc = page.locator('[data-review-id="toc"] a').nth(1);
    const secondToc = page.locator('[data-review-id="toc"] a').nth(2);
    const firstText = (await firstToc.textContent())?.trim();
    const secondText = (await secondToc.textContent())?.trim();
    if (!firstText || !secondText) {
      throw new Error("Split TOC headings are not available");
    }
    await firstToc.click();
    await secondToc.click();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("navigation.back");
    });
    await page.waitForFunction(
      (text) =>
        document
          .querySelector('[data-review-id="toc"] a.active')
          ?.textContent?.trim() === text,
      firstText,
    );
  } else if (scenario === "viewer-quick-open") {
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
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmark-add-active"]').click();
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page.locator('[data-review-id="quick-open-hints"]').waitFor();
    await page.locator('[data-review-id="quick-open-close"]').click();
    await page.locator('[data-review-id="quick-open"]').waitFor({
      state: "detached",
    });
    await page.evaluate(() => {
      window.__SVARD_QUICK_OPEN_HINTS_SEEN__ = true;
      window.__SVARD_QUICK_OPEN_CLOSE_SEEN__ = true;
    });
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page.locator('[data-review-id="quick-open-input"]').fill("quick");
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "quick-start.adoc" })
      .waitFor();
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Bookmark" })
      .waitFor();
    await page.keyboard.press("Enter");
    await page.locator("text=Quick Start").waitFor();
    await page.locator('[data-review-id="sidebar-tab-files"]').click();
    await page.locator('[data-review-id="tree-refresh"]').click();
    await page.locator('[data-review-id="inline-notice"]').waitFor();
    await page
      .locator('[data-review-id="inline-notice"]')
      .waitFor({ state: "detached", timeout: 6000 });
  } else if (scenario === "viewer-command-palette") {
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page.locator('[data-review-id="quick-open-input"]').fill(">search");
    await page
      .locator('[data-review-id="quick-open-mode"]')
      .filter({ hasText: "Commands" })
      .waitFor();
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Focus Search" })
      .click();
    await page.locator('[data-review-id="search-input"]').waitFor();
    await page.waitForFunction(
      () => window.__SVARD_COMMANDS__?.getLastCommand() === "search.focus",
    );
  } else if (scenario === "viewer-zen-mode-prototype") {
    const modifier = await page.evaluate(() =>
      navigator.platform.toLowerCase().includes("mac") ? "Meta" : "Control",
    );
    await page.keyboard.press(`${modifier}+K`);
    await page.keyboard.press("Z");
    await page.locator('[data-zen-mode-active="true"]').waitFor();
    await page.waitForFunction(
      () =>
        window.__SVARD_COMMANDS__?.getLastCommand() === "view.toggleZenMode",
    );
    await page.evaluate(() => {
      const shell = document.querySelector('[data-review-id="shell"]');
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      const body = document.querySelector('[data-review-id="document-body"]');
      const viewerRect = viewer?.getBoundingClientRect();
      const bodyRect = body?.getBoundingClientRect();
      window.__SVARD_ZEN_MODE_CHECK__ = {
        active: shell?.getAttribute("data-zen-mode-active") === "true",
        leftSidebarCount: document.querySelectorAll(
          '[data-review-id="left-sidebar"]',
        ).length,
        rightSidebarCount: document.querySelectorAll(
          '[data-review-id="right-sidebar"]',
        ).length,
        topbarCount: document.querySelectorAll(".topbar").length,
        tabBarCount: document.querySelectorAll('[data-review-id="tab-bar"]')
          .length,
        activeTitleCount: document.querySelectorAll(
          '[data-review-id="active-document-title"]',
        ).length,
        quickOpenTriggerCount: document.querySelectorAll(
          '[data-review-id="quick-open-trigger"]',
        ).length,
        inlineNoticeCount: document.querySelectorAll(
          '[data-review-id="inline-notice"]',
        ).length,
        exitControlCount: document.querySelectorAll(
          '[data-review-id="zen-mode-exit-control"]',
        ).length,
        documentViewerHeight: viewerRect?.height ?? 0,
        documentBodyWidth: bodyRect?.width ?? 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    await page.locator('[data-review-id="zen-mode-exit-control"]').click();
    await page.locator('[data-zen-mode-active="true"]').waitFor({
      state: "detached",
    });
    await page.waitForFunction(
      () => window.__SVARD_COMMANDS__?.getLastCommand() === "view.exitZenMode",
    );
    await page.evaluate(() => {
      window.__SVARD_ZEN_MODE_EXIT_CHECK__ = {
        activeAfterExit:
          document
            .querySelector('[data-review-id="shell"]')
            ?.getAttribute("data-zen-mode-active") === "true",
        exitControlCountAfterExit: document.querySelectorAll(
          '[data-review-id="zen-mode-exit-control"]',
        ).length,
        exitCommandObserved:
          window.__SVARD_COMMANDS__?.getLastCommand() === "view.exitZenMode",
      };
    });
    await page.keyboard.press(`${modifier}+K`);
    await page.keyboard.press("Z");
    await page.locator('[data-zen-mode-active="true"]').waitFor();
    await page.locator('[data-review-id="zen-mode-exit-control"]').waitFor();
  } else if (scenario === "viewer-shortcut-gesture-hints-command") {
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page
      .locator('[data-review-id="quick-open-input"]')
      .fill(">shortcuts");
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Shortcuts and Gestures" })
      .click();
    await page
      .locator('[data-review-id="viewer-shortcut-gesture-hints-panel"]')
      .waitFor();
    const firstPanelText = await page
      .locator('[data-review-id="viewer-shortcut-gesture-hints-panel"]')
      .innerText();
    await page.keyboard.press("Escape");
    await page
      .locator('[data-review-id="viewer-shortcut-gesture-hints-panel"]')
      .waitFor({ state: "detached" });
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open-input"]').fill(">help");
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Shortcuts and Gestures" })
      .click();
    await page
      .locator('[data-review-id="viewer-shortcut-gesture-hints-panel"]')
      .waitFor();
    await page
      .locator('[data-review-id="shortcut-gesture-hints-close"]')
      .click();
    await page
      .locator('[data-review-id="viewer-shortcut-gesture-hints-panel"]')
      .waitFor({ state: "detached" });
    await page.evaluate((text) => {
      window.__SVARD_VIEWER_SHORTCUT_HINTS_CHECK__ = {
        text,
        triggerCount: document.querySelectorAll(
          '[data-review-id="viewer-shortcut-gesture-hints-open"]',
        ).length,
        panelCountAfterClose: document.querySelectorAll(
          '[data-review-id="viewer-shortcut-gesture-hints-panel"]',
        ).length,
      };
    }, firstPanelText);
  } else if (scenario === "viewer-command-palette-headings") {
    await page
      .locator('[data-review-id="toc"] a')
      .filter({ hasText: "Search" })
      .waitFor();
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page.locator('[data-review-id="quick-open-input"]').fill("@Search");
    await page
      .locator('[data-review-id="quick-open-mode"]')
      .filter({ hasText: "Headings" })
      .waitFor();
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Search" })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-review-id="toc"] a.active')
          ?.textContent?.trim() === "Search",
    );
  } else if (scenario === "viewer-command-palette-line-jump") {
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open"]').waitFor();
    await page.locator('[data-review-id="quick-open-input"]').fill(":592");
    await page
      .locator('[data-review-id="quick-open-mode"]')
      .filter({ hasText: "Source line" })
      .waitFor();
    await page.locator('[data-review-id="quick-open-result"]').first().click();
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-quick-open-line-jump-highlight="true"]',
        ) !== null,
    );
    await page.evaluate(() => {
      window.__SVARD_LINE_JUMP_SEEN__ = true;
    });
  } else if (scenario === "viewer-search") {
    const phases = [];
    const recordPhaseDuration = async (name, durationMs) => {
      phases.push({ name, durationMs, status: "ok" });
      await page.evaluate((nextPhases) => {
        window.__SVARD_BENCHMARK_PHASES__ = nextPhases;
      }, phases);
    };
    const recordPhase = async (name, started) => {
      await recordPhaseDuration(name, Date.now() - started);
    };
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    const inputStartedAt = Date.now();
    await page.locator('[data-review-id="search-input"]').fill("AsciiDoc");
    await recordPhase("input-fill", inputStartedAt);
    await page.waitForFunction(
      () => window.__SVARD_CURRENT_FILE_SEARCH_TIMING__?.status === "ready",
    );
    const searchTiming = await page.evaluate(
      () => window.__SVARD_CURRENT_FILE_SEARCH_TIMING__ ?? {},
    );
    await recordPhaseDuration(
      "highlight-complete",
      Number(searchTiming.highlightMs ?? 0),
    );
    const resultListStartedAt = Date.now();
    await page.locator('[data-review-id="search-hit"]').first().waitFor();
    await page.locator('[data-review-id="search-result-item"]').first().waitFor();
    await recordPhase("result-list-rendered", resultListStartedAt);
    const clickStartedAt = Date.now();
    await page.locator('[data-review-id="search-result-item"]').first().click();
    await page
      .locator('[data-review-id="search-result-item"].active')
      .filter({ hasText: "1 /" })
      .waitFor();
    const clickTiming = await page.evaluate(
      () => window.__SVARD_CURRENT_FILE_SEARCH_TIMING__ ?? {},
    );
    await recordPhaseDuration(
      "active-hit-update",
      Number(clickTiming.activeHitUpdateMs ?? 0),
    );
    await recordPhase("hit-scroll", clickStartedAt);
    const nextStartedAt = Date.now();
    await page.locator('[data-review-id="search-input"]').press("Enter");
    await page
      .locator('[data-review-id="search-result-item"].active')
      .filter({ hasText: "2 /" })
      .waitFor();
    await recordPhase("next-navigation", nextStartedAt);
    const previousStartedAt = Date.now();
    await page.locator('[data-review-id="search-input"]').press("Shift+Enter");
    await page
      .locator('[data-review-id="search-result-item"].active')
      .filter({ hasText: "1 /" })
      .waitFor();
    await recordPhase("previous-navigation", previousStartedAt);
    const nextButtonStartedAt = Date.now();
    await page.locator('[data-review-id="search-next"]').click();
    await recordPhase("next-button", nextButtonStartedAt);
    const manualScrollStartedAt = Date.now();
    await page.evaluate(async () => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      if (!(viewer instanceof HTMLElement)) {
        return false;
      }
      viewer.scrollTop = Math.max(0, viewer.scrollTop - 120);
      const afterManualScroll = viewer.scrollTop;
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      return viewer.scrollTop === afterManualScroll;
    });
    await recordPhase("manual-scroll-stability", manualScrollStartedAt);
    const pinStartedAt = Date.now();
    await page.locator('[data-review-id="search-pin"]').click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Search pinned" })
      .waitFor();
    await page
      .locator('[data-review-id="search-pinned-status"]')
      .filter({ hasText: "Pinned search: AsciiDoc" })
      .waitFor();
    await recordPhase("pin-search-feedback", pinStartedAt);
  } else if (scenario === "viewer-search-hit-ruler") {
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-page"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Experimental" })
      .click();
    await page.locator('[data-review-id="preferences-tab-experimental"]').waitFor();
    await page
      .locator('[data-review-id="experimental-search-hit-ruler-control"]')
      .check();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.close");
    });
    await page.locator('[data-review-id="document-body"]').waitFor();
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-input"]').fill("AsciiDoc");
    await page.locator('[data-review-id="search-result-item"]').first().click();
    await page.locator('[data-review-id="search-hit-ruler"]').waitFor();
    await page
      .locator('[data-review-id="search-hit-ruler-active-marker"]')
      .waitFor();
    await page
      .locator('[data-review-id="search-hit-ruler-marker"]')
      .first()
      .click();
    await page
      .locator('[data-review-id="search-result-item"].active')
      .first()
      .waitFor();
  } else if (scenario === "viewer-search-clear-pinned") {
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-input"]').fill("Kroki");
    await page.locator('[data-review-id="search-pin"]').click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Search pinned" })
      .waitFor();
    await page.locator('[data-review-id="search-clear"]').click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Pinned search cleared" })
      .waitFor();
    await page.locator('[data-review-id="search-pinned-status"]').waitFor({
      state: "detached",
    });
    await page
      .locator('[data-review-id="search-result"]')
      .filter({ hasText: "No search query" })
      .waitFor();
  } else if (scenario === "viewer-right-sidebar-tabs") {
    await page.locator('[data-review-id="right-sidebar-tabs"]').waitFor();
    await page.locator('[data-review-id="toc"]').waitFor();
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-input"]').fill("Svard");
    await page.locator('[data-review-id="search-result-list"]').waitFor();
    await page.locator('[data-review-id="right-sidebar-tab-contents"]').click();
    await page.locator('[data-review-id="toc"]').waitFor();
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
  } else if (scenario === "viewer-keybindings-native") {
    await page.keyboard.press("Control+F");
    await page
      .locator('[data-review-id="right-sidebar-tab-search"].active')
      .waitFor();
    await page.locator('[data-review-id="search-input"]').fill("Kroki");
    await page.locator('[data-review-id="search-hit"].active').waitFor();
    await page.keyboard.press("Control+G");
    await page.keyboard.press("Control+B");
    await page.locator('[data-review-id="tab-bar"]').waitFor();
    await page.keyboard.press("Control+B");
    await page.locator('[data-review-id="open-files"]').waitFor();
  } else if (scenario === "viewer-keybindings-vim") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Keybindings" })
      .click();
    await page
      .locator('[data-review-id="keybinding-preset-control"]')
      .waitFor();
  } else if (scenario === "viewer-keybindings-emacs") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Keybindings" })
      .click();
    await page
      .locator('[data-review-id="keybinding-preset-control"]')
      .waitFor();
  } else if (scenario === "viewer-command-automation") {
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("search.focus");
    });
    await page.locator('[data-review-id="search-input"]').fill("Kroki");
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("search.next");
      await window.__SVARD_COMMANDS__?.dispatch("bookmark.toggleActive");
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.showBookmarks");
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.showFiles");
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
    });
    await page.locator('[data-review-id="tab-bar"]').waitFor();
    await page
      .locator('[data-review-id="document-viewer"]')
      .evaluate((element) => element.scrollTo(0, 0));
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
  } else if (scenario === "viewer-window-local-recent-tabs") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of ["preferences.adoc", "render-fixtures.adoc"]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" })
      .click();
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "preferences.adoc" })
      .waitFor();
    const openFileRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await openFileRow.click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const contextMenuText = await page
      .locator('[data-review-id="context-menu"]')
      .innerText();
    await page.keyboard.press("Escape");
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("tab.switchToRecent");
    });
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .waitFor();
    await page.evaluate((contextMenuText) => {
      window.__SVARD_WINDOW_LOCAL_RECENT_TABS_CHECK__ = {
        activeTitle:
          document.querySelector('[data-review-id="active-document-title"]')
            ?.textContent ?? "",
        commandEnabled:
          window.__SVARD_COMMANDS__?.getCommandState("tab.switchToRecent")
            ?.enabled ?? false,
        lastCommand: window.__SVARD_COMMANDS__?.getLastCommand() ?? null,
        contextMenuHasSwitchRecent: contextMenuText.includes(
          "Switch to Recent Tab",
        ),
      };
    }, contextMenuText);
  } else if (scenario === "viewer-new-window") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.evaluate(() => {
      globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ = [];
    });
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.showBookmarks");
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.showFiles");
      await window.__SVARD_COMMANDS__?.dispatch("window.new");
    });
    await page.waitForFunction(
      () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length === 1,
    );
    await page.evaluate(() => {
      const requests = globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? [];
      window.__SVARD_NEW_WINDOW_CHECK__ = {
        request: requests.at(-1) ?? null,
        lastCommand: window.__SVARD_COMMANDS__?.getLastCommand() ?? null,
        commandEnabled:
          window.__SVARD_COMMANDS__?.getCommandState("window.new")?.enabled ??
          false,
      };
    });
  } else if (scenario === "viewer-duplicate-window") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.evaluate(() => {
      globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ = [];
    });
    await page.locator('[data-review-id="document-viewer"]').evaluate((node) =>
      node.scrollTo({
        top: 180,
      }),
    );
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.showBookmarks");
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.showFiles");
      await window.__SVARD_COMMANDS__?.dispatch("window.duplicate");
    });
    await page.waitForFunction(
      () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length === 1,
    );
    await page.evaluate(() => {
      const requests = globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? [];
      window.__SVARD_DUPLICATE_WINDOW_CHECK__ = {
        request: requests.at(-1) ?? null,
        lastCommand: window.__SVARD_COMMANDS__?.getLastCommand() ?? null,
        commandEnabled:
          window.__SVARD_COMMANDS__?.getCommandState("window.duplicate")
            ?.enabled ?? false,
      };
    });
  } else if (scenario === "viewer-restore-additional-windows-opt-in") {
    await page.waitForFunction(
      () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length === 1,
    );
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-page"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Experimental" })
      .click();
    await page.locator('[data-review-id="preferences-tab-experimental"]').waitFor();
    await page.evaluate(() => {
      const requests = globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? [];
      window.__SVARD_RESTORE_ADDITIONAL_WINDOWS_CHECK__ = {
        requests,
        restoreChecked:
          document.querySelector(
            '[data-review-id="experimental-restore-additional-windows-control"]',
          )?.checked ?? false,
      };
    });
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.close");
    });
    await page.locator('[data-review-id="document-viewer"]').waitFor();
  } else if (scenario === "viewer-start-page") {
    await page.locator('[data-review-id="start-page"]').waitFor();
  } else if (scenario === "viewer-close-last-tab") {
    await page.locator('[data-review-id="open-file-close"]').first().click();
    await page.locator('[data-review-id="start-page"]').waitFor();
  } else if (scenario === "viewer-close-all-tabs") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of ["preferences.adoc", "render-fixtures.adoc"]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    await preferencesRow.click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-close-all-files"]')
      .click({ force: true });
    await page.locator('[data-review-id="start-page"]').waitFor();
  } else {
    return false;
  }
  return true;
}

async function openSplitViewFromTopbar(page) {
  await page.locator('[data-review-id="split-view-toggle"]').click();
}
