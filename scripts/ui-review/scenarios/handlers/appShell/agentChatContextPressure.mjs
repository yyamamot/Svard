async function sendWithUsage({ composer, page, usedTokens }) {
  const previousTurnCount = await page.locator(".agent-turn").count();
  await page.evaluate((value) => {
    window.__SVARD_AGENT_CONTEXT_USAGE__ = {
      usedTokens: value,
      contextWindowTokens: 250_000,
    };
  }, usedTokens);
  await composer.fill(`Record context usage at ${usedTokens} tokens.`);
  await composer.press("Meta+Enter");
  await page.waitForFunction((turnCount) => {
    const turns = document.querySelectorAll(".agent-turn");
    return (
      turns.length > turnCount &&
      turns[turns.length - 1]?.getAttribute("data-turn-status") === "completed"
    );
  }, previousTurnCount);
}

export async function runAgentContextPressureScenario({ composer, page }) {
  const automaticNotice = page.getByText("Context compacted automatically.");
  await automaticNotice.waitFor();
  const automaticNoticeVisible = await automaticNotice.isVisible();
  const trigger = page.locator('[data-review-id="agent-context-trigger"]');

  await sendWithUsage({ composer, page, usedTokens: 187_500 });
  const gettingFullVisible =
    (await trigger.getAttribute("aria-label")) === "25% context remaining";
  await sendWithUsage({ composer, page, usedTokens: 225_000 });
  const nearlyFullVisible =
    (await trigger.getAttribute("aria-label")) === "10% context remaining";
  await sendWithUsage({ composer, page, usedTokens: 50_000 });
  const normalVisible =
    (await trigger.getAttribute("aria-label")) === "80% context remaining";

  const draft = "この下書きをcompact後も維持してください。";
  await composer.fill(draft);
  await trigger.click();
  const popover = page.locator('[data-review-id="agent-context-popover"]');
  await popover.waitFor();
  const exactUsageVisible =
    (await popover.getByText("50K / 250K tokens").count()) === 1;
  await popover.getByRole("button", { name: "Compact context" }).click();
  await page.getByRole("button", { name: "Send" }).waitFor({
    state: "visible",
  });
  await page.waitForFunction(
    () =>
      document.querySelector('button[aria-label="Send"]')?.disabled === true,
  );
  const sendSuppressed =
    (await page.getByRole("button", { name: "Send" }).isDisabled()) === true;
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-review-id="agent-context-trigger"]')
        ?.getAttribute("aria-label") === "80% context remaining",
  );
  const draftPreserved = (await composer.inputValue()) === draft;
  const manualResultVisible =
    (await popover.getByText("Last compacted manually.").count()) === 1;

  await page.getByRole("button", { name: "Move AI Chat to bottom" }).click();
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
    )
    .waitFor();
  const bottomMaintained = (await trigger.count()) === 1;

  await page.locator("text=diff-regression-gallery.md").click();
  await page
    .locator('[data-review-id="active-document-title"]')
    .filter({ hasText: "diff-regression-gallery.md" })
    .waitFor();
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("git.showDiff");
  });
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  await page.getByRole("button", { name: "Changes Only" }).click();
  await page.locator('[data-review-id="git-diff-agent-dock"]').waitFor();
  const diffMaintained = (await trigger.count()) === 1;
  await page.getByRole("button", { name: "Close Git diff preview" }).click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Move AI Chat to right" }).click();
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="right"]',
    )
    .waitFor();
  const rightMaintained = (await trigger.count()) === 1;
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
  });
  await page.locator(".app-shell.theme-dark").waitFor();

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_CONTEXT_PRESSURE_CHECK__ = result;
    },
    {
      automaticNoticeVisible,
      bottomMaintained,
      diffMaintained,
      draftPreserved,
      exactUsageVisible,
      gettingFullVisible,
      manualResultVisible,
      nearlyFullVisible,
      normalVisible,
      rightMaintained,
      sendSuppressed,
    },
  );
}

export async function reopenAgentContextForCapture({ page }) {
  const trigger = page.locator('[data-review-id="agent-context-trigger"]');
  await trigger.click();
  await page.locator('[data-review-id="agent-context-popover"]').waitFor();
}
