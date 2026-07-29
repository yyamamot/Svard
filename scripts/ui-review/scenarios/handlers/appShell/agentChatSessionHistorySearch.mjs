async function openHistory(page) {
  await page.getByRole("button", { name: "Open chat history" }).click();
  const history = page.locator('[data-review-id="agent-session-history"]');
  await history.waitFor();
  await history.getByRole("searchbox", { name: "Search chat names" }).waitFor();
  return history;
}

async function searchState(history) {
  const search = history.getByRole("searchbox", {
    name: "Search chat names",
  });
  return {
    query: await search.inputValue(),
    resultCount: await history.locator(".agent-session-item").count(),
  };
}

export async function runAgentSessionHistorySearchScenario({ page }) {
  let history = await openHistory(page);
  await history.getByRole("button", { name: "Close chat history" }).click();
  await page.getByRole("button", { name: "Start new chat" }).click();
  history = await openHistory(page);
  await page.waitForFunction(
    () => document.querySelectorAll(".agent-session-item").length === 2,
  );

  const search = history.getByRole("searchbox", {
    name: "Search chat names",
  });
  await search.fill("focused");
  await page.waitForFunction(
    () => document.querySelectorAll(".agent-session-item").length === 1,
  );
  const right = await searchState(history);
  await history.getByRole("button", { name: "Close chat history" }).click();

  await page.getByRole("button", { name: "Move AI Chat to bottom" }).click();
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
    )
    .waitFor();
  history = await openHistory(page);
  const bottom = await searchState(history);
  await history.getByRole("button", { name: "Close chat history" }).click();

  await page.locator("text=diff-regression-gallery.md").click();
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("git.showDiff");
  });
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  await page.getByRole("button", { name: "Changes Only" }).click();
  await page.locator('[data-review-id="git-diff-agent-dock"]').waitFor();
  history = await openHistory(page);
  const diff = await searchState(history);
  await history.getByRole("button", { name: "Close chat history" }).click();
  await page.getByRole("button", { name: "Close Git diff preview" }).click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Move AI Chat to right" }).click();

  history = await openHistory(page);
  await history
    .getByRole("combobox", { name: "Filter chats by update date" })
    .selectOption("last7Days");
  await history.getByRole("tab", { name: "Archived" }).click();
  await history.getByText("No chats match your search.").waitFor();
  const emptyVisible = true;
  await history.getByRole("tab", { name: "Recent" }).click();
  await history.getByRole("button", { name: "Clear chat search" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".agent-session-item").length === 2,
  );
  const clearRestored =
    (await history.locator(".agent-session-item").count()) === 2;
  await history
    .locator(".agent-session-item")
    .filter({ hasNotText: "Current chat" })
    .locator(".agent-session-open")
    .click();
  await history.waitFor({ state: "detached" });
  await page.locator(".agent-work-summary").waitFor();
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
  });
  await page.locator(".app-shell.theme-dark").waitFor();

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_SESSION_HISTORY_SEARCH_CHECK__ = result;
    },
    {
      bottomMaintained: bottom.query === "focused" && bottom.resultCount === 1,
      clearRestored,
      darkThemeMaintained: true,
      diffMaintained: diff.query === "focused" && diff.resultCount === 1,
      emptyVisible,
      rightMaintained: right.query === "focused" && right.resultCount === 1,
    },
  );
}

export async function reopenAgentSessionHistorySearchForCapture({ page }) {
  const history = await openHistory(page);
  const box = await history.boundingBox();
  await page.evaluate(
    (insideCompactViewport) => {
      window.__SVARD_AGENT_SESSION_HISTORY_SEARCH_CHECK__ = {
        ...window.__SVARD_AGENT_SESSION_HISTORY_SEARCH_CHECK__,
        insideCompactViewport,
      };
    },
    Boolean(
      box &&
      box.x >= 8 &&
      box.y >= 8 &&
      box.x + box.width <= 952 &&
      box.y + box.height <= 632,
    ),
  );
}
