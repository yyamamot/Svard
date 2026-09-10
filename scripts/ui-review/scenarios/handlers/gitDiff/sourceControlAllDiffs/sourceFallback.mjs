export async function applyTooComplexSourceFallbackScenario(page) {
  await page.evaluate(() => {
    window.__SVARD_TOO_COMPLEX_GIT_DIFF_FIXTURE__ = true;
    window.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ = 0;
  });
  await page.locator('[data-review-id="sidebar-tab-source-control"]').click();
  await page
    .locator('[data-review-id="source-control-changes-list"]')
    .waitFor();
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  const blocker = page.locator(
    '[data-review-id="diff-stream-too-complex-blocker"]',
  );
  await blocker.waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .waitFor();
  await page.waitForTimeout(850);

  const blockerSection = blocker.locator(
    'xpath=ancestor::*[@data-review-id="diff-stream-file-section"]',
  );
  const reviewState =
    (await blockerSection
      .locator('[data-review-id="document-review-state"]')
      .textContent()) ?? "";
  const allDiffsState = {
    blockerVisible: await blocker.isVisible(),
    otherSectionRendered:
      (await page
        .locator('[data-review-id="diff-stream-rendered-block"]')
        .count()) > 0,
    remainedUnreviewed: reviewState.trim() === "Unreviewed",
    requestCount: await page.evaluate(
      () => window.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ ?? 0,
    ),
  };

  await blocker
    .locator('[data-review-id="diff-stream-open-source-fallback"]')
    .click();
  await page.locator('[data-review-id="git-diff-source-only"]').waitFor();
  await page
    .locator('[data-review-id="git-diff-source-only-banner"]')
    .waitFor();
  await page.locator('[data-review-id="git-diff-left-pane"]').waitFor();
  await page.locator('[data-review-id="git-diff-right-pane"]').waitFor();

  await page.evaluate((streamState) => {
    const leftPane = document.querySelector(
      '[data-review-id="git-diff-left-pane"]',
    );
    const rightPane = document.querySelector(
      '[data-review-id="git-diff-right-pane"]',
    );
    const disabledViewIds = [
      "git-diff-overview-view",
      "git-diff-full-preview-view",
      "git-diff-rendered-view",
      "git-diff-table-view",
    ];
    const navigationButtons = Array.from(
      document.querySelectorAll(
        '[data-review-id="git-diff-change-navigation"] button',
      ),
    );
    window.__SVARD_TOO_COMPLEX_DIFF_FALLBACK_SAMPLE__ = {
      ...streamState,
      allDiffsClosed:
        document.querySelectorAll(
          '[data-review-id="source-control-all-diffs-panel"]',
        ).length === 0,
      bannerVisible:
        document
          .querySelector('[data-review-id="git-diff-source-only-banner"]')
          ?.textContent?.trim() ===
        "Change highlighting is unavailable for this comparison.",
      controlsDisabled: disabledViewIds.every((id) => {
        const control = document.querySelector(`[data-review-id="${id}"]`);
        return control instanceof HTMLButtonElement && control.disabled;
      }),
      leftLineNumbers:
        leftPane?.querySelectorAll(".git-diff-line-number").length ?? 0,
      leftSourceVisible:
        leftPane?.textContent?.includes("Original source remains readable.") ===
        true,
      navigationDisabled:
        navigationButtons.length === 2 &&
        navigationButtons.every(
          (button) => button instanceof HTMLButtonElement && button.disabled,
        ),
      requestCountAfterOpen:
        window.__SVARD_TOO_COMPLEX_GIT_DIFF_CALL_COUNT__ ?? 0,
      rightLineNumbers:
        rightPane?.querySelectorAll(".git-diff-line-number").length ?? 0,
      rightSourceVisible:
        rightPane?.textContent?.includes("Updated source remains readable.") ===
        true,
      rulerAbsent:
        document.querySelectorAll('[data-review-id="git-diff-change-ruler"]')
          .length === 0,
      sourceOnlyLabel:
        document
          .querySelector('[data-review-id="git-diff-change-count"]')
          ?.textContent?.trim() === "Source only",
      sourceOnlyVisible:
        document.querySelectorAll('[data-review-id="git-diff-source-only"]')
          .length === 1,
    };
  }, allDiffsState);
}
