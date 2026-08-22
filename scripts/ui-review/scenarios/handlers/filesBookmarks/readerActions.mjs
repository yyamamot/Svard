export async function applyReaderActionsScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-open-in-editor") {
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
  } else if (scenario === "viewer-copy-actions") {
    await page.locator("text=copy-actions.adoc").click();
    await page
      .getByRole("heading", { name: "Copy Actions", exact: true })
      .waitFor();
    await page
      .locator('[data-review-id="source-copy-button"]')
      .click({ force: true });
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Source block copied" })
      .waitFor();
    await page
      .locator('[data-review-id="source-reference-copy-button"]')
      .click({ force: true });
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
  } else if (scenario === "viewer-capture-area") {
    await page.locator("text=copy-actions.adoc").click();
    const article = page.locator('[data-review-id="document-body"]');
    await article.waitFor();
    const box = await article.boundingBox();
    if (!box) {
      throw new Error("Capture Area document body was not visible");
    }
    await page.mouse.click(box.x + box.width - 12, box.y + 24, {
      button: "right",
    });
    const referenceAction = page.locator(
      '[data-review-id="context-menu-item-capture-area-with-reference"]',
    );
    const referenceActionVisible = await referenceAction.isVisible();
    await referenceAction.click();
    await page.locator('[data-review-id="capture-area-overlay"]').waitFor();
    await page.mouse.move(box.x + 24, box.y + 48);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 190);
    await page.locator('[data-review-id="capture-area-selection"]').waitFor();
    await page.evaluate((referenceActionVisible) => {
      window.__SVARD_CAPTURE_AREA_CHECK__ = {
        selectionVisible: true,
        referenceActionVisible,
      };
    }, referenceActionVisible);
  } else if (scenario === "viewer-copy-location-reference") {
    await page.locator("text=copy-actions.adoc").click();
    await page
      .getByRole("heading", { name: "Copy Actions", exact: true })
      .waitFor();
    const selectionPoint = await page.evaluate(() => {
      const paragraph = Array.from(document.querySelectorAll("p")).find(
        (element) => element.textContent === "Each path includes:",
      );
      const list = paragraph
        ?.closest(".paragraph")
        ?.nextElementSibling?.querySelector("ul");
      const walker = list
        ? document.createTreeWalker(list, NodeFilter.SHOW_TEXT)
        : null;
      let lastText = null;
      for (let node = walker?.nextNode(); node; node = walker?.nextNode()) {
        if (/\S/u.test(node.textContent ?? "")) lastText = node;
      }
      if (!paragraph?.firstChild || !lastText) return null;
      const range = document.createRange();
      range.setStart(paragraph.firstChild, 0);
      range.setEnd(lastText, lastText.data.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const rect = range.getClientRects()[0];
      return rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null;
    });
    if (!selectionPoint) {
      throw new Error("Location reference selection was not visible");
    }
    await page.mouse.click(selectionPoint.x, selectionPoint.y, {
      button: "right",
    });
    await page
      .locator('[data-review-id="context-menu-item-copy-text-reference"]')
      .waitFor();
    await page
      .locator('[data-review-id="context-menu-item-copy-text-reference"]')
      .click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Text reference copied" })
      .waitFor();
    await page.mouse.click(selectionPoint.x, selectionPoint.y, {
      button: "right",
    });
    await page
      .locator(
        '[data-review-id="context-menu-item-copy-original-text-reference"]',
      )
      .waitFor();
    await page
      .locator(
        '[data-review-id="context-menu-item-copy-original-text-reference"]',
      )
      .click();
    await page
      .locator('[data-review-id="lightweight-action-feedback"]')
      .filter({ hasText: "Original text reference copied" })
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_LOCATION_REFERENCE_CHECK__ = {
        originalReferenceCopied: true,
        selectionReferenceCopied: true,
      };
    });
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
    await page
      .getByRole("heading", { name: "Copy Actions", exact: true })
      .waitFor();
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
  } else if (scenario === "viewer-workspace-search-performance") {
    const phases = [];
    const recordPhase = async (name, started) => {
      const durationMs = Date.now() - started;
      await recordPhaseDuration(name, durationMs);
    };
    const recordPhaseDuration = async (name, durationMs) => {
      phases.push({ name, durationMs, status: "ok" });
      await page.evaluate((nextPhases) => {
        window.__SVARD_BENCHMARK_PHASES__ = nextPhases;
      }, phases);
    };
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-scope-workspace"]').click();
    const dispatchStartedAt = Date.now();
    await page.locator('[data-review-id="search-input"]').fill("Graphviz");
    await recordPhase("query-dispatch", dispatchStartedAt);
    await page.locator('[data-review-id="search-input"]').press("Enter");
    await page.waitForFunction(
      () =>
        typeof window.__SVARD_WORKSPACE_SEARCH_TIMING__?.submitBypassMs ===
        "number",
    );
    const submitTiming = await page.evaluate(
      () => window.__SVARD_WORKSPACE_SEARCH_TIMING__ ?? {},
    );
    await recordPhaseDuration(
      "submit-debounce-bypass",
      Number(submitTiming.submitBypassMs ?? 0),
    );
    await page.waitForFunction(
      () =>
        typeof window.__SVARD_WORKSPACE_SEARCH_TIMING__?.hostSearchMs ===
        "number",
    );
    const hostTiming = await page.evaluate(
      () => window.__SVARD_WORKSPACE_SEARCH_TIMING__ ?? {},
    );
    await recordPhaseDuration(
      "host-search-complete",
      Number(hostTiming.hostSearchMs ?? 0),
    );
    const renderStartedAt = Date.now();
    await page
      .locator('[data-review-id="workspace-search-result-item"]')
      .first()
      .waitFor();
    await recordPhase("result-list-rendered", renderStartedAt);
    await page.evaluate(() => {
      const timing = window.__SVARD_WORKSPACE_SEARCH_TIMING__ ?? {};
      window.__SVARD_WORKSPACE_SEARCH_PERF_CHECK__ = {
        capped: Boolean(timing.capped),
        resultCount: document.querySelectorAll(
          '[data-review-id="workspace-search-result-item"]',
        ).length,
        searchResultCount: Number(timing.resultCount ?? 0),
        searchedFiles: Number(timing.searchedFiles ?? 0),
        skippedFiles: Number(timing.skippedFiles ?? 0),
        status: String(timing.status ?? ""),
        hasScope: Boolean(
          document.querySelector('[data-review-id="search-scope-control"]'),
        ),
        inputValue:
          document.querySelector('[data-review-id="search-input"]')?.value ??
          "",
      };
    });
  } else {
    return false;
  }
  return true;
}
