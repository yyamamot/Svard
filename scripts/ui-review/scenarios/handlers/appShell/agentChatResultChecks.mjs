export async function collectAgentChatResultChecks({ page, scenario }) {
  const reasoningVisible =
    (await page.locator(".agent-work-summary").count()) >= 1;
  const toolVisible = (await page.locator(".agent-activity").count()) >= 1;
  const activityFailureVisible =
    scenario !== "viewer-agent-chat-activity" ||
    (await page.locator(".agent-activity.failed").count()) === 1;
  const emptyActivityHidden =
    scenario !== "viewer-agent-chat-activity" ||
    (await page
      .locator('.agent-activity[data-activity-category="command"]')
      .count()) === 1;
  let groupedReadActivity = true;
  if (scenario === "viewer-agent-chat-activity") {
    await page.locator(".agent-work-summary > summary").click();
    groupedReadActivity =
      (await page
        .locator('.agent-activity[data-activity-category="read"]')
        .count()) === 1 &&
      (await page
        .locator('.agent-activity[data-activity-category="read"]')
        .getByText("2 operations")
        .count()) === 1;
  }
  const approvalResolved =
    scenario !== "viewer-agent-chat-approval" ||
    (await page.getByRole("button", { name: "Allow once" }).count()) === 0;
  const limitDiagnosticScenario =
    scenario === "viewer-agent-chat-openui-limit-diagnostics";
  const openUiVisible = limitDiagnosticScenario
    ? (await page
        .locator('[data-review-id="agent-openui-fallback"]')
        .count()) >= 1
    : (scenario !== "viewer-agent-chat-openui" &&
        scenario !== "viewer-agent-chat-openui-exploration" &&
        scenario !== "viewer-agent-chat-openui-basic-review" &&
        scenario !== "viewer-agent-chat-openui-basic-gallery" &&
        scenario !== "viewer-agent-chat-openui-basic-balanced" &&
        scenario !== "viewer-agent-chat-openui-basic-lean" &&
        scenario !== "viewer-agent-chat-openui-component-challengers" &&
        scenario !== "viewer-agent-chat-output-hygiene") ||
      (await page
        .locator('[data-review-id="agent-openui-response"]')
        .count()) >= 1;
  let openUiLimitDiagnosticsVisible = true;
  if (limitDiagnosticScenario) {
    const fallback = page
      .locator('[data-review-id="agent-openui-fallback"]')
      .last();
    await fallback.locator("summary").click();
    const fallbackText = await fallback.innerText();
    openUiLimitDiagnosticsVisible =
      (await fallback
        .locator('[data-openui-failure="complexityLimit"]')
        .count()) === 1 &&
      ["Limit", "Generated", "Allowed", "Table rows", "101", "100"].every(
        (text) => fallbackText.includes(text),
      ) &&
      !fallbackText.includes("root = SvardExperience") &&
      !fallbackText.toLowerCase().includes("parser");
  }
  let openUiEvaluationVisible = true;
  if (
    scenario === "viewer-agent-chat-openui-basic-review" ||
    scenario === "viewer-agent-chat-openui-basic-gallery" ||
    scenario === "viewer-agent-chat-openui-basic-balanced" ||
    scenario === "viewer-agent-chat-openui-basic-lean" ||
    scenario === "viewer-agent-chat-openui-component-challengers"
  ) {
    const answer = page
      .locator('[data-review-id="agent-openui-response"]')
      .last();
    const answerText = await answer.innerText();
    const expectedText = {
      "viewer-agent-chat-openui-basic-review": [
        "Document review brief",
        "Review scope",
        "Review targets",
        "Compare omitted components",
      ],
      "viewer-agent-chat-openui-basic-gallery": [
        "Basic profile gallery",
        "Review-oriented building blocks",
        "Review coverage",
        "Check profile coverage",
      ],
      "viewer-agent-chat-openui-basic-balanced": [
        "Balanced profile",
        "Document review result",
        "Selected schema only",
        "Prepare real Codex evaluation",
      ],
      "viewer-agent-chat-openui-basic-lean": [
        "Lean profile",
        "Document review result",
        "Selected schema only",
        "Review the lean replacements",
      ],
      "viewer-agent-chat-openui-component-challengers": [
        "Component challengers",
        "Apply filter",
        "Document relationships",
        "Gallery layout",
      ],
    };
    const profileComparison =
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean";
    openUiEvaluationVisible =
      expectedText[scenario].every((text) => answerText.includes(text)) &&
      (await page
        .locator('[data-review-id="agent-openui-fallback"]')
        .count()) === 0 &&
      (!profileComparison ||
        (await page
          .getByRole("button", { name: "Context unavailable" })
          .count()) === 1);
  }
  let explorationInteraction = true;
  if (scenario === "viewer-agent-chat-openui-exploration") {
    await page.locator('[data-review-id="agent-openui-grid"]').waitFor();
    await page.locator('[data-review-id="agent-openui-file-list"]').waitFor();
    const action = page
      .locator('[data-review-id="agent-openui-action"]')
      .first();
    await action.click();
    await page.waitForFunction(
      () => document.querySelectorAll(".agent-user-message").length >= 2,
    );
    explorationInteraction =
      (await page.locator(".agent-user-message").count()) >= 2;
  }
  if (scenario === "viewer-agent-chat-output-hygiene") {
    const panelText = await page
      .locator('[data-review-id="agent-panel"]')
      .innerText();
    const emptyDetails = await page
      .locator(
        ".agent-activity-detail:not(:has(strong)):not(:has(pre)):not(:has(small))",
      )
      .count();
    await page.evaluate(
      ({ emptyDetails, panelText }) => {
        window.__SVARD_AGENT_OUTPUT_HYGIENE_CHECK__ = {
          emptyDetails,
          hasInternalMemory: panelText.includes("MEMORY.md"),
          hasOpenUiRoot: panelText.includes("root ="),
          hasZeroDuration: panelText.includes("0 ms"),
          workspaceReadVisible:
            document.querySelectorAll(
              '.agent-activity[data-activity-category="read"]',
            ).length >= 1,
        };
      },
      { emptyDetails, panelText },
    );
  }
  let markdownAnswerVisible = true;
  let externalLinkConfirmationVisible = true;
  if (scenario === "viewer-agent-chat-markdown-answer") {
    const answer = page.locator(".agent-markdown-answer").last();
    await answer.locator("code").filter({ hasText: "docs/guide.md" }).waitFor();
    markdownAnswerVisible =
      (await answer.locator("strong").count()) >= 1 &&
      (await answer.locator("table").count()) === 1 &&
      (await answer.locator("pre code").count()) === 1;
    await answer
      .getByRole("link", { name: "Open external documentation" })
      .click();
    externalLinkConfirmationVisible =
      (await page
        .locator('[data-review-id="external-link-confirmation-dialog"]')
        .count()) === 1;
    await page.getByRole("button", { name: "Cancel" }).click();
  }
  return {
    activityFailureVisible,
    approvalResolved,
    emptyActivityHidden,
    explorationInteraction,
    externalLinkConfirmationVisible,
    groupedReadActivity,
    markdownAnswerVisible,
    openUiEvaluationVisible,
    openUiLimitDiagnosticsVisible,
    openUiVisible,
    reasoningVisible,
    toolVisible,
  };
}
