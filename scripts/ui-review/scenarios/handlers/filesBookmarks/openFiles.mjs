export async function applyOpenFilesScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-drag-reorder-open-files") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "preferences.adoc",
      "copy-actions.adoc",
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
    const firstRow = page.locator('[data-review-id="open-file-item"]').nth(0);
    await page
      .locator('[data-review-id="open-file-item"] .open-file-button')
      .nth(1)
      .dragTo(firstRow);
    await page.waitForFunction(() =>
      document
        .querySelectorAll('[data-review-id="open-file-item"]')
        .item(0)
        ?.textContent?.includes("preferences.adoc"),
    );
  } else if (scenario === "viewer-pinned-tabs") {
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
    }
    await page.locator("text=Render Fixtures").waitFor();
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-close-other-files"]')
      .click({ force: true });
  } else if (scenario === "viewer-open-files-row-actions") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "preferences.adoc",
      "copy-actions.adoc",
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
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    const restingCopyActions = await page.evaluate(() => {
      const row = [
        ...document.querySelectorAll('[data-review-id="open-file-item"]'),
      ]
        .filter((candidate) => candidate instanceof HTMLElement)
        .find((candidate) =>
          candidate.textContent?.includes("copy-actions.adoc"),
        );
      const readAction = (selector) => {
        const action = row?.querySelector(selector);
        if (!(action instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(action);
        return {
          opacity: Number(style.opacity),
          visibility: style.visibility,
          pointerEvents: style.pointerEvents,
          ariaLabel: action.getAttribute("aria-label"),
        };
      };
      return {
        restingPin: readAction('[data-review-id="open-file-pin"]'),
        restingClose: readAction('[data-review-id="open-file-close"]'),
      };
    });
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "copy-actions.adoc" })
      .hover();
    await page.waitForTimeout(180);
    await page.evaluate((restingCopyActions) => {
      const readAction = (row, selector) => {
        const action = row?.querySelector(selector);
        if (!(action instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(action);
        return {
          opacity: Number(style.opacity),
          visibility: style.visibility,
          pointerEvents: style.pointerEvents,
          ariaLabel: action.getAttribute("aria-label"),
        };
      };
      const rowByText = (text) =>
        [...document.querySelectorAll('[data-review-id="open-file-item"]')]
          .filter((row) => row instanceof HTMLElement)
          .find((row) => row.textContent?.includes(text));
      const hovered = rowByText("copy-actions.adoc");
      const pinned = rowByText("preferences.adoc");
      const active = rowByText("render-fixtures.adoc");
      window.__SVARD_OPEN_FILES_ROW_ACTIONS_CHECK__ = {
        ...restingCopyActions,
        hoveredPin: readAction(hovered, '[data-review-id="open-file-pin"]'),
        hoveredClose: readAction(hovered, '[data-review-id="open-file-close"]'),
        pinnedPin: readAction(pinned, '[data-review-id="open-file-pin"]'),
        pinnedClose: readAction(pinned, '[data-review-id="open-file-close"]'),
        activeClose: readAction(active, '[data-review-id="open-file-close"]'),
        pinnedRowClass: pinned?.classList.contains("pinned") ?? false,
        activeRowClass: active?.classList.contains("active") ?? false,
      };
    }, restingCopyActions);
  } else if (scenario === "viewer-open-files-filter") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "preferences.adoc" })
      .click();
    await page.locator('[data-review-id="open-files-filter"]').fill("pref");
    await page.locator('[data-review-id="open-files-filter"]').press("Enter");
    await page.locator("text=Preferences Defaults").waitFor();
  } else if (scenario === "viewer-open-files-glob-filter") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "math-rendering.md",
      "preferences.adoc",
      "copy-actions.adoc",
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
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    await page.locator('[data-review-id="open-files-filter"]').fill("*pref*");
    await page
      .locator('[data-review-id="open-file-item"].pinned')
      .filter({ hasText: "preferences.adoc" })
      .waitFor();
    await page.locator('[data-review-id="open-files-filter"]').fill("*.md");
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "math-rendering.md" })
      .waitFor();
    await page.locator('[data-review-id="open-files-filter"]').fill("*copy*");
    await page.locator('[data-review-id="open-files-filter"]').press("Enter");
    await page.locator("text=Copy Actions").waitFor();
  } else if (scenario === "viewer-open-files-collapse") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "preferences.adoc" })
      .click();
    await page.locator('[data-review-id="open-files-collapse"]').click();
    await page.locator('[data-review-id="open-files-collapsed-bar"]').waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click();
    await page.locator('[data-review-id="active-document-title"]').waitFor();
    await page.locator('[data-review-id="open-files-expand"]').click();
    await page.locator('[data-review-id="open-file-item"]').first().waitFor();
    await page.locator('[data-review-id="open-files-collapse"]').click();
    await page.locator('[data-review-id="open-files-collapsed-bar"]').waitFor();
  } else if (scenario === "viewer-open-files-auto-reload-inactive") {
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.locator("text=markdown-code.md").click();
    await page.getByRole("heading", { name: "Markdown Code Sample" }).waitFor();
    await page.evaluate(() => {
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        "/workspace/docs/markdown-sample.md": {
          source:
            "# Markdown Sample Reloaded\n\nThis content was reloaded while the file was inactive.\n",
          updatedAt: "2026-05-12T00:02:00.000Z",
        },
      };
      window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(
        "/workspace/docs/markdown-sample.md",
      );
    });
    await page.waitForTimeout(150);
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"]',
      )
      .click();
    await page
      .getByRole("heading", { name: "Markdown Sample Reloaded" })
      .waitFor();
  } else if (scenario === "viewer-open-files-auto-reload-error") {
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.locator("text=markdown-code.md").click();
    await page.getByRole("heading", { name: "Markdown Code Sample" }).waitFor();
    await page.evaluate(() => {
      window.__SVARD_OPEN_DOCUMENT_ERRORS__ = {
        "/workspace/docs/markdown-sample.md": "mock reload failed",
      };
      window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(
        "/workspace/docs/markdown-sample.md",
      );
    });
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"][data-reload-status="error"]',
      )
      .waitFor();
  } else {
    return false;
  }
  return true;
}
