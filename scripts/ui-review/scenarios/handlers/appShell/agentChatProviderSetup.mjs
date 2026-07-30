export async function runAgentChatProviderSetupScenario({ page }) {
  await page.evaluate(() => {
    window.__SVARD_AGENT_PROVIDER_STATE__ = "notFound";
    window.__SVARD_AGENT_RUNTIME_LOAD_COUNT__ = 0;
  });
  const trigger = page.locator('[data-review-id="codex-spike-toggle"]');
  await trigger.waitFor();
  const visibleWithoutProvider = await trigger.isVisible();
  await trigger.click();
  await page
    .locator('[data-review-id="preferences-tab-agent-providers"]')
    .waitFor();
  await page
    .locator('[data-review-id="agent-provider-codex-status"]')
    .filter({ hasText: "Not installed" })
    .waitFor();
  const setupLabel =
    (await trigger.getAttribute("aria-label")) === "Set up AI Chat";
  const warningVisible =
    (await page
      .locator('[data-review-id="agent-chat-entry-warning"]')
      .count()) === 1;
  const noChatCreated =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 0 &&
    (await page.locator('[data-review-id="agent-display-menu"]').count()) === 0;
  const firstProbeCount = await page.evaluate(
    () => window.__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
  );

  await page.evaluate(() => {
    window.__SVARD_AGENT_PROVIDER_STATE__ = "ready";
  });
  await page.getByRole("button", { name: "Refresh Codex" }).click();
  await page
    .locator('[data-review-id="agent-provider-codex-status"]')
    .filter({ hasText: "Ready" })
    .waitFor();
  await trigger.click();
  const displayMenu = page.locator('[data-review-id="agent-display-menu"]');
  await displayMenu.waitFor();
  const readyMenuLabels = (
    await displayMenu
      .locator('[role="menuitem"], [role="menuitemradio"]')
      .allTextContents()
  ).map((label) => label.trim());
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    window.__SVARD_AGENT_PROVIDER_STATE__ = "notFound";
  });
  await page.getByRole("button", { name: "Refresh Codex" }).click();
  await page
    .locator('[data-review-id="agent-provider-codex-status"]')
    .filter({ hasText: "Not installed" })
    .waitFor();
  await trigger.click();
  await page
    .locator('[data-review-id="preferences-tab-agent-providers"]')
    .waitFor();
  const repeatedSetupRequest =
    (await trigger.getAttribute("aria-label")) === "Set up AI Chat";

  await page.setViewportSize({ width: 960, height: 640 });
  const compactLayoutValid = Boolean(
    await page.locator('[data-review-id="preferences-page"]').boundingBox(),
  );
  await page.setViewportSize({ width: 1280, height: 840 });

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_PROVIDER_SETUP_CHECK__ = result;
    },
    {
      compactLayoutValid,
      firstProbeCount,
      noChatCreated,
      readyMenuLabels,
      repeatedSetupRequest,
      setupLabel,
      visibleWithoutProvider,
      warningVisible,
    },
  );
}
