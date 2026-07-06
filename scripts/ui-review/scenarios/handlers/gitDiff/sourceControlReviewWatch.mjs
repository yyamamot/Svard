export function isReviewWatchModeScenario(scenario) {
  return scenario === "viewer-review-watch-mode";
}

export function isReviewWatchActiveDiffScenario(scenario) {
  return (
    scenario === "viewer-review-watch-mode-active-diff" ||
    scenario === "viewer-review-watch-mode-refresh-preview"
  );
}

export async function applyReviewWatchModeScenario(page) {
  await page.evaluate(() => {
    window.__SVARD_GIT_CHANGES_CALL_COUNT__ = 0;
  });
  await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
  await page
    .locator('[data-review-id="source-control-changes-list"]')
    .waitFor();
  await page.evaluate(() => {
    window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
  });
  await page.waitForFunction(
    () => (window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0) >= 2,
    null,
    { timeout: 3000 },
  );
  await page.evaluate(() => {
    window.__SVARD_REVIEW_WATCH_MODE_SAMPLE__ = {
      callCount: window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0,
      changesVisible:
        document.querySelector('[data-review-id="source-control-change-item"]') !==
        null,
    };
  });
}

export async function applyReviewWatchActiveDiffScenario(page, scenario) {
  await setupReviewWatchDiffPreview(page);
  await page.getByRole("button", { name: "Next change" }).click();
  await page
    .locator('[data-review-id="git-diff-change-ruler-marker"].active')
    .waitFor();
  const initialActiveLabel = await page.evaluate(() => {
    const active = document.querySelector(
      '[data-review-id="git-diff-change-ruler-marker"].active',
    );
    return active?.getAttribute("aria-label") ?? "";
  });
  await page.evaluate(() => {
    window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
  });
  await page
    .locator('[data-review-id="git-diff-preview-watch-status"]')
    .filter({ hasText: "Stale" })
    .waitFor();
  if (scenario === "viewer-review-watch-mode-refresh-preview") {
    const refreshedPreview = reviewWatchPreview({
      suffix: "Refreshed watch body",
    });
    await page.evaluate((refreshedPreview) => {
      window.__SVARD_GIT_DIFF_OVERRIDES__ = {
        ...(window.__SVARD_GIT_DIFF_OVERRIDES__ ?? {}),
        "/workspace/docs/review-watch.md": refreshedPreview,
      };
    }, refreshedPreview);
    await page.locator('[data-review-id="git-diff-preview-refresh"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-review-id="git-diff-preview-watch-status"]',
        ) === null,
    );
    await page
      .locator('[data-review-id="git-full-preview-right-pane"]')
      .filter({ hasText: "Refreshed watch body" })
      .waitFor();
  }
  await page.evaluate(
    ({ scenario, initialActiveLabel }) => {
      const active = document.querySelector(
        '[data-review-id="git-diff-change-ruler-marker"].active',
      );
      window.__SVARD_REVIEW_WATCH_ACTIVE_DIFF_SAMPLE__ = {
        scenario,
        initialActiveLabel,
        activeMarkerPresent: active !== null,
        activeLabel: active?.getAttribute("aria-label") ?? "",
        staleVisible:
          document.querySelector('[data-review-id="git-diff-preview-watch-status"]')
            ?.textContent ?? "",
        refreshVisible:
          document.querySelector('[data-review-id="git-diff-preview-refresh"]') !==
          null,
        refreshedTextVisible:
          document.body.textContent?.includes("Refreshed watch body") ?? false,
      };
    },
    { scenario, initialActiveLabel },
  );
}

async function setupReviewWatchDiffPreview(page) {
  const path = "/workspace/docs/review-watch.md";
  const rightText = reviewWatchRightText({ suffix: "Initial watch body" });
  const preview = reviewWatchPreview({ suffix: "Initial watch body" });
  await page.evaluate(
    ({ path, preview, rightText }) => {
      window.__SVARD_PICK_DOCUMENT__ = path;
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        ...(window.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
        [path]: { source: rightText },
      };
      window.__SVARD_GIT_STATUS_OVERRIDES__ = {
        ...(window.__SVARD_GIT_STATUS_OVERRIDES__ ?? {}),
        [path]: "modified",
      };
      window.__SVARD_GIT_CHANGES_OVERRIDE__ = {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [
          {
            path: "docs/review-watch.md",
            status: "modified",
            documentPath: path,
          },
        ],
        message: null,
      };
      window.__SVARD_GIT_DIFF_OVERRIDES__ = {
        ...(window.__SVARD_GIT_DIFF_OVERRIDES__ ?? {}),
        [path]: preview,
      };
    },
    { path, preview, rightText },
  );
  await page.evaluate(() => window.__SVARD_COMMANDS__?.dispatch("file.open"));
  await page
    .locator('[data-review-id="document-body"]')
    .filter({ hasText: "Review Watch" })
    .waitFor();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
  );
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  await page.locator('[data-review-id="git-diff-full-preview-view"]').click();
  await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
}

function reviewWatchRightText({ suffix }) {
  return `# Review Watch

Opening the rendered diff marks the document viewed.

The second changed paragraph keeps the review cursor stable.

${suffix}
`;
}

function reviewWatchPreview({ suffix }) {
  const path = "/workspace/docs/review-watch.md";
  const leftText = `# Review Watch

Opening the document does not mark the review session.

The second paragraph is unchanged.

Initial footer
`;
  const rightText = reviewWatchRightText({ suffix });
  return {
    source: "git",
    repositoryRoot: "/workspace",
    relativePath: "docs/review-watch.md",
    leftPath: path,
    rightPath: path,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
        lines: [
          { kind: "context", oldLine: 1, newLine: 1, text: "# Review Watch" },
          { kind: "context", oldLine: 2, newLine: 2, text: "" },
          {
            kind: "removed",
            oldLine: 3,
            newLine: null,
            text: "Opening the document does not mark the review session.",
          },
          {
            kind: "added",
            oldLine: null,
            newLine: 3,
            text: "Opening the rendered diff marks the document viewed.",
          },
        ],
      },
      {
        oldStart: 5,
        oldLines: 3,
        newStart: 5,
        newLines: 3,
        lines: [
          {
            kind: "removed",
            oldLine: 5,
            newLine: null,
            text: "The second paragraph is unchanged.",
          },
          {
            kind: "added",
            oldLine: null,
            newLine: 5,
            text: "The second changed paragraph keeps the review cursor stable.",
          },
          { kind: "context", oldLine: 6, newLine: 6, text: "" },
          {
            kind: "removed",
            oldLine: 7,
            newLine: null,
            text: "Initial footer",
          },
          { kind: "added", oldLine: null, newLine: 7, text: suffix },
        ],
      },
    ],
    message: null,
    leftText,
    rightText,
  };
}
