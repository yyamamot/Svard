export const markerScenarios = new Set([
  "viewer-normal-git-markers-initial-working-tree-opt-in",
  "viewer-normal-git-markers-subtle",
  "viewer-change-review-revision-lens",
  "viewer-normal-git-markers-after-diff-opt-in",
  "viewer-normal-git-markers-disabled",
  "viewer-normal-git-markers-no-prior-diff",
  "viewer-normal-git-markers-context-clear",
  "viewer-normal-git-markers-privacy",
  "viewer-normal-git-markers-list-item-initial-working-tree",
  "viewer-normal-git-markers-list-item-after-diff",
  "viewer-normal-git-markers-list-item-deletion-fallback",
  "viewer-normal-git-markers-list-item-privacy",
  "viewer-normal-git-markers-table-row-cell-initial-working-tree",
  "viewer-normal-git-markers-table-row-cell-after-diff",
  "viewer-normal-git-markers-table-cell-markdown-diagnosis",
  "viewer-normal-git-markers-table-cell-asciidoc-regression",
  "viewer-normal-git-markers-table-cell-untracked-not-applicable",
  "viewer-normal-git-markers-table-cell-complex-fallback",
  "viewer-normal-git-markers-git-refresh-stability",
  "viewer-normal-git-markers-git-commit-clean-stability",
  "viewer-git-change-visual-contract-block",
  "viewer-git-change-visual-contract-list-item",
  "viewer-git-change-visual-contract-inline",
  "viewer-git-change-visual-contract-deletion-fallback",
]);

export async function enablePostDiffGitMarkers(page) {
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

export async function selectSubtleChangeReviewDisplay(page) {
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("preferences.open"),
  );
  await page.locator('[data-review-id="preferences-tab-general"]').waitFor();
  await page
    .locator('[data-review-id="change-review-display-control"] label', {
      hasText: "Subtle",
    })
    .click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("preferences.close"),
  );
}

export async function selectDetailedChangeReviewDisplay(page) {
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("preferences.open"),
  );
  await page.locator('[data-review-id="preferences-tab-general"]').waitFor();
  await page
    .locator('[data-review-id="change-review-display-control"] label', {
      hasText: "Detailed",
    })
    .click();
  await page.evaluate(() =>
    window.__SVARD_COMMANDS__?.dispatch("preferences.close"),
  );
}

export async function pressRevisionLensMarker(
  page,
  marker,
  status,
  release = true,
) {
  const box = await marker.boundingBox();
  if (!box) {
    throw new Error("Revision Lens marker is not visible.");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page
    .locator(
      `[data-review-id="revision-lens-replacement"][data-revision-lens-status="${status}"]`,
    )
    .waitFor();
  if (release) {
    await page.mouse.up();
    await page
      .locator('[data-review-id="revision-lens-replacement"]')
      .waitFor({ state: "detached" });
  }
}
