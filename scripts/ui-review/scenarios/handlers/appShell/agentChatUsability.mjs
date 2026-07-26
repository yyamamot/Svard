export async function runAgentChatUsabilityScenario({ composer, page }) {
  await composer.press("Control+Enter");
  await page.getByRole("region", { name: "Approval required" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Restore input" }).waitFor();
  await page.getByRole("button", { name: "Restore input" }).click();
  const restoredInput =
    (await composer.inputValue()) ===
    "Show the Markdown answer after approval cancellation.";
  await page.evaluate(() => {
    window.__SVARD_AGENT_COPY_VALUES__ = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__SVARD_AGENT_COPY_VALUES__.push(value);
        },
      },
    });
  });
  await composer.press("Meta+Enter");
  await page.getByRole("region", { name: "Approval required" }).waitFor();
  await page.getByRole("button", { name: "Allow once" }).click();
  await page.locator(".agent-final-answer").waitFor();
  await page.getByRole("button", { name: "Copy answer" }).last().click();
  await page.getByRole("button", { name: "Copy code" }).last().click();
  const copiedValues = await page.evaluate(
    () => window.__SVARD_AGENT_COPY_VALUES__ ?? [],
  );
  await composer.fill("Continue the usability stream.");
  await composer.press("Control+Enter");
  await page
    .locator('.agent-turn[data-turn-status="running"]')
    .last()
    .waitFor();
  await page.locator(".agent-conversation").evaluate((conversation) => {
    conversation.scrollTop = 0;
    conversation.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.getByRole("button", { name: "New activity" }).waitFor();
  const newActivityVisible =
    (await page.getByRole("button", { name: "New activity" }).count()) === 1;
  await page.getByRole("button", { name: "New activity" }).click();
  const jumpedToLatest = await page
    .locator(".agent-conversation")
    .evaluate(
      (conversation) =>
        conversation.scrollHeight -
          conversation.scrollTop -
          conversation.clientHeight <=
        96,
    );
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.agent-turn[data-turn-status="completed"]')
        .length >= 2,
  );
  await page.evaluate(
    ({ copiedValues, jumpedToLatest, newActivityVisible, restoredInput }) => {
      window.__SVARD_AGENT_USABILITY_CHECK__ = {
        codeCopied: copiedValues.some((value) =>
          value.includes('const response = "safe";'),
        ),
        markdownCopied: copiedValues.some((value) =>
          value.startsWith("## Workspace answer"),
        ),
        rawDslCopied: copiedValues.some((value) => value.includes("root =")),
        jumpedToLatest,
        newActivityVisible,
        restoredInput,
        turnCount: document.querySelectorAll(".agent-user-message").length,
      };
    },
    { copiedValues, jumpedToLatest, newActivityVisible, restoredInput },
  );
}
