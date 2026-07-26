export async function applyAppShellWindowLifecycleScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-window-local-recent-tabs") {
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
    await page
      .locator('[data-review-id="preferences-tab-experimental"]')
      .waitFor();
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
