import { expect, test } from "@playwright/test";

test("viewer-basic shows shell, rendered document, TOC, and search", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("shell")).toBeVisible();
  await expect(page.getByTestId("left-sidebar")).toBeVisible();
  await expect(page.getByTestId("document-viewer")).toContainText(
    "Svard MVP Guide",
  );
  await expect(page.getByTestId("toc")).toContainText("Reader Workflow");
  await expect(page.getByTestId("mermaid-render").locator("svg")).toBeVisible();
  await expect(
    page.getByTestId("plantuml-render").locator("svg"),
  ).toBeVisible();
  await expect(
    page.getByTestId("graphviz-render").locator("svg"),
  ).toBeVisible();

  await page.getByTestId("right-sidebar-tab-search").click();
  await page.getByTestId("search-input").fill("Graphviz");
  await expect(page.getByTestId("search-result")).toContainText("matches");
  await expect(page.getByTestId("search-result-item").first()).toBeVisible();
  await expect(page.getByTestId("search-hit").first()).toBeVisible();
  await expect(
    page.locator('[data-review-id="search-hit"].active'),
  ).toHaveCount(1);
});

test("viewer-preferences exposes MVP defaults", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
  });
  await expect(page.getByTestId("preferences-dialog")).toBeVisible();
  await expect(page.getByTestId("preferences-nav")).toBeVisible();
  await expect(page.getByTestId("preferences-pane")).toBeVisible();
  await expect(page.getByTestId("preferences-tab-general")).toContainText(
    "Theme",
  );
  await expect(page.getByTestId("theme-control")).toBeVisible();
  await page.getByText("Dark", { exact: true }).click();
  await expect(page.getByTestId("shell")).toHaveClass(/theme-dark/);
  await expect(page.getByTestId("zoom-slider")).toHaveValue("100");
  await page.getByTestId("zoom-slider").fill("120");
  await expect(page.getByTestId("zoom-value")).toHaveText("120%");
  await page.getByTestId("zoom-reset").click();
  await expect(page.getByTestId("zoom-slider")).toHaveValue("100");
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "Diagrams" })
    .click();
  await expect(page.getByTestId("preferences-tab-diagrams")).not.toContainText(
    "Local",
  );
  await expect(page.getByTestId("mermaid-renderer")).toContainText("Built-in");
  await expect(page.getByTestId("mermaid-renderer")).toContainText(
    "Mermaid uses the built-in renderer.",
  );
  await expect(page.getByTestId("preferences-tab-diagrams")).not.toContainText(
    "TeaVM",
  );
  await expect(page.getByTestId("preferences-tab-diagrams")).not.toContainText(
    "Viz.js",
  );
  await expect(page.getByTestId("plantuml-renderer-control")).toContainText(
    "Built-in",
  );
  await expect(page.getByTestId("plantuml-renderer-control")).toContainText(
    "Kroki",
  );
  await expect(page.getByTestId("graphviz-renderer-control")).toContainText(
    "Built-in",
  );
  await expect(page.getByTestId("graphviz-renderer-control")).toContainText(
    "Kroki",
  );
  await page
    .getByTestId("diagram-advanced-settings")
    .locator("summary")
    .click();
  await expect(page.getByTestId("plantuml-timeout-control")).toHaveValue(
    "10000",
  );
  await expect(page.getByTestId("graphviz-timeout-control")).toHaveValue(
    "10000",
  );
  await expect(page.getByTestId("diagram-timeout-unit")).toHaveText([
    "ms",
    "ms",
  ]);
  await page
    .getByTestId("plantuml-renderer-control")
    .getByText("Kroki", { exact: true })
    .click();
  await page
    .getByTestId("graphviz-renderer-control")
    .getByText("Kroki", { exact: true })
    .click();
  await expect(page.getByTestId("preferences-tab-diagrams")).toContainText(
    "Uses the endpoint configured in Kroki settings.",
  );
  await expect(
    page.getByLabel("PlantUML renderer").getByLabel("Kroki"),
  ).toBeChecked();
  await expect(
    page.getByLabel("Graphviz / DOT renderer").getByLabel("Kroki"),
  ).toBeChecked();
  await page.getByTestId("plantuml-timeout-control").fill("15000");
  await expect(page.getByTestId("plantuml-timeout-control")).toHaveValue(
    "15000",
  );
  await page.getByTestId("diagram-open-kroki-settings").first().click();
  await expect(page.getByTestId("preferences-tab-kroki")).toBeVisible();
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "Kroki" })
    .click();
  await expect(page.getByTestId("preferences-tab-kroki")).toContainText(
    "Disabled",
  );
  await expect(page.getByTestId("preferences-tab-kroki")).toContainText(
    "Public kroki.io",
  );
  await expect(page.getByTestId("kroki-mode-help")).toHaveText(
    "Kroki is not used.",
  );
  await expect(page.getByTestId("kroki-privacy-note")).toContainText(
    "Public kroki.io requires per-request confirmation.",
  );
  await expect(page.getByTestId("kroki-mode-control")).not.toContainText(
    "Local",
  );
  await page.getByTestId("kroki-mode-control").selectOption("remote");
  await expect(page.getByTestId("kroki-mode-help")).toHaveText(
    "Use a trusted self-managed Kroki endpoint, including LAN or localhost.",
  );
  await expect(page.getByTestId("kroki-endpoint-control")).toBeEnabled();
  await expect(page.getByTestId("kroki-endpoint-control")).toHaveAttribute(
    "placeholder",
    "http://192.168.1.10:8000",
  );
  await page
    .getByTestId("kroki-endpoint-control")
    .fill("http://192.168.1.10:8000");
  await expect(page.getByTestId("kroki-diagnostic")).toContainText(
    "PlantUML diagnostic",
  );
  await page.getByTestId("kroki-test-run").click();
  await expect(page.getByTestId("kroki-test-result")).toContainText(
    "Mock Kroki SVG",
  );
  await expect(page.getByTestId("kroki-test-svg").locator("svg")).toBeVisible();
  await page.getByTestId("kroki-mode-control").selectOption("public");
  await expect(page.getByTestId("kroki-mode-help")).toHaveText(
    "Uses https://kroki.io. Sending still requires confirmation.",
  );
  await expect(page.getByTestId("kroki-endpoint-control")).toHaveValue(
    "https://kroki.io",
  );
  await expect(page.getByTestId("kroki-endpoint-control")).toBeDisabled();
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "Network" })
    .click();
  await expect(page.getByTestId("preferences-tab-network")).toContainText(
    "HTTP proxy",
  );
  await expect(page.getByTestId("http-proxy-mode-control")).toContainText(
    "Disabled",
  );
  await expect(page.getByTestId("http-proxy-url-control")).toBeDisabled();
  await page
    .getByTestId("http-proxy-mode-control")
    .getByText("Custom", { exact: true })
    .click();
  await expect(page.getByTestId("http-proxy-url-control")).toBeEnabled();
  await page
    .getByTestId("http-proxy-url-control")
    .fill("http://proxy.local:8080");
  await expect(page.getByTestId("http-proxy-url-control")).toHaveValue(
    "http://proxy.local:8080",
  );
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "PR / MR Providers" })
    .click();
  await expect(
    page.getByTestId("preferences-tab-remote-providers"),
  ).toContainText("PR / MR Providers");
  await expect(
    page.getByTestId("preferences-tab-remote-providers"),
  ).toContainText("Used by Source Control > Branch Diff");
  await expect(page.getByTestId("remote-provider-github")).toContainText(
    "Not configured",
  );
  await expect(page.getByTestId("remote-provider-github")).toContainText(
    "Use GitHub to detect PR target branches",
  );
  await page.getByTestId("remote-provider-github-token").fill("mock-token");
  await page.getByTestId("remote-provider-github-save-token").click();
  await expect(
    page.getByTestId("remote-provider-github-token-status"),
  ).toContainText("Ready for PR target detection");
  await expect(page.getByTestId("remote-provider-github-token")).toHaveValue(
    "",
  );
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "Security" })
    .click();
  await expect(page.getByTestId("preferences-tab-security")).toContainText(
    "Show local images",
  );
  await expect(page.getByTestId("preferences-tab-security")).toContainText(
    "Render image files referenced by the current document.",
  );
  await expect(page.getByTestId("preferences-tab-security")).toContainText(
    "Confirm external links before opening",
  );
  await expect(page.getByTestId("preferences-tab-security")).toContainText(
    "Ask before opening http/https links in the system browser.",
  );
  await expect(page.getByTestId("preferences-tab-security")).toContainText(
    "Remote Kroki rendering has its own confirmation setting under Kroki. Public kroki.io always requires confirmation.",
  );
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "Cache" })
    .click();
  await expect(page.getByTestId("preferences-tab-cache")).toContainText(
    "Kroki cache",
  );
  await expect(page.getByTestId("preferences-tab-cache")).toContainText(
    "Store rendered Kroki diagrams on this device.",
  );
  await expect(page.getByTestId("cache-retention-note")).toHaveText(
    "Cached files are kept until you clear them or the operating system removes app cache data.",
  );
  await page
    .getByTestId("preferences-nav-item")
    .filter({ hasText: "Mouse Gestures" })
    .click();
  await expect(
    page.getByTestId("preferences-tab-mouse-gestures"),
  ).toContainText("Gesture assignments");
  await expect(
    page.getByTestId("mouse-gesture-table").locator("thead"),
  ).toContainText("Action");
  await expect(page.getByTestId("mouse-gesture-row")).toHaveCount(10);
  await expect(page.getByTestId("mouse-gesture-row").first()).toContainText(
    "Navigate Back",
  );
  await expect(page.getByTestId("mouse-gesture-row").first()).toContainText(
    "navigation.back",
  );
  await expect(
    page.getByTestId("mouse-gesture-table").locator("select"),
  ).toHaveCount(0);
  await expect(page.getByTestId("mouse-gesture-add")).toHaveCount(0);
  await expect(page.getByTestId("mouse-gesture-reset")).toBeVisible();
});

