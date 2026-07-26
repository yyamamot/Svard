import {
  enablePostDiffGitMarkers,
  markerScenarios,
  pressRevisionLensMarker,
  selectDetailedChangeReviewDisplay,
  selectSubtleChangeReviewDisplay,
} from "./postDiffMarkerControls.mjs";

async function runRevisionLensScenario(page) {
  await page
    .locator(
      '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-markdown.md"]',
    )
    .click();
  await page
    .locator(
      '[data-review-id="post-diff-git-markers"][data-display-mode="subtle"]',
    )
    .waitFor();
  const subtleMarker = page
    .locator('[data-review-id="post-diff-git-marker"]')
    .first();
  await subtleMarker.waitFor();
  await pressRevisionLensMarker(page, subtleMarker, "base");
  const subtlePressRevealSucceeded = true;
  await pressRevisionLensMarker(page, subtleMarker, "base");

  await selectDetailedChangeReviewDisplay(page);
  await page
    .locator(
      '[data-review-id="post-diff-git-markers"][data-display-mode="detailed"]',
    )
    .waitFor();
  const detailedMarker = page
    .locator('[data-review-id="post-diff-git-marker"]')
    .first();
  await detailedMarker.waitFor();
  await pressRevisionLensMarker(page, detailedMarker, "base");
  const detailedBaseVisible = true;

  await page
    .locator(
      '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-list-deletion.md"]',
    )
    .click();
  const removedMarker = page.locator(
    '[data-review-id="post-diff-git-marker"][data-marker-kind="removed"]',
  );
  await removedMarker.first().waitFor();
  await pressRevisionLensMarker(page, removedMarker.first(), "removed", false);
  const removedMarkerBaseVisible = true;

  await page.evaluate(
    (summary) => {
      window.__SVARD_POST_DIFF_MARKER_SUMMARY__ = summary;
    },
    {
      revisionLens: true,
      targetCount: 1,
      markerPressGesture: true,
      subtlePressRevealSucceeded,
      workingTreeRestoredOnRelease: true,
      repeatRevealSucceeded: true,
      detailedBaseVisible,
      removedMarkerBaseVisible,
      finalCategory: "removed",
      privacySafe: true,
    },
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
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
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
    const tableRowHighlightCount = document.querySelectorAll(
      ".document-body .post-diff-git-highlight-table-row",
    ).length;
    const tableCellHighlightCount = document.querySelectorAll(
      ".document-body .post-diff-git-highlight-table-cell",
    ).length;
    const parentTableHighlightCount = document.querySelectorAll(
      ".document-body table.post-diff-git-highlight",
    ).length;
    const bodyAccentTarget = document.querySelector(
      ".document-body .post-diff-git-highlight:not(.post-diff-git-highlight-table-cell)",
    );
    const blockHighlightCount =
      document.querySelectorAll(".document-body .post-diff-git-highlight")
        .length -
      itemHighlightCount -
      tableCellHighlightCount -
      parentTableHighlightCount;
    const summary = {
      documentBasename: "git-rendered-markdown.md",
      displayMode: markerRoot?.getAttribute("data-display-mode") ?? null,
      longestMarkerRange: Math.max(
        0,
        ...markers.map((marker) =>
          Number.parseFloat(
            marker.style.getPropertyValue("--post-diff-marker-range-height") ||
              "0",
          ),
        ),
      ),
      markerOpacity: markers[0]
        ? Number.parseFloat(
            getComputedStyle(markers[0], "::before").opacity || "0",
          )
        : 0,
      bodyAccentVisible: bodyAccentTarget
        ? getComputedStyle(bodyAccentTarget, "::before").content !== "none"
        : false,
      markerCount: Number(markerRoot?.getAttribute("data-marker-count") ?? 0),
      renderedMarkerCount: markers.length,
      tableCellMarkerCount: Number(
        markerRoot?.getAttribute("data-table-cell-marker-count") ?? 0,
      ),
      tableAddedRowMarkerCount: Number(
        markerRoot?.getAttribute("data-table-added-row-marker-count") ?? 0,
      ),
      tableBlockFallbackCount: Number(
        markerRoot?.getAttribute("data-table-block-fallback-count") ?? 0,
      ),
      tableNotApplicableCount: Number(
        markerRoot?.getAttribute("data-table-not-applicable-count") ?? 0,
      ),
      tableReasonCounts: JSON.parse(
        markerRoot?.getAttribute("data-table-reason-counts") ?? "{}",
      ),
      blockHighlightCount,
      itemHighlightCount,
      tableRowHighlightCount,
      tableCellHighlightCount,
      parentTableHighlightCount,
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

async function openTableFixture(
  page,
  {
    path = "/workspace/docs/git-asciidoc-table.adoc",
    title = "Git AsciiDoc Table Diff Fixture",
  } = {},
) {
  await page
    .locator(`[data-review-id="tree-file"][data-path="${path}"]`)
    .click();
  await page
    .locator('[data-review-id="document-body"]')
    .filter({ hasText: title })
    .waitFor();
}

async function waitForTableMarkers(page) {
  await page
    .locator('[data-review-id="post-diff-git-marker"]')
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-review-id="git-diff-preview-panel"]') ===
        null &&
      document.querySelectorAll(
        ".document-body .post-diff-git-highlight-table-row",
      ).length > 0 &&
      document.querySelectorAll(
        ".document-body .post-diff-git-highlight-table-cell",
      ).length > 0 &&
      document.querySelectorAll(".document-body table.post-diff-git-highlight")
        .length === 0,
  );
}

async function waitForNoTableCellMarkers(page) {
  await page
    .locator('[data-review-id="post-diff-git-marker"]')
    .first()
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-review-id="git-diff-preview-panel"]') ===
        null &&
      document.querySelectorAll(
        ".document-body .post-diff-git-highlight-table-row",
      ).length === 0 &&
      document.querySelectorAll(
        ".document-body .post-diff-git-highlight-table-cell",
      ).length === 0,
  );
}

