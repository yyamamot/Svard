export async function applyAsciiDocScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (
    scenario === "viewer-asciidoc-standard-theme" ||
    scenario === "viewer-asciidoc-antora-theme" ||
    scenario === "viewer-asciidoc-theme-compare"
  ) {
    await page.locator("text=asciidoc-standard-theme.adoc").click();
    await page.locator("text=AsciiDoc Standard Theme Sample").waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-dialog"]').waitFor();
    await page
      .locator('[data-review-id="asciidoc-theme-control"]')
      .locator("label")
      .filter({
        hasText:
          scenario === "viewer-asciidoc-standard-theme"
            ? "Asciidoctor"
            : "Antora",
      })
      .click();
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    const themeClass =
      scenario === "viewer-asciidoc-standard-theme"
        ? "asciidoc-theme-asciidoctor"
        : "asciidoc-theme-antora";
    await page
      .locator(`.document-body.format-asciidoc.${themeClass} h1`)
      .waitFor();
    await page
      .locator(
        ".document-body.format-asciidoc .admonitionblock.note .icon-note",
      )
      .waitFor();
    await page
      .locator(".document-body.format-asciidoc table.tableblock caption.title")
      .first()
      .waitFor();
    await page
      .locator(".document-body.format-asciidoc .exampleblock > .title")
      .waitFor();
  } else if (scenario === "viewer-render-fixtures") {
    await page.locator("text=render-fixtures.adoc").click();
    await page.locator("text=Render Fixtures").waitFor();
    await page.getByRole("heading", { name: "Source Block" }).waitFor();
    await page.getByRole("heading", { name: "Admonition" }).waitFor();
    await page.getByRole("heading", { name: "Table" }).waitFor();
    await page.getByRole("heading", { name: "Xref Target" }).waitFor();
  } else if (
    scenario === "viewer-asciidoc-include" ||
    scenario === "viewer-asciidoc-include-source-location" ||
    scenario === "viewer-asciidoc-include-leveloffset"
  ) {
    await page.locator("text=include-main.adoc").click();
    await page.getByRole("heading", { name: "Include Main" }).waitFor();
    await page.getByRole("heading", { name: "Antora Partial Title" }).waitFor();
    await page.getByRole("heading", { name: "Included Source" }).waitFor();
    await page.getByRole("heading", { name: "Scoped Partial Title" }).waitFor();
    await page.getByRole("heading", { name: "Parent After Include" }).waitFor();
    if (scenario === "viewer-asciidoc-include-source-location") {
      await page
        .locator('[data-source-reference*="partials/antora-partial.adoc"]')
        .first()
        .waitFor();
    }
  } else if (scenario === "viewer-asciidoc-include-diagnostics") {
    await page.locator("text=include-diagnostics.adoc").click();
    await page.locator("text=Include Diagnostics").waitFor();
    await page.locator("text=Include file not found").waitFor();
    await page.locator("text=Unsupported or unsafe include target").waitFor();
    await page.locator("text=top-level title without leveloffset").waitFor();
  } else if (scenario === "viewer-asciidoc-include-text-files") {
    await page.locator("text=include-text-files.adoc").click();
    await page.getByRole("heading", { name: "Text Include Files" }).waitFor();
    await page.locator("text=Synthetic Svard service").waitFor();
    await page.locator("text=start helper").waitFor();
    await page.locator("text=FEATURE_FLAG=true").waitFor();
  } else if (
    scenario === "viewer-asciidoc-conditional-include" ||
    scenario === "viewer-asciidoc-ifeval-include" ||
    scenario === "viewer-asciidoc-attribute-include-target"
  ) {
    await page.locator("text=conditional-include.adoc").click();
    await page
      .getByRole("heading", {
        name: "Conditional Include Compatibility Sample",
      })
      .waitFor();
    await page
      .getByRole("heading", { name: "Feature Preview Branch" })
      .waitFor();
    await page.getByRole("heading", { name: "Modern Mode Branch" }).waitFor();
    await page
      .getByRole("heading", { name: "Production Target Branch" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Propagated Attribute Include" })
      .waitFor();
  } else if (
    scenario === "viewer-cross-platform-local-assets" ||
    scenario === "viewer-image-svg-preview-selectable-text" ||
    scenario === "viewer-image-context-menu" ||
    scenario === "viewer-image-lightbox"
  ) {
    await page.locator("text=cross-platform-local-assets.adoc").click();
    await page
      .getByRole("heading", { name: "Cross-platform Local Assets" })
      .waitFor();
    await page.getByRole("heading", { name: "Sibling Include" }).waitFor();
    await page
      .getByRole("heading", { name: "Local Workspace Image" })
      .waitFor();
    const image = page.locator('img[src^="data:image/svg+xml"]').first();
    await image.waitFor();
    if (scenario === "viewer-image-context-menu") {
      await image.click({ button: "right", force: true });
      await page
        .locator(
          '[data-review-id="context-menu-item-copy-image-with-reference"]',
        )
        .waitFor();
      await page
        .locator('[data-review-id="context-menu-item-copy-image-path"]')
        .waitFor();
    } else if (scenario === "viewer-image-lightbox") {
      await image.dblclick({ force: true });
      await page.locator('[data-review-id="diagram-preview-panel"]').waitFor();
      await page
        .locator('[data-review-id="image-svg-preview-content"] svg text')
        .filter({ hasText: "Workspace image" })
        .waitFor();
      await page.locator('[data-review-id="diagram-preview-zoom-in"]').click();
    } else if (scenario === "viewer-image-svg-preview-selectable-text") {
      await image.click({ button: "right", force: true });
      const openPreviewItem = page.getByRole("menuitem", {
        name: "Open Preview",
      });
      await openPreviewItem.waitFor();
      await openPreviewItem.click({ force: true });
      await page.locator('[data-review-id="diagram-preview-panel"]').waitFor();
      await page
        .locator('[data-review-id="image-svg-preview-content"] svg text')
        .filter({ hasText: "Workspace image" })
        .waitFor();
      await page.locator('[data-review-id="diagram-preview-zoom-in"]').click();
    }
  } else if (scenario === "viewer-asciidoc-project-context-assets") {
    await page.getByRole("button", { name: "book" }).click();
    await page.getByRole("button", { name: "sections" }).click();
    await page
      .getByRole("button", { name: "project-context-assets.adoc" })
      .click();
    await page
      .getByRole("heading", { name: "Project Context Assets" })
      .waitFor();
    await page.getByRole("heading", { name: "Root Image" }).waitFor();
    await page.locator('img[src^="data:image/svg+xml"]').waitFor();
  } else if (scenario === "viewer-antora-module-local-assets") {
    await page.locator("text=modules").click();
    await page.locator("text=module-a").click();
    await page.locator("text=pages").click();
    await page.locator("text=index.adoc").click();
    await page
      .getByRole("heading", { name: "Antora Module Local Assets" })
      .waitFor();
    await page.getByRole("heading", { name: "Module Header" }).waitFor();
    await page
      .getByRole("heading", { name: "Primary / Secondary Diagram" })
      .waitFor();
    await page.locator('img[src^="data:image/svg+xml"]').waitFor();
  } else if (scenario === "viewer-asciidoc-antora-static-attributes") {
    await page.locator("text=modules").click();
    await page.locator("text=module-a").click();
    await page.locator("text=pages").click();
    await page.locator("text=static-attributes.adoc").click();
    await page
      .getByRole("heading", { name: "Antora Static Attribute Context" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Static Attribute Partial" })
      .waitFor();
    await page.getByRole("heading", { name: "Static Image" }).waitFor();
    await page.locator('img[src^="data:image/svg+xml"]').waitFor();
  } else if (scenario === "viewer-asciidoc-comprehensive-visual") {
    await page.locator("text=asciidoc-comprehensive-visual.adoc").click();
    await page
      .getByRole("heading", { name: "AsciiDoc Comprehensive Visual Sample" })
      .waitFor();
    await page.getByRole("heading", { name: "Source Blocks" }).waitFor();
    await page.getByRole("heading", { name: "Mermaid Flowchart" }).waitFor();
    await page
      .getByRole("heading", { name: "Mermaid Class Diagram" })
      .waitFor();
    await page.getByRole("heading", { name: "PlantUML Sequence" }).waitFor();
    await page.getByRole("heading", { name: "PlantUML Activity" }).waitFor();
    await page
      .getByRole("heading", { name: "C4 PlantUML Diagnostic" })
      .waitFor();
    await page.locator('img[src^="data:image/svg+xml"]').waitFor();
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
    await page
      .locator('[data-review-id="plantuml-render"] svg')
      .first()
      .waitFor();
    await page
      .locator('[data-review-id="diagram-inline-diagnostic"]')
      .first()
      .waitFor();
    await page.getByRole("heading", { name: "Image" }).scrollIntoViewIfNeeded();
  } else if (scenario === "viewer-asciidoc-active-content-boundary") {
    await page.locator("text=asciidoc-active-content-boundary.adoc").click();
    await page
      .getByRole("heading", { name: "AsciiDoc Active Content Boundary" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Ordinary AsciiDoc remains visible" })
      .waitFor();
  } else {
    return false;
  }
  return true;
}