test("viewer-search stays scoped to the active tab during tab switches", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("copy-actions.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText("Copy Actions");
  await page.getByTestId("right-sidebar-tab-search").click();
  await page.getByTestId("search-input").fill("Pl");
  await expect(page.getByTestId("search-result")).toContainText("0 matches");

  await page
    .getByTestId("open-file-item")
    .filter({ hasText: "mvp-guide.adoc" })
    .click();
  await expect(page.getByTestId("search-input")).toHaveValue("");
  await expect(page.getByTestId("search-result")).toContainText(
    "No search query",
  );
  await expect(page.getByTestId("search-hit")).toHaveCount(0);
  await expect(page.getByTestId("document-body")).toContainText(
    "Svard MVP Guide",
  );

  await page.getByTestId("search-input").fill("G");
  await expect(page.getByTestId("search-result")).toContainText("matches");
  await expect(page.getByTestId("search-hit").first()).toBeVisible();

  await page.getByTestId("search-input").type("r");
  await expect(page.getByTestId("search-input")).toHaveValue("Gr");
  await expect(page.getByTestId("search-result")).not.toContainText(
    "0 matches",
  );
  await expect(page.getByTestId("search-hit").first()).toBeVisible();

  await page.getByTestId("search-input").type("aphviz");
  await expect(page.getByTestId("search-input")).toHaveValue("Graphviz");
  await expect(page.getByTestId("search-result")).toContainText("3 matches");
  await expect(page.getByTestId("search-hit")).toHaveCount(3);
  await page.getByTestId("search-pin").click();
  await expect(page.getByTestId("search-default-status")).toContainText(
    "Default search: Graphviz",
  );
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Search pinned",
  );

  await page.getByText("render-fixtures.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
  await expect(page.getByTestId("search-input")).toHaveValue("Graphviz");
  await expect(page.getByTestId("search-result")).toContainText("0 matches");

  await page
    .getByTestId("open-file-item")
    .filter({ hasText: "mvp-guide.adoc" })
    .click();
  await expect(page.getByTestId("search-input")).toHaveValue("Graphviz");

  await page.getByTestId("search-input").fill("");
  await page.getByTestId("search-input").type("Pl");
  await expect(page.getByTestId("search-input")).toHaveValue("Pl");
  await expect(page.getByTestId("search-result")).not.toContainText(
    "0 matches",
  );
  await expect(page.getByTestId("search-hit").first()).toBeVisible();

  await page.getByTestId("search-input").type("antUML");
  await expect(page.getByTestId("search-result")).toContainText("3 matches");
  await expect(page.getByTestId("search-hit")).toHaveCount(3);

  await page
    .getByTestId("open-file-item")
    .filter({ hasText: "copy-actions.adoc" })
    .click();
  await expect(page.getByTestId("search-input")).toHaveValue("Pl");
  await expect(page.getByTestId("search-result")).toContainText("0 matches");
  await expect(page.getByTestId("search-hit")).toHaveCount(0);
  await expect(page.getByTestId("document-body")).toContainText("Copy Actions");
});

