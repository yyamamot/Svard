export async function runAgentWorkspaceIsolationScenario({ composer, page }) {
  const initialTurnCount = await page.locator(".agent-turn").count();
  await composer.fill("Draft that belongs to the first workspace.");
  await page.evaluate(() => {
    window.__SVARD_PICK_DIRECTORY__ = "/workspace-b";
    window.__SVARD_DIRECTORY_ENTRIES__ = {
      ...(window.__SVARD_DIRECTORY_ENTRIES__ ?? {}),
      "/workspace-b": [
        {
          name: "notes",
          path: "/workspace-b/notes",
          kind: "directory",
        },
      ],
    };
  });
  await page.getByRole("button", { name: "Open file or folder" }).click();
  await page.getByRole("menuitem", { name: "Open Folder..." }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-review-id="tree-root"]')
        ?.getAttribute("title") === "/workspace-b",
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".agent-turn").length === 0 &&
      document
        .querySelector(".agent-action-notice")
        ?.textContent?.includes("Workspace changed"),
  );

  const draftCleared = (await composer.inputValue()) === "";
  const panelMaintained =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 1;
  const oldConversationCleared =
    initialTurnCount > 0 && (await page.locator(".agent-turn").count()) === 0;
  await composer.fill("新しいワークスペースについて説明してください。");
  await composer.press("Meta+Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.agent-turn[data-turn-status="completed"]')
        .length === 1,
  );
  const newConversationStarted =
    (await page.locator(".agent-turn").count()) === 1 &&
    (await page
      .locator(".agent-user-message")
      .filter({ hasText: "新しいワークスペース" })
      .count()) === 1;
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
  });
  await page.locator(".app-shell.theme-dark").waitFor();
  const darkThemeMaintained =
    (await page.locator('[data-review-id="agent-panel"]').count()) === 1 &&
    (await page.locator(".agent-turn").count()) === 1;
  await page.evaluate(
    ({
      darkThemeMaintained,
      draftCleared,
      newConversationStarted,
      oldConversationCleared,
      panelMaintained,
    }) => {
      window.__SVARD_AGENT_WORKSPACE_ISOLATION_CHECK__ = {
        darkThemeMaintained,
        draftCleared,
        newConversationStarted,
        oldConversationCleared,
        panelMaintained,
      };
    },
    {
      darkThemeMaintained,
      draftCleared,
      newConversationStarted,
      oldConversationCleared,
      panelMaintained,
    },
  );
}
