export async function applyGitDiffSourceControlScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-git-diff-preview") {
    await page.locator("text=git-modified.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Diff Modified Fixture" })
      .waitFor();
    await page.keyboard.press("Control+L");
    await page.locator('[data-review-id="quick-open-input"]').fill(">git");
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: "Show Git Diff" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-source-view"]').click();
    await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else if (scenario === "viewer-zen-mode-diff-preview") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-nav"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Zen Mode" })
      .click();
    await page.locator('[data-review-id="preferences-tab-zen-mode"]').waitFor();
    await page
      .locator('[data-review-id="zen-mode-advanced-settings"]')
      .waitFor();
    await page
      .locator('[data-review-id="zen-mode-advanced-settings"] summary')
      .click();
    const applyDiffPreview = page.locator(
      '[data-review-id="zen-mode-apply-diff-preview-control"]',
    );
    await applyDiffPreview.waitFor();
    if (!(await applyDiffPreview.isChecked())) {
      await applyDiffPreview.click();
    }
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("preferences.close"),
    );
    await page.locator("text=git-modified.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Diff Modified Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("view.toggleZenMode"),
    );
    await page.locator('[data-zen-mode-active="true"]').waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page
      .locator(
        '[data-review-id="git-diff-preview-panel"][data-zen-mode-chrome-hidden="true"]',
      )
      .waitFor();
    await page
      .locator('[data-review-id="git-full-preview-left-pane"]')
      .waitFor();
    await page
      .locator('[data-review-id="git-full-preview-right-pane"]')
      .waitFor();
    await page.evaluate(() => {
      const panel = document.querySelector(
        '[data-review-id="git-diff-preview-panel"]',
      );
      const toolbar = document.querySelector(".git-diff-toolbar");
      const changeRuler = document.querySelector(
        '[data-review-id="git-diff-change-ruler"]',
      );
      const body = document.querySelector(
        ".git-diff-body, .git-rendered-diff-body",
      );
      window.__SVARD_ZEN_DIFF_PREVIEW_CHECK__ = {
        shellActive:
          document
            .querySelector('[data-review-id="shell"]')
            ?.getAttribute("data-zen-mode-active") === "true",
        panelChromeHidden:
          panel?.getAttribute("data-zen-mode-chrome-hidden") === "true",
        topbarCount: document.querySelectorAll(".topbar").length,
        toolbarDisplay: toolbar ? getComputedStyle(toolbar).display : null,
        changeRulerDisplay: changeRuler
          ? getComputedStyle(changeRuler).display
          : null,
        bodyHeight: body?.getBoundingClientRect().height ?? 0,
        viewportHeight: window.innerHeight,
      };
    });
  } else if (scenario === "viewer-file-tree-git-badge-open-diff") {
    const modifiedRow = page
      .locator('[data-review-id="tree-file"][data-git-status="modified"]')
      .filter({ hasText: "git-modified.md" });
    const diffButton = modifiedRow.locator(
      '[data-review-id="git-status-diff-button"]',
    );
    await diffButton.waitFor();
    await diffButton.hover();
    await page.waitForFunction(() => {
      const row = [
        ...document.querySelectorAll('[data-review-id="tree-file"]'),
      ].find(
        (candidate) =>
          candidate instanceof HTMLElement &&
          candidate.dataset.gitStatus === "modified" &&
          candidate.textContent?.includes("git-modified.md"),
      );
      const button = row?.querySelector(
        '[data-review-id="git-status-diff-button"]',
      );
      if (!(button instanceof HTMLElement)) {
        return false;
      }
      const style = getComputedStyle(button);
      const label =
        button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "";
      return (
        style.cursor === "pointer" &&
        style.boxShadow !== "none" &&
        label.includes("Modified in Git") &&
        label.includes("Open rendered diff for git-modified.md")
      );
    });
    await diffButton.click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-open-files-git-badge-open-diff") {
    await page
      .locator('[data-review-id="tree-file"][data-git-status="modified"]')
      .filter({ hasText: "git-modified.md" })
      .click();
    const openFileRow = page
      .locator('[data-review-id="open-file-item"][data-git-status="modified"]')
      .filter({ hasText: "git-modified.md" });
    const diffButton = openFileRow.locator(
      '[data-review-id="git-status-diff-button"]',
    );
    await diffButton.waitFor();
    await diffButton.hover();
    await page.waitForFunction(() => {
      const row = [
        ...document.querySelectorAll('[data-review-id="open-file-item"]'),
      ].find(
        (candidate) =>
          candidate instanceof HTMLElement &&
          candidate.dataset.gitStatus === "modified" &&
          candidate.textContent?.includes("git-modified.md"),
      );
      const button = row?.querySelector(
        '[data-review-id="git-status-diff-button"]',
      );
      if (!(button instanceof HTMLElement)) {
        return false;
      }
      const style = getComputedStyle(button);
      return style.cursor === "pointer" && style.boxShadow !== "none";
    });
    await diffButton.click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-git-status-hints") {
    await page
      .locator('[data-review-id="tree-file"][data-git-status="modified"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
    await page.locator("text=git-untracked.md").click();
    await page
      .locator('[data-review-id="open-file-item"][data-git-status="untracked"]')
      .filter({ hasText: "git-untracked.md" })
      .waitFor();
    await page.locator('[data-review-id="sidebar-tab-bookmarks"]').click();
    await page.locator('[data-review-id="bookmark-add-active"]').click();
    await page
      .locator('[data-review-id="bookmark-item"][data-git-status="untracked"]')
      .filter({ hasText: "git-untracked.md" })
      .waitFor();
    await page.locator('[data-review-id="sidebar-tab-files"]').click();
    await page
      .locator('[data-review-id="tree-file"][data-git-status="modified"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
  } else if (scenario === "viewer-git-status-directory-hints") {
    await page
      .locator('[data-review-id="tree-file"][data-git-status="modified"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
    await page
      .locator(
        '[data-review-id="tree-folder-toggle"][data-git-status-summary="modified"][data-git-status-count]',
      )
      .filter({ hasText: "docs" })
      .waitFor();
    await page
      .locator('[data-review-id="tree-file"][data-git-status="untracked"]')
      .filter({ hasText: "git-untracked.md" })
      .waitFor();
  } else if (scenario === "viewer-git-status-directory-badge-polish") {
    await page.waitForFunction(() => {
      const docs = [
        ...document.querySelectorAll('[data-review-id="tree-folder-toggle"]'),
      ].find(
        (row) =>
          row instanceof HTMLElement && row.dataset.path === "/workspace/docs",
      );
      if (!(docs instanceof HTMLElement)) {
        return false;
      }
      return (
        docs.dataset.gitStatusSummary === "modified" &&
        Number(docs.dataset.gitStatusCount ?? 0) >= 2 &&
        Number(docs.dataset.gitStatusModifiedCount ?? 0) >= 1 &&
        Number(docs.dataset.gitStatusUntrackedCount ?? 0) >= 1 &&
        (docs.dataset.gitStatusLabel ?? "").includes("under docs") &&
        (docs.getAttribute("title") ?? "").includes("changed documents:") &&
        (docs.getAttribute("title") ?? "").includes("modified") &&
        (docs.getAttribute("title") ?? "").includes("untracked") &&
        (
          docs
            .querySelector('[data-review-id="git-status-badge"]')
            ?.getAttribute("aria-label") ?? ""
        ).includes("under docs")
      );
    });
  } else if (scenario === "viewer-git-status-directory-source-control-cache") {
    await page.evaluate(() => {
      window.__SVARD_GIT_CHANGES_CALL_COUNT__ = 0;
      window.__SVARD_GIT_CHANGES_OVERRIDE__ = {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: {
          revision: "2222222222222222222222222222222222222222",
          shortHash: "2222222",
          summary: "docs: update nested cached document",
        },
        items: [
          {
            path: "book/deep/cache-only.md",
            status: "modified",
            documentPath: "/workspace/book/deep/cache-only.md",
          },
          {
            path: "assets/generated.bin",
            status: "binary",
            documentPath: null,
          },
        ],
        message: null,
      };
    });
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-change-item"]')
      .filter({ hasText: "cache-only.md" })
      .waitFor();
    await page.locator('[data-review-id="sidebar-tab-files"]').click();
    await page
      .locator(
        '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"][data-git-status-count="1"][data-git-status-modified-count="1"]',
      )
      .filter({ hasText: "book" })
      .waitFor();
  } else if (scenario === "viewer-git-status-directory-idle-cache") {
    await page
      .locator(
        '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"][data-git-status-count="1"][data-git-status-modified-count="1"]',
      )
      .filter({ hasText: "book" })
      .waitFor({ timeout: 8000 });
  } else if (scenario === "viewer-git-status-directory-cache-invalidation") {
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__ === "function",
    );
    await page
      .locator(
        '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"][data-git-status-count="1"][data-git-status-modified-count="1"]',
      )
      .filter({ hasText: "book" })
      .waitFor({ timeout: 8000 });
    await page.evaluate(() => {
      window.__SVARD_GIT_CHANGES_OVERRIDE__ = {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: {
          revision: "3333333333333333333333333333333333333333",
          shortHash: "3333333",
          summary: "docs: clean working tree",
        },
        items: [],
        message: null,
      };
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page.waitForFunction(() => {
      const book = document.querySelector(
        '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"]',
      );
      return book instanceof HTMLElement && !book.dataset.gitStatusCount;
    });
  } else if (scenario === "viewer-git-status-hints-auto-refresh") {
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__ === "function",
    );
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "git-clean.md" })
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_GIT_STATUS_OVERRIDES__ = {
        "/workspace/docs/git-clean.md": "modified",
      };
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page
      .locator('[data-review-id="tree-file"][data-git-status="modified"]')
      .filter({ hasText: "git-clean.md" })
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_GIT_STATUS_OVERRIDES__ = {
        "/workspace/docs/git-clean.md": "clean",
      };
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page.waitForFunction(() => {
      const clean = [
        ...document.querySelectorAll('[data-review-id="tree-file"]'),
      ].find((row) => row.textContent?.includes("git-clean.md"));
      return clean instanceof HTMLElement && !clean.dataset.gitStatus;
    });
  } else if (scenario === "viewer-git-status-rename-hints") {
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__ === "function",
    );
    await page.evaluate(() => {
      window.__SVARD_GIT_STATUS_OVERRIDES__ = {
        "/workspace/docs/git-clean.md": "deleted",
        "/workspace/docs/git-untracked.md": "added",
      };
      window.__SVARD_GIT_DIFF_OVERRIDES__ = {
        "/workspace/docs/git-clean.md": {
          repositoryRoot: null,
          relativePath: "docs/git-clean.md",
          status: "deleted",
          leftLabel: "HEAD",
          rightLabel: "Index",
          hunks: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 0,
              newLines: 0,
              lines: [
                {
                  kind: "removed",
                  oldLine: 1,
                  newLine: null,
                  text: "# Clean Fixture",
                },
              ],
            },
          ],
          message: null,
          leftText: "# Clean Fixture",
          rightText: "",
        },
      };
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page
      .locator('[data-review-id="tree-file"][data-git-status="deleted"]')
      .filter({ hasText: "git-clean.md" })
      .waitFor();
    await page
      .locator('[data-review-id="tree-file"][data-git-status="added"]')
      .filter({ hasText: "git-untracked.md" })
      .waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "git-clean.md" })
      .click();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("git.showDiff");
    });
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page
      .locator('[data-review-id="git-diff-preview-panel"]')
      .filter({ hasText: "Deleted" })
      .waitFor();
  } else if (
    scenario === "viewer-git-timeline-file-history" ||
    scenario === "viewer-git-timeline-file-history-cache" ||
    scenario === "viewer-git-timeline-file-history-load-more" ||
    scenario === "viewer-git-timeline-file-history-initial-latency"
  ) {
    if (scenario === "viewer-git-timeline-file-history-initial-latency") {
      await page.evaluate(() => {
        window.__SVARD_GIT_FILE_HISTORY_CALL_COUNT__ = 0;
      });
    }
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
    );
    await page.locator('[data-review-id="source-control-panel"]').waitFor();
    await page.locator('[data-review-id="timeline-panel"]').waitFor();
    await page.locator('[data-review-id="timeline-list"]').waitFor();
    await page
      .locator('[data-review-id="timeline-item"]')
      .filter({ hasText: "docs: add rendered preview diff goal" })
      .waitFor();
    if (scenario === "viewer-git-timeline-file-history-cache") {
      await page.evaluate(() =>
        window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
      );
      await page
        .locator('[data-review-id="timeline-item"]')
        .filter({ hasText: "docs: add rendered preview diff goal" })
        .waitFor();
    } else if (scenario === "viewer-git-timeline-file-history-load-more") {
      const beforeCount = await page
        .locator('[data-review-id="timeline-item"]')
        .count();
      await page
        .locator('[data-review-id="timeline-load-more"] button')
        .click();
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-review-id="timeline-item"]').length >
          count,
        beforeCount,
      );
    } else if (
      scenario === "viewer-git-timeline-file-history-initial-latency"
    ) {
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        window.__SVARD_FILE_HISTORY_INITIAL_LATENCY_CHECK__ = {
          itemCount: document.querySelectorAll(
            '[data-review-id="timeline-item"]',
          ).length,
          loadMoreVisible:
            document.querySelector('[data-review-id="timeline-load-more"]') !==
            null,
          fileHistoryCallCount:
            window.__SVARD_GIT_FILE_HISTORY_CALL_COUNT__ ?? 0,
        };
      });
    }
  } else if (scenario === "viewer-source-control-changes") {
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page.locator('[data-review-id="source-control-panel"]').waitFor();
    await page
      .locator('[data-review-id="source-control-changes-list"]')
      .waitFor();
    await page
      .locator('[data-review-id="source-control-change-item"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
  } else if (scenario === "viewer-source-control-performance-cache") {
    await page.evaluate(() => {
      window.__SVARD_GIT_CHANGES_CALL_COUNT__ = 0;
    });
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-changes-list"]')
      .waitFor();
    await page
      .locator('[data-review-id="source-control-change-item"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
    await page.locator('[data-review-id="sidebar-tab-files"]').click();
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-change-item"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
    await page.waitForFunction(
      () => (window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0) >= 2,
    );
  } else if (scenario === "viewer-source-control-watch-debounce") {
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-changes-list"]')
      .waitFor();
    await page.evaluate(() => {
      window.__SVARD_GIT_CHANGES_CALL_COUNT__ = 0;
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
      window.__SVARD_TRIGGER_GIT_STATUS_CHANGE__?.();
    });
    await page.waitForFunction(
      () => (window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0) === 1,
      null,
      { timeout: 3000 },
    );
    await page.evaluate(() => {
      window.__SVARD_SOURCE_CONTROL_WATCH_DEBOUNCE_SAMPLE__ = {
        callCount: window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0,
      };
      document.body.dataset.sourceControlWatchDebounced = "true";
    });
  } else if (scenario === "viewer-source-control-branch-diff") {
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-view-branch-diff"]')
      .click();
    await page.locator('[data-review-id="source-control-panel"]').waitFor();
    await page
      .locator('[data-review-id="source-control-branch-diff-list"]')
      .waitFor();
    await page
      .locator('[data-review-id="source-control-branch-diff-item"]')
      .filter({ hasText: "git-modified.md" })
      .waitFor();
  } else if (scenario === "viewer-source-control-branch-diff-provider-base") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-dialog"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "PR / MR Providers" })
      .click();
    await page
      .locator('[data-review-id="preferences-tab-remote-providers"]')
      .waitFor();
    await page
      .locator('[data-review-id="remote-provider-github-token"]')
      .fill("mock-token");
    await page
      .locator('[data-review-id="remote-provider-github-save-token"]')
      .click();
    await page
      .locator('[data-review-id="remote-provider-github-token-status"]')
      .filter({ hasText: "Ready for PR target detection" })
      .waitFor();
    await page
      .locator('[data-review-id="remote-provider-github-enabled"]')
      .check();
    await page.locator('[data-review-id="preferences-close"]').click();
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-view-branch-diff"]')
      .click();
    await page.locator('[data-review-id="source-control-panel"]').waitFor();
    await page
      .locator('[data-review-id="source-control-branch-diff-base"]')
      .filter({ hasText: "PR target: origin/main" })
      .waitFor();
    await page
      .locator('[data-review-id="source-control-branch-diff-list"]')
      .waitFor();
  } else if (
    scenario === "viewer-source-control-branch-diff-provider-fallback"
  ) {
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-view-branch-diff"]')
      .click();
    await page.locator('[data-review-id="source-control-panel"]').waitFor();
    await page
      .locator('[data-review-id="source-control-branch-diff-base"]')
      .filter({ hasText: "origin/main" })
      .waitFor();
    await page
      .locator('[data-review-id="source-control-branch-diff-list"]')
      .waitFor();
  } else if (
    scenario === "viewer-source-control-graph" ||
    scenario === "viewer-source-control-repo-graph-load-more"
  ) {
    await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
    await page
      .locator('[data-review-id="source-control-view-repo-graph"]')
      .click();
    await page.locator('[data-review-id="source-control-panel"]').waitFor();
    await page.locator('[data-review-id="timeline-list"]').waitFor();
    await page
      .locator('[data-review-id="timeline-item"]')
      .filter({ hasText: "docs: add rendered preview diff goal" })
      .waitFor();
    if (scenario === "viewer-source-control-repo-graph-load-more") {
      const beforeCount = await page
        .locator('[data-review-id="timeline-item"]')
        .count();
      await page
        .locator('[data-review-id="timeline-load-more"] button')
        .click();
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('[data-review-id="timeline-item"]').length >
          count,
        beforeCount,
      );
    }
  } else if (
    scenario === "viewer-git-timeline-compare-commit" ||
    scenario === "viewer-git-timeline-vscode-left-click"
  ) {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
    );
    await page.locator('[data-review-id="timeline-item"]').first().click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page
      .locator('[data-review-id="git-full-preview-left-pane"]')
      .waitFor();
    await page
      .locator('[data-review-id="git-full-preview-right-pane"]')
      .waitFor();
  } else if (scenario === "viewer-git-timeline-context-menu") {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
    );
    await page.locator('[data-review-id="timeline-item"]').first().click({
      button: "right",
    });
    await page.locator('[data-review-id="context-menu"]').waitFor();
  } else if (scenario === "viewer-git-timeline-select-compare") {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
    );
    const rows = page.locator('[data-review-id="timeline-item"]');
    await rows.nth(1).click({ button: "right" });
    await page
      .locator('[data-review-id="context-menu-item-select-for-compare"]')
      .click();
    await rows.nth(0).click({ button: "right" });
    await page
      .locator('[data-review-id="context-menu-item-compare-with-selected"]')
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-git-timeline-view-commit") {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showFileHistory"),
    );
    await page.locator('[data-review-id="timeline-item"]').first().click({
      button: "right",
    });
    await page
      .locator('[data-review-id="context-menu-item-view-commit"]')
      .click();
    await page.locator('[data-review-id="git-commit-details-panel"]').waitFor();
  } else if (scenario === "viewer-git-compare-branch") {
    await page.locator("text=git-modified.md").click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "git-modified.md" })
      .click({ button: "right" });
    await page
      .locator('[data-review-id="context-menu-item-compare-with-branch"]')
      .click();
    await page.locator('[data-review-id="git-ref-picker"]').waitFor();
    await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .filter({ hasText: "main" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-git-compare-tag") {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.compareWithTag"),
    );
    await page.locator('[data-review-id="git-ref-picker"]').waitFor();
    await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .filter({ hasText: "v0.1.0" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-git-compare-commit") {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.compareWithCommit"),
    );
    await page.locator('[data-review-id="git-ref-picker"]').waitFor();
    await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .filter({ hasText: "1111111" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-git-ref-picker-load-more") {
    await page.locator("text=git-modified.md").click();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.compareWithCommit"),
    );
    await page.locator('[data-review-id="git-ref-picker"]').waitFor();
    const initialCount = await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .count();
    await page.locator('[data-review-id="git-ref-picker-load-more"]').click();
    await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .filter({ hasText: "older ref picker pagination fixture" })
      .waitFor();
    const loadedCount = await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .count();
    await page.evaluate(
      ({ initialCount, loadedCount }) => {
        window.__SVARD_GIT_REF_PICKER_LOAD_MORE_CHECK__ = {
          initialCount,
          loadedCount,
        };
      },
      { initialCount, loadedCount },
    );
    await page
      .locator('[data-review-id="git-ref-picker-item"]')
      .filter({ hasText: "older ref picker pagination fixture" })
      .click();
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  } else if (scenario === "viewer-git-diff-clean") {
    await page.locator("text=git-clean.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Diff Clean Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-empty-state"]').waitFor();
  } else if (scenario === "viewer-git-diff-untracked") {
    await page.locator("text=git-untracked.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Diff Untracked Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();
  } else {
    return false;
  }
  return true;
}
