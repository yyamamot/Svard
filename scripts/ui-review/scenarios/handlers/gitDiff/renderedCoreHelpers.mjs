export async function exerciseRenderedDiffAgentSelection(
  page,
  { paneReviewId, restoredPanelReviewId, resultKey },
) {
  const pane = page.locator(`[data-review-id="${paneReviewId}"]`).first();
  await pane.waitFor();
  const reverseSelectionPoints = await pane.evaluate((element) => {
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
  await page.locator('[data-review-id="selection-mini-toolbar"]').waitFor();
  await page
    .locator('[data-review-id="selection-mini-toolbar"]')
    .getByRole("button", { name: "Ask AI" })
    .click();
  await page.locator(".agent-selection-card").waitFor();
  const revisionVisible = await page
    .locator(".agent-selection-card")
    .getByText(/After|Working tree/u)
    .count();
  await page
    .locator(".agent-selection-card")
    .getByRole("button", { name: "Return to selected content" })
    .click();
  await page.locator(`[data-review-id="${restoredPanelReviewId}"]`).waitFor();
  await page.evaluate(
    ({ resultKey, revisionVisible }) => {
      window[resultKey] = {
        overlayRestored: true,
        revisionVisible: revisionVisible > 0,
        toolbarOpaque:
          getComputedStyle(
            document.querySelector(
              '[data-review-id="selection-mini-toolbar"]',
            ) ?? document.body,
          ).backgroundColor !== "rgba(0, 0, 0, 0)",
      };
    },
    { resultKey, revisionVisible },
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
  const card = page.locator(".agent-media-card");
  await card.waitFor();
  const revisionVisible = await card.getByText(/After|Working tree/u).count();
  const modeCount = await card.locator(".agent-media-mode button").count();
  await card.getByRole("button", { name: "Show" }).click();
  await page.locator(`[data-review-id="${restoredPanelReviewId}"]`).waitFor();
  await page.evaluate(
    ({ modeCount, resultKey, revisionVisible }) => {
      window[resultKey] = {
        modeCount,
        overlayRestored: true,
        revisionVisible: revisionVisible > 0,
      };
    },
    { modeCount, resultKey, revisionVisible },
  );
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
