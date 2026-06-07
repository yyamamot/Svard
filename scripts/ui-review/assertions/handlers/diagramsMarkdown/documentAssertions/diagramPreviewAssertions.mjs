export async function buildDiagramPreviewAssertions({
  scenario,
  page,
  bodyText,
}) {
  return {
    hasDiagramPreviewPanel:
      scenario === "viewer-diagram-preview-panel" ||
      scenario === "viewer-diagram-lightbox"
        ? bodyText.includes("Mixed Diagram Japanese Sample") &&
          bodyText.includes("120%") &&
          (await page
            .locator('[data-review-id="diagram-preview-panel"].expanded')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-canvas"] svg')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-zoom-in"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-expand"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-close"]')
            .count()) === 1
        : true,
  };
}
