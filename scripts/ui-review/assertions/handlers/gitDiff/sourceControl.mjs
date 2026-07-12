export async function buildGitDiffSourceControlAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;

  return {
    hasGitStatusHints:
      scenario === "viewer-git-status-hints"
        ? (await page
            .locator(
              '[data-review-id="tree-file"][data-git-status="modified"] [data-review-id="git-status-diff-button"]',
            )
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="open-file-item"][data-git-status="untracked"] [data-review-id="git-status-diff-button"]',
            )
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="tree-file"]')
            .filter({ hasText: "git-clean.md" })
            .getAttribute("data-git-status")) === null
        : true,
    hasGitStatusDirectoryHints:
      scenario === "viewer-git-status-directory-hints"
        ? (await page
            .locator(
              '[data-review-id="tree-folder-toggle"][data-git-status-summary="modified"][data-git-status-count] [data-review-id="git-status-badge"]',
            )
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="tree-file"][data-git-status="modified"] [data-review-id="git-status-diff-button"]',
            )
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="tree-file"][data-git-status="untracked"] [data-review-id="git-status-diff-button"]',
            )
            .count()) > 0
        : true,
    hasGitStatusDirectoryBadgePolish:
      scenario === "viewer-git-status-directory-badge-polish"
        ? await page.evaluate(() => {
            const docs = document.querySelector(
              '[data-review-id="tree-folder-toggle"][data-path="/workspace/docs"]',
            );
            if (!(docs instanceof HTMLElement)) {
              return false;
            }
            const title = docs.getAttribute("title") ?? "";
            const badge = docs.querySelector(
              '[data-review-id="git-status-badge"]',
            );
            const badgeLabel =
              badge?.getAttribute("aria-label") ??
              badge?.getAttribute("title") ??
              "";
            const badgeStyle =
              badge instanceof HTMLElement ? getComputedStyle(badge) : null;
            const rowStyle = getComputedStyle(docs);
            const oldStrongBadgeBackgrounds = new Set([
              "rgb(244, 208, 111)",
              "rgb(167, 223, 189)",
              "rgb(240, 178, 171)",
            ]);
            const oldStatusTextColors = new Set([
              "rgb(138, 90, 0)",
              "rgb(31, 122, 79)",
              "rgb(179, 64, 53)",
            ]);
            const badgeLooksSubdued =
              badgeStyle !== null &&
              badgeStyle.backgroundColor !== "rgba(0, 0, 0, 0)" &&
              !oldStrongBadgeBackgrounds.has(badgeStyle.backgroundColor);
            const rowTextIsNotStatusTint = !oldStatusTextColors.has(
              rowStyle.color,
            );
            return (
              badge !== null &&
              Number(docs.dataset.gitStatusCount ?? 0) >= 2 &&
              Number(docs.dataset.gitStatusModifiedCount ?? 0) >= 1 &&
              Number(docs.dataset.gitStatusUntrackedCount ?? 0) >= 1 &&
              (docs.dataset.gitStatusLabel ?? "").includes("under docs") &&
              title.includes("changed documents:") &&
              title.includes("modified") &&
              title.includes("untracked") &&
              badgeLabel.includes("under docs") &&
              badgeLabel.includes("modified") &&
              badgeLabel.includes("untracked") &&
              badgeLooksSubdued &&
              rowTextIsNotStatusTint
            );
          })
        : true,
    hasGitStatusDirectorySourceControlCache:
      scenario === "viewer-git-status-directory-source-control-cache"
        ? (await page
            .locator(
              '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"][data-git-status-count="1"][data-git-status-modified-count="1"] [data-review-id="git-status-badge"]',
            )
            .count()) > 0 &&
          !bodyText.includes("generated.bin") &&
          (await page.evaluate(
            () => window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0,
          )) >= 1
        : true,
    hasGitStatusDirectoryIdleCache:
      scenario === "viewer-git-status-directory-idle-cache"
        ? (await page
            .locator(
              '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"][data-git-status-count="1"][data-git-status-modified-count="1"] [data-review-id="git-status-badge"]',
            )
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="source-control-panel"]')
            .count()) === 0
        : true,
    hasGitStatusDirectoryCacheInvalidation:
      scenario === "viewer-git-status-directory-cache-invalidation"
        ? ((await page
            .locator(
              '[data-review-id="tree-folder-toggle"][data-path="/workspace/book"]',
            )
            .getAttribute("data-git-status-count")) ?? null) === null &&
          (await page
            .locator('[data-review-id="source-control-panel"]')
            .count()) === 0
        : true,
    hasGitStatusAutoRefresh:
      scenario === "viewer-git-status-hints-auto-refresh"
        ? bodyText.includes("git-clean.md") &&
          (await page
            .locator('[data-review-id="tree-file"]')
            .filter({ hasText: "git-clean.md" })
            .getAttribute("data-git-status")) === null
        : true,
    hasGitStatusRenameHints:
      scenario === "viewer-git-status-rename-hints"
        ? bodyText.includes("git-clean.md") &&
          bodyText.includes("git-untracked.md") &&
          bodyText.includes("Deleted") &&
          (await page
            .locator(
              '[data-review-id="tree-file"][data-git-status="deleted"] [data-review-id="git-status-diff-button"]',
            )
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="tree-file"][data-git-status="added"] [data-review-id="git-status-diff-button"]',
            )
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1
        : true,
    hasGitTimeline:
      scenario === "viewer-git-timeline-file-history" ||
      scenario === "viewer-git-timeline-file-history-cache" ||
      scenario === "viewer-git-timeline-file-history-load-more" ||
      scenario === "viewer-git-timeline-file-history-initial-latency"
        ? bodyText.includes("Source Control") &&
          bodyText.includes("git-modified.md") &&
          bodyText.includes("docs: add rendered preview diff goal") &&
          (await page.locator('[data-review-id="timeline-item"]').count()) > 0
        : true,
    hasGitTimelineInitialLatencyGuard:
      scenario === "viewer-git-timeline-file-history-initial-latency"
        ? await page.evaluate(() => {
            const sample =
              window.__SVARD_FILE_HISTORY_INITIAL_LATENCY_CHECK__ ?? null;
            return (
              sample !== null &&
              sample.itemCount > 0 &&
              sample.itemCount <= 20 &&
              sample.loadMoreVisible === true &&
              sample.fileHistoryCallCount === 1
            );
          })
        : true,
    hasSourceControlChanges:
      scenario === "viewer-source-control-changes"
        ? (await page.evaluate(() => {
            const row = document.querySelector(
              '[data-review-id="source-control-change-item"]',
            );
            if (!(row instanceof HTMLElement)) {
              return false;
            }
            const name = row.querySelector(".source-control-change-name");
            const badge = row.querySelector(
              '[data-review-id="git-status-badge"], .git-status-badge',
            );
            const head = document.querySelector(
              '[data-review-id="source-control-head"]',
            );
            const switcher = document.querySelector(".source-control-switch");
            const sourceControlTab = document.querySelector(
              '[data-review-id="sidebar-tab-source-control"]',
            );
            const activeInnerTab = document.querySelector(
              ".source-control-switch button.active",
            );
            if (
              !(name instanceof HTMLElement) ||
              !(badge instanceof HTMLElement) ||
              !(head instanceof HTMLElement) ||
              !(switcher instanceof HTMLElement) ||
              !(sourceControlTab instanceof HTMLElement) ||
              !(activeInnerTab instanceof HTMLElement)
            ) {
              return false;
            }
            const rowRect = row.getBoundingClientRect();
            const nameRect = name.getBoundingClientRect();
            const badgeRect = badge.getBoundingClientRect();
            const headRect = head.getBoundingClientRect();
            const branchRect = head
              .querySelector('[data-review-id="source-control-branch"]')
              ?.getBoundingClientRect();
            const commitRect = head
              .querySelector('[data-review-id="source-control-head-commit"]')
              ?.getBoundingClientRect();
            const switcherRect = switcher.getBoundingClientRect();
            const parentTabRect = sourceControlTab.getBoundingClientRect();
            const switcherStyle = getComputedStyle(switcher);
            const innerTabStyle = getComputedStyle(activeInnerTab);
            const badgeIsOnNameLine =
              Math.abs(
                nameRect.top +
                  nameRect.height / 2 -
                  (badgeRect.top + badgeRect.height / 2),
              ) <= 5;
            const innerTabsAreVisuallySubordinate =
              switcherRect.height < parentTabRect.height &&
              switcherStyle.display === "flex" &&
              switcherStyle.justifyContent === "flex-start" &&
              switcherStyle.boxShadow === "none" &&
              switcherStyle.backgroundColor === "rgba(0, 0, 0, 0)" &&
              Number.parseFloat(innerTabStyle.borderBottomWidth) >= 1;
            return (
              document.body.textContent?.includes("Source Control") === true &&
              document.body.textContent?.includes("Changes") === true &&
              document.body.textContent?.includes("1111111") === true &&
              document.body.textContent?.includes("git-modified.md") === true &&
              headRect.height <= 38 &&
              branchRect &&
              commitRect &&
              commitRect.top >= branchRect.bottom - 1 &&
              innerTabsAreVisuallySubordinate &&
              rowRect.height <= 50 &&
              badgeIsOnNameLine &&
              badge.getAttribute("aria-label")?.includes("Git") === true &&
              badge.getAttribute("title")?.includes("Git") === true
            );
          })) &&
          (await page
            .locator('[data-review-id="source-control-head-commit"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="source-control-change-item"]')
            .count()) > 0
        : true,
    hasSourceControlPerformanceCache:
      scenario === "viewer-source-control-performance-cache"
        ? bodyText.includes("Source Control") &&
          bodyText.includes("git-modified.md") &&
          (await page.evaluate(
            () => window.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0,
          )) >= 2 &&
          (await page
            .locator('[data-review-id="source-control-change-item"]')
            .count()) > 0
        : true,
    hasSourceControlWatchDebounce:
      scenario === "viewer-source-control-watch-debounce"
        ? bodyText.includes("Source Control") &&
          bodyText.includes("git-modified.md") &&
          (await page.evaluate(
            () =>
              document.body.dataset.sourceControlWatchDebounced === "true" ||
              window.__SVARD_SOURCE_CONTROL_WATCH_DEBOUNCE_SAMPLE__
                ?.callCount === 1,
          ))
        : true,
    hasReviewWatchMode:
      scenario === "viewer-review-watch-mode"
        ? await page.evaluate(() => {
            const sample = window.__SVARD_REVIEW_WATCH_MODE_SAMPLE__;
            return sample?.callCount >= 2 && sample?.changesVisible === true;
          })
        : true,
    hasSourceControlAllDiffs:
      scenario === "viewer-source-control-all-diffs"
        ? await page.evaluate(() => {
            const sample = window.__SVARD_ALL_DIFFS_STREAM_SAMPLE__;
            return (
              sample?.panelVisible === true &&
              sample?.fileSections >= 1 &&
              sample?.renderedBlocks >= 1 &&
              sample?.renderedBodyHeight > 0 &&
              sample?.renderedBodyWidth > 0 &&
              sample?.renderedBlockHeight > 0 &&
              sample?.renderedBlockWidth > 0 &&
              sample?.renderedBlockVisibleInSection === true &&
              sample?.renderedSectionHeight >= sample?.renderedBodyHeight &&
              sample?.streamBodyOverflowY === "auto" &&
              sample?.renderedScrollOverflowY === "visible" &&
              sample?.fullPreviewDefault === true &&
              sample?.rulerVisible === true &&
              sample?.rulerMarkers >= 1 &&
              sample?.activeRulerMarkerVisible === true &&
              sample?.activeRenderedTargetIndexMatchesMarker === true &&
              sample?.activeRenderedTargetStreamIndexMatchesMarker === true &&
              sample?.activeRenderedTargetVisibleAfterMarker === true &&
              sample?.contextMenuVisible === true &&
              sample?.contextMenuSourceReviewId !== "" &&
              sample?.contextMenuItemCount > 0 &&
              sample?.contextMenuHasCaptureArea === true &&
              sample?.contextMenuHasReferencedCapture === true &&
              sample?.assetVisible === false &&
              sample?.navigationVisible === true &&
              sample?.refreshVisible === true
            );
          })
        : true,
    hasSourceControlAllDiffsMouseGestures:
      scenario === "viewer-source-control-all-diffs-mouse-gestures"
        ? await page.evaluate(() => {
            const result = window.__SVARD_ALL_DIFFS_MOUSE_GESTURE_SAMPLE__;
            return (
              result?.afterRight?.activeLabel === "Go to change 2" &&
              result?.afterRight?.lastGesture?.pattern === "Right" &&
              result?.afterRight?.lastGesture?.commandId ===
                "navigation.forward" &&
              result?.afterRight?.lastGesture?.status === "handled" &&
              result?.afterLeft?.activeLabel === "Go to change 1" &&
              result?.afterLeft?.lastGesture?.pattern === "Left" &&
              result?.afterLeft?.lastGesture?.commandId === "navigation.back" &&
              result?.afterLeft?.lastGesture?.status === "handled" &&
              result?.afterDown?.scrollTop > 0 &&
              result?.afterDown?.lastGesture?.pattern === "Down" &&
              result?.afterDown?.lastGesture?.commandId === "viewer.bottom" &&
              result?.afterDown?.lastGesture?.status === "handled" &&
              result?.afterUp?.scrollTop === 0 &&
              result?.afterUp?.lastGesture?.pattern === "Up" &&
              result?.afterUp?.lastGesture?.commandId === "viewer.top" &&
              result?.afterUp?.lastGesture?.status === "handled" &&
              result?.afterClose?.panelCount === 0 &&
              result?.afterClose?.lastGesture?.pattern === "Down Right" &&
              result?.afterClose?.lastGesture?.commandId === "tab.close" &&
              result?.afterClose?.lastGesture?.status === "handled"
            );
          })
        : true,
    hasSourceControlAllDiffsKeybindings:
      scenario === "viewer-source-control-all-diffs-keybindings"
        ? await page.evaluate(() => {
            const result = window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__;
            return (
              result?.activeLabel === "Go to change 1" &&
              result?.bottomStatus === "handled" &&
              (result?.scrollable === true
                ? result?.afterBottom > 0
                : result?.afterBottom === 0) &&
              result?.topStatus === "handled" &&
              result?.afterTop === 0 &&
              result?.closeStatus === "handled" &&
              result?.panelCount === 0
            );
          })
        : true,
    hasSourceControlAllDiffsKeybindingNavigation:
      scenario === "viewer-source-control-all-diffs-keybindings"
        ? await page.evaluate(() => {
            const result = window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__;
            return result?.activeLabel === "Go to change 1";
          })
        : true,
    hasSourceControlAllDiffsKeybindingScroll:
      scenario === "viewer-source-control-all-diffs-keybindings"
        ? await page.evaluate(() => {
            const result = window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__;
            return (
              result?.bottomStatus === "handled" &&
              (result?.scrollable === true
                ? result?.afterBottom > 0
                : result?.afterBottom === 0) &&
              result?.topStatus === "handled" &&
              result?.afterTop === 0
            );
          })
        : true,
    hasSourceControlAllDiffsKeybindingClose:
      scenario === "viewer-source-control-all-diffs-keybindings"
        ? await page.evaluate(() => {
            const result = window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__;
            return (
              result?.closeStatus === "handled" && result?.panelCount === 0
            );
          })
        : true,
    hasSourceControlAllDiffsPrivacy:
      scenario === "viewer-source-control-all-diffs-privacy"
        ? await page.evaluate(() => {
            const sample = window.__SVARD_ALL_DIFFS_STREAM_SAMPLE__;
            return (
              sample?.panelVisible === true &&
              sample?.privatePathVisible === false
            );
          })
        : true,
    hasReviewWatchModeActiveDiff:
      scenario === "viewer-review-watch-mode-active-diff"
        ? await page.evaluate(() => {
            const sample = window.__SVARD_REVIEW_WATCH_ACTIVE_DIFF_SAMPLE__;
            return (
              sample?.staleVisible === "Stale" &&
              sample?.refreshVisible === true &&
              sample?.initialActiveLabel === sample?.activeLabel
            );
          })
        : true,
    hasReviewWatchModeRefreshPreview:
      scenario === "viewer-review-watch-mode-refresh-preview"
        ? await page.evaluate(() => {
            const sample = window.__SVARD_REVIEW_WATCH_ACTIVE_DIFF_SAMPLE__;
            return (
              sample?.staleVisible === "" &&
              sample?.refreshedTextVisible === true &&
              sample?.activeMarkerPresent === true
            );
          })
        : true,
    hasSourceControlBranchDiff:
      scenario === "viewer-source-control-branch-diff" ||
      scenario === "viewer-source-control-branch-diff-provider-fallback"
        ? bodyText.includes("Source Control") &&
          bodyText.includes("Branch Diff") &&
          bodyText.includes("origin/main") &&
          bodyText.includes("git-modified.md") &&
          (await page
            .locator('[data-review-id="source-control-branch-diff-item"]')
            .count()) > 0
        : true,
    hasSourceControlBranchDiffProviderBase:
      scenario === "viewer-source-control-branch-diff-provider-base"
        ? bodyText.includes("Source Control") &&
          bodyText.includes("Branch Diff") &&
          bodyText.includes("PR target: origin/main") &&
          bodyText.includes("git-modified.md") &&
          (await page
            .locator('[data-review-id="source-control-branch-diff-base"]')
            .filter({ hasText: "PR target: origin/main" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="source-control-branch-diff-item"]')
            .count()) > 0
        : true,
    hasSourceControlGraph:
      scenario === "viewer-source-control-graph" ||
      scenario === "viewer-source-control-repo-graph-load-more"
        ? bodyText.includes("Source Control") &&
          bodyText.includes("Repo Graph") &&
          bodyText.includes("1111111") &&
          bodyText.includes("docs: add rendered preview diff goal") &&
          (await page
            .locator('[data-review-id="source-control-head-commit"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="timeline-item"]').count()) > 0
        : true,
    hasGitTimelineCompare:
      scenario === "viewer-git-timeline-compare-commit" ||
      scenario === "viewer-git-timeline-vscode-left-click" ||
      scenario === "viewer-git-timeline-select-compare"
        ? bodyText.includes("0000000") &&
          bodyText.includes("1111111") &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-full-preview-left-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-full-preview-right-pane"]')
            .count()) === 1
        : true,
    hasGitTimelineContextMenu:
      scenario === "viewer-git-timeline-context-menu"
        ? bodyText.includes("Open Changes") &&
          bodyText.includes("View Commit") &&
          bodyText.includes("Select for Compare") &&
          bodyText.includes("Copy Commit ID")
        : true,
    hasGitCommitDetails:
      scenario === "viewer-git-timeline-view-commit"
        ? bodyText.includes("Changed Files") &&
          bodyText.includes("docs: add rendered preview diff goal") &&
          (await page
            .locator('[data-review-id="git-commit-details-file"]')
            .count()) > 0
        : true,
    hasGitRefCompare:
      scenario.startsWith("viewer-git-compare-") ||
      scenario === "viewer-git-ref-picker-load-more"
        ? (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-full-preview-left-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-full-preview-right-pane"]')
            .count()) === 1 &&
          bodyText.includes("Working Tree") &&
          (scenario === "viewer-git-compare-branch"
            ? bodyText.includes("branch:main")
            : scenario === "viewer-git-compare-tag"
              ? bodyText.includes("tag:v0.1.0")
              : scenario === "viewer-git-ref-picker-load-more"
                ? await page.evaluate(() => {
                    const sample =
                      window.__SVARD_GIT_REF_PICKER_LOAD_MORE_CHECK__;
                    return (
                      sample?.initialCount === 20 &&
                      sample?.loadedCount > sample.initialCount
                    );
                  })
                : bodyText.includes("1111111"))
        : true,
  };
}
