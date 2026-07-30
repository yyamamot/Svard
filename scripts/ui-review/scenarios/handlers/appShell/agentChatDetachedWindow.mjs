import { selectAgentChatDisplay } from "./agentChatDisplayMenu.mjs";

async function routeMainReattachRequestToMockDetached(page) {
  await page.evaluate(() => {
    window.addEventListener(
      "svard-agent-chat-reattach-request",
      () => {
        void window.__SVARD_MOCK_AGENT_REATTACH__?.();
      },
      { once: true },
    );
  });
  await selectAgentChatDisplay(page, "Attach to Main", { source: "topbar" });
}

async function readDisplayMenuLabels(page, source = "topbar") {
  const trigger =
    source === "topbar"
      ? page.locator('[data-review-id="codex-spike-toggle"]')
      : page
          .locator('[data-review-id="agent-panel"]')
          .locator('[data-review-id="agent-display-menu-trigger"]');
  await trigger.click();
  const menu = page.locator('[data-review-id="agent-display-menu"]').last();
  await menu.waitFor();
  const labels = await menu
    .locator('[role="menuitem"], [role="menuitemradio"]')
    .allTextContents();
  await page.keyboard.press("Escape");
  return labels.map((label) => label.trim());
}

export async function runAgentDetachedWindowScenario({ composer, page }) {
  await composer.fill("Detached window draft");
  await selectAgentChatDisplay(page, "Hide AI Chat", { source: "topbar" });
  await page
    .locator('[data-review-id="agent-panel"]')
    .waitFor({ state: "hidden" });

  const normalMenuLabels = await readDisplayMenuLabels(page);
  await page.evaluate(() => {
    window.__SVARD_AGENT_MAIN_PANEL_FLASHED__ = false;
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-review-id="codex-main-split"]')) {
        window.__SVARD_AGENT_MAIN_PANEL_FLASHED__ = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__SVARD_AGENT_MAIN_PANEL_FLASH_OBSERVER__ = observer;
  });
  await selectAgentChatDisplay(page, "Separate window", {
    source: "topbar",
  });
  await page.waitForFunction(
    () => document.querySelector('[data-review-id="agent-panel"]') === null,
  );
  const mainPanelFlashed = await page.evaluate(() => {
    window.__SVARD_AGENT_MAIN_PANEL_FLASH_OBSERVER__?.disconnect();
    return window.__SVARD_AGENT_MAIN_PANEL_FLASHED__;
  });
  const mainControllerRemoved =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 0;
  const rightSidebarRestored =
    (await page.locator('[data-review-id="right-sidebar"]').count()) === 1;
  const detachedMenuLabels = await readDisplayMenuLabels(page);

  await selectAgentChatDisplay(page, "Focus separate window", {
    source: "topbar",
  });
  const focusMaintainedSingleOwner =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 0;

  await routeMainReattachRequestToMockDetached(page);
  await page.locator('[data-review-id="agent-panel"]').waitFor();
  const reattached =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 1;
  const draftPreserved =
    (await page.locator(".agent-composer textarea").inputValue()) ===
    "Detached window draft";

  await selectAgentChatDisplay(page, "Bottom");
  await page.locator('[data-review-id="codex-main-split"]').waitFor();
  await selectAgentChatDisplay(page, "Separate window");
  await page
    .locator('[data-review-id="agent-panel"]')
    .waitFor({ state: "detached" });
  await routeMainReattachRequestToMockDetached(page);
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
  const diffMenuLabels = await readDisplayMenuLabels(page, "panel");
  await selectAgentChatDisplay(page, "Separate window");
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
    void window.__SVARD_MOCK_AGENT_REATTACH__?.();
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
      bottomReattached,
      detachedMenuLabels,
      diffDrawerClosedAfterDetach,
      diffDrawerReopenedAfterReattach,
      diffMenuLabels,
      diffPreviewMaintained,
      draftPreserved,
      focusMaintainedSingleOwner,
      mainControllerRemoved,
      mainPanelFlashed,
      normalMenuLabels,
      reattached,
      rightSidebarRestored,
    },
  );
}
