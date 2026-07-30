import { selectAgentChatDisplay } from "./agentChatDisplayMenu.mjs";

export async function prepareAgentComposerAccessScenario({ composer, page }) {
  await composer.fill("この変更の権限境界を説明してください。");
  const trigger = page.locator('[data-review-id="agent-access-trigger"]');
  const textareaBox = await composer.boundingBox();
  const triggerBox = await trigger.boundingBox();
  const headerControlRemoved =
    (await page.getByRole("button", { name: "Agent settings" }).count()) === 0;
  const toolbarBelowInput = Boolean(
    textareaBox &&
    triggerBox &&
    triggerBox.y >= textareaBox.y + textareaBox.height,
  );

  await trigger.click();
  const popover = page.locator('[data-review-id="agent-access-popover"]');
  await popover.waitFor();
  const initialObserve =
    (await popover.getByRole("radio", { name: "Observe" }).isChecked()) ===
    true;
  await popover.getByRole("radio", { name: "Agent", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-review-id="agent-access-trigger"]')
        ?.getAttribute("aria-label") === "Agent access: Agent",
  );
  const network = popover.getByRole("checkbox", { name: "Network access" });
  const webSearch = popover.getByRole("checkbox", { name: "Web search" });
  if (await network.count()) {
    await network.check();
  }
  if (await webSearch.count()) {
    await webSearch.check();
  }
  await popover.getByRole("radio", { name: "Full Access" }).click();
  const popoverStayedOpen = (await popover.count()) === 1;
  const draftPreserved =
    (await composer.inputValue()) === "この変更の権限境界を説明してください。";

  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      document.activeElement ===
      document.querySelector('[data-review-id="agent-access-trigger"]'),
  );
  const focusRestored = await trigger.evaluate(
    (element) => document.activeElement === element,
  );

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__ = result;
    },
    {
      draftPreserved,
      focusRestored,
      headerControlRemoved,
      initialObserve,
      popoverStayedOpen,
      toolbarBelowInput,
    },
  );
}

export async function confirmAgentComposerFullAccess({ page }) {
  await page.getByRole("button", { name: "Enable Full Access" }).waitFor();
  await page.getByRole("button", { name: "Enable Full Access" }).click();
}

export async function reopenAgentComposerAccessForCapture({ page }) {
  const trigger = page.locator('[data-review-id="agent-access-trigger"]');
  await trigger.click();
  const popover = page.locator('[data-review-id="agent-access-popover"]');
  await popover.waitFor();
  const triggerBox = await trigger.boundingBox();
  const popoverBox = await popover.boundingBox();
  const insideViewport = Boolean(
    popoverBox &&
    popoverBox.x >= 8 &&
    popoverBox.y >= 8 &&
    popoverBox.x + popoverBox.width <= 952 &&
    popoverBox.y + popoverBox.height <= 632,
  );
  const opensAbove = Boolean(
    triggerBox &&
    popoverBox &&
    popoverBox.y + popoverBox.height <= triggerBox.y,
  );
  await page.evaluate(
    ({ insideViewport, opensAbove }) => {
      window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__ = {
        ...window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__,
        insideViewport,
        opensAbove,
      };
    },
    { insideViewport, opensAbove },
  );
}

export async function exerciseAgentComposerAccessPlacements({ page }) {
  await selectAgentChatDisplay(page, "Bottom");
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
    )
    .waitFor();
  const bottomMaintained =
    (await page.locator('[data-review-id="agent-access-trigger"]').count()) ===
    1;

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
  const diffMaintained =
    (await page.locator('[data-review-id="agent-access-trigger"]').count()) ===
    1;
  await page.getByRole("button", { name: "Close Git diff preview" }).click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  await selectAgentChatDisplay(page, "Right side");
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="right"]',
    )
    .waitFor();
  const rightMaintained =
    (await page.locator('[data-review-id="agent-access-trigger"]').count()) ===
    1;
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
  });
  await page.locator(".app-shell.theme-dark").waitFor();
  await page.evaluate(
    ({ bottomMaintained, diffMaintained, rightMaintained }) => {
      window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__ = {
        ...window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__,
        bottomMaintained,
        darkThemeMaintained: true,
        diffMaintained,
        rightMaintained,
      };
    },
    { bottomMaintained, diffMaintained, rightMaintained },
  );
}
