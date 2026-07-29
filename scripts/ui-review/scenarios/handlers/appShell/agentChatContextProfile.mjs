import {
  exerciseAgentComposerAccessPlacements,
  reopenAgentComposerAccessForCapture,
} from "./agentChatComposerAccess.mjs";

export async function prepareAgentContextProfileScenario({ composer, page }) {
  const draft = "Focused contextの境界を確認してください。";
  await composer.fill(draft);
  await page.locator('[data-review-id="agent-access-trigger"]').click();
  const popover = page.locator('[data-review-id="agent-access-popover"]');
  await popover.waitFor();
  const profile = page.locator('[data-review-id="agent-context-profile"]');
  const focusedVisible =
    (await profile.getByRole("radio", { name: "Focused" }).isChecked()) ===
    true;
  const boundaryVisible = await profile
    .getByText("this is not full MCP or global-instruction isolation")
    .isVisible();
  await profile.getByRole("radio", { name: "Provider extensions" }).click();
  const providerExtensionsSelected =
    (await profile
      .getByRole("radio", { name: "Provider extensions" })
      .isChecked()) === true;
  const draftPreserved = (await composer.inputValue()) === draft;
  await page.keyboard.press("Escape");
  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__ = result;
    },
    {
      boundaryVisible,
      draftPreserved,
      focusedVisible,
      providerExtensionsSelected,
    },
  );
}

export async function exerciseAgentContextProfilePlacements({ page }) {
  await exerciseAgentComposerAccessPlacements({ page });
  await page.evaluate(() => {
    const placements = window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__;
    window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__ = {
      ...window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__,
      bottomMaintained: placements?.bottomMaintained === true,
      darkThemeMaintained: placements?.darkThemeMaintained === true,
      diffMaintained: placements?.diffMaintained === true,
      rightMaintained: placements?.rightMaintained === true,
    };
  });
}

export async function reopenAgentContextProfileForCapture({ page }) {
  await reopenAgentComposerAccessForCapture({ page });
  await page.evaluate(() => {
    const geometry = window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__;
    window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__ = {
      ...window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__,
      insideViewport: geometry?.insideViewport === true,
      opensAbove: geometry?.opensAbove === true,
    };
  });
}