test("viewer-pinned-tabs keeps pinned files when closing others", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("copy-actions.adoc").click();
  await page.getByText("render-fixtures.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
  await expect(page.getByTestId("open-file-drag-handle")).toHaveCount(0);

  const pinnedRow = page
    .getByTestId("open-file-item")
    .filter({ hasText: "mvp-guide.adoc" });
  await pinnedRow.getByTestId("open-file-pin").click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "pinned",
  );

  await page
    .getByTestId("open-file-item")
    .filter({ hasText: "render-fixtures.adoc" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close Other Files" }).click();
  await expect(page.getByTestId("open-file-item")).toHaveCount(2);
  await expect(
    page.getByTestId("open-file-item").filter({ hasText: "mvp-guide.adoc" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("open-file-item")
      .filter({ hasText: "render-fixtures.adoc" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("open-file-item").filter({ hasText: "copy-actions.adoc" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
  await page
    .getByTestId("open-file-item")
    .filter({ hasText: "render-fixtures.adoc" })
    .click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Close Other Files" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("viewer-open-files-collapse hides only the Open Files pane", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("copy-actions.adoc").click();
  await expect(page.getByTestId("open-file-item")).toHaveCount(2);

  await page.getByTestId("open-files-collapse").click();
  await expect(page.getByTestId("open-files-collapsed-bar")).toContainText(
    "Open Files (2)",
  );
  await expect(page.getByTestId("open-files-expand")).toBeVisible();
  await expect(page.getByTestId("open-files-filter")).toHaveCount(0);
  await expect(page.getByTestId("open-file-item")).toHaveCount(0);
  await expect(page.getByTestId("open-files-split-resizer")).toHaveCount(0);

  await page.getByText("render-fixtures.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
  await expect(page.getByTestId("open-files-collapsed-bar")).toContainText(
    "Open Files (3)",
  );

  await page.getByTestId("open-files-expand").click();
  await expect(page.getByTestId("open-file-item")).toHaveCount(3);
  await expect(page.getByTestId("open-files-filter")).toBeVisible();
  await expect(page.getByTestId("open-files-split-resizer")).toBeVisible();
});

test("viewer-copy-actions covers source, reference, selection, path, and links", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.getByText("copy-actions.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "const product",
  );

  await page.getByTestId("source-copy-button").dispatchEvent("click");
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Source block copied",
  );
  await expect(page.getByTestId("inline-notice")).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'const product = "Svard";',
  );

  await page.getByTestId("source-reference-copy-button").dispatchEvent("click");
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Source reference copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/copy-actions.adoc:5",
  );

  await page.getByTestId("right-sidebar-tab-search").click();
  await expect(page.getByTestId("selection-copy")).toHaveCount(0);
  await expect(page.getByTestId("path-copy")).toHaveCount(0);
  const sourceBlock = page.locator(".source-block-frame pre");
  await sourceBlock.scrollIntoViewIfNeeded();
  await expect(
    sourceBlock.locator("xpath=..").locator(".source-block-toolbar"),
  ).toHaveCSS("user-select", "none");
  await sourceBlock.selectText();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
    'const product = "Svard";',
  );
  const selectionPoint = await page.evaluate(() => {
    const selection = window.getSelection();
    const rect = selection?.rangeCount
      ? selection.getRangeAt(0).getClientRects()[0]
      : null;
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  });
  expect(selectionPoint).not.toBeNull();
  await page.mouse.click(selectionPoint!.x, selectionPoint!.y, {
    button: "right",
  });
  await page.getByRole("menuitem", { name: "Copy Text Reference" }).click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Text reference copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'Text:\nconst product = "Svard";',
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Section:",
  );

  const sourceParagraph = page.getByText(
    "A source paragraph for copy actions.",
  );
  await sourceParagraph.selectText();
  const sourceBlockSelectionPoint = await page.evaluate(() => {
    const selection = window.getSelection();
    const rect = selection?.rangeCount
      ? selection.getRangeAt(0).getClientRects()[0]
      : null;
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  });
  expect(sourceBlockSelectionPoint).not.toBeNull();
  await page.mouse.click(
    sourceBlockSelectionPoint!.x,
    sourceBlockSelectionPoint!.y,
    { button: "right" },
  );
  await page
    .getByRole("menuitem", { name: "Copy Original Text Reference" })
    .click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Original text reference copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Original text:\nA *source* paragraph for copy actions.",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Section:",
  );

  await sourceBlock.selectText();
  const sourceRangeSelectionPoint = await page.evaluate(() => {
    const selection = window.getSelection();
    const rect = selection?.rangeCount
      ? selection.getRangeAt(0).getClientRects()[0]
      : null;
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  });
  expect(sourceRangeSelectionPoint).not.toBeNull();
  await page.mouse.click(
    sourceRangeSelectionPoint!.x,
    sourceRangeSelectionPoint!.y,
    {
      button: "right",
    },
  );
  await expect(
    page.getByRole("menuitem", { name: "Copy Text Reference" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Copy Original Text Reference" }),
  ).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Copy Original Text Reference" })
    .click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Original text reference copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '[source,ts]\n----\nconst product = "Svard";\n----',
  );

  await page.evaluate(() => {
    const pre = document.querySelector(".source-block-frame pre")!;
    const paragraph = Array.from(
      document.querySelectorAll("p[data-source-text-block-id]"),
    ).find((element) => element.textContent?.includes("source paragraph"))!;
    const range = document.createRange();
    range.setStart(pre, 0);
    range.setEnd(paragraph, paragraph.childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const crossBlockSelectionPoint = await page.evaluate(() => {
    const rect = window.getSelection()?.getRangeAt(0).getClientRects()[0];
    return rect ? { x: rect.left + 8, y: rect.top + 8 } : null;
  });
  expect(crossBlockSelectionPoint).not.toBeNull();
  await page.mouse.click(
    crossBlockSelectionPoint!.x,
    crossBlockSelectionPoint!.y,
    {
      button: "right",
    },
  );
  await page
    .getByRole("menuitem", { name: "Copy Original Text Reference" })
    .click();
  const crossBlockOriginal = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(crossBlockOriginal).toContain(
    '[source,ts]\n----\nconst product = "Svard";\n----\n\nA *source* paragraph for copy actions.',
  );
  expect(crossBlockOriginal).toContain(
    "File: /workspace/docs/copy-actions.adoc:5-10",
  );

  await sourceBlock.selectText();
  const locationSelectionPoint = await page.evaluate(() => {
    const selection = window.getSelection();
    const rect = selection?.rangeCount
      ? selection.getRangeAt(0).getClientRects()[0]
      : null;
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  });
  expect(locationSelectionPoint).not.toBeNull();
  await page.mouse.click(locationSelectionPoint!.x, locationSelectionPoint!.y, {
    button: "right",
  });
  await page.getByRole("menuitem", { name: "Copy Text Reference" }).click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Text reference copied",
  );
  const locationReference = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(locationReference).toContain(
    "File: /workspace/docs/copy-actions.adoc:5",
  );
  expect(locationReference).toContain('Text:\nconst product = "Svard";');

  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page
    .getByTestId("document-body")
    .click({ button: "right", position: { x: 20, y: 260 } });
  await page.getByRole("menuitem", { name: "Copy Document Path" }).click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Path copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/copy-actions.adoc",
  );

  await page.getByTestId("right-sidebar-tab-contents").click();
  const codeTocItem = page.getByTestId("toc").getByRole("link", {
    name: "Code",
  });
  await codeTocItem.click();
  await codeTocItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy Heading Link" }).click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Heading link copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/copy-actions.adoc:1#_code",
  );

  await codeTocItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy Text Reference" }).click();
  const headingLocationReference = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(headingLocationReference).toContain(
    "File: /workspace/docs/copy-actions.adoc:1",
  );
  expect(headingLocationReference).toContain("Text:\nCode");

  await page.getByRole("link", { name: "External link" }).click();
  await expect(
    page.getByTestId("external-link-confirmation-dialog"),
  ).toContainText("Open external link?");
  await expect(
    page.getByTestId("external-link-confirmation-url"),
  ).toContainText("https://example.com");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("link", { name: "Local document link" }).click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
});

test("viewer-diagram-context-action saves rendered svg without host save api", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByTestId("diagram-inline-image")
    .locator("svg")
    .first()
    .waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("diagram-inline-image").first().click({
    button: "right",
  });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Save SVG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("mvp-guide-diagram.svg");
  await expect(page.getByTestId("inline-notice")).toContainText(
    "Diagram SVG saved",
  );
});

test("viewer-context-menu-document exposes document actions", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.getByText("copy-actions.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "const product",
  );

  await page.locator(".source-block-frame pre").click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /^Copy Source$/ }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Copy Source Reference" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/copy-actions.adoc:5",
  );

  await page.getByRole("heading", { name: "Code" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy Heading Link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/copy-actions.adoc:1#_code",
  );

  await page.getByRole("link", { name: "External link" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: "Copy Link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://example.com",
  );

  await page.getByRole("link", { name: "Local document link" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: "Open Document" }).click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
});

test("viewer Capture Area copies a visible document rectangle as PNG", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByText("copy-actions.adoc").click();
  const article = page.getByTestId("document-body");
  await expect(article).toContainText("A source paragraph for copy actions.");
  const box = await article.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.click(box.x + box.width - 12, box.y + 24, {
    button: "right",
  });
  await page.getByRole("menuitem", { name: "Capture Area…" }).click();
  await expect(page.getByTestId("capture-area-overlay")).toBeVisible();

  await page.mouse.move(box.x + 24, box.y + 48);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 190);
  await page.mouse.up();

  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Image copied",
  );
  const copiedImage = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    if (!item?.types.includes("image/png")) {
      return { types: item?.types ?? [], colorCount: 0, width: 0, height: 0 };
    }
    const blob = await item!.getType("image/png");
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    const pixels = context?.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    ).data;
    const colors = new Set<string>();
    for (let index = 0; pixels && index < pixels.length; index += 16) {
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }
    return {
      types: item.types,
      colorCount: colors.size,
      width: bitmap.width,
      height: bitmap.height,
    };
  });
  expect(copiedImage.types).toContain("image/png");
  expect(copiedImage.colorCount).toBeGreaterThan(1);

  await page.mouse.click(box.x + box.width - 12, box.y + 24, {
    button: "right",
  });
  await page
    .getByRole("menuitem", { name: "Capture Area with Reference…" })
    .click();
  await page.mouse.move(box.x + 24, box.y + 48);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 190);
  await page.mouse.up();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Image with reference copied",
  );
  const referencedSize = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item!.getType("image/png"));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    const pixels =
      context?.getImageData(0, 0, canvas.width, canvas.height).data ??
      new Uint8ClampedArray();
    let footerInkPixels = 0;
    for (let y = Math.floor(canvas.height * 0.72); y < canvas.height; y += 3) {
      for (let x = 0; x < canvas.width; x += 3) {
        const index = (y * canvas.width + x) * 4;
        if (
          pixels[index + 3] === 255 &&
          pixels[index] < 180 &&
          pixels[index + 1] < 180 &&
          pixels[index + 2] < 180
        ) {
          footerInkPixels += 1;
        }
      }
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      footerInkPixels,
    };
  });
  expect(referencedSize.width).toBe(copiedImage.width);
  expect(referencedSize.height).toBeGreaterThan(copiedImage.height);
  expect(referencedSize.footerInkPixels).toBeGreaterThan(10);
});

test("viewer Diff Preview Capture Area spans both rendered panes", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByText("git-modified.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();

  const diffBody = page.getByTestId("git-full-preview-diff");
  await expect(diffBody).toBeVisible();
  const rightPane = page.getByTestId("git-full-preview-right-pane");
  const paneBox = await rightPane.boundingBox();
  expect(paneBox).not.toBeNull();
  if (!paneBox) return;
  const paragraph = rightPane.locator("p").first();
  const paragraphBox = await paragraph.boundingBox();
  expect(paragraphBox).not.toBeNull();
  if (!paragraphBox) return;

  await page.mouse.click(paragraphBox.x + 12, paragraphBox.y + 12, {
    button: "right",
  });
  await page
    .getByRole("menuitem", { name: "Capture Area with Reference…" })
    .click();
  const overlay = page.getByTestId("capture-area-overlay");
  await expect(overlay).toBeVisible();
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox?.width).toBeGreaterThan(paneBox.width);

  await page.mouse.move((overlayBox?.x ?? 0) + 24, (overlayBox?.y ?? 0) + 32);
  await page.mouse.down();
  await page.mouse.move(
    (overlayBox?.x ?? 0) + (overlayBox?.width ?? 0) - 24,
    (overlayBox?.y ?? 0) + 180,
  );
  await page.mouse.up();
  await expect(
    page.getByTestId("lightweight-action-feedback").filter({
      hasText: "Image with reference copied",
    }),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();
        return item?.types.includes("image/png") ?? false;
      }),
    )
    .toBe(true);
  const firstPixelAlpha = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const blob = await item!.getType("image/png");
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    return context?.getImageData(0, 0, 1, 1).data[3] ?? 0;
  });
  expect(firstPixelAlpha).toBe(255);
});

