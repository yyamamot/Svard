export async function applyDiagramPreviewScenario(context) {
  const { scenario, page } = context;
  if (
    scenario !== "viewer-diagram-preview-panel" &&
    scenario !== "viewer-diagram-lightbox"
  ) {
    return false;
  }
  await page.locator('[data-review-id="file-tree"]').waitFor();
  await page.locator('[data-review-id="tree-collapse-all"]').click();
  await page
    .locator('[data-review-id="tree-folder-toggle"]')
    .filter({ hasText: "docs" })
    .click();
  await page
    .locator('[data-review-id="tree-folder-toggle"]')
    .filter({ hasText: "diagrams" })
    .click();
  await page
    .locator('[data-review-id="tree-file"]')
    .filter({ hasText: "diagrams-mixed-long-ja.adoc" })
    .click();
  await page.locator("text=Mixed Diagram Japanese Sample").waitFor();
  await page.locator('[data-review-id="mermaid-render"] svg').waitFor();
  const diagram = page
    .locator('[data-review-id="diagram-inline-image"]')
    .first();
  await diagram.scrollIntoViewIfNeeded();
  if (scenario === "viewer-diagram-lightbox") {
    await diagram.dblclick({ force: true });
  } else {
    await diagram.click({ button: "right", force: true });
    const openPreviewItem = page
      .locator('[data-review-id="context-menu-item-open-diagram-preview"]')
      .filter({ visible: true });
    await openPreviewItem.waitFor();
    await openPreviewItem.click({ force: true, timeout: 5000 });
  }
  await page.locator('[data-review-id="diagram-preview-panel"]').waitFor();
  await page.locator('[data-review-id="diagram-preview-canvas"] svg').waitFor();
  await page.locator('[data-review-id="diagram-preview-zoom-in"]').click();
  return true;
}
