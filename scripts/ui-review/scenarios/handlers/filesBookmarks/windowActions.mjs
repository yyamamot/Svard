export async function applyWindowActionsScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-open-in-new-window-context-menu") {
    const readMenuLabels = async () =>
      page
        .locator('[data-review-id="context-menu"] [role="menuitem"]')
        .evaluateAll((items) =>
          items.map((item) => item.textContent?.trim() ?? ""),
        );
    const openInNewWindow = async () => {
      await page.locator('[data-review-id="context-menu"]').waitFor();
      const labels = await readMenuLabels();
      const nextRequestCount =
        (await page.evaluate(
          () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length,
        )) + 1;
      await page
        .locator('[data-review-id="context-menu-item-open-in-new-window"]')
        .click({ force: true });
      await page.waitForFunction(
        (count) =>
          (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length ===
          count,
        nextRequestCount,
      );
      return labels;
    };

    await page.evaluate(() => {
      globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ = [];
    });
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click();
    await page.locator("text=Copy Actions").waitFor();

    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click({ button: "right" });
    const treeFileLabels = await openInNewWindow();

    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click({ button: "right" });
    const openFileLabels = await openInNewWindow();

    if ((await page.locator('[data-review-id="left-sidebar"]').count()) > 0) {
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft"),
      );
      await page.locator('[data-review-id="left-sidebar"]').waitFor({
        state: "detached",
      });
    }
    await page.locator('[data-review-id="active-tab"]').click({
      button: "right",
    });
    const tabLabels = await openInNewWindow();
    if ((await page.locator('[data-review-id="left-sidebar"]').count()) === 0) {
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft"),
      );
      await page.locator('[data-review-id="left-sidebar"]').waitFor();
    }

    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("bookmark.toggleActive"),
    );
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page
      .locator('[data-review-id="bookmark-item"][data-entry-kind="file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click({ button: "right" });
    const fileBookmarkLabels = await openInNewWindow();

    await page.locator('[data-review-id="sidebar-tab-files"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const directoryRowLabels = await readMenuLabels();
    await page.keyboard.press("Escape");

    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmark-add-root"]').click();
    await page
      .locator('[data-review-id="bookmark-item"][data-entry-kind="directory"]')
      .first()
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const directoryBookmarkLabels = await readMenuLabels();
    await page.keyboard.press("Escape");

    await page.evaluate(
      ({
        directoryBookmarkLabels,
        directoryRowLabels,
        fileBookmarkLabels,
        openFileLabels,
        tabLabels,
        treeFileLabels,
      }) => {
        window.__SVARD_OPEN_IN_NEW_WINDOW_CONTEXT_CHECK__ = {
          directoryBookmarkLabels,
          directoryRowLabels,
          fileBookmarkLabels,
          openFileLabels,
          requests: globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? [],
          tabLabels,
          treeFileLabels,
        };
      },
      {
        directoryBookmarkLabels,
        directoryRowLabels,
        fileBookmarkLabels,
        openFileLabels,
        tabLabels,
        treeFileLabels,
      },
    );
  } else if (scenario === "viewer-open-link-in-new-window") {
    await page.evaluate(() => {
      globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ = [];
    });
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click();
    await page.locator("text=Copy Actions").waitFor();
    await page
      .getByRole("link", { name: "Local document link" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const labels = await page
      .locator('[data-review-id="context-menu"] [role="menuitem"]')
      .evaluateAll((items) =>
        items.map((item) => item.textContent?.trim() ?? ""),
      );
    await page
      .locator('[data-review-id="context-menu-item-open-link-in-new-window"]')
      .click({ force: true });
    await page.waitForFunction(
      () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length === 1,
    );
    await page.evaluate((labels) => {
      window.__SVARD_OPEN_LINK_IN_NEW_WINDOW_CHECK__ = {
        labels,
        requests: globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? [],
      };
    }, labels);
  } else if (scenario === "viewer-move-tab-to-new-window") {
    const readMenuLabels = async () =>
      page
        .locator('[data-review-id="context-menu"] [role="menuitem"]')
        .evaluateAll((items) =>
          items.map((item) => item.textContent?.trim() ?? ""),
        );

    await page.evaluate(() => {
      globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ = [];
    });
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of ["copy-actions.adoc", "preferences.adoc"]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }

    const copyActionsRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "copy-actions.adoc" });
    await copyActionsRow.hover();
    await copyActionsRow.locator('[data-review-id="open-file-pin"]').click();
    await copyActionsRow.click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const openFileLabels = await readMenuLabels();
    await page
      .locator('[data-review-id="context-menu-item-move-tab-to-new-window"]')
      .click({ force: true });
    await page.waitForFunction(
      () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length === 1,
    );
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "copy-actions.adoc" })
      .waitFor({ state: "detached" });

    if ((await page.locator('[data-review-id="left-sidebar"]').count()) > 0) {
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft"),
      );
      await page.locator('[data-review-id="left-sidebar"]').waitFor({
        state: "detached",
      });
    }
    await page.locator('[data-review-id="active-tab"]').click({
      button: "right",
    });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const tabLabels = await readMenuLabels();
    await page
      .locator('[data-review-id="context-menu-item-move-tab-to-new-window"]')
      .click({ force: true });
    await page.waitForFunction(
      () => (globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []).length === 2,
    );
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" })
      .waitFor({ state: "detached" });

    await page.evaluate(
      ({ openFileLabels, tabLabels }) => {
        window.__SVARD_MOVE_TAB_TO_NEW_WINDOW_CHECK__ = {
          openFileLabels,
          requests: globalThis.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? [],
          tabLabels,
          copyActionsRows: document.querySelectorAll(
            '[data-review-id="open-file-item"][data-path="/workspace/docs/copy-actions.adoc"]',
          ).length,
          preferencesRows: document.querySelectorAll(
            '[data-review-id="open-file-item"][data-path="/workspace/docs/preferences.adoc"]',
          ).length,
          startPageCount: document.querySelectorAll(
            '[data-review-id="start-page"]',
          ).length,
        };
      },
      { openFileLabels, tabLabels },
    );
  } else if (scenario === "viewer-context-menu-navigation") {
    const readMenuLabels = async () =>
      page
        .locator('[data-review-id="context-menu"] [role="menuitem"]')
        .evaluateAll((items) =>
          items.map((item) => item.textContent?.trim() ?? ""),
        );
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const treeLabels = await readMenuLabels();
    await page.locator('[data-review-id="context-menu-item-bookmark"]').click();
    await page.locator('[data-review-id="inline-notice"]').waitFor();

    await page.locator('[data-review-id="open-file-item"]').first().click({
      button: "right",
    });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const openFileLabels = await readMenuLabels();
    await page.keyboard.press("Escape");

    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmark-item"]').first().click({
      button: "right",
    });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const bookmarkLabels = await readMenuLabels();
    await page.keyboard.press("Escape");

    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft"),
    );
    await page.locator('[data-review-id="active-tab"]').click({
      button: "right",
    });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    const tabLabels = await readMenuLabels();
    await page.evaluate(
      ({ bookmarkLabels, openFileLabels, tabLabels, treeLabels }) => {
        window.__SVARD_CONTEXT_MENU_NAVIGATION_CHECK__ = {
          bookmarkLabels,
          openFileLabels,
          tabLabels,
          treeLabels,
        };
      },
      { bookmarkLabels, openFileLabels, tabLabels, treeLabels },
    );
  } else {
    return false;
  }
  return true;
}