test("viewer split Capture Area spans both document panes", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByText("copy-actions.adoc").click();
  await page.getByTestId("split-view-toggle").click();
  await expect(page.getByTestId("viewer-split")).toBeVisible();

  const article = page.getByTestId("document-body").first();
  const articleBox = await article.boundingBox();
  expect(articleBox).not.toBeNull();
  if (!articleBox) return;
  await page.mouse.click(articleBox.x + 24, articleBox.y + 40, {
    button: "right",
  });
  await page
    .getByRole("menuitem", { name: "Capture Area with Reference…" })
    .click();

  const overlay = page.getByTestId("capture-area-overlay");
  await expect(overlay).toBeVisible();
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox?.width).toBeGreaterThan(articleBox.width);

  await page.mouse.move((overlayBox?.x ?? 0) + 24, (overlayBox?.y ?? 0) + 36);
  await page.mouse.down();
  await page.mouse.move(
    (overlayBox?.x ?? 0) + (overlayBox?.width ?? 0) - 24,
    (overlayBox?.y ?? 0) + 170,
  );
  await page.mouse.up();
  await expect(
    page.getByTestId("lightweight-action-feedback").filter({
      hasText: "Image with reference copied",
    }),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();
        return item?.types.includes("image/png") ?? false;
      }),
    )
    .toBe(true);
  const rightPaneInkPixels = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item!.getType("image/png"));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0);
    const pixels =
      context?.getImageData(0, 0, canvas.width, canvas.height).data ??
      new Uint8ClampedArray();
    let count = 0;
    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = Math.floor(canvas.width * 0.6); x < canvas.width; x += 4) {
        const index = (y * canvas.width + x) * 4;
        if (
          pixels[index + 3] === 255 &&
          (pixels[index] < 180 ||
            pixels[index + 1] < 180 ||
            pixels[index + 2] < 180)
        ) {
          count += 1;
        }
      }
    }
    return count;
  });
  expect(rightPaneInkPixels).toBeGreaterThan(10);
});

test("viewer-table-copy exposes TSV, CSV, Markdown, and reference actions", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.getByText("render-fixtures.adoc").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Render Fixtures",
  );
  const table = page.locator("table").filter({ hasText: "AsciiDoc" }).first();

  async function openTableContextMenu() {
    await expect(page.getByTestId("context-menu")).toBeHidden();
    const box = await table.boundingBox();
    if (!box) {
      throw new Error("Expected table bounds");
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
      button: "right",
    });
    await expect(page.getByTestId("context-menu")).toBeVisible();
  }

  async function selectMenuItem(label: string) {
    const item = page.getByRole("menuitem", { name: label });
    await expect(item).toBeVisible();
    await item.evaluate((element) => (element as HTMLButtonElement).click());
  }

  await openTableContextMenu();
  await selectMenuItem("Copy as TSV");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Item\tStatus\nAsciiDoc\tRendered\nDiagram\tLocal-first",
  );

  await openTableContextMenu();
  await selectMenuItem("Copy as CSV");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Item,Status\nAsciiDoc,Rendered\nDiagram,Local-first",
  );

  await openTableContextMenu();
  await selectMenuItem("Copy as Markdown Table");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "| Item | Status |\n| --- | --- |\n| AsciiDoc | Rendered |\n| Diagram | Local-first |",
  );

  await openTableContextMenu();
  await selectMenuItem("Copy Table Reference");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/render-fixtures.adoc:22",
  );
});

test("viewer-context-menu-navigation exposes tree, open file, bookmark, and tab actions", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const menuLabels = () =>
    page
      .getByTestId("context-menu")
      .getByRole("menuitem")
      .allTextContents()
      .then((items) => items.map((item) => item.trim()));

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "copy-actions.adoc" })
    .click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Open", exact: true }),
  ).toHaveCount(0);
  expect(await menuLabels()).toEqual([
    "Open in Editor",
    "Show Git Diff",
    "Show File History",
    "Compare with Active File",
    "Compare Files...",
    "Compare with Branch...",
    "Compare with Tag...",
    "Compare with Commit...",
    "Copy Path",
    "Bookmark",
  ]);
  await page.getByRole("menuitem", { name: "Copy Path" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "/workspace/docs/copy-actions.adoc",
  );

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "copy-actions.adoc" })
    .click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Bookmark" }).click();
  await expect(page.getByTestId("inline-notice")).toContainText("bookmarked");

  await page.getByTestId("open-file-item").first().click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Activate", exact: true }),
  ).toHaveCount(0);
  expect(await menuLabels()).toEqual([
    "Pin",
    "Open in Editor",
    "Show Git Diff",
    "Show File History",
    "Compare Files...",
    "Compare with Branch...",
    "Compare with Tag...",
    "Compare with Commit...",
    "Copy Path",
    "Close",
  ]);
  await page.getByRole("menuitem", { name: "Pin" }).click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "pinned",
  );

  await page.getByTestId("sidebar-tab-bookmarks").click();
  await page.getByTestId("bookmark-item").first().click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Open", exact: true }),
  ).toHaveCount(0);
  expect(await menuLabels()).toEqual([
    "Open in Editor",
    "Show Git Diff",
    "Show File History",
    "Compare with Active File",
    "Compare Files...",
    "Compare with Branch...",
    "Compare with Tag...",
    "Compare with Commit...",
    "Copy Path",
    "Remove",
  ]);
  await page.getByRole("menuitem", { name: "Copy Path" }).click();
  await expect(page.getByTestId("context-menu")).toHaveCount(0);

  await page.getByLabel("Toggle left sidebar").click();
  await page.getByTestId("active-tab").click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Activate", exact: true }),
  ).toHaveCount(0);
  const tabLabels = await menuLabels();
  expect(tabLabels.at(0)).toMatch(/^(Pin|Unpin)$/);
  expect(tabLabels.at(-2)).toBe("Copy Path");
  expect(tabLabels.at(-1)).toBe("Close");
});

test("viewer-open-in-editor exposes document editor actions", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("document-body").click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Open in Editor" }).click();
  await expect(page.getByTestId("inline-notice")).toContainText(
    "Open in Editor requested for mvp-guide.adoc",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __SVARD_EDITOR_OPEN_REQUESTS__?: string[];
            }
          ).__SVARD_EDITOR_OPEN_REQUESTS__ ?? [],
      ),
    )
    .toContain("/workspace/docs/mvp-guide.adoc");

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "copy-actions.adoc" })
    .click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Open in Editor" }).click();
  await expect(page.getByTestId("inline-notice")).toContainText(
    "Open in Editor requested for copy-actions.adoc",
  );

  await page
    .getByTestId("tree-folder-toggle")
    .filter({ hasText: "docs" })
    .click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Open in Editor" }),
  ).toHaveCount(0);
});

test("viewer-git-diff-preview opens modified preview from command palette and context menu", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );

  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({
      hasText: "Show Git Diff",
    })
    .click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  const changedText = page.getByText(
    "The document now explains two-pane Git diff preview.",
  );
  await changedText.selectText();
  const selectionPoint = await page.evaluate(() => {
    const rect = window.getSelection()?.getRangeAt(0).getClientRects()[0];
    return rect ? { x: rect.left + 4, y: rect.top + 4 } : null;
  });
  expect(selectionPoint).not.toBeNull();
  await page.mouse.click(selectionPoint!.x, selectionPoint!.y, {
    button: "right",
  });
  await page.getByRole("menuitem", { name: "Copy Diff Reference" }).click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Diff reference copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Before (HEAD):",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "After (Working Tree):",
  );
  await changedText.selectText();
  await page.mouse.click(selectionPoint!.x, selectionPoint!.y, {
    button: "right",
  });
  await page
    .getByRole("menuitem", { name: "Copy Original Text Reference" })
    .click();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Original text reference copied",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Revision: Working Tree (right)",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Section: Git Diff",
  );
  await page.getByTestId("git-diff-source-view").click();
  await expect(page.getByTestId("git-diff-left-pane")).toContainText("HEAD");
  await expect(page.getByTestId("git-diff-right-pane")).toContainText(
    "Working Tree",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "docs/git-modified.md",
  );
  await expect(page.getByTestId("git-diff-left-pane")).toContainText(
    "file-only",
  );
  await expect(page.getByTestId("git-diff-right-pane")).toContainText(
    "two-pane Git diff preview",
  );
  await page.getByTestId("git-diff-preview-close").click();
  await expect(page.getByTestId("git-diff-preview-panel")).toHaveCount(0);

  await page.getByTestId("document-body").click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Show Git Diff" }).click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
});