async function collectTableMarkerSummary(page, extra = {}) {
  await page.locator('[data-review-id="post-diff-git-marker"]').first().click();
  await markerSummary(page, {
    documentBasename: extra.documentBasename ?? "git-asciidoc-table.adoc",
    tableMarker: true,
    clickResult: true,
    ...extra,
  });
}

async function collectGitChangeVisualContractSummary(page, scenario) {
  const isDeletionFallback =
    scenario === "viewer-git-change-visual-contract-deletion-fallback";
  const path = isDeletionFallback
    ? "/workspace/docs/git-rendered-list-deletion.md"
    : "/workspace/docs/git-rendered-markdown.md";
  const title = isDeletionFallback
    ? "Git Rendered List Deletion Fixture"
    : "Git Rendered Markdown Diff Fixture";
  await page
    .locator(`[data-review-id="tree-file"][data-path="${path}"]`)
    .click();
  await page
    .locator('[data-review-id="document-body"]')
    .filter({ hasText: title })
    .waitFor();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();

  let rendered = null;
  if (!isDeletionFallback) {
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-review-id="git-rendered-block"]')
          .length > 0,
    );
    rendered = await page.evaluate(() => {
      const styleFor = (selector, pseudo = null) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const style = getComputedStyle(element, pseudo);
        return {
          backgroundColor: style.backgroundColor,
          left: style.left,
          width: style.width,
        };
      };
      return {
        blockCount: document.querySelectorAll(
          ".git-rendered-block.changed.right-side:not(.has-list-item-changes)",
        ).length,
        itemCount: document.querySelectorAll(".git-rendered-list-item-change")
          .length,
        parentListTargetCount: document.querySelectorAll(
          ".git-rendered-block.has-list-item-changes[data-change-index]",
        ).length,
        inlineCount: document.querySelectorAll(
          ".git-inline-word-highlight.added",
        ).length,
        block: styleFor(
          ".git-rendered-block.changed.right-side:not(.has-list-item-changes)",
        ),
        blockBar: styleFor(
          ".git-rendered-block.changed.right-side:not(.has-list-item-changes)",
          "::before",
        ),
        item: styleFor(".git-rendered-list-item-change"),
        itemBar: styleFor(".git-rendered-list-item-change", "::before"),
        inline: styleFor(".git-inline-word-highlight.added"),
      };
    });
  }

  await page.locator('[data-review-id="git-diff-preview-close"]').click();
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor({
    state: "detached",
  });
  await page
    .locator('[data-review-id="post-diff-git-marker"]')
    .first()
    .waitFor();

  const normal = await page.evaluate(() => {
    const styleFor = (selector, pseudo = null) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const style = getComputedStyle(element, pseudo);
      return {
        backgroundColor: style.backgroundColor,
        content: style.content,
        left: style.left,
        opacity: Number.parseFloat(style.opacity || "0"),
        width: style.width,
      };
    };
    const root =
      document.querySelector(".app-shell") ?? document.documentElement;
    const rootStyle = getComputedStyle(root);
    return {
      tokenCount: [
        "--git-change-added-accent",
        "--git-change-removed-accent",
        "--git-change-changed-accent",
        "--git-change-accent-width",
        "--git-change-accent-offset",
      ].filter((token) => rootStyle.getPropertyValue(token).trim().length > 0)
        .length,
      markerCount: Number(
        document
          .querySelector('[data-review-id="post-diff-git-markers"]')
          ?.getAttribute("data-marker-count") ?? 0,
      ),
      blockCount: document.querySelectorAll(
        ".document-body .post-diff-git-highlight:not(.post-diff-git-highlight-list-item)",
      ).length,
      itemCount: document.querySelectorAll(
        ".document-body .post-diff-git-highlight-list-item",
      ).length,
      parentListTargetCount: document.querySelectorAll(
        ".document-body ul.post-diff-git-highlight, .document-body ol.post-diff-git-highlight",
      ).length,
      inlineCount: document.querySelectorAll(
        ".document-body .git-inline-word-highlight.added",
      ).length,
      block: styleFor(
        ".document-body .post-diff-git-highlight:not(.post-diff-git-highlight-list-item)",
      ),
      blockBar: styleFor(
        ".document-body .post-diff-git-highlight:not(.post-diff-git-highlight-list-item)",
        "::before",
      ),
      item: styleFor(".document-body .post-diff-git-highlight-list-item"),
      itemBar: styleFor(
        ".document-body .post-diff-git-highlight-list-item",
        "::before",
      ),
      inline: styleFor(".document-body .git-inline-word-highlight.added"),
      marginMarker: styleFor(
        '[data-review-id="post-diff-git-marker"]',
        "::before",
      ),
    };
  });

  const summary = {
    scenario,
    documentBasename: isDeletionFallback
      ? "git-rendered-list-deletion.md"
      : "git-rendered-markdown.md",
    rendered,
    normal,
  };
  await page.evaluate((payload) => {
    window.__SVARD_GIT_CHANGE_VISUAL_CONTRACT__ = payload;
    window.__SVARD_POST_DIFF_MARKER_SUMMARY__ = {
      documentBasename: payload.documentBasename,
      markerCount: payload.normal.markerCount,
      blockHighlightCount: payload.normal.blockCount,
      itemHighlightCount: payload.normal.itemCount,
      inlineAddedCount: payload.normal.inlineCount,
      visualContract: true,
      visible: payload.normal.markerCount > 0,
    };
  }, summary);
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
    scenario === "viewer-normal-git-markers-subtle" ||
    scenario === "viewer-change-review-revision-lens"
  ) {
    await selectSubtleChangeReviewDisplay(page);
  }

  if (scenario === "viewer-change-review-revision-lens") {
    await runRevisionLensScenario(page);
    return true;
  }

  if (scenario.startsWith("viewer-git-change-visual-contract-")) {
    await collectGitChangeVisualContractSummary(page, scenario);
    return true;
  }

  if (scenario === "viewer-normal-git-markers-subtle") {
    await page
      .locator(
        '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-markdown.md"]',
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page
      .locator(
        '[data-review-id="post-diff-git-markers"][data-display-mode="subtle"]',
      )
      .waitFor();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".document-body .post-diff-git-highlight")
          .length === 0 &&
        document.querySelectorAll(".document-body .git-inline-word-highlight")
          .length === 0,
    );
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .click();
    await markerSummary(page, {
      initialWorkingTree: true,
      subtleDisplay: true,
      clickResult: true,
    });
    return true;
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
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
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
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .click();
    await markerSummary(page, {
      initialWorkingTree: true,
      clickResult: true,
      listItemMarker:
        scenario === "viewer-normal-git-markers-list-item-initial-working-tree",
    });
    return true;
  }

  if (
    scenario === "viewer-normal-git-markers-table-row-cell-initial-working-tree"
  ) {
    await openTableFixture(page);
    await waitForTableMarkers(page);
    await collectTableMarkerSummary(page, { initialWorkingTree: true });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-table-cell-markdown-diagnosis") {
    await openTableFixture(page, {
      path: "/workspace/docs/git-table-cells.md",
      title: "Git Markdown Table Cell Fixture",
    });
    await waitForTableMarkers(page);
    await collectTableMarkerSummary(page, {
      documentBasename: "git-table-cells.md",
      initialWorkingTree: true,
      markdownTableDiagnosis: true,
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-table-cell-asciidoc-regression") {
    await openTableFixture(page);
    await waitForTableMarkers(page);
    await collectTableMarkerSummary(page, {
      documentBasename: "git-asciidoc-table.adoc",
      initialWorkingTree: true,
      asciidocTableRegression: true,
    });
    return true;
  }

  if (
    scenario === "viewer-normal-git-markers-table-cell-untracked-not-applicable"
  ) {
    await openTableFixture(page, {
      path: "/workspace/docs/git-table-untracked.md",
      title: "Git Markdown Table Untracked Fixture",
    });
    await waitForTableMarkers(page);
    await collectTableMarkerSummary(page, {
      documentBasename: "git-table-untracked.md",
      tableMarker: true,
      wholeFileAddedTableRows: true,
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-table-cell-complex-fallback") {
    await openTableFixture(page, {
      path: "/workspace/docs/git-asciidoc-table-complex.adoc",
      title: "Git AsciiDoc Complex Table Diff Fixture",
    });
    await waitForNoTableCellMarkers(page);
    await collectTableMarkerSummary(page, {
      documentBasename: "git-asciidoc-table-complex.adoc",
      complexTableFallback: true,
      tableMarker: false,
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-git-refresh-stability") {
    await page.evaluate(() => {
      localStorage.setItem("SVARD_PERF_TRACE", "1");
      window.__SVARD_PERF_EVENTS__ = [];
      if (window.__SVARD_PERF_CONSOLE_WRAPPED__ !== true) {
        const originalInfo = console.info.bind(console);
        window.__SVARD_PERF_CONSOLE_WRAPPED__ = true;
        console.info = (...args) => {
          if (args[0] === "[perf]" && args[1] && typeof args[1] === "object") {
            window.__SVARD_PERF_EVENTS__?.push(args[1]);
          }
          originalInfo(...args);
        };
      }
    });
    await page
      .locator(
        '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-markdown.md"]',
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
    const before = await markerSummary(page, {
      initialWorkingTree: true,
      stabilityBaseline: true,
    });
    await page.evaluate(() => {
      window.__SVARD_PERF_EVENTS__ = [];
      window.__SVARD_TRIGGER_DIRECTORY_CHANGE__?.(
        "/workspace",
        "modified",
        "/workspace/docs/unrelated-refresh.md",
      );
    });
    await page.waitForTimeout(900);
    const stability = await page.evaluate(() => {
      const events = window.__SVARD_PERF_EVENTS__ ?? [];
      const count = (eventName) =>
        events.filter((event) => event.event === eventName).length;
      return {
        clearCount: count("postDiffGitMarkers.clear"),
        initialContextCount: count("postDiffGitMarkers.initialContext"),
        articleCommitCount: count("render.articleInnerHtmlCommit"),
        refreshSkipCount: count("postDiffGitMarkers.refreshSkip"),
        refreshKeepCount: count("postDiffGitMarkers.refreshKeep"),
      };
    });
    await markerSummary(page, {
      initialWorkingTree: true,
      gitRefreshStability: true,
      beforeMarkerCount: before.markerCount,
      ...stability,
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-git-commit-clean-stability") {
    await page.evaluate(() => {
      localStorage.setItem("SVARD_PERF_TRACE", "1");
      window.__SVARD_PERF_EVENTS__ = [];
      if (window.__SVARD_PERF_CONSOLE_WRAPPED__ !== true) {
        const originalInfo = console.info.bind(console);
        window.__SVARD_PERF_CONSOLE_WRAPPED__ = true;
        console.info = (...args) => {
          if (args[0] === "[perf]" && args[1] && typeof args[1] === "object") {
            window.__SVARD_PERF_EVENTS__?.push(args[1]);
          }
          originalInfo(...args);
        };
      }
    });
    await page
      .locator(
        '[data-review-id="tree-file"][data-path="/workspace/docs/git-rendered-markdown.md"]',
      )
      .click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Markdown Diff Fixture" })
      .waitFor();
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
    const before = await markerSummary(page, {
      initialWorkingTree: true,
      commitCleanBaseline: true,
    });
    await page.evaluate(() => {
      window.__SVARD_PERF_EVENTS__ = [];
      window.__SVARD_GIT_CHANGES_OVERRIDE__ = {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: {
          revision: "1111111111111111111111111111111111111111",
          shortHash: "1111111",
          summary: "docs: commit clean fixture",
        },
        items: [],
        message: null,
      };
      window.__SVARD_GIT_DIFF_OVERRIDES__ = {
        "/workspace/docs/git-rendered-markdown.md": {
          source: "git",
          repositoryRoot: "/workspace",
          relativePath: "docs/git-rendered-markdown.md",
          leftPath: "/workspace/docs/git-rendered-markdown.md",
          rightPath: "/workspace/docs/git-rendered-markdown.md",
          status: "clean",
          leftLabel: "HEAD",
          rightLabel: "Working Tree",
          leftText: "",
          rightText: "",
          hunks: [],
        },
      };
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-review-id="post-diff-git-markers"]') ===
        null,
    );
    const stability = await page.evaluate(() => {
      const events = window.__SVARD_PERF_EVENTS__ ?? [];
      const count = (eventName) =>
        events.filter((event) => event.event === eventName).length;
      return {
        clearCount: count("postDiffGitMarkers.clear"),
        initialContextCount: count("postDiffGitMarkers.initialContext"),
        articleCommitCount: count("render.articleInnerHtmlCommit"),
        refreshSkipCount: count("postDiffGitMarkers.refreshSkip"),
        refreshKeepCount: count("postDiffGitMarkers.refreshKeep"),
      };
    });
    await markerSummary(page, {
      gitCommitCleanStability: true,
      beforeMarkerCount: before.markerCount,
      ...stability,
    });
    await page.evaluate(() => {
      delete window.__SVARD_GIT_CHANGES_OVERRIDE__;
      delete window.__SVARD_GIT_DIFF_OVERRIDES__;
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
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
    await markerSummary(page, {
      documentBasename: "git-rendered-list-deletion.md",
      deletionFallback: true,
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-table-row-cell-after-diff") {
    await openTableFixture(page);
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-preview-close"]').click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor({
      state: "detached",
    });
    await waitForTableMarkers(page);
    await collectTableMarkerSummary(page, { afterDiffHandoff: true });
    return true;
  }

  await openDiffAndClose(page);

  if (
    scenario === "viewer-normal-git-markers-after-diff-opt-in" ||
    scenario === "viewer-normal-git-markers-privacy" ||
    scenario === "viewer-normal-git-markers-list-item-after-diff" ||
    scenario === "viewer-normal-git-markers-list-item-privacy"
  ) {
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .click();
    await markerSummary(page, {
      clickResult: true,
      listItemMarker:
        scenario === "viewer-normal-git-markers-list-item-after-diff" ||
        scenario === "viewer-normal-git-markers-list-item-privacy",
    });
    return true;
  }

  if (scenario === "viewer-normal-git-markers-context-clear") {
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
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
    await page
      .locator('[data-review-id="post-diff-git-marker"]')
      .first()
      .waitFor();
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
