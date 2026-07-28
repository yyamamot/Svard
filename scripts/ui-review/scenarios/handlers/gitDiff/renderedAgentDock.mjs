import { sampleDiffAgentDockLayout } from "./renderedCoreHelpers.mjs";

export async function exerciseRenderedDiffAgentDock(page) {
  const toggle = page.locator('[data-review-id="git-diff-agent-toggle"]');
  await toggle.click();
  const dock = page.locator('[data-review-id="git-diff-agent-dock"]');
  await dock.waitFor();
  const composer = dock.locator("textarea");
  const draft = "この変更が周辺の仕様へ与える影響を説明してください";
  await composer.fill(draft);

  const heightBefore = (await dock.boundingBox())?.height ?? 0;
  const resizer = dock.locator(
    '[data-review-id="git-diff-agent-dock-resizer"]',
  );
  await resizer.focus();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(50);
  const heightAfter = (await dock.boundingBox())?.height ?? 0;

  await page.getByRole("button", { name: "Next change" }).click();
  const draftAfterNext = await composer.inputValue();
  await page.getByRole("button", { name: "Previous change" }).click();

  await dock.getByRole("button", { name: "Hide AI Chat" }).click();
  await dock.waitFor({ state: "detached" });
  await toggle.click();
  await dock.waitFor();
  const draftAfterShow = await dock.locator("textarea").inputValue();

  await page.locator('[data-review-id="git-diff-preview-close"]').click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  const mainPanel = page.locator('[data-review-id="agent-panel"]');
  await mainPanel.waitFor();
  const draftInMainPanel = await mainPanel.locator("textarea").inputValue();

  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  await page.locator('[data-review-id="git-diff-agent-dock"]').waitFor();
  const diffPane = page.locator(
    '[data-review-id="git-rendered-left-pane"], [data-review-id="git-full-preview-left-pane"]',
  );
  await diffPane.waitFor();
  const draftAfterReopen = await page
    .locator('[data-review-id="git-diff-agent-dock"] textarea')
    .inputValue();
  const regularLayout = await sampleDiffAgentDockLayout(page);

  await page.setViewportSize({ width: 960, height: 640 });
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("theme.toggle"),
  );
  await page.locator(".app-shell.theme-dark").waitFor();
  await diffPane.waitFor();
  const compactDarkLayout = await sampleDiffAgentDockLayout(page);
  await page.setViewportSize({ width: 1280, height: 840 });
  await diffPane.waitFor();

  const result = {
    compactDarkLayout,
    dockVisible: true,
    draftPreserved:
      draftAfterNext === draft &&
      draftAfterShow === draft &&
      draftInMainPanel === draft &&
      draftAfterReopen === draft,
    resized: heightAfter > heightBefore,
    regularLayout,
    togglePressed: (await toggle.getAttribute("aria-pressed")) === "true",
  };
  const layouts = [regularLayout, compactDarkLayout];
  if (
    !result.draftPreserved ||
    !result.resized ||
    !result.togglePressed ||
    layouts.some(
      (layout) =>
        !layout.composerInsideDock ||
        !layout.diffEndReachable ||
        !layout.dockBelowToolbar ||
        !layout.panesVisible ||
        layout.resizerHitTarget < 24 ||
        !layout.toolbarInsideViewport,
    )
  ) {
    throw new Error(`Diff Agent dock layout failed: ${JSON.stringify(result)}`);
  }
  await page.evaluate((result) => {
    window.__SVARD_DIFF_AGENT_DOCK_CHECK__ = result;
  }, result);
}
