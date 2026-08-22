export async function exerciseRenderedDiffAgentSelection(
  page,
  { paneReviewId, restoredPanelReviewId, resultKey },
) {
  const pane = page.locator(`[data-review-id="${paneReviewId}"]`).first();
  await pane.waitFor();
  const selectedProgrammatically = await pane.evaluate((element) => {
    const mathParagraph = Array.from(element.querySelectorAll("p")).find(
      (candidate) => candidate.querySelector(".katex") !== null,
    );
    if (!mathParagraph) return false;
    const range = document.createRange();
    range.selectNodeContents(mathParagraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    mathParagraph.dispatchEvent(
      new Event("selectionchange", { bubbles: true }),
    );
    mathParagraph.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true }),
    );
    return true;
  });
  const reverseSelectionPoints = selectedProgrammatically
    ? null
    : await pane.evaluate((element) => {
        const text = Array.from(element.querySelectorAll("p,li,pre"))
          .flatMap((candidate) => Array.from(candidate.childNodes))
          .find((node) => node instanceof Text && node.data.trim().length > 12);
        if (!(text instanceof Text)) throw new Error("No selectable diff text");
        const endOffset = Math.min(text.data.length, 12);
        const startRange = document.createRange();
        startRange.setStart(text, 0);
        startRange.collapse(true);
        const endRange = document.createRange();
        endRange.setStart(text, endOffset);
        endRange.collapse(true);
        const start = startRange.getBoundingClientRect();
        const end = endRange.getBoundingClientRect();
        return {
          start: { x: start.left + 1, y: start.top + start.height / 2 },
          end: { x: end.left - 1, y: end.top + end.height / 2 },
        };
      });
  if (reverseSelectionPoints) {
    await page.mouse.move(
      reverseSelectionPoints.end.x,
      reverseSelectionPoints.end.y,
    );
    await page.mouse.down();
    await page.mouse.move(
      reverseSelectionPoints.start.x,
      reverseSelectionPoints.start.y,
      { steps: 6 },
    );
    await page.mouse.up();
  }
  await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
  await page
    .locator('[data-review-id="selection-mini-toolbar"]')
    .getByRole("button", { name: "Ask AI" })
    .click();
  const dock = page.locator('[data-review-id="git-diff-agent-dock"]');
  await dock.waitFor();
  const card = dock.locator(".agent-selection-card");
  await card.waitFor();
  const cardText = (await card.textContent()) ?? "";
  const questionBlank = (await dock.locator("textarea").inputValue()) === "";
  const revisionVisible = await page
    .locator('[data-review-id="git-diff-agent-dock"] .agent-selection-card')
    .getByText(/After|Working tree/u)
    .count();
  await card
    .getByRole("button", { name: "Return to selected content" })
    .click();
  await page.locator(`[data-review-id="${restoredPanelReviewId}"]`).waitFor();
  await dock.waitFor();
  await page.evaluate(
    ({ cardText, questionBlank, resultKey, revisionVisible }) => {
      window[resultKey] = {
        dockVisible: true,
        overlayMaintained: true,
        questionBlank,
        revisionVisible: revisionVisible > 0,
        mathVisible:
          cardText.includes("D_{\\mathrm{head}}=3") &&
          !cardText.includes("katex-html"),
        toolbarOpaque:
          getComputedStyle(
            document.querySelector(
              '[data-review-id="selection-mini-toolbar"]',
            ) ?? document.body,
          ).backgroundColor !== "rgba(0, 0, 0, 0)",
      };
    },
    { cardText, questionBlank, resultKey, revisionVisible },
  );
}

export async function exerciseRenderedDiffAgentMedia(
  page,
  { paneReviewId, restoredPanelReviewId, resultKey },
) {
  const pane = page.locator(`[data-review-id="${paneReviewId}"]`).first();
  const diagram = pane
    .locator("[data-diagram-id] svg, [data-diagram-id] img")
    .first();
  await diagram.waitFor();
  await diagram.scrollIntoViewIfNeeded();
  await diagram.click({ button: "right" });
  await page
    .locator('[data-review-id="context-menu"]')
    .getByRole("menuitem", { name: "Ask AI" })
    .click();
  const dock = page.locator('[data-review-id="git-diff-agent-dock"]');
  await dock.waitFor();
  const card = dock.locator(".agent-media-card");
  await card.waitFor();
  const questionBlank = (await dock.locator("textarea").inputValue()) === "";
  const revisionVisible = await card.getByText(/After|Working tree/u).count();
  const modeCount = await card.locator(".agent-media-mode button").count();
  await card.getByRole("button", { name: "Show" }).click();
  await page.locator(`[data-review-id="${restoredPanelReviewId}"]`).waitFor();
  await dock.waitFor();
  await page.evaluate(
    ({ modeCount, questionBlank, resultKey, revisionVisible }) => {
      window[resultKey] = {
        dockVisible: true,
        modeCount,
        overlayMaintained: true,
        questionBlank,
        revisionVisible: revisionVisible > 0,
      };
    },
    { modeCount, questionBlank, resultKey, revisionVisible },
  );
}

