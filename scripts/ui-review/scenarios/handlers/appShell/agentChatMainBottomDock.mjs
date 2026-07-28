export async function recordAgentMainBottomStreamingMove({ composer, page }) {
  await page
    .locator('.agent-turn[data-turn-status="running"]')
    .last()
    .waitFor();
  await composer.fill("配置変更後も保持する日本語の下書き");
  await page.getByRole("button", { name: "Move AI Chat to bottom" }).click();
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
    )
    .waitFor();
  await page.evaluate(() => {
    window.__SVARD_AGENT_MAIN_BOTTOM_STREAMING_CHECK__ = {
      draft:
        document.querySelector(".agent-composer-dock textarea")?.value ?? "",
      running:
        document.querySelectorAll('.agent-turn[data-turn-status="running"]')
          .length === 1,
    };
  });
}

export async function runAgentMainBottomDockScenario({ composer, page }) {
  const split = page.locator('[data-review-id="codex-main-split"]');
  const streamingCheck = await page.evaluate(
    () => window.__SVARD_AGENT_MAIN_BOTTOM_STREAMING_CHECK__,
  );
  const draftPreserved =
    (await composer.inputValue()) === "配置変更後も保持する日本語の下書き";
  const bottomPlacement =
    (await split.getAttribute("data-agent-placement")) === "bottom";
  const rightSidebarHidden =
    (await page.locator('[data-review-id="right-sidebar"]').count()) === 0;

  const panelBeforeResize = await page
    .locator('[data-review-id="agent-panel"]')
    .boundingBox();
  await page.locator(".codex-main-resizer").press("ArrowUp");
  const panelAfterResize = await page
    .locator('[data-review-id="agent-panel"]')
    .boundingBox();
  const resized =
    Boolean(panelBeforeResize && panelAfterResize) &&
    (panelAfterResize?.height ?? 0) > (panelBeforeResize?.height ?? 0);

  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("view.splitRight");
  });
  await page.locator('[data-review-id="viewer-split"]').waitFor();
  const splitViewMaintained = await page.evaluate(() => {
    const viewer = document
      .querySelector('[data-review-id="viewer-split"]')
      ?.getBoundingClientRect();
    const panel = document
      .querySelector('[data-review-id="agent-panel"]')
      ?.getBoundingClientRect();
    return Boolean(
      viewer &&
      panel &&
      panel.top >= viewer.bottom &&
      document.querySelector(".agent-composer-dock textarea")?.value ===
        "配置変更後も保持する日本語の下書き",
    );
  });
  await page.locator('[data-review-id="codex-spike-toggle"]').click();
  await page
    .locator('[data-review-id="agent-panel"]')
    .waitFor({ state: "hidden" });
  await page.locator('[data-review-id="codex-spike-toggle"]').click();
  await page.locator('[data-review-id="agent-panel"]').waitFor();
  const splitReopenMaintained =
    (await composer.inputValue()) === "配置変更後も保持する日本語の下書き" &&
    (await page.locator('[data-review-id="viewer-split"]').count()) === 1;
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("view.closeSplit");
  });
  await page
    .locator('[data-review-id="viewer-split"]')
    .waitFor({ state: "detached" });

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
  const diffDrawerMaintained =
    (await composer.inputValue()) === "配置変更後も保持する日本語の下書き" &&
    (await page
      .getByRole("button", { name: "Move AI Chat to bottom" })
      .count()) === 0 &&
    (await page
      .getByRole("button", { name: "Move AI Chat to right" })
      .count()) === 0;
  await page.getByRole("button", { name: "Close Git diff preview" }).click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="bottom"]',
    )
    .waitFor();
  const bottomRestored =
    (await composer.inputValue()) === "配置変更後も保持する日本語の下書き";

  await page.getByRole("button", { name: "Move AI Chat to right" }).click();
  await page
    .locator(
      '[data-review-id="codex-main-split"][data-agent-placement="right"]',
    )
    .waitFor();
  const rightPlacementMaintained =
    (await composer.inputValue()) === "配置変更後も保持する日本語の下書き";
  await page.getByRole("button", { name: "Move AI Chat to bottom" }).click();

  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
  });
  await page.locator(".app-shell.theme-dark").waitFor();
  const darkThemeMaintained =
    (await composer.inputValue()) === "配置変更後も保持する日本語の下書き";

  await page.setViewportSize({ width: 960, height: 640 });
  const compactLayoutValid = await page.evaluate(() => {
    const viewer = document
      .querySelector(".codex-document-pane")
      ?.getBoundingClientRect();
    const panel = document
      .querySelector('[data-review-id="agent-panel"]')
      ?.getBoundingClientRect();
    const composerDock = document
      .querySelector(".agent-composer-dock")
      ?.getBoundingClientRect();
    return Boolean(
      viewer &&
      panel &&
      composerDock &&
      viewer.bottom <= panel.top &&
      Math.abs(panel.bottom - composerDock.bottom) <= 4,
    );
  });
  await page.setViewportSize({ width: 1280, height: 840 });

  await page.evaluate(
    (result) => {
      window.__SVARD_AGENT_MAIN_BOTTOM_DOCK_CHECK__ = result;
    },
    {
      bottomPlacement,
      bottomRestored,
      compactLayoutValid,
      darkThemeMaintained,
      diffDrawerMaintained,
      draftPreserved,
      resized,
      rightPlacementMaintained,
      rightSidebarHidden,
      splitViewMaintained,
      splitReopenMaintained,
      streamingMoveMaintained:
        streamingCheck?.running === true &&
        streamingCheck?.draft === "配置変更後も保持する日本語の下書き",
    },
  );
}