test("viewer-git-status-hints marks changed files in sidebar lists", async ({
  page,
}) => {
  await page.goto("/");

  const modifiedTreeRow = page
    .getByTestId("tree-file")
    .filter({ hasText: "git-modified.md" });
  await expect(modifiedTreeRow).toHaveAttribute("data-git-status", "modified");
  await expect(
    modifiedTreeRow.getByTestId("git-status-diff-button"),
  ).toHaveText("M");

  const cleanTreeRow = page
    .getByTestId("tree-file")
    .filter({ hasText: "git-clean.md" });
  await expect(cleanTreeRow).not.toHaveAttribute("data-git-status");

  await modifiedTreeRow.click();
  await page.getByText("git-untracked.md").click();
  await expect(
    page.getByTestId("open-file-item").filter({ hasText: "git-modified.md" }),
  ).toHaveAttribute("data-git-status", "modified");
  await expect(
    page.getByTestId("open-file-item").filter({ hasText: "git-untracked.md" }),
  ).toHaveAttribute("data-git-status", "untracked");
  await expect(
    page
      .getByTestId("open-file-item")
      .filter({ hasText: "git-untracked.md" })
      .getByTestId("git-status-diff-button"),
  ).toHaveText("U");

  await page.getByTestId("sidebar-tab-bookmarks").click();
  await page.getByTestId("bookmark-add-active").click();
  await expect(
    page.getByTestId("bookmark-item").filter({ hasText: "git-untracked.md" }),
  ).toHaveAttribute("data-git-status", "untracked");
});

test("viewer-git-status-hints-auto-refresh updates badges after Git metadata change", async ({
  page,
}) => {
  await page.goto("/");

  await page.waitForFunction(
    () =>
      typeof (
        window as unknown as {
          __SVARD_TRIGGER_GIT_STATUS_CHANGE__?: () => void;
        }
      ).__SVARD_TRIGGER_GIT_STATUS_CHANGE__ === "function",
  );

  const cleanTreeRow = page
    .getByTestId("tree-file")
    .filter({ hasText: "git-clean.md" });
  await expect(cleanTreeRow).not.toHaveAttribute("data-git-status");

  await page.evaluate(() => {
    (
      window as unknown as {
        __SVARD_GIT_STATUS_OVERRIDES__?: Record<string, string>;
        __SVARD_TRIGGER_GIT_STATUS_CHANGE__?: () => void;
      }
    ).__SVARD_GIT_STATUS_OVERRIDES__ = {
      "/workspace/docs/git-clean.md": "modified",
    };
    (
      window as unknown as {
        __SVARD_TRIGGER_GIT_STATUS_CHANGE__?: () => void;
      }
    ).__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
  });
  await expect(cleanTreeRow).toHaveAttribute("data-git-status", "modified");
  await expect(cleanTreeRow.getByTestId("git-status-badge")).toHaveText("M");

  await page.evaluate(() => {
    (
      window as unknown as {
        __SVARD_GIT_STATUS_OVERRIDES__?: Record<string, string>;
        __SVARD_TRIGGER_GIT_STATUS_CHANGE__?: () => void;
      }
    ).__SVARD_GIT_STATUS_OVERRIDES__ = {
      "/workspace/docs/git-clean.md": "clean",
    };
    (
      window as unknown as {
        __SVARD_TRIGGER_GIT_STATUS_CHANGE__?: () => void;
      }
    ).__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
  });
  await expect(cleanTreeRow).not.toHaveAttribute("data-git-status");
});

test("viewer-git-timeline-file-history shows active file history", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );

  await expect(page.getByTestId("sidebar-tab-source-control")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByTestId("source-control-view-file-history"),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("source-control-panel")).not.toContainText(
    "Source Control",
  );
  await expect(page.getByTestId("source-control-branch")).toContainText("main");
  await expect(page.getByTestId("source-control-branch")).toContainText(
    "1111111",
  );
  await expect(page.getByTestId("source-control-head-commit")).toContainText(
    "docs: add rendered preview diff goal",
  );
  await expect(page.getByTestId("timeline-panel")).not.toContainText(
    "File History",
  );
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("timeline-item").first()).toContainText(
    "docs: add rendered preview diff goal",
  );
});

test("viewer-source-control-changes lists changed files and opens supported diffs", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("sidebar-tab-source-control").click();

  await expect(page.getByTestId("source-control-view-changes")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("source-control-changes-list")).toBeVisible();
  await expect(
    page.getByTestId("source-control-change-item").first(),
  ).toContainText("git-modified.md");
  await page.getByTestId("source-control-change-item").first().click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
});

test("viewer-source-control-all-diffs supports LLM reference and Current file capture", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByTestId("sidebar-tab-source-control").click();
  await page.getByTestId("source-control-all-diffs").click();

  const panel = page.getByTestId("source-control-all-diffs-panel");
  const rightPane = page.getByTestId("diff-stream-right-pane").first();
  await expect(panel).toBeVisible();
  await expect(rightPane).toBeVisible();
  const changedParagraph = rightPane.locator("p").first();
  await expect(changedParagraph).toBeVisible();

  await changedParagraph.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Copy Diff Reference" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Copy Diff Reference" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Before (HEAD):");

  await rightPane.evaluate((pane) => {
    const rect = pane.getBoundingClientRect();
    pane.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        buttons: 0,
        clientX: rect.right - 4,
        clientY: rect.top + 4,
      }),
    );
  });
  await expect(
    page.getByRole("menuitem", { name: "Capture Area…" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Capture Area with Reference…" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("viewer.captureArea"),
  );
  const overlay = page.getByTestId("capture-area-overlay");
  await expect(overlay).toBeVisible();
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();
  if (!overlayBox) return;
  await page.mouse.move(overlayBox.x + 24, overlayBox.y + 32);
  await page.mouse.down();
  await page.mouse.move(
    overlayBox.x + Math.min(280, overlayBox.width - 24),
    overlayBox.y + Math.min(180, overlayBox.height - 24),
  );
  await page.mouse.up();
  await expect(page.getByTestId("lightweight-action-feedback")).toContainText(
    "Image copied",
  );
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();
        return item?.types.includes("image/png") ?? false;
      }),
    )
    .toBe(true);
});

test("viewer-source-control-branch-diff lists branch changes and opens supported diffs", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("sidebar-tab-source-control").click();
  await page.getByTestId("source-control-view-branch-diff").click();

  await expect(
    page.getByTestId("source-control-view-branch-diff"),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("source-control-branch-diff-base")).toHaveValue(
    "origin/main",
  );
  await expect(
    page.getByTestId("source-control-branch-diff-list"),
  ).toBeVisible();
  await expect(
    page.getByTestId("source-control-branch-diff-item").first(),
  ).toContainText("git-modified.md");
  await page.getByTestId("source-control-branch-diff-item").first().click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "origin/main",
  );
});

test("viewer-source-control-refreshes-when-folder-moves-outside-git", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("sidebar-tab-source-control").click();
  await expect(page.getByTestId("source-control-branch")).toContainText("main");
  await expect(page.getByTestId("source-control-branch")).toContainText(
    "1111111",
  );

  await page.evaluate(() => {
    window.localStorage.setItem(
      "svard.mockPickDirectory",
      "/outside-git/project",
    );
    return window.__SVARD_COMMANDS__?.dispatch("folder.open");
  });

  await expect(page.getByTestId("source-control-changes-empty")).toContainText(
    "Not in Git repository",
  );
  await expect(page.getByTestId("source-control-panel")).not.toContainText(
    "1111111",
  );
  await expect(page.getByTestId("source-control-panel")).not.toContainText(
    "docs: add rendered preview diff goal",
  );
});