export async function sampleDiffAgentDockLayout(page) {
  return page.evaluate(() => {
    const rect = (selector) =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const toolbar = rect(".git-diff-toolbar");
    const dock = rect('[data-review-id="git-diff-agent-dock"]');
    const composer = rect(".agent-composer-dock");
    const resizer = rect('[data-review-id="git-diff-agent-dock-resizer"]');
    const leftPane = rect(
      '[data-review-id="git-rendered-left-pane"], [data-review-id="git-full-preview-left-pane"]',
    );
    const rightPane = rect(
      '[data-review-id="git-rendered-right-pane"], [data-review-id="git-full-preview-right-pane"]',
    );
    const scrollAreas = Array.from(
      document.querySelectorAll(".git-rendered-scroll"),
    );
    for (const area of scrollAreas) {
      area.scrollTop = area.scrollHeight;
    }
    const scrollMetrics = scrollAreas.map((area) => ({
      clientHeight: area.clientHeight,
      scrollHeight: area.scrollHeight,
      scrollTop: area.scrollTop,
    }));
    return {
      composerInsideDock: Boolean(
        composer &&
        dock &&
        composer.top >= dock.top &&
        composer.bottom <= dock.bottom + 1,
      ),
      diffEndReachable:
        scrollAreas.length >= 2 &&
        scrollAreas.every(
          (area) => area.scrollTop + area.clientHeight >= area.scrollHeight - 2,
        ),
      dockBelowToolbar: Boolean(toolbar && dock && dock.top >= toolbar.bottom),
      panesVisible: Boolean(
        leftPane &&
        rightPane &&
        leftPane.width >= 280 &&
        rightPane.width >= 280,
      ),
      resizerHitTarget: resizer?.height ?? 0,
      scrollMetrics,
      themeDark: document.querySelector(".app-shell.theme-dark") !== null,
      toolbarInsideViewport: Boolean(
        toolbar && toolbar.left >= 0 && toolbar.right <= window.innerWidth + 1,
      ),
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
  });
}

export function largeMarkdownTableSource({ includeLocalPlantUmlCache }) {
  const rows = [
    ["Documents", "Open files", "Stable"],
    ["Diagrams", "Fast diagram loading", "Stable"],
    ...(includeLocalPlantUmlCache
      ? [["Diagrams", "Local PlantUML SVG cache", "Stable"]]
      : []),
    ["Files", "File tree", "Stable"],
    ["Search", "Quick Open", "Stable"],
    ["Navigation", "Table of contents", "Stable"],
    ["Review", "Source Control changes", "Stable"],
    ["Review", "Rendered diff", "Stable"],
    ["Review", "Table view", "Stable"],
    ["Review", "Change navigation", "Stable"],
    ["Context", "Copy as TSV", "Stable"],
    ["Context", "Open in editor", "Stable"],
    ["Preferences", "Theme", "Stable"],
    ["Preferences", "Cache", "Stable"],
  ];
  return `# Large Table Row Addition

| Area | Feature | Status |
| --- | --- | --- |
${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`;
}

export async function sampleCodeFenceWordHighlight(page, rootSelectors) {
  return await page.evaluate((selectors) => {
    const root = selectors
      .map((selector) => document.querySelector(selector))
      .find((node) => node instanceof HTMLElement);
    const codeHighlights = Array.from(
      root?.querySelectorAll(
        ".git-rendered-block-content pre.hljs .git-inline-word-highlight",
      ) ?? [],
    );
    return {
      codeHighlightCount: codeHighlights.length,
      hasCodeWordHighlight: codeHighlights.length > 0,
      codeHighlightsHaveNoReviewId: codeHighlights.every(
        (node) => !node.hasAttribute("data-review-id"),
      ),
      preservesSyntaxTokens:
        (root?.querySelectorAll(
          ".git-rendered-block-content pre.hljs .hljs-keyword",
        ).length ?? 0) > 0 &&
        (root?.querySelectorAll(
          ".git-rendered-block-content pre.hljs .hljs-string",
        ).length ?? 0) > 0,
      hasNoMathHighlight:
        (root?.querySelectorAll(
          ".katex .git-inline-word-highlight, .math-inline .git-inline-word-highlight, .math-block .git-inline-word-highlight",
        ).length ?? 0) === 0,
      hasNoSvgHighlight:
        (root?.querySelectorAll("svg .git-inline-word-highlight").length ??
          0) === 0,
    };
  }, rootSelectors);
}
