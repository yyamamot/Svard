export async function runAgentSessionManagementScenario({ page }) {
  await page.getByRole("button", { name: "Open chat history" }).click();
  const initialHistory = page.locator(
    '[data-review-id="agent-session-history"]',
  );
  await initialHistory.waitFor();
  await initialHistory
    .getByText("Explain how the focused files are", { exact: true })
    .waitFor();
  const automaticTitleVisible = true;
  const searchControlsHidden =
    (await initialHistory
      .locator(
        '[aria-label="Search chat names"], [aria-label="Filter chats by update date"]',
      )
      .count()) === 0;
  await initialHistory
    .getByRole("button", { name: "Close chat history" })
    .click();
  await page.getByRole("button", { name: "Start new chat" }).click();
  await page.getByRole("button", { name: "Open chat history" }).click();
  const history = page.locator('[data-review-id="agent-session-history"]');
  await history.waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".agent-session-item").length === 2,
  );
  let previous = history
    .locator(".agent-session-item")
    .filter({ hasNotText: "Current chat" });
  await previous.getByRole("button", { name: /^Rename /u }).click();
  await previous
    .getByRole("textbox", { name: "Chat name" })
    .fill("Document review");
  await previous.getByRole("button", { name: "Save chat name" }).click();
  await history.getByText("Document review", { exact: true }).waitFor();
  previous = history
    .locator(".agent-session-item")
    .filter({ hasText: "Document review" });
  await previous
    .getByRole("button", { name: "Archive Document review" })
    .click();
  await history.getByRole("tab", { name: "Archived" }).click();
  await history.getByText("Document review", { exact: true }).waitFor();
  await history
    .getByRole("button", { name: "Restore Document review" })
    .click();
  await history.getByRole("tab", { name: "Recent" }).click();
  await history.getByText("Document review", { exact: true }).waitFor();
  await history
    .locator(".agent-session-item")
    .filter({ hasText: "Document review" })
    .locator(".agent-session-open")
    .click();
  await history.waitFor({ state: "detached" });
  await page.locator(".agent-turn").first().waitFor();
  const restoredAnswer = page
    .locator('[data-review-id="agent-openui-response"]')
    .first();
  const readOnlyHistory =
    (await restoredAnswer.getAttribute("data-read-only")) === "true" &&
    (await restoredAnswer
      .locator('[data-review-id="agent-openui-action"]:enabled')
      .count()) === 0 &&
    (await page.locator(".agent-restored-context-note").count()) === 0 &&
    !(await page
      .locator('[data-review-id="agent-panel"]')
      .innerText()
      .then((text) => text.includes("root = SvardExperience")));
  await page.getByRole("button", { name: "Open chat history" }).click();
  await history.waitFor();
  const currentNamed =
    (await history
      .locator(".agent-session-item")
      .filter({ hasText: "Document review" })
      .filter({ hasText: "Current chat" })
      .count()) === 1;
  const inactive = history
    .locator(".agent-session-item")
    .filter({ hasNotText: "Current chat" });
  await inactive.getByRole("button", { name: /^Delete /u }).click();
  const deleteConfirmation =
    (await history.getByText("Delete this chat permanently?").count()) === 1;
  await history.getByRole("button", { name: "Cancel" }).click();
  await history.getByRole("button", { name: "Close chat history" }).click();
  await page.evaluate(
    ({
      automaticTitleVisible,
      currentNamed,
      deleteConfirmation,
      readOnlyHistory,
      searchControlsHidden,
    }) => {
      window.__SVARD_AGENT_SESSION_MANAGEMENT_CHECK__ = {
        automaticTitleVisible,
        currentNamed,
        deleteConfirmation,
        readOnlyHistory,
        searchControlsHidden,
      };
    },
    {
      automaticTitleVisible,
      currentNamed,
      deleteConfirmation,
      readOnlyHistory,
      searchControlsHidden,
    },
  );
}