test("viewer-source-control-branch-diff-refreshes-when-folder-moves-outside-git", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("sidebar-tab-source-control").click();
  await page.getByTestId("source-control-view-branch-diff").click();
  await page
    .getByTestId("source-control-branch-diff-base")
    .selectOption("origin/docs-preview");
  await expect(page.getByTestId("source-control-branch")).toContainText("main");
  await expect(page.getByTestId("source-control-branch")).toContainText(
    "1111111",
  );

  await page.evaluate(() => {
    window.localStorage.setItem(
      "svard.mockPickDirectory",
      "/outside-git/project",
    );
    return window.__SVARD_COMMANDS__?.dispatch("folder.open");
  });

  await expect(
    page.getByTestId("source-control-branch-diff-empty"),
  ).toContainText("Not in Git repository");
  await expect(page.getByTestId("source-control-branch-diff-base")).toHaveValue(
    "",
  );
  await expect(page.getByTestId("source-control-panel")).not.toContainText(
    "1111111",
  );
  await expect(page.getByTestId("source-control-panel")).not.toContainText(
    "docs: add rendered preview diff goal",
  );
  await expect(page.getByTestId("source-control-panel")).not.toContainText(
    "origin/docs-preview",
  );
});

test("viewer-source-control-graph shows repository graph", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("sidebar-tab-source-control").click();
  await page.getByTestId("source-control-view-repo-graph").click();

  await expect(
    page.getByTestId("source-control-view-repo-graph"),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("timeline-item").first()).toContainText(
    "docs: add rendered preview diff goal",
  );
});

test("viewer-git-timeline-vscode-left-click opens commit changes", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );
  await page.getByTestId("timeline-item").first().click();

  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "0000000",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "1111111",
  );
});

test("viewer-git-timeline-context-menu exposes VS Code style actions", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );
  await page.getByTestId("timeline-item").first().click({ button: "right" });

  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("context-menu")).toContainText("Open Changes");
  await expect(page.getByTestId("context-menu")).toContainText("View Commit");
  await expect(page.getByTestId("context-menu")).toContainText(
    "Select for Compare",
  );
  await expect(page.getByTestId("context-menu")).toContainText(
    "Copy Commit ID",
  );
});

test("viewer-git-timeline-select-compare compares selected commits", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );
  const items = page.getByTestId("timeline-item");
  await items.nth(1).click({ button: "right" });
  await page.getByTestId("context-menu-item-select-for-compare").click();
  await expect(items.nth(1)).toHaveAttribute("data-selected-compare", "true");
  await items.nth(0).click({ button: "right" });
  await page.getByTestId("context-menu-item-compare-with-selected").click();

  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "0000000",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "1111111",
  );
});

test("viewer-git-timeline-view-commit opens commit details", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );
  await page.getByTestId("timeline-item").first().click({ button: "right" });
  await page.getByTestId("context-menu-item-view-commit").click();

  await expect(page.getByTestId("git-commit-details-panel")).toBeVisible();
  await expect(page.getByTestId("git-commit-details-panel")).toContainText(
    "docs: add rendered preview diff goal",
  );
  await page.getByTestId("git-commit-details-file").first().click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
});

test("viewer-git-timeline-compare-commit opens preview diff", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Modified Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );
  await page.getByTestId("timeline-item").first().click();

  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
});

test("viewer-git-timeline-empty-states explains untracked files", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-untracked.md").click();
  await expect(page.getByTestId("document-body")).toContainText(
    "Git Diff Untracked Fixture",
  );
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
  );

  await expect(page.getByTestId("timeline-empty-state")).toContainText(
    "Untracked file",
  );
  await expect(page.getByTestId("timeline-empty-state")).toContainText(
    "not tracked",
  );
});

test("viewer-git-compare-branch opens ref picker from context menu", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "git-modified.md" })
    .click({ button: "right" });
  await page.getByTestId("context-menu-item-compare-with-branch").click();

  await expect(page.getByTestId("git-ref-picker")).toBeVisible();
  await expect(page.getByTestId("git-ref-picker")).toContainText("main");
  await page
    .getByTestId("git-ref-picker-item")
    .filter({ hasText: "main" })
    .click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "branch:main",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "Working Tree",
  );
});

test("viewer-git-compare-tag opens ref picker from command palette", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">Compare with Tag");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Compare with Tag..." })
    .click();

  await expect(page.getByTestId("git-ref-picker")).toBeVisible();
  await page
    .getByTestId("git-ref-picker-item")
    .filter({ hasText: "v0.1.0" })
    .click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "tag:v0.1.0",
  );
});

test("viewer-git-compare-commit accepts recent commit candidate", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-modified.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.compareWithCommit"),
  );

  await expect(page.getByTestId("git-ref-picker")).toBeVisible();
  await expect(page.getByTestId("git-ref-picker")).toContainText(
    "docs: add rendered preview diff goal",
  );
  await page
    .getByTestId("git-ref-picker-item")
    .filter({ hasText: "1111111" })
    .click();
  await expect(page.getByTestId("git-diff-preview-panel")).toBeVisible();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "1111111",
  );
});

test("viewer-git-diff-clean shows compact empty state", async ({ page }) => {
  await page.goto("/");

  await page.getByText("git-clean.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({
      hasText: "Show Git Diff",
    })
    .click();

  await expect(page.getByTestId("git-diff-empty-state")).toContainText("Clean");
  await expect(page.getByTestId("git-diff-empty-state")).toContainText(
    "No working tree changes",
  );
});

test("viewer-git-diff-untracked shows worktree-only source preview", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-untracked.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({
      hasText: "Show Git Diff",
    })
    .click();

  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "Untracked",
  );
  await page.getByTestId("git-diff-source-view").click();
  await expect(page.getByTestId("git-diff-right-pane")).toContainText(
    "not tracked by HEAD",
  );
  await expect(page.getByTestId("git-diff-left-pane")).not.toContainText(
    "not tracked by HEAD",
  );
});

test("viewer-git-diff-rendered-markdown shows rendered block diff", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();
  await expect(page.getByTestId("git-diff-rendered-view")).toBeEnabled();
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(page.getByTestId("git-rendered-diff")).toBeVisible();
  await expect(page.getByTestId("git-rendered-left-pane")).toContainText(
    "was stable in HEAD",
  );
  await expect(page.getByTestId("git-rendered-right-pane")).toContainText(
    "changed in the working tree",
  );
  await expect(page.getByTestId("git-rendered-right-pane")).toContainText(
    "Added working-tree item",
  );
});

test("viewer-rendered-visual-diff-markdown overlays changes on rendered preview", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(page.getByTestId("git-rendered-diff")).toBeVisible();
  await expect(
    page
      .locator('[data-review-id="git-rendered-block"].changed.left-side')
      .first(),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-review-id="git-rendered-block"].changed.right-side')
      .first(),
  ).toBeVisible();
});

test("viewer-git-diff-rendered-asciidoc shows rendered block diff", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-asciidoc.adoc").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();
  await expect(page.getByTestId("git-diff-rendered-view")).toBeEnabled();
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(page.getByTestId("git-rendered-diff")).toBeVisible();
  await expect(page.getByTestId("git-rendered-left-pane")).toContainText(
    "was stable in HEAD",
  );
  await expect(page.getByTestId("git-rendered-right-pane")).toContainText(
    "changed in the working tree",
  );
  await expect(page.getByTestId("git-rendered-right-pane")).toContainText(
    "Changed",
  );
});

test("viewer-rendered-visual-diff-asciidoc overlays changes on AsciiDoc preview", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-asciidoc.adoc").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(page.getByTestId("git-rendered-diff")).toBeVisible();
  await expect(page.getByTestId("git-rendered-left-pane")).toContainText(
    "This rendered AsciiDoc paragraph was stable in HEAD",
  );
  await expect(page.getByTestId("git-rendered-right-pane")).toContainText(
    "Changed",
  );
  await expect(
    page
      .locator('[data-review-id="git-rendered-block"].changed.right-side')
      .first(),
  ).toBeVisible();
});

test("viewer-git-diff-rendered-diagram-placeholder hides diagram source", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-diagram.adoc").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();
  await expect(page.getByTestId("git-diff-rendered-view")).toBeEnabled();
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(page.getByTestId("git-rendered-diff")).toContainText(
    "Diagram placeholder",
  );
  await expect(page.getByTestId("git-rendered-diff")).not.toContainText(
    "A[Start]",
  );
});

test("viewer-rendered-diff-quality shows default rendered readability controls", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();

  await expect(page.getByTestId("git-diff-full-preview-view")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toHaveClass(
    /expanded/,
  );
  await expect(page.getByTestId("git-full-preview-diff")).toBeVisible();
  await expect(page.getByTestId("git-diff-change-navigation")).toContainText(
    /changes?/,
  );
  await expect(page.getByTestId("git-diff-change-ruler")).toBeVisible();
  await expect(
    page.getByTestId("git-diff-word-highlight").first(),
  ).toBeVisible();
});

test("viewer-rendered-visual-diff-inline-highlight shows inline word changes", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(
    page.getByTestId("git-diff-word-highlight").first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-review-id="git-diff-word-highlight"].added').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-review-id="git-diff-word-highlight"].added').first(),
  ).not.toHaveCSS("font-weight", "700");
  await expect(
    page.locator('[data-review-id="git-diff-word-highlight"].removed').first(),
  ).toBeVisible();
});

