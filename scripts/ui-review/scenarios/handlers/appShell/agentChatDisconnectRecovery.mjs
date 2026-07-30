import { selectAgentChatDisplay } from "./agentChatDisplayMenu.mjs";

async function reattachMockDetached(page) {
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
  await page.locator('[data-review-id="agent-panel"]').waitFor();
}

export async function runAgentChatDisconnectRecoveryScenario({
  composer,
  page,
}) {
  await composer.press("Meta+Enter");
  await page.locator('.agent-turn[data-turn-status="failed"]').last().waitFor();
  await page.getByRole("button", { name: "Restore input" }).waitFor();
  const approvalClosed =
    (await page.getByRole("region", { name: "Approval required" }).count()) ===
    0;
  const runningClosed =
    (await page.locator('.agent-turn[data-turn-status="running"]').count()) ===
    0;
  const activityClosed =
    (await page.locator(".agent-current-activity").count()) === 0;
  const failedTurnCount = await page
    .locator('.agent-turn[data-turn-status="failed"]')
    .count();

  await page.getByRole("button", { name: "Restore input" }).click();
  const restoredDraft =
    (await composer.inputValue()) === "Unexpected disconnect during approval.";
  await page.getByRole("button", { name: "Reconnect" }).waitFor();
  await page.getByRole("button", { name: "Reconnect" }).click();
  await page
    .locator('[data-review-id="agent-disconnected"]')
    .waitFor({ state: "detached" });
  const failedTurnMaintained =
    (await page.locator('.agent-turn[data-turn-status="failed"]').count()) ===
    failedTurnCount;

  await composer.fill("Continue after the disconnect.");
  await composer.press("Meta+Enter");
  await page
    .locator('.agent-turn[data-turn-status="completed"]')
    .last()
    .waitFor();
  const turnCountBeforeReuse = await page.locator(".agent-turn").count();
  await page.getByRole("button", { name: "Reuse input" }).last().click();
  const reusedDraft =
    (await composer.inputValue()) === "Continue after the disconnect.";
  const reuseDidNotSend =
    (await page.locator(".agent-turn").count()) === turnCountBeforeReuse;
  await composer.press("Meta+Enter");
  await page.waitForFunction(
    (minimum) =>
      document.querySelectorAll('.agent-turn[data-turn-status="completed"]')
        .length >= minimum,
    2,
  );

  await selectAgentChatDisplay(page, "Bottom");
  const bottomPlacement =
    (await page
      .locator(
        '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
      )
      .count()) === 1;
  await selectAgentChatDisplay(page, "Right side");
  const rightPlacement =
    (await page
      .locator(
        '[data-review-id="codex-main-split"][data-agent-placement="right"]',
      )
      .count()) === 1;
  await selectAgentChatDisplay(page, "Separate window");
  await page
    .locator('[data-review-id="agent-panel"]')
    .waitFor({ state: "detached" });
  const detachedExclusive =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 0;
  await reattachMockDetached(page);

  await page.setViewportSize({ width: 960, height: 640 });
  const compactLayoutValid = Boolean(
    await page.locator('[data-review-id="agent-panel"]').boundingBox(),
  );
  await page.setViewportSize({ width: 1280, height: 840 });

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_DISCONNECT_RECOVERY_CHECK__ = result;
    },
    {
      activityClosed,
      approvalClosed,
      bottomPlacement,
      compactLayoutValid,
      detachedExclusive,
      failedTurnMaintained,
      reconnectCleared: true,
      restoredDraft,
      reusedDraft,
      reuseDidNotSend,
      rightPlacement,
      runningClosed,
    },
  );
}
