export async function applyFilesBookmarksScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-bookmarks") {
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmarks-panel"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-active"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-root"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-active"]').click();
    await page.locator('[data-review-id="bookmark-add-root"]').click();
    await page.locator('[data-review-id="bookmark-item"]').nth(1).waitFor();
    await page
      .locator('[data-review-id="bookmark-open"]')
      .filter({ hasText: "workspace" })
      .click();
    await page.locator('[data-review-id="sidebar-tab-files"]').waitFor();
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page
      .locator('[data-review-id="bookmark-open"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .click();
    await page.locator("text=Svard MVP Guide").waitFor();
    await page
      .locator('[data-review-id="bookmark-item"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .hover();
    await page
      .locator('[data-review-id="bookmark-item"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .locator('[data-review-id="bookmark-remove"]')
      .click();
    await page.locator('[data-review-id="inline-notice-close"]').click();
    await page
      .locator('[data-review-id="inline-notice"]')
      .waitFor({ state: "detached" });
  } else if (scenario === "viewer-drag-reorder-open-files") {
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
  } else if (scenario === "viewer-drag-reorder-bookmarks") {
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmarks-panel"]').waitFor();
    await page.locator('[data-review-id="bookmark-add-active"]').click();
    await page.locator('[data-review-id="bookmark-add-root"]').click();
    await page.locator('[data-review-id="bookmark-item"]').nth(1).waitFor();
    const firstBookmark = page
      .locator('[data-review-id="bookmark-item"]')
      .nth(0);
    await page
      .locator('[data-review-id="bookmark-item"] .bookmark-open')
      .nth(1)
      .dragTo(firstBookmark);
    await page.waitForFunction(() =>
      document
        .querySelectorAll('[data-review-id="bookmark-item"]')
        .item(0)
        ?.textContent?.includes("workspace"),
    );
  } else if (scenario === "viewer-files") {
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
  } else if (scenario === "viewer-open-in-editor") {
    await page.locator('[data-review-id="document-body"]').click({
      button: "right",
    });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-open-in-editor"]')
      .click();
    await page.locator('[data-review-id="inline-notice"]').waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
  } else if (scenario === "viewer-copy-heading-link") {
    const firstTocItem = page.locator('[data-review-id="toc"] a').first();
    await firstTocItem.click();
    await firstTocItem.click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-heading-link"]')
      .click({ force: true });
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Heading link copied" })
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_COPY_HEADING_LINK_CHECK__ = {
        copiedFromTocContextMenu: true,
      };
    });
  } else if (scenario === "viewer-session-restore") {
    await page.locator('[data-review-id="split-view-toggle"]').click();
    await page.locator('[data-review-id="viewer-split"]').waitFor();
    await page.locator('[data-review-id="toc"] a').nth(1).click();
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
  } else if (scenario === "viewer-copy-actions") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    await page.locator('[data-review-id="source-copy-button"]').click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Source block copied" })
      .waitFor();
    await page
      .locator('[data-review-id="source-reference-copy-button"]')
      .click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Source reference copied" })
      .waitFor();
    const sourceBlock = page.locator(".source-block-frame pre");
    await sourceBlock.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await sourceBlock.click({ button: "right", force: true });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-source"]')
      .waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-source-reference"]')
      .waitFor();
    await page.keyboard.press("Escape");
    await page
      .locator('[data-review-id="context-menu"]')
      .waitFor({ state: "detached" });
    await page.locator('[data-review-id="right-sidebar-tab-contents"]').click();
    await page
      .locator('[data-review-id="toc"] a')
      .filter({ hasText: "Code" })
      .click();
    await page
      .locator('[data-review-id="toc"] a')
      .filter({ hasText: "Code" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-heading-link"]')
      .click({ force: true });
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Heading link copied" })
      .waitFor();
  } else if (scenario === "viewer-code-block-actions") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    const sourceFrame = page.locator(".source-block-frame").first();
    await sourceFrame.scrollIntoViewIfNeeded();
    await sourceFrame
      .locator('[data-review-id="source-block-toolbar"]')
      .waitFor();
    await sourceFrame
      .locator('[data-review-id="source-block-language"]')
      .waitFor();
    await sourceFrame
      .locator('[data-review-id="source-copy-button"]')
      .waitFor();
    await sourceFrame
      .locator('[data-review-id="source-reference-copy-button"]')
      .waitFor();
    await sourceFrame.locator('[data-review-id="source-wrap-toggle"]').click();
    await sourceFrame
      .locator('[data-review-id="source-collapse-toggle"]')
      .click();
    await page.evaluate(() => {
      const frame = document.querySelector(".source-block-frame");
      const language = frame?.querySelector(
        '[data-review-id="source-block-language"]',
      );
      const wrap = frame?.querySelector(
        '[data-review-id="source-wrap-toggle"]',
      );
      const collapse = frame?.querySelector(
        '[data-review-id="source-collapse-toggle"]',
      );
      window.__SVARD_CODE_BLOCK_ACTIONS_SEEN__ =
        frame?.classList.contains("source-block-wrapped") === true &&
        frame?.classList.contains("source-block-collapsed") === true &&
        language?.textContent?.trim().length > 0 &&
        wrap?.getAttribute("aria-pressed") === "true" &&
        collapse?.getAttribute("aria-expanded") === "false" &&
        collapse?.textContent?.trim() === "Expand";
    });
  } else if (scenario === "viewer-asciidoc-code-highlight") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    const sourceFrame = page.locator(".source-block-frame").first();
    await sourceFrame.scrollIntoViewIfNeeded();
    await sourceFrame
      .locator(".hljs-keyword")
      .filter({ hasText: "const" })
      .waitFor();
    await sourceFrame
      .locator('[data-review-id="source-block-toolbar"]')
      .waitFor();
    await page.evaluate(() => {
      const frame = document.querySelector(".source-block-frame");
      window.__SVARD_ASCIIDOC_CODE_HIGHLIGHT_SEEN__ =
        frame?.querySelector("pre.hljs code.language-ts .hljs-keyword")
          ?.textContent === "const" &&
        frame?.querySelector(".hljs-string")?.textContent === '"Svard"' &&
        Boolean(
          frame?.querySelector('[data-review-id="source-block-toolbar"]'),
        );
    });
  } else if (scenario === "viewer-section-collapse") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    const codeHeading = page
      .locator("[data-section-collapse-heading]")
      .filter({ hasText: "Code" })
      .first();
    await codeHeading
      .locator('[data-review-id="section-collapse-toggle"]')
      .click();
    await page.evaluate(() => {
      const heading = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      ).find((item) => item.textContent?.includes("Code"));
      window.__SVARD_SECTION_COLLAPSE_SEEN__ =
        heading?.getAttribute("data-section-collapsed") === "true" &&
        heading
          ?.querySelector('[data-review-id="section-collapse-toggle"]')
          ?.getAttribute("aria-expanded") === "false" &&
        Boolean(
          document.querySelector(
            ".section-collapsed-hidden .source-block-frame",
          ),
        );
    });
    await codeHeading
      .locator('[data-review-id="section-collapse-toggle"]')
      .click();
    await page.evaluate(() => {
      const heading = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      ).find((item) => item.textContent?.includes("Code"));
      window.__SVARD_SECTION_COLLAPSE_EXPANDED__ =
        heading?.getAttribute("data-section-collapsed") === "false" &&
        !document.querySelector(
          ".section-collapsed-hidden .source-block-frame",
        );
    });
  } else if (scenario === "viewer-section-collapse-search-auto-expand") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    const codeHeading = page
      .locator("[data-section-collapse-heading]")
      .filter({ hasText: "Code" })
      .first();
    await codeHeading
      .locator('[data-review-id="section-collapse-toggle"]')
      .click();
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-input"]').fill("Svard");
    await page.locator('[data-review-id="search-result-item"]').first().click();
    await page.evaluate(() => {
      const heading = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      ).find((item) => item.textContent?.includes("Code"));
      window.__SVARD_SECTION_COLLAPSE_SEARCH_EXPANDED__ =
        heading?.getAttribute("data-section-collapsed") === "false" &&
        Boolean(document.querySelector("mark.search-hit.active")) &&
        !document.querySelector(
          ".section-collapsed-hidden .source-block-frame",
        );
    });
  } else if (scenario === "viewer-section-copy") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    const codeHeading = page.getByRole("heading", { name: "Code" });
    await codeHeading.click({ button: "right", force: true });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-section"]')
      .waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-section-reference"]')
      .waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-section"]')
      .click({ force: true });
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Section copied" })
      .waitFor();

    await codeHeading.click({ button: "right", force: true });
    await page
      .locator('[data-review-id="context-menu-item-copy-section-reference"]')
      .click({ force: true });
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Section reference copied" })
      .waitFor();

    await page.locator("text=include-main.adoc").click();
    await page.getByRole("heading", { name: "Include Main" }).waitFor();
    const includedHeading = page.getByRole("heading", {
      name: "Antora Partial Title",
    });
    await includedHeading.click({ button: "right", force: true });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page.evaluate(() => {
      const labels = Array.from(
        document.querySelectorAll(
          '[data-review-id="context-menu"] [role="menuitem"]',
        ),
      ).map((item) => item.textContent?.trim() ?? "");
      window.__SVARD_SECTION_COPY_MENU_SEEN__ =
        labels.includes("Copy Section Reference") &&
        !labels.includes("Copy Section");
    });
  } else if (scenario === "viewer-lightweight-action-feedback") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    await page.locator('[data-review-id="source-copy-button"]').click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Source block copied" })
      .waitFor();
    await page
      .locator('[data-review-id="inline-notice"]')
      .waitFor({ state: "detached" });
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .waitFor({ state: "detached" });
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "mvp-guide.adoc" })
      .click();
    await page.locator("text=Svard MVP Guide").waitFor();
    await page.evaluate(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      if (viewer instanceof HTMLElement) {
        viewer.scrollTop = 260;
      }
    });
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page
      .locator('[data-review-id="search-input"]')
      .fill("IMP-096-no-hit");
    await page.locator('[data-review-id="search-pin"]').click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Search pinned" })
      .waitFor();
  } else if (scenario === "viewer-link-hover-status") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    await page.getByRole("link", { name: "External link" }).hover();
    await page
      .locator('[data-review-id="link-hover-status"]')
      .filter({ hasText: "https://example.com" })
      .waitFor();
    await page.mouse.move(8, 8);
    await page
      .locator('[data-review-id="link-hover-status"]')
      .waitFor({ state: "detached" });
    await page.getByRole("link", { name: "Local document link" }).hover();
    await page
      .locator('[data-review-id="link-hover-status"]')
      .filter({ hasText: "/workspace/docs/render-fixtures.adoc" })
      .waitFor();
  } else if (scenario === "viewer-local-link-preview") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    await page.getByRole("link", { name: "Same document code link" }).hover();
    await page
      .locator('[data-review-id="link-preview-popover"]')
      .filter({ hasText: "Code" })
      .waitFor();
    const sameDocumentPreviewSeen = await page
      .locator('[data-review-id="link-preview-popover"]')
      .filter({ hasText: "const product" })
      .count();
    await page.mouse.move(8, 8);
    await page
      .locator('[data-review-id="link-preview-popover"]')
      .waitFor({ state: "detached" });
    await page.getByRole("link", { name: "Local document link" }).hover();
    await page
      .locator('[data-review-id="link-preview-popover"]')
      .filter({ hasText: "Render Fixtures" })
      .waitFor();
    const localPreviewSeen = await page
      .locator('[data-review-id="link-preview-popover"]')
      .filter({ hasText: "Source Block" })
      .count();
    await page.getByRole("link", { name: "External link" }).hover();
    await page.waitForTimeout(350);
    const externalPreviewCount = await page
      .locator('[data-review-id="link-preview-popover"]')
      .count();
    const localLinkPreviewCheck = {
      sameDocumentPreviewSeen: sameDocumentPreviewSeen > 0,
      localPreviewSeen: localPreviewSeen > 0,
      externalPreviewSuppressed: externalPreviewCount === 0,
    };
    await page.evaluate((check) => {
      window.__SVARD_LOCAL_LINK_PREVIEW_CHECK__ = check;
    }, localLinkPreviewCheck);
  } else if (scenario === "viewer-local-link-dedup-tabs") {
    await page.locator("text=render-fixtures.adoc").click();
    await page.locator("text=Render Fixtures").waitFor();
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    await page.getByRole("link", { name: "Local document link" }).click();
    await page.locator("text=Render Fixtures").waitFor();
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .first()
      .waitFor();
  } else if (scenario === "viewer-context-menu-document") {
    await page.locator("text=copy-actions.adoc").click();
    await page.locator("text=Copy Actions").waitFor();
    await page.locator(".source-block-frame pre").click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
  } else if (scenario === "viewer-table-copy") {
    await page.locator("text=render-fixtures.adoc").click();
    await page.locator("text=Render Fixtures").waitFor();
    await page
      .locator("table")
      .filter({ hasText: "AsciiDoc" })
      .first()
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-table-tsv"]')
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_TABLE_COPY_MENU_SEEN__ = true;
    });
  } else if (scenario === "viewer-open-in-new-window-context-menu") {
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
  } else if (scenario === "viewer-context-menu-search-toc") {
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-input"]').fill("Graphviz");
    await page
      .locator('[data-review-id="search-result-item"]')
      .first()
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
  } else if (scenario === "viewer-workspace-search") {
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-scope-workspace"]').click();
    await page.locator('[data-review-id="search-input"]').fill("Graphviz");
    await page
      .locator('[data-review-id="workspace-search-result-item"]')
      .filter({ hasText: "docs/graphviz-diagnostic.adoc" })
      .first()
      .waitFor();
    const diagnosticIndex = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll(
          '[data-review-id="workspace-search-result-item"]',
        ),
      );
      return rows.findIndex((row) =>
        row.textContent?.includes("docs/graphviz-diagnostic.adoc"),
      );
    });
    await page.locator('[data-review-id="search-input"]').press("Enter");
    await page.locator('[data-review-id="search-input"]').press("Shift+Enter");
    for (let index = 0; index < diagnosticIndex - 1; index += 1) {
      await page.locator('[data-review-id="search-input"]').press("Enter");
    }
    await page.locator('[data-review-id="search-input"]').press("Enter");
    await page.getByRole("heading", { name: "Graphviz Diagnostic" }).waitFor();
    await page.waitForFunction(() =>
      Boolean(
        document.querySelector(
          '[data-review-id="document-body"][data-rendered-document-path="/workspace/docs/graphviz-diagnostic.adoc"]',
        ),
      ),
    );
    await page
      .locator('[data-review-id="workspace-search-result-item"]')
      .filter({ hasText: "docs/graphviz-diagnostic.adoc" })
      .first()
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_WORKSPACE_SEARCH_CHECK__ = {
        resultCount: document.querySelectorAll(
          '[data-review-id="workspace-search-result-item"]',
        ).length,
        hasScope: Boolean(
          document.querySelector('[data-review-id="search-scope-control"]'),
        ),
        inputValue:
          document.querySelector('[data-review-id="search-input"]')?.value ??
          "",
        activePath: document
          .querySelector('[data-review-id="document-body"]')
          ?.getAttribute("data-rendered-document-path"),
        hasSourceLineTarget: Boolean(
          document.querySelector("[data-source-line]"),
        ),
        hasRawSourceDump:
          (document.querySelector('[data-review-id="search-result-list"]')
            ?.textContent?.length ?? 0) > 4000,
      };
    });
  } else if (scenario === "viewer-reload-watch") {
    await page.locator("text=render-fixtures.adoc").click();
    await page.locator("text=Render Fixtures").waitFor();
    await page
      .locator(
        '[data-review-id="active-tab"], [data-review-id="active-document-title"]',
      )
      .waitFor();
  } else if (scenario === "viewer-smart-scroll-restore") {
    const path = "/workspace/docs/markdown-sample.md";
    const initialSource = `# Markdown Sample

Intro before smart scroll.

## Top Section

${"Top filler paragraph.\n\n".repeat(16)}

## Target Section

This is the smart scroll restoration target.

${"Target filler paragraph.\n\n".repeat(18)}

## Tail Section

Tail content.
`;
    const updatedSource = `# Markdown Sample

Prepended update before target.

${"New top content.\n\n".repeat(12)}

## Top Section

${"Top filler paragraph.\n\n".repeat(16)}

## Target Section

This is the smart scroll restoration target.

${"Target filler paragraph.\n\n".repeat(18)}

## Tail Section

Tail content.
`;
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_DOCUMENT_CHANGE__ === "function",
    );
    await page.evaluate(
      ({ path: documentPath, source }) => {
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          [documentPath]: {
            source,
            updatedAt: "2026-05-12T00:04:00.000Z",
          },
        };
      },
      { path, source: initialSource },
    );
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Target Section" }).waitFor();
    await page.evaluate(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      const target = [...document.querySelectorAll("h2")].find(
        (heading) => heading.textContent?.trim() === "Target Section",
      );
      if (viewer instanceof HTMLElement && target instanceof HTMLElement) {
        viewer.scrollTop = Math.max(0, target.offsetTop - 72);
        viewer.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await page.waitForFunction(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      return (viewer?.scrollTop ?? 0) > 0;
    });
    await page.waitForTimeout(150);
    await page.evaluate(
      ({ path: documentPath, source }) => {
        const viewer = document.querySelector(
          '[data-review-id="document-viewer"]',
        );
        const target = [...document.querySelectorAll("h2")].find(
          (heading) => heading.textContent?.trim() === "Target Section",
        );
        window.__SVARD_SMART_SCROLL_RESTORE_BEFORE__ = {
          scrollTop: viewer?.scrollTop ?? 0,
          targetTop: target?.getBoundingClientRect().top ?? null,
        };
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          [documentPath]: {
            source,
            updatedAt: "2026-05-12T00:05:00.000Z",
          },
        };
        window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(documentPath);
      },
      { path, source: updatedSource },
    );
    await page.getByText("Prepended update before target").waitFor();
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      const target = [...document.querySelectorAll("h2")].find(
        (heading) => heading.textContent?.trim() === "Target Section",
      );
      const viewerRect = viewer?.getBoundingClientRect();
      const targetRect = target?.getBoundingClientRect();
      window.__SVARD_SMART_SCROLL_RESTORE_CHECK__ = {
        before: window.__SVARD_SMART_SCROLL_RESTORE_BEFORE__,
        restoredNearTarget:
          Boolean(viewerRect && targetRect) &&
          targetRect.top >= viewerRect.top - 24 &&
          targetRect.top <= viewerRect.top + 180,
        scrollTop: viewer?.scrollTop ?? 0,
        targetText: target?.textContent?.trim() ?? "",
      };
    });
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