test("viewer-rendered-visual-diff-minimap keeps rendered change navigation visible", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(page.getByTestId("git-diff-change-ruler")).toBeVisible();
  await expect(
    page.locator('[data-review-id="git-diff-change-ruler-marker"]'),
  ).not.toHaveCount(0);
  await page.getByRole("button", { name: "Next change" }).click();
  await expect(
    page.locator('[data-review-id="git-diff-change-ruler-marker"].active'),
  ).toHaveCount(1);
});

test("viewer-diff-full-preview-markdown shows full document preview context", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(page.getByTestId("git-diff-full-preview-view")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("git-full-preview-diff")).toBeVisible();
  await expect(
    page.locator('[data-review-id="git-full-preview-block"].unchanged').first(),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-review-id="git-full-preview-block"].changed.right-side')
      .first(),
  ).toBeVisible();
  await expect(page.locator(".git-rendered-block-meta")).toHaveCount(0);
});

test("viewer-diff-preview-regression-suite keeps preview diff stable", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("diff-regression-gallery.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(page.getByTestId("git-diff-full-preview-view")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("git-full-preview-diff")).toBeVisible();
  await expect(page.getByTestId("git-full-preview-right-pane")).toContainText(
    "Preview-based diff",
  );
  await expect(page.getByTestId("git-full-preview-right-pane")).toContainText(
    "差分表示",
  );
  await expect(page.locator(".git-rendered-block-meta")).toHaveCount(0);

  const regression = await page.evaluate(() => {
    const highlights = Array.from(
      document.querySelectorAll('[data-review-id="git-diff-word-highlight"]'),
    ).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        text: node.textContent?.trim() ?? "",
        width: rect.width,
        height: rect.height,
      };
    });
    const rightPane = document.querySelector(
      '[data-review-id="git-full-preview-right-pane"]',
    );
    const unrelatedBlocks = Array.from(
      document.querySelectorAll('[data-review-id="git-full-preview-block"]'),
    )
      .filter((node) =>
        /legacy footer note|fresh working tree closing note/.test(
          node.textContent ?? "",
        ),
      )
      .map((node) => ({
        added: node.classList.contains("added"),
        removed: node.classList.contains("removed"),
        changed: node.classList.contains("changed"),
      }));
    return {
      highlights,
      nestedListCount: rightPane?.querySelectorAll("li ul, li ol").length ?? 0,
      unrelatedBlocks,
      addedBlocks: document.querySelectorAll(
        '[data-review-id="git-full-preview-block"].added.right-side',
      ).length,
      removedBlocks: document.querySelectorAll(
        '[data-review-id="git-full-preview-block"].removed.left-side',
      ).length,
    };
  });

  expect(regression.highlights.length).toBeGreaterThan(0);
  expect(
    regression.highlights.every(
      (highlight) =>
        highlight.text.length > 0 &&
        highlight.width >= 4 &&
        highlight.height >= 8,
    ),
  ).toBe(true);
  expect(regression.nestedListCount).toBeGreaterThan(0);
  expect(regression.addedBlocks).toBeGreaterThan(0);
  expect(regression.removedBlocks).toBeGreaterThan(0);
  expect(regression.unrelatedBlocks.length).toBeGreaterThan(0);
  expect(
    regression.unrelatedBlocks.every(
      (block) => !block.changed && (block.added || block.removed),
    ),
  ).toBe(true);
});

test("viewer-diff-preview-expand fills the viewport for comparison", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(page.getByTestId("git-diff-preview-expand")).toHaveAttribute(
    "aria-label",
    "Exit full screen",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toHaveClass(
    /expanded/,
  );
  const panelBox = await page
    .getByTestId("git-diff-preview-panel")
    .boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox?.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 2);
  expect(panelBox?.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 2);

  await page.getByTestId("git-diff-preview-expand").click();
  await expect(page.getByTestId("git-diff-preview-expand")).toHaveAttribute(
    "aria-label",
    "Enter full screen",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).not.toHaveClass(
    /expanded/,
  );
});

test("viewer-diff-full-preview-asciidoc shows full AsciiDoc preview context", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-asciidoc.adoc").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(page.getByTestId("git-full-preview-diff")).toBeVisible();
  await expect(page.getByTestId("git-full-preview-left-pane")).toContainText(
    "Git Rendered AsciiDoc Diff Fixture",
  );
  await expect(page.getByTestId("git-full-preview-right-pane")).toContainText(
    "Changed",
  );
});

test("viewer-diff-full-preview-overview-jump opens Preview at a changed section", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-asciidoc.adoc").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.getByTestId("git-diff-overview-view").click();
  await page.getByTestId("git-diff-overview-jump-preview").first().click();

  await expect(page.getByTestId("git-diff-full-preview-view")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.locator('[data-review-id="git-diff-change-ruler-marker"].active'),
  ).toHaveCount(1);
  await expect(page.getByTestId("git-full-preview-diff")).toBeVisible();
});

test("viewer-diff-overview summarizes rendered diff changes", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-asciidoc.adoc").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.getByTestId("git-diff-overview-view").click();

  await expect(page.getByTestId("git-diff-overview")).toBeVisible();
  await expect(page.getByTestId("git-diff-overview")).toContainText(
    "Changed blocks",
  );
  await expect(page.getByTestId("git-diff-overview")).toContainText("Tables");
  await expect(page.getByTestId("git-diff-overview")).not.toContainText(
    "Added blocks",
  );
  await expect(page.getByTestId("git-diff-overview")).not.toContainText(
    "Removed blocks",
  );
  await expect(page.getByTestId("git-diff-overview")).not.toContainText(
    "Diagrams",
  );
  await expect(page.getByTestId("git-diff-overview-sections")).toContainText(
    "Changed",
  );
  await expect(page.getByTestId("git-diff-overview-sections")).toContainText(
    "2 changes",
  );
  await expect(page.getByTestId("git-diff-overview-jump-preview")).toHaveCount(
    1,
  );
  await expect(page.getByTestId("git-diff-fallback-reason")).toHaveCount(0);
});

test("viewer-diff-change-navigation moves between changes", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-markdown.md").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(page.getByTestId("git-diff-change-count")).toContainText(
    /rendered changes?/,
  );
  await page.getByRole("button", { name: "Next change" }).click();
  await expect(
    page.locator('[data-review-id="git-diff-change-ruler-marker"].active'),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Previous change" }).click();
  await expect(page.getByTestId("git-full-preview-diff")).toBeVisible();
});

test("viewer-diff-scroll-sync can disable side-by-side scroll sync", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-asciidoc.adoc").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  const syncToggle = page.getByTestId("git-diff-scroll-sync");
  await expect(syncToggle).toBeChecked();
  await syncToggle.click();
  await expect(syncToggle).not.toBeChecked();
});

test("viewer-diff-diagram-placeholder summarizes diagram changes without source", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-rendered-diagram.adoc").click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );

  await expect(
    page.getByTestId("git-diff-diagram-placeholder").first(),
  ).toContainText("Diagram changed");
  await expect(page.getByTestId("git-full-preview-diff")).not.toContainText(
    "A[Start]",
  );
});

test("viewer-file-diff-source compares two Markdown documents", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .click();
  await expect(page.getByTestId("document-body")).toContainText(
    "left document",
  );
  await page.evaluate(() => {
    window.localStorage.setItem(
      "svard.mockPickDocument",
      "/workspace/docs/file-diff-right.md",
    );
    (
      window as unknown as { __SVARD_PICK_DOCUMENT__?: string }
    ).__SVARD_PICK_DOCUMENT__ = "/workspace/docs/file-diff-right.md";
  });
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">compare");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Compare Active File With..." })
    .click();

  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "File compare",
  );
  await page.getByTestId("git-diff-source-view").click();
  await expect(page.getByTestId("git-diff-left-pane")).toContainText(
    "left document",
  );
  await expect(page.getByTestId("git-diff-right-pane")).toContainText(
    "right document",
  );
});

test("viewer-file-diff-command opens file compare from command palette", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .click();
  await expect(page.getByTestId("document-body")).toContainText(
    "left document",
  );
  await page.evaluate(() => {
    (
      window as unknown as { __SVARD_PICK_DOCUMENTS__?: string[] }
    ).__SVARD_PICK_DOCUMENTS__ = ["/workspace/docs/file-diff-right.md"];
  });
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">compare files");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Compare Files..." })
    .click();

  await expect(page.getByTestId("file-compare-picker")).toBeVisible();
  await expect(page.getByTestId("file-compare-left-slot")).toContainText(
    "file-diff-left.md",
  );
  await page.getByTestId("file-compare-right-choose").click();
  await page.getByTestId("file-compare-run").click();

  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "File compare",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "file-diff-left.md",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "file-diff-right.md",
  );
});

