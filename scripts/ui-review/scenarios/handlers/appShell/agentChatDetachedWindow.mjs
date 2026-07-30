export async function runAgentDetachedWindowScenario({ composer, page }) {
  await composer.fill("Detached window draft");
  const detach = page.getByRole("button", {
    name: "Open AI Chat in separate window",
  });
  const detachControlVisible = (await detach.count()) === 1;
  await detach.click();
  await page.waitForFunction(
    () => document.querySelector('[data-review-id="agent-panel"]') === null,
  );
  const mainControllerRemoved =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 0;
  const rightSidebarRestored =
    (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;

  await page.getByRole("button", { name: "Focus detached AI Chat" }).click();
  const focusMaintainedSingleOwner =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 0;

  await page.evaluate(() => {
    window.__SVARD_MOCK_AGENT_REATTACH__?.();
  });
  await page.locator('[data-review-id="agent-panel"]').waitFor();
  const reattached =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 1;
  const draftPreserved =
    (await page.locator(".agent-composer textarea").inputValue()) ===
    "Detached window draft";
  await page.getByRole("button", { name: "Move AI Chat to bottom" }).click();
  await page.locator('[data-review-id="codex-main-split"]').waitFor();
  await page
    .getByRole("button", { name: "Open AI Chat in separate window" })
    .click();
  await page.waitForFunction(
    () => document.querySelector('[data-review-id="agent-panel"]') === null,
  );
  await page.evaluate(() => {
    window.__SVARD_MOCK_AGENT_REATTACH__?.();
  });
  await page.locator('[data-review-id="agent-panel"]').waitFor();
  const bottomReattached =
    (await page.locator('[data-review-id="codex-main-split"]').count()) === 1;

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
  await page
    .getByRole("button", { name: "Open AI Chat in separate window" })
    .click();
  await page
    .locator('[data-review-id="git-diff-agent-dock"]')
    .waitFor({ state: "detached" });
  const diffDrawerClosedAfterDetach =
    (await page.locator('[data-review-id="git-diff-agent-dock"]').count()) ===
    0;
  const diffPreviewMaintained =
    (await page
      .locator('[data-review-id="git-diff-preview-panel"]')
      .count()) === 1;
  await page.evaluate(() => {
    window.__SVARD_MOCK_AGENT_REATTACH__?.();
  });
  await page.locator('[data-review-id="git-diff-agent-dock"]').waitFor();
  const diffDrawerReopenedAfterReattach =
    (await page.locator('[data-review-id="git-diff-agent-dock"]').count()) ===
    1;
  await page.getByRole("button", { name: "Close Git diff preview" }).click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  await page.locator('[data-review-id="agent-panel"]').waitFor();

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_DETACHED_WINDOW_CHECK__ = result;
    },
    {
      detachControlVisible,
      bottomReattached,
      diffDrawerClosedAfterDetach,
      diffDrawerReopenedAfterReattach,
      diffPreviewMaintained,
      draftPreserved,
      focusMaintainedSingleOwner,
      mainControllerRemoved,
      reattached,
      rightSidebarRestored,
    },
  );
}
