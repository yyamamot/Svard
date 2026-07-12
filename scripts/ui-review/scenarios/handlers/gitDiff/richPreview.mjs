export async function applyGitDiffRichPreviewScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-diff-preview-regression-suite") {
    await page.locator("text=diff-regression-gallery.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Diff Preview Regression Gallery" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-diff-word-highlight"]')
      .first()
      .waitFor();
  } else if (
    scenario === "viewer-diff-local-image-preview" ||
    scenario === "viewer-diff-same-path-image-revision" ||
    scenario === "viewer-diff-image-preview"
  ) {
    await page.locator("text=git-rendered-images.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Local Image Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-full-preview-diff"] img[data-image-path]')
      .first()
      .waitFor();
    if (scenario === "viewer-diff-image-preview") {
      await page
        .locator(
          '[data-review-id="git-full-preview-diff"] img[src^="data:image/svg+xml"]',
        )
        .first()
        .click({ button: "right", force: true });
      const openPreviewItem = page.getByRole("menuitem", {
        name: "Open Preview",
      });
      await openPreviewItem.waitFor();
      await openPreviewItem.click({ force: true });
      await page.locator('[data-review-id="diagram-preview-panel"]').waitFor();
      await page
        .locator('[data-review-id="image-svg-preview-content"] svg')
        .waitFor();
    }
  } else if (
    scenario === "viewer-diff-diagram-rendered-preview" ||
    scenario === "viewer-diff-diagram-before-after-preview"
  ) {
    await page.locator("text=git-rendered-diagram.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Diagram Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-full-preview-diff"]')
      .locator('[data-review-id="mermaid-render"]')
      .first()
      .waitFor();
    if (
      scenario === "viewer-diff-diagram-rendered-preview" ||
      scenario === "viewer-diff-diagram-before-after-preview"
    ) {
      await page
        .locator(
          '[data-review-id="git-full-preview-diff"] [data-review-id="diagram-inline-image"]',
        )
        .first()
        .click({ button: "right" });
      const openPreviewItem = page.getByRole("menuitem", {
        name: "Open Preview",
      });
      await openPreviewItem.waitFor();
      await openPreviewItem.click({ force: true });
      await page.locator('[data-review-id="diagram-preview-panel"]').waitFor();
      if (scenario === "viewer-diff-diagram-before-after-preview") {
        await page
          .locator('[data-review-id="diagram-preview-comparison"]')
          .waitFor();
        await page
          .locator('[data-review-id="diagram-preview-comparison-before"] svg')
          .waitFor();
        await page
          .locator('[data-review-id="diagram-preview-comparison-after"] svg')
          .waitFor();
      } else {
        await page
          .locator('[data-review-id="diagram-preview-canvas"] svg')
          .waitFor();
      }
    }
  } else if (scenario === "viewer-diff-diagram-preview-escape-stack") {
    await page.locator("text=git-rendered-diagram.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Diagram Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    const diffPanel = page.locator('[data-review-id="git-diff-preview-panel"]');
    const diagramPanel = page.locator(
      '[data-review-id="diagram-preview-panel"]',
    );
    await diffPanel.waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator(
        '[data-review-id="git-full-preview-diff"] [data-review-id="diagram-inline-image"]',
      )
      .first()
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Open Preview" }).click({
      force: true,
    });
    await diagramPanel.waitFor();
    await page.keyboard.press("Escape");
    await diagramPanel.waitFor({ state: "hidden" });
    await diffPanel.waitFor();
    await page.keyboard.press("Escape");
    await diffPanel.waitFor({ state: "hidden" });
  } else if (scenario === "viewer-diff-math-rendering") {
    await page.locator("text=git-rendered-math.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Math Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-full-preview-diff"] .math-inline .katex')
      .first()
      .waitFor();
    await page
      .locator(
        '[data-review-id="git-full-preview-diff"] [data-review-id="math-block"] .katex',
      )
      .first()
      .waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-rendered-diff"] .math-inline .katex')
      .first()
      .waitFor();
  } else if (scenario === "viewer-diff-rich-asciidoc-preview") {
    await page.locator("text=git-rendered-rich-asciidoc.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered Rich AsciiDoc Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-full-preview-diff"] .admonitionblock')
      .first()
      .waitFor();
  } else if (scenario === "viewer-rendered-diff-placeholder-grouping") {
    await page.locator("text=diff-regression-gallery.md").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Diff Preview Regression Gallery" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    await page.locator('[data-review-id="git-diff-rendered-view"]').click();
    await page.locator('[data-review-id="git-rendered-diff"]').waitFor();
    await page
      .locator('[data-review-id="git-rendered-placeholder-group"]')
      .first()
      .waitFor();
  } else if (
    scenario === "viewer-diff-full-preview-asciidoc" ||
    scenario === "viewer-diff-full-preview-overview-jump"
  ) {
    await page.locator("text=git-rendered-asciidoc.adoc").click();
    await page
      .locator('[data-review-id="document-body"]')
      .filter({ hasText: "Git Rendered AsciiDoc Diff Fixture" })
      .waitFor();
    await page.evaluate(() =>
      window.__SVARD_COMMANDS__?.dispatch("git.showDiff"),
    );
    await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
    if (scenario === "viewer-diff-full-preview-overview-jump") {
      await page.locator('[data-review-id="git-diff-overview-view"]').click();
      await page
        .locator('[data-review-id="git-diff-overview-jump-preview"]')
        .first()
        .click();
    }
    await page.locator('[data-review-id="git-full-preview-diff"]').waitFor();
  } else {
    return false;
  }
  return true;
}
