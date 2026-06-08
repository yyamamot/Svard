export async function applyFilesScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-files") {
    await page
      .locator('[data-review-id="file-tree-open-menu-trigger"]')
      .click();
    await page.locator('[data-review-id="directory-open-control"]').click();
    await page.locator("text=copy-actions.adoc").waitFor();
    await page.locator("text=preferences.adoc").click();
    await page.locator("text=Preferences Defaults").waitFor();
  } else if (scenario === "viewer-file-tree-toolbar-actions") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    const trigger = page.locator(
      '[data-review-id="file-tree-open-menu-trigger"]',
    );
    await trigger.click();
    await page.locator('[data-review-id="file-tree-open-menu"]').waitFor();
    await page.evaluate(() => {
      const action = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() ?? "",
          ariaLabel: element.getAttribute("aria-label"),
          title: element.getAttribute("title"),
          role: element.getAttribute("role"),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
            right: rect.right,
          },
        };
      };
      const style = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) {
          return null;
        }
        const computed = getComputedStyle(element);
        return {
          display: computed.display,
          gridTemplateColumns: computed.gridTemplateColumns,
          backgroundImage: computed.backgroundImage,
          backgroundColor: computed.backgroundColor,
          borderBottomColor: computed.borderBottomColor,
          borderBottomWidth: computed.borderBottomWidth,
        };
      };
      window.__SVARD_FILE_TREE_TOOLBAR_ACTIONS_CHECK__ = {
        toolbar: action('[data-review-id="file-toolbar"]'),
        toolbarStyle: style('[data-review-id="file-toolbar"]'),
        root: action('[data-review-id="tree-root"]'),
        firstTreeRow: action(
          '[data-review-id="tree-folder-toggle"], [data-review-id="tree-file"]',
        ),
        trigger: action('[data-review-id="file-tree-open-menu-trigger"]'),
        openMenu: action('[data-review-id="file-tree-open-menu"]'),
        openFile: action('[data-review-id="file-open-control"]'),
        openFolder: action('[data-review-id="directory-open-control"]'),
        refresh: action('[data-review-id="tree-refresh"]'),
        collapse: action('[data-review-id="tree-collapse-all"]'),
        itemOrder: [
          ...document.querySelectorAll(
            '[data-review-id="file-tree-open-menu"] [role="menuitem"]',
          ),
        ]
          .filter((element) => element instanceof HTMLElement)
          .map((element) => element.textContent?.trim() ?? ""),
      };
    });
    await page.locator('[data-review-id="directory-open-control"]').click();
    await page.locator("text=copy-actions.adoc").waitFor();
    await trigger.click();
    await page.locator('[data-review-id="file-tree-open-menu"]').waitFor();
  } else if (scenario === "viewer-files-tree") {
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
      .filter({
        hasText: "quick-start.adoc",
      })
      .click();
    await page.locator("text=Quick Start").waitFor();
    await page.locator('[data-review-id="tree-refresh"]').click();
  } else if (scenario === "viewer-files-tree-auto-refresh") {
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_DIRECTORY_CHANGE__ === "function",
    );
    await page.evaluate(() => {
      window.__SVARD_DIRECTORY_ENTRIES__ = {
        "/workspace/docs": [
          {
            name: "auto-created.md",
            path: "/workspace/docs/auto-created.md",
            kind: "file",
          },
        ],
      };
      window.__SVARD_GIT_STATUS_OVERRIDES__ = {
        "/workspace/docs/auto-created.md": "untracked",
      };
      window.__SVARD_TRIGGER_DIRECTORY_CHANGE__?.("/workspace/docs", "created");
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page
      .locator('[data-review-id="tree-file"][data-git-status="untracked"]')
      .filter({ hasText: "auto-created.md" })
      .waitFor();
  } else if (scenario === "viewer-file-tree-new-file-watch-refresh") {
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_DIRECTORY_CHANGE__ === "function",
    );
    await page.evaluate(() => {
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        "/workspace/docs/new-watch-file.md": {
          source: "# New Watch File\n\nCreated while the file tree is open.\n",
          updatedAt: "2026-05-12T00:03:00.000Z",
        },
      };
      window.__SVARD_DIRECTORY_ENTRIES__ = {
        "/workspace/docs": [
          {
            name: "new-watch-file.md",
            path: "/workspace/docs/new-watch-file.md",
            kind: "file",
          },
        ],
      };
      window.__SVARD_TRIGGER_DIRECTORY_CHANGE__?.(
        "/workspace/docs",
        "created",
        "/workspace/docs/new-watch-file.md",
      );
    });
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "new-watch-file.md" })
      .waitFor();
  } else {
    return false;
  }
  return true;
}
