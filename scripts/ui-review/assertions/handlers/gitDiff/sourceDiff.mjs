export async function buildGitDiffSourceDiffAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;

  return {
    hasGitDiffPreview:
      scenario === "viewer-git-diff-preview"
        ? bodyText.includes("docs/git-modified.md") &&
          bodyText.includes("Modified") &&
          bodyText.includes("two-pane Git diff preview") &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-left-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-right-pane"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="git-diff-line"]').count()) > 0
        : true,
    hasZenModeDiffPreview:
      scenario === "viewer-zen-mode-diff-preview"
        ? await page.evaluate(() => {
            const result = window.__SVARD_ZEN_DIFF_PREVIEW_CHECK__;
            return (
              result?.shellActive === true &&
              result?.panelChromeHidden === true &&
              result?.topbarCount === 0 &&
              (result?.toolbarDisplay === "none" ||
                result?.toolbarDisplay === null) &&
              (result?.changeRulerDisplay === "none" ||
                result?.changeRulerDisplay === null) &&
              result?.bodyHeight > result?.viewportHeight * 0.7
            );
          })
        : true,
    hasFileTreeGitBadgeOpenDiff:
      scenario === "viewer-file-tree-git-badge-open-diff"
        ? bodyText.includes("docs/git-modified.md") &&
          bodyText.includes("Modified") &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (
            (await page
              .locator(
                '[data-review-id="tree-file"][data-git-status="modified"] [data-review-id="git-status-diff-button"]',
              )
              .first()
              .getAttribute("aria-label")) ?? ""
          ).includes(
            "Modified in Git. Open rendered diff for git-modified.md",
          ) &&
          (await page
            .locator(
              '[data-review-id="tree-folder-toggle"] [data-review-id="git-status-diff-button"]',
            )
            .count()) === 0
        : true,
    hasOpenFilesGitBadgeOpenDiff:
      scenario === "viewer-open-files-git-badge-open-diff"
        ? bodyText.includes("docs/git-modified.md") &&
          bodyText.includes("Modified") &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="open-file-item"][data-git-status="modified"] [data-review-id="git-status-diff-button"]',
            )
            .count()) === 1
        : true,
    hasGitDiffCleanState:
      scenario === "viewer-git-diff-clean"
        ? bodyText.includes("Clean") &&
          bodyText.includes("No working tree changes") &&
          (await page
            .locator('[data-review-id="git-diff-empty-state"]')
            .count()) === 1
        : true,
    hasGitDiffUntrackedPreview:
      scenario === "viewer-git-diff-untracked"
        ? bodyText.includes("Untracked") &&
          bodyText.includes("not tracked by HEAD") &&
          (await page
            .locator('[data-review-id="git-diff-preview-panel"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="git-diff-right-pane"]')
            .count()) === 1
        : true,
  };
}
