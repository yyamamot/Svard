const markerScenarios = new Set([
  "viewer-normal-git-markers-initial-working-tree-opt-in",
  "viewer-normal-git-markers-after-diff-opt-in",
  "viewer-normal-git-markers-disabled",
  "viewer-normal-git-markers-no-prior-diff",
  "viewer-normal-git-markers-context-clear",
  "viewer-normal-git-markers-privacy",
  "viewer-normal-git-markers-list-item-initial-working-tree",
  "viewer-normal-git-markers-list-item-after-diff",
  "viewer-normal-git-markers-list-item-deletion-fallback",
  "viewer-normal-git-markers-list-item-privacy",
]);

async function enablePostDiffGitMarkers(page) {
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("preferences.open"),
  );
  await page.locator('[data-review-id="preferences-tab-general"]').waitFor();
  await page
    .locator('[data-review-id="general-post-diff-git-markers-control"]')
    .check();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("preferences.close"),
  );
}

async function openDiffAndClose(page) {
  await page
    .locator(
      '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-markdown.md"]',
    )
    .click();
  await page
    .locator('[data-review-id="document-body"]')
    .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
    .waitFor();
  await page.evaluate(() => window.__SVARD_COMMANDS__?.dispatch("git.showDiff"));
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-review-id="git-full-preview-block"]')
        .length > 0,
  );
  await page.locator('[data-review-id="git-diff-preview-close"]').click();
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor({
    state: "detached",
  });
}

async function markerSummary(page, extra = {}) {
  return page.evaluate((extraPayload) => {
    const markerRoot = document.querySelector(
      '[data-review-id="post-diff-git-markers"]',
    );
    const markers = Array.from(
      document.querySelectorAll('[data-review-id="post-diff-git-marker"]'),
    );
    const inlineAddedCount = document.querySelectorAll(
      ".document-body .git-inline-word-highlight.added",
    ).length;
    const inlineRemovedCount = document.querySelectorAll(
      ".document-body .git-inline-word-highlight.removed",
    ).length;
    const itemHighlightCount = document.querySelectorAll(
      ".document-body .post-diff-git-highlight-list-item",
    ).length;
    const blockHighlightCount =
      document.querySelectorAll(".document-body .post-diff-git-highlight")
        .length - itemHighlightCount;
    const summary = {
      documentBasename: "git-rendered-markdown.md",
      markerCount: Number(markerRoot?.getAttribute("data-marker-count") ?? 0),
      renderedMarkerCount: markers.length,
      blockHighlightCount,
      itemHighlightCount,
      inlineAddedCount,
      inlineRemovedCount,
      visible: Boolean(markerRoot),
      kinds: markers.map((marker) => marker.getAttribute("data-marker-kind")),
      ...extraPayload,
    };
    window.__SVARD_POST_DIFF_MARKER_SUMMARY__ = summary;
    return summary;
  }, extra);
}

export async function applyGitDiffPostDiffMarkersScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (!markerScenarios.has(scenario)) {
    return false;
  }

  if (scenario !== "viewer-normal-git-markers-disabled") {
    await enablePostDiffGitMarkers(page);
  }

  if (
    scenario === "viewer-normal-git-markers-initial-working-tree-opt-in" ||
    scenario === "viewer-normal-git-markers-list-item-initial-working-tree"
  ) {
    await page
      .locator(
        '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-markdown.md"]',
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page.locator('[data-review-id="post-diff-git-marker"]').first().waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-review-id="git-diff-preview-panel"]') ===
          null &&
        document.querySelectorAll(".document-body .post-diff-git-highlight")
          .length > 0 &&
        document.querySelectorAll(
          ".document-body .git-inline-word-highlight.added",
        ).length > 0,
    );
    await page.locator('[data-review-id="post-diff-git-marker"]').first().click();
    await markerSummary(page, {
      initialWorkingTree: true,
      clickResult: true,
      listItemMarker:
        scenario === "viewer-normal-git-markers-list-item-initial-working-tree",
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-no-prior-diff") {
    await page.locator("text=git-clean.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Diff Clean Fixture" })
      .waitFor();
    await markerSummary(page, {
      documentBasename: "git-clean.md",
      noPriorDiff: true,
      cleanWorkingTree: true,
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-list-item-deletion-fallback") {
    await page
      .locator(
        '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-list-deletion.md"]',
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered List Deletion Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-preview-close"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor({
      state: "detached",
    });
    await page.locator('[data-review-id="post-diff-git-marker"]').first().waitFor();
    await markerSummary(page, {
      documentBasename: "git-rendered-list-deletion.md",
      deletionFallback: true,
    });
    return true;
  }

  await openDiffAndClose(page);

  if (
    scenario === "viewer-normal-git-markers-after-diff-opt-in" ||
    scenario === "viewer-normal-git-markers-privacy" ||
    scenario === "viewer-normal-git-markers-list-item-after-diff" ||
    scenario === "viewer-normal-git-markers-list-item-privacy"
  ) {
    await page.locator('[data-review-id="post-diff-git-marker"]').first().waitFor();
    await page.locator('[data-review-id="post-diff-git-marker"]').first().click();
    await markerSummary(page, {
      clickResult: true,
      listItemMarker:
        scenario === "viewer-normal-git-markers-list-item-after-diff" ||
        scenario === "viewer-normal-git-markers-list-item-privacy",
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-context-clear") {
    await page.locator('[data-review-id="post-diff-git-marker"]').first().waitFor();
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/mvp-guide.adoc"]',
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Svard MVP Guide" })
      .waitFor();
    await page
      .locator('[data-review-id="post-diff-git-markers"]')
      .waitFor({ state: "detached" });
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/git-rendered-markdown.md"]',
      )
      .click();
    await page.locator('[data-review-id="post-diff-git-marker"]').first().waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".document-body .post-diff-git-highlight")
          .length > 0 &&
        document.querySelectorAll(
          ".document-body .git-inline-word-highlight.added",
        ).length > 0,
    );
    await markerSummary(page, {
      hiddenOnOtherDocument: true,
      restoredAfterReturn: true,
    });
    return true;
  }

  await markerSummary(page, { disabled: true });
  return true;
}
