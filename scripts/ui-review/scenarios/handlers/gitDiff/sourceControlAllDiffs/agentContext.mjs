export async function exerciseDiffContextReliability(page) {
  const pane = page
    .locator('[data-review-id="diff-stream-right-pane"]')
    .first();
  await pane.scrollIntoViewIfNeeded();
  const selectionPoint = await pane.evaluate((element) => {
    const text = Array.from(element.querySelectorAll("p,li,pre"))
      .flatMap((candidate) => Array.from(candidate.childNodes))
      .find((node) => node instanceof Text && node.data.trim().length > 4);
    if (!(text instanceof Text)) throw new Error("No selectable diff text");
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(text.data.length, 60));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    const rect = range.getClientRects()[0];
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
  });
  if (!selectionPoint) throw new Error("Diff selection was not visible");
  await page.waitForTimeout(100);
  await page.mouse.click(selectionPoint.x, selectionPoint.y, {
    button: "right",
  });
  await page
    .locator('[data-review-id="context-menu"]')
    .getByRole("menuitem", { name: "Ask AI about selection" })
    .click();
  await page.waitForTimeout(200);
  const agentPanel = page.locator('[data-review-id="agent-panel"]');
  if (!(await agentPanel.isVisible())) {
    const notice = await page
      .locator('[data-review-id="inline-notice"]')
      .allTextContents();
    throw new Error(
      `AI Chat did not open after the Diff selection: ${notice.join(" | ")}`,
    );
  }
  const selectionCard = page.locator(".agent-selection-card");
  await selectionCard.waitFor();
  const dock = page.locator('[data-review-id="git-diff-agent-dock"]');
  await dock.waitFor();
  const composer = dock.locator("textarea");
  const questionBlank = (await composer.inputValue()) === "";
  await composer.fill("選択した変更の前提を説明してください");
  const draft = await composer.inputValue();
  await selectionCard
    .getByRole("button", { name: "Return to selected content" })
    .click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await dock.waitFor();
  const diagram = page
    .locator(
      '[data-review-id="diff-stream-right-pane"] [data-diagram-id] svg, [data-review-id="diff-stream-right-pane"] [data-diagram-id] img',
    )
    .first();
  await diagram.waitFor();
  await diagram.scrollIntoViewIfNeeded();
  await diagram.click({ button: "right" });
  await page
    .locator('[data-review-id="context-menu"]')
    .getByRole("menuitem", { name: "Ask AI" })
    .click();
  const mediaCard = page.locator(".agent-media-card");
  await mediaCard.waitFor();
  const orderedKinds = await page
    .locator('[data-review-id="agent-selection-attachments"] > *')
    .evaluateAll((items) =>
      items.map((item) =>
        item.classList.contains("agent-selection-card")
          ? "selection"
          : item.classList.contains("agent-media-card")
            ? "media"
            : "unknown",
      ),
    );
  const modeCount = await mediaCard.locator(".agent-media-mode button").count();
  await mediaCard.getByRole("button", { name: "Show" }).click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await dock.waitFor();
  const draftAfterContext = await composer.inputValue();
  await page.evaluate(
    ({ draft, draftAfterContext, modeCount, orderedKinds, questionBlank }) => {
      window.__SVARD_DIFF_CONTEXT_RELIABILITY_CHECK__ = {
        dockVisible: true,
        draftPreserved: draftAfterContext === draft,
        modeCount,
        orderedKinds,
        overlayMaintained: true,
        questionBlank,
      };
    },
    { draft, draftAfterContext, modeCount, orderedKinds, questionBlank },
  );
  if (modeCount !== 3 || orderedKinds.join(",") !== "selection,media") {
    throw new Error(
      `Unexpected ordered Diff context: ${JSON.stringify({
        modeCount,
        orderedKinds,
      })}`,
    );
  }
  await page.getByRole("button", { name: "Close all diffs" }).click();
  await agentPanel.waitFor();
}

export async function exerciseAllDiffsSelection(page) {
  const pane = page
    .locator('[data-review-id="diff-stream-right-pane"]')
    .first();
  await pane.evaluate((element) => {
    const text = Array.from(element.querySelectorAll("p,li,pre"))
      .flatMap((candidate) => Array.from(candidate.childNodes))
      .find((node) => node instanceof Text && node.data.trim().length > 4);
    if (!(text instanceof Text)) throw new Error("No selectable diff text");
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(text.data.length, 60));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
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
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await page.evaluate(
    ({ revisionVisible }) => {
      window.__SVARD_ALL_DIFFS_AGENT_SELECTION_CHECK__ = {
        overlayRestored: true,
        revisionVisible: revisionVisible > 0,
      };
    },
    { revisionVisible },
  );
}

export async function exerciseAllDiffsMediaContext(page) {
  const diagram = page
    .locator(
      '[data-review-id="diff-stream-right-pane"] [data-diagram-id] svg, [data-review-id="diff-stream-right-pane"] [data-diagram-id] img',
    )
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
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await page.evaluate(
    ({ modeCount, revisionVisible }) => {
      window.__SVARD_ALL_DIFFS_AGENT_MEDIA_CHECK__ = {
        modeCount,
        overlayRestored: true,
        revisionVisible: revisionVisible > 0,
      };
    },
    { modeCount, revisionVisible },
  );
}