test("viewer-file-compare-picker-context-menu opens file compare picker", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .click();
  await expect(page.getByTestId("document-body")).toContainText(
    "left document",
  );
  await page.evaluate(() => {
    (
      window as unknown as { __SVARD_PICK_DOCUMENTS__?: string[] }
    ).__SVARD_PICK_DOCUMENTS__ = ["/workspace/docs/file-diff-right.md"];
  });
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Compare Files..." }).click();

  await expect(page.getByTestId("file-compare-picker")).toBeVisible();
  await expect(page.getByTestId("file-compare-left-slot")).toContainText(
    "file-diff-left.md",
  );
  await page.getByTestId("file-compare-right-choose").click();
  await page.getByTestId("file-compare-run").click();

  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "File compare",
  );
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "file-diff-right.md",
  );
});

test("viewer-file-compare-picker-drag-drop compares dropped tree files", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">compare files");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Compare Files..." })
    .click();
  await expect(page.getByTestId("file-compare-picker")).toBeVisible();

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .dragTo(page.getByTestId("file-compare-left-slot"));
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-right.md" })
    .dragTo(page.getByTestId("file-compare-right-slot"));
  await expect(page.getByTestId("file-compare-left-slot")).toContainText(
    "file-diff-left.md",
  );
  await expect(page.getByTestId("file-compare-right-slot")).toContainText(
    "file-diff-right.md",
  );

  await page.getByTestId("file-compare-run").click();
  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "File compare",
  );
});

test("viewer-file-compare-picker-swap-clear swaps and clears slots", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as { __SVARD_PICK_DOCUMENTS__?: string[] }
    ).__SVARD_PICK_DOCUMENTS__ = ["/workspace/docs/file-diff-right.md"];
  });
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
  );
  await page.getByTestId("file-compare-right-choose").click();
  await expect(page.getByTestId("file-compare-left-slot")).toContainText(
    "file-diff-left.md",
  );
  await expect(page.getByTestId("file-compare-right-slot")).toContainText(
    "file-diff-right.md",
  );

  await page.getByTestId("file-compare-swap").click();
  await expect(page.getByTestId("file-compare-left-slot")).toContainText(
    "file-diff-right.md",
  );
  await page.getByTestId("file-compare-left-clear").click();
  await expect(page.getByTestId("file-compare-left-slot")).toContainText(
    "Drop a file here",
  );
});

test("viewer-file-compare-picker-validation blocks invalid pairs", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.md" })
    .click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("file.compareFiles"),
  );
  await page.getByTestId("file-compare-run").click();
  await expect(page.getByTestId("file-compare-validation")).toContainText(
    "Choose a base file and a compare file.",
  );

  await page.evaluate(() => {
    (
      window as unknown as { __SVARD_PICK_DOCUMENTS__?: string[] }
    ).__SVARD_PICK_DOCUMENTS__ = ["/workspace/docs/file-diff-left.md"];
  });
  await page.getByTestId("file-compare-right-choose").click();
  await page.getByTestId("file-compare-run").click();
  await expect(page.getByTestId("file-compare-validation")).toContainText(
    "Choose two different markup documents",
  );
});

test("viewer-cli-file-diff-open opens diff for two desktop document paths", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as unknown as {
        __SVARD_PENDING_OPEN_REQUESTS__?: Array<{
          paths: string[];
          source: "initial";
        }>;
      }
    ).__SVARD_PENDING_OPEN_REQUESTS__ = [
      {
        source: "initial",
        paths: [
          "/workspace/docs/file-diff-left.md",
          "/workspace/docs/file-diff-right.md",
        ],
      },
    ];
  });
  await page.goto("/");

  await expect(page.getByTestId("git-diff-preview-panel")).toContainText(
    "File compare",
  );
  await page.getByTestId("git-diff-source-view").click();
  await expect(page.getByTestId("git-diff-left-pane")).toContainText(
    "left document",
  );
  await expect(page.getByTestId("git-diff-right-pane")).toContainText(
    "right document",
  );
});

test("viewer-file-diff-rendered compares AsciiDoc rendered blocks", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-left.adoc" })
    .click();
  await expect(page.getByTestId("document-body")).toContainText(
    "left document",
  );
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-right.adoc" })
    .click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Compare with Active File" })
    .dispatchEvent("click");
  await expect(page.getByTestId("git-diff-rendered-view")).toBeEnabled();
  await page.getByTestId("git-diff-rendered-view").click();

  await expect(page.getByTestId("git-rendered-diff")).toBeVisible();
  await expect(page.getByTestId("git-rendered-left-pane")).toContainText(
    "left document",
  );
  await expect(page.getByTestId("git-rendered-right-pane")).toContainText(
    "right document",
  );
  await expect(page.getByTestId("git-rendered-diff")).toContainText(
    "admonition",
  );
});

test("viewer-file-diff-table compares rendered table cells", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-table-left.md" })
    .click();
  await expect(page.getByTestId("document-body")).toContainText("$10");
  await page
    .getByTestId("tree-file")
    .filter({ hasText: "file-diff-table-right.md" })
    .click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Compare with Active File" })
    .dispatchEvent("click");
  await expect(page.getByTestId("git-diff-table-view")).toBeEnabled();
  await page.getByTestId("git-diff-table-view").click();

  await expect(page.getByTestId("git-diff-table-diff")).toBeVisible();
  await expect(page.getByTestId("git-diff-table-left-pane")).toContainText(
    "$10",
  );
  await expect(page.getByTestId("git-diff-table-right-pane")).toContainText(
    "$12",
  );
  await expect(page.getByTestId("git-diff-table-right-pane")).toContainText(
    "Team",
  );
});

test("viewer-git-diff-markdown-table shows cell-level table diff", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-table.md").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();
  await page.getByTestId("git-diff-table-view").click();

  await expect(page.getByTestId("git-diff-table-diff")).toBeVisible();
  await expect(page.getByTestId("git-diff-table-left-pane")).toContainText(
    "$10",
  );
  await expect(page.getByTestId("git-diff-table-right-pane")).toContainText(
    "$12",
  );
  await expect(page.getByTestId("git-diff-table-right-pane")).toContainText(
    "Enterprise",
  );
  await expect(page.locator(".git-diff-table-cell.changed")).toHaveCount(4);
  await expect(page.locator(".git-diff-table-cell.added")).toHaveCount(3);
});

test("viewer-git-diff-asciidoc-table-marker shows source marker fallback", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-asciidoc-table-complex.adoc").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();

  await page.getByTestId("git-diff-source-view").click();
  await expect(
    page.getByTestId("git-diff-asciidoc-table-badge").first(),
  ).toHaveText("Table block changed");
  await page.getByTestId("git-diff-table-view").click();
  await expect(page.getByTestId("git-diff-empty-state")).toContainText(
    "This table uses spans or nested tables. Use Source view.",
  );
});

test("viewer-git-diff-asciidoc-table-dom shows rendered table diff", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("git-asciidoc-table.adoc").click();
  await page.keyboard.press("Control+L");
  await page.getByTestId("quick-open-input").fill(">git");
  await page
    .getByTestId("quick-open-result")
    .filter({ hasText: "Show Git Diff" })
    .click();
  await page.getByTestId("git-diff-table-view").click();

  await expect(page.getByTestId("git-diff-table-diff")).toBeVisible();
  await expect(page.getByTestId("git-diff-table-left-pane")).toContainText(
    "Rendered",
  );
  await expect(page.getByTestId("git-diff-table-right-pane")).toContainText(
    "Changed",
  );
  await expect(page.locator(".git-diff-table-cell.changed")).toHaveCount(2);
});

test("viewer-context-menu-search-toc exposes search and contents actions", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.getByTestId("right-sidebar-tab-search").click();
  await page.getByTestId("search-input").fill("Graphviz");
  await expect(page.getByTestId("search-result-item").first()).toBeVisible();
  await page.getByTestId("search-result-item").first().click({
    button: "right",
  });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Open Result" }).click();
  await expect(
    page.locator('[data-review-id="search-hit"].active'),
  ).toHaveCount(1);

  await page.getByTestId("right-sidebar-tab-contents").click();
  await page.getByTestId("toc").getByRole("link").first().click({
    button: "right",
  });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Copy Heading Link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "/workspace/docs/",
  );
});
