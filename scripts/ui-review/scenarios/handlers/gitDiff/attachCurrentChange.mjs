export async function exerciseAttachCurrentChange(page) {
  await page.setViewportSize({ width: 1280, height: 840 });
  const allDiffsToolbarActionRemoved =
    (await page
      .locator('[data-review-id="diff-stream-attach-current-change"]')
      .count()) === 0;
  const rightClickedSection = page
    .locator('[data-review-id="diff-stream-file-section"]')
    .nth(1);
  const rightClickedChange = rightClickedSection
    .locator(
      [
        ".git-rendered-block.change-target[data-change-index]",
        ".git-rendered-list-item-change[data-change-index]",
        ".git-rendered-structured-child-change[data-change-index]",
        ".git-rendered-table-row-change[data-change-index]",
      ].join(","),
    )
    .first();
  const rightClickedPoint = await rightClickVisibleChange(
    page,
    rightClickedChange,
    "All Diffs",
  );
  const contextMenu = page.locator('[data-review-id="context-menu"]');
  try {
    await contextMenu.waitFor({ timeout: 2_000 });
  } catch {
    throw new Error(
      `All Diffs context menu did not open: ${JSON.stringify(rightClickedPoint)}`,
    );
  }
  const attachFromContextMenu = contextMenu.getByRole("menuitem", {
    name: "Attach current change",
  });
  if ((await attachFromContextMenu.count()) === 0) {
    const menuLabels = await contextMenu
      .getByRole("menuitem")
      .allTextContents();
    const targetState = await rightClickedChange.evaluate((element) => ({
      changeIndex: element.getAttribute("data-change-index"),
      className: element.className,
      streamIndex: element
        .closest("[data-stream-index]")
        ?.getAttribute("data-stream-index"),
    }));
    throw new Error(
      `Attach current change was absent: ${JSON.stringify({ menuLabels, targetState })}`,
    );
  }
  await attachFromContextMenu.click();
  await rightClickedSection
    .locator('[data-active-change="true"][data-change-index]')
    .first()
    .waitFor();
  const dock = page.locator('[data-review-id="git-diff-agent-dock"]');
  await dock.waitFor();
  const card = dock.locator(
    '[data-review-id="agent-current-change-attachment"]',
  );
  await card.waitFor();
  await card.locator("summary").click();
  const questionBlank = (await dock.locator("textarea").inputValue()) === "";
  const beforeVisible = (await card.getByText(/^Before/u).count()) > 0;
  const afterVisible = (await card.getByText(/^After/u).count()) > 0;
  const snapshotBeforeNavigation = await card.locator("pre").allTextContents();
  const draft = "この変更が周辺の仕様へ与える影響を説明してください";
  await dock.locator("textarea").fill(draft);
  await page
    .locator(".diff-stream-toolbar")
    .getByRole("button", { name: "Next", exact: true })
    .click();
  const snapshotAfterNavigation = await card.locator("pre").allTextContents();
  await card.getByRole("button", { name: "Return to current change" }).click();
  await page
    .locator(
      '.diff-stream-rendered-body [data-active-change="true"][data-change-index]',
    )
    .first()
    .waitFor();

  const sampleLayout = async () =>
    page.evaluate(() => {
      const toolbar = document.querySelector(".diff-stream-toolbar");
      const card = document.querySelector(
        '[data-review-id="agent-current-change-attachment"]',
      );
      const composer = document.querySelector(
        '[data-review-id="git-diff-agent-dock"] textarea',
      );
      const viewport = { height: window.innerHeight, width: window.innerWidth };
      const toolbarRect = toolbar?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      const composerRect = composer?.getBoundingClientRect();
      return {
        cardVisible:
          Boolean(cardRect) &&
          (cardRect?.width ?? 0) > 0 &&
          (cardRect?.height ?? 0) > 0,
        composerInsideViewport:
          Boolean(composerRect) &&
          (composerRect?.left ?? -1) >= 0 &&
          (composerRect?.right ?? viewport.width + 1) <= viewport.width,
        themeDark: document.querySelector(".app-shell.theme-dark") !== null,
        toolbarInsideViewport:
          Boolean(toolbarRect) &&
          (toolbarRect?.left ?? -1) >= 0 &&
          (toolbarRect?.right ?? viewport.width + 1) <= viewport.width,
        viewport,
      };
    });
  const regularLayout = await sampleLayout();
  await page.setViewportSize({ width: 960, height: 640 });
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("theme.toggle"),
  );
  await page.locator(".app-shell.theme-dark").waitFor();
  const compactDarkLayout = await sampleLayout();
  await page.setViewportSize({ width: 1280, height: 840 });

  const result = {
    afterVisible,
    beforeVisible,
    compactDarkLayout,
    draftPreserved: (await dock.locator("textarea").inputValue()) === draft,
    immutable:
      snapshotBeforeNavigation.join("\n") ===
      snapshotAfterNavigation.join("\n"),
    overlayMaintained: true,
    questionBlank,
    regularLayout,
  };
  await card.getByRole("button", { name: "Remove current change" }).click();
  await page.getByRole("button", { name: "Close all diffs" }).click();
  await page
    .locator('[data-review-id="source-control-change-item"]')
    .filter({ hasText: "git-modified.md" })
    .click();
  const singleDiff = page.locator('[data-review-id="git-diff-preview-panel"]');
  await singleDiff.waitFor();
  await singleDiff
    .locator('[data-review-id="git-diff-full-preview-view"]')
    .click();
  const singleToolbarActionRemoved =
    (await singleDiff
      .locator('[data-review-id="git-diff-attach-current-change"]')
      .count()) === 0;
  const singleRightClickedChange = singleDiff
    .locator(
      [
        ".git-rendered-block.change-target[data-change-index]",
        ".git-rendered-list-item-change[data-change-index]",
        ".git-rendered-structured-child-change[data-change-index]",
        ".git-rendered-table-row-change[data-change-index]",
      ].join(","),
    )
    .first();
  await rightClickVisibleChange(page, singleRightClickedChange, "Single Diff");
  await page
    .locator('[data-review-id="context-menu"]')
    .getByRole("menuitem", { name: "Attach current change" })
    .click();
  const singleCard = singleDiff.locator(
    '[data-review-id="agent-current-change-attachment"]',
  );
  await singleCard.waitFor();
  await singleCard.locator("summary").click();
  const singleBeforeVisible =
    (await singleCard.getByText(/^Before/u).count()) > 0;
  const singleAfterVisible =
    (await singleCard.getByText(/^After/u).count()) > 0;
  const singleDraftPreserved =
    (await singleDiff.locator("textarea").inputValue()) === draft;
  await singleCard
    .getByRole("button", { name: "Return to current change" })
    .click();
  await singleDiff
    .locator('[data-active-change="true"][data-change-index]')
    .first()
    .waitFor();
  await singleDiff.locator('[data-review-id="git-diff-preview-close"]').click();
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  const restoredDock = page.locator(
    '[data-review-id="source-control-all-diffs-panel"] [data-review-id="git-diff-agent-dock"]',
  );
  await restoredDock.waitFor();
  const restoredCard = restoredDock.locator(
    '[data-review-id="agent-current-change-attachment"]',
  );
  await restoredCard.waitFor();
  await restoredCard.locator("summary").click();
  result.allDiffsRestored = true;
  result.allDiffsContextMenu = true;
  result.singleAfterVisible = singleAfterVisible;
  result.singleBeforeVisible = singleBeforeVisible;
  result.singleContextMenu = true;
  result.singleDiffAttached = true;
  result.singleDraftPreserved = singleDraftPreserved;
  result.toolbarRemoved =
    allDiffsToolbarActionRemoved && singleToolbarActionRemoved;
  if (
    !result.beforeVisible ||
    !result.afterVisible ||
    !result.draftPreserved ||
    !result.immutable ||
    !result.questionBlank ||
    !regularLayout.cardVisible ||
    !regularLayout.composerInsideViewport ||
    !regularLayout.toolbarInsideViewport ||
    !compactDarkLayout.cardVisible ||
    !compactDarkLayout.composerInsideViewport ||
    !compactDarkLayout.toolbarInsideViewport ||
    !result.allDiffsRestored ||
    !result.allDiffsContextMenu ||
    !result.singleAfterVisible ||
    !result.singleBeforeVisible ||
    !result.singleContextMenu ||
    !result.singleDiffAttached ||
    !result.singleDraftPreserved ||
    !result.toolbarRemoved
  ) {
    throw new Error(
      `Attach current change scenario failed: ${JSON.stringify(result)}`,
    );
  }
  await page.evaluate((result) => {
    window.__SVARD_ATTACH_CURRENT_CHANGE_CHECK__ = result;
  }, result);
}

async function rightClickVisibleChange(page, change, label) {
  await change.scrollIntoViewIfNeeded();
  const point = await change.evaluate((element) => {
    const candidate =
      element.querySelector("p, li, td, th, dt, dd, pre, span") ?? element;
    const rect = candidate.getBoundingClientRect();
    const x = Math.max(
      1,
      Math.min(window.innerWidth - 1, rect.left + Math.min(24, rect.width / 2)),
    );
    const y = Math.max(
      1,
      Math.min(
        window.innerHeight - 1,
        rect.top + Math.min(16, rect.height / 2),
      ),
    );
    const hit = document.elementFromPoint(x, y);
    return {
      hitChangeIndex:
        hit
          ?.closest("[data-change-index]")
          ?.getAttribute("data-change-index") ?? null,
      hitClass: hit?.className ?? null,
      hitTag: hit?.tagName ?? null,
      x,
      y,
    };
  });
  if (!point) throw new Error(`${label} change was not visible`);
  await page.mouse.click(point.x, point.y, { button: "right" });
  return point;
}
