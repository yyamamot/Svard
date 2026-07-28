export async function runAgentRunningInputScenario({ composer, page }) {
  await page.getByRole("button", { name: "Queue", exact: true }).waitFor();
  await composer.fill("Focus on failure handling.");
  await page
    .locator('summary[aria-label="Choose running response action"]')
    .click();
  await page.getByRole("menuitem", { name: "Steer" }).click();
  await page.locator(".agent-steering-message").waitFor();
  await composer.fill("Queue the follow-up.");
  await page.getByRole("button", { name: "Queue", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".agent-turn").length >= 2,
  );
  const queuedTurnCount = await page.locator(".agent-turn").count();
  const steeredVisible =
    (await page.locator(".agent-steering-message").count()) === 1;
  await page.evaluate(
    ({ queuedTurnCount, steeredVisible }) => {
      window.__SVARD_AGENT_RUNNING_INPUT_CHECK__ = {
        queuedTurnCount,
        steeredVisible,
      };
    },
    { queuedTurnCount, steeredVisible },
  );
}

export async function recordAgentChangeReviewScenario({ page }) {
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.locator('[data-review-id="source-control-panel"]').waitFor();
  const chatMaintained =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 1;
  const fivePaths =
    (await page.locator(".agent-changed-files li").count()) === 5;
  await page.evaluate(
    ({ chatMaintained, fivePaths }) => {
      window.__SVARD_AGENT_CHANGE_REVIEW_CHECK__ = {
        chatMaintained,
        fivePaths,
      };
    },
    { chatMaintained, fivePaths },
  );
}

export function shouldRestoreAgentViewport(scenario) {
  return [
    "viewer-agent-chat-image-input",
    "viewer-agent-chat-openui-exploration",
    "viewer-agent-chat-output-hygiene",
    "viewer-agent-chat-markdown-answer",
    "viewer-agent-chat-conversation-usability",
    "viewer-agent-chat-running-input-control",
    "viewer-agent-chat-change-review",
    "viewer-agent-chat-media-context",
    "viewer-agent-chat-workspace-isolation",
    "viewer-agent-chat-main-bottom-dock",
    "viewer-agent-chat-composer-access",
  ].includes(scenario);
}

export function usesResponsiveAgentViewport(scenario) {
  return [
    "viewer-agent-chat-image-input",
    "viewer-agent-chat-openui-exploration",
    "viewer-agent-chat-activity",
    "viewer-agent-chat-output-hygiene",
    "viewer-agent-chat-markdown-answer",
    "viewer-agent-chat-conversation-usability",
    "viewer-agent-chat-running-input-control",
    "viewer-agent-chat-change-review",
    "viewer-agent-chat-selection",
    "viewer-agent-chat-selection-image",
    "viewer-agent-chat-media-context",
    "viewer-agent-chat-active-file",
    "viewer-agent-chat-session-management",
    "viewer-agent-chat-workspace-isolation",
    "viewer-agent-chat-main-bottom-dock",
    "viewer-agent-chat-dark-theme",
    "viewer-agent-chat-composer-access",
  ].includes(scenario);
}

export function isAgentChatScenario(scenario) {
  return [
    "viewer-agent-chat-streaming",
    "viewer-agent-chat-approval",
    "viewer-agent-chat-openui",
    "viewer-agent-chat-openui-exploration",
    "viewer-agent-chat-image-input",
    "viewer-agent-chat-activity",
    "viewer-agent-chat-output-hygiene",
    "viewer-agent-chat-markdown-answer",
    "viewer-agent-chat-conversation-usability",
    "viewer-agent-chat-running-input-control",
    "viewer-agent-chat-change-review",
    "viewer-agent-chat-selection",
    "viewer-agent-chat-selection-image",
    "viewer-agent-chat-media-context",
    "viewer-agent-chat-active-file",
    "viewer-agent-chat-session-management",
    "viewer-agent-chat-workspace-isolation",
    "viewer-agent-chat-main-bottom-dock",
    "viewer-agent-chat-dark-theme",
    "viewer-agent-chat-composer-access",
  ].includes(scenario);
}
