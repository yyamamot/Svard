import { selectAgentChatDisplay } from "./agentChatDisplayMenu.mjs";

async function openTokenDetails(page) {
  const trigger = page.locator('[data-review-id="agent-context-trigger"]');
  await trigger.click();
  const popover = page.locator('[data-review-id="agent-context-popover"]');
  await popover.waitFor();
  await popover
    .locator('[data-review-id="agent-token-details"] summary')
    .click();
  await popover
    .locator('[data-review-id="agent-token-details-content"]')
    .waitFor();
  await page.waitForFunction(() => {
    const element = document.querySelector(
      '[data-review-id="agent-context-popover"]',
    );
    if (!(element instanceof HTMLElement)) return false;
    const box = element.getBoundingClientRect();
    return (
      box.left >= 8 &&
      box.top >= 8 &&
      box.right <= window.innerWidth - 8 &&
      box.bottom <= window.innerHeight - 8
    );
  });
  return popover;
}

function isInsideViewport(box, viewport) {
  return Boolean(
    box &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height,
  );
}

export async function runAgentTokenDiagnosticsScenario({ page }) {
  let popover = await openTokenDetails(page);
  const exactValuesVisible =
    (await popover.getByText("187,500", { exact: true }).count()) === 1 &&
    (await popover.getByText("180,000", { exact: true }).count()) >= 1 &&
    (await popover.getByText("7,000", { exact: true }).count()) === 1;
  const comparisonVisible =
    (await popover.getByText("Latest request", { exact: true }).count()) ===
      1 &&
    (await popover.getByText("Latest turn", { exact: true }).count()) === 1 &&
    (await popover.getByText("Conversation", { exact: true }).count()) === 1;
  const provenanceVisible =
    (await popover.getByText("Provider reported", { exact: true }).count()) ===
      2 &&
    (await popover
      .getByText("Aggregated provider reports", { exact: true })
      .count()) === 1;

  await selectAgentChatDisplay(page, "Bottom");
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
    )
    .waitFor();
  popover = await openTokenDetails(page);
  const bottomMaintained =
    (await popover
      .locator('[data-review-id="agent-token-details-content"]')
      .count()) === 1;
  await page.keyboard.press("Escape");

  await page.locator("text=diff-regression-gallery.md").click();
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("git.showDiff");
  });
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  await page.getByRole("button", { name: "Changes Only" }).click();
  await page.locator('[data-review-id="git-diff-agent-dock"]').waitFor();
  popover = await openTokenDetails(page);
  const diffMaintained =
    (await popover.getByText("Token details", { exact: true }).count()) === 1;
  await page.locator('[data-review-id="agent-context-trigger"]').click();
  await page.getByRole("button", { name: "Close Git diff preview" }).click();
  await selectAgentChatDisplay(page, "Right side");
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="right"]',
    )
    .waitFor();
  await page.setViewportSize({ width: 960, height: 640 });
  popover = await openTokenDetails(page);
  const compactReachable = await popover
    .getByRole("button", { name: "Compact context" })
    .isVisible();
  const compactBox = await popover.boundingBox();
  const insideCompactViewport = isInsideViewport(compactBox, {
    width: 960,
    height: 640,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 840 });

  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
  });
  await page.locator(".app-shell.theme-dark").waitFor();
  popover = await openTokenDetails(page);
  const darkThemeMaintained =
    (await popover
      .locator('[data-review-id="agent-token-details-content"]')
      .count()) === 1;
  await page.keyboard.press("Escape");

  const result = {
    bottomMaintained,
    compactReachable,
    comparisonVisible,
    darkThemeMaintained,
    diffMaintained,
    exactValuesVisible,
    insideCompactViewport,
    provenanceVisible,
  };
  const failedChecks = Object.entries(result)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failedChecks.length > 0) {
    throw new Error(
      `Token diagnostics checks failed: ${failedChecks.join(", ")}`,
    );
  }
  await page.evaluate((value) => {
    window.__SVARD_AGENT_TOKEN_DIAGNOSTICS_CHECK__ = value;
  }, result);
}

export async function reopenAgentTokenDiagnosticsForCapture({ page }) {
  await openTokenDetails(page);
}
