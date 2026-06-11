export async function buildAsciiDocAssertions({
  scenario,
  page,
  bodyText,
  documentText,
  asciiDocThemeGeometry,
  antoraImageFitsReader,
}) {
  return {
    hasRenderFixtures:
      scenario === "viewer-render-fixtures"
        ? bodyText.includes("Source Block") &&
          bodyText.includes("Admonition") &&
          bodyText.includes("Table") &&
          bodyText.includes("Xref Target") &&
          bodyText.includes("Local document link") &&
          (await page.locator("[data-copy-source-button]").count()) >= 2
        : true,
    hasAsciiDocInclude:
      scenario === "viewer-asciidoc-include"
        ? bodyText.includes("Include Main") &&
          bodyText.includes("Antora Partial Title") &&
          bodyText.includes("Scoped Partial Title") &&
          bodyText.includes("Parent After Include") &&
          !(await documentText()).includes(":leveloffset:") &&
          !(await documentText()).includes(":doctype:") &&
          !(await documentText()).includes(":imagesdir:") &&
          (await page.locator("[data-copy-source-button]").count()) >= 1
        : true,
    hasAsciiDocIncludeSourceLocation:
      scenario === "viewer-asciidoc-include-source-location"
        ? (await page
            .locator('[data-source-reference*="partials/antora-partial.adoc"]')
            .count()) >= 2
        : true,
    hasAsciiDocIncludeLeveloffset:
      scenario === "viewer-asciidoc-include-leveloffset"
        ? (await documentText()).includes("Antora Partial Title") &&
          (await documentText()).includes("Included Source") &&
          (await documentText()).includes("Parent After Include") &&
          !(await documentText()).includes(":leveloffset:") &&
          !(await documentText()).includes(":doctype:") &&
          !(await documentText()).includes(":imagesdir:")
        : true,
    hasAsciiDocIncludeDiagnostics:
      scenario === "viewer-asciidoc-include-diagnostics"
        ? bodyText.includes("Include file not found") &&
          bodyText.includes("Unsupported or unsafe include target") &&
          bodyText.includes("top-level title without leveloffset") &&
          bodyText.includes("Unadjusted Standalone Title")
        : true,
    hasAsciiDocIncludeTextFiles:
      scenario === "viewer-asciidoc-include-text-files"
        ? bodyText.includes("Text Include Files") &&
          bodyText.includes("Synthetic Svard service") &&
          bodyText.includes("ExecStart=/usr/bin/svard-example") &&
          bodyText.includes("echo") &&
          bodyText.includes("FEATURE_FLAG=true") &&
          !bodyText.includes("Nested Script Include") &&
          !bodyText.includes("Include file not found or not allowed")
        : true,
    hasAsciiDocConditionalInclude:
      scenario === "viewer-asciidoc-conditional-include" ||
      scenario === "viewer-asciidoc-ifeval-include" ||
      scenario === "viewer-asciidoc-attribute-include-target"
        ? bodyText.includes("Conditional Include Compatibility Sample") &&
          bodyText.includes("Feature Preview Branch") &&
          bodyText.includes("Modern Mode Branch") &&
          bodyText.includes("Production Target Branch") &&
          bodyText.includes("Propagated Attribute Include") &&
          !bodyText.includes("Feature Disabled Branch") &&
          !bodyText.includes("Legacy Mode Branch") &&
          !bodyText.includes("Development Target Branch") &&
          !bodyText.includes("Include file not found or not allowed")
        : true,
    hasCrossPlatformLocalAssets:
      scenario === "viewer-cross-platform-local-assets"
        ? bodyText.includes("Cross-platform Local Assets") &&
          bodyText.includes("Sibling Include") &&
          bodyText.includes("This partial lives outside docs") &&
          bodyText.includes("Local Workspace Image") &&
          (await page.locator('img[src^="data:image/svg+xml"]').count()) >= 1 &&
          !bodyText.includes("Local image is not available") &&
          !bodyText.includes("Unsupported or unsafe include target")
        : true,
    hasSvgImagePreviewSelectableText:
      scenario === "viewer-image-svg-preview-selectable-text" ||
      scenario === "viewer-image-lightbox"
        ? bodyText.includes("Cross-platform Local Assets") &&
          (await page
            .locator('[data-review-id="diagram-preview-panel"].expanded')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="image-svg-preview-content"] svg text')
            .filter({ hasText: "Workspace image" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-zoom-in"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-preview-close"]')
            .count()) === 1 &&
          (await page
            .locator(
              '[data-review-id="image-svg-preview-content"] [onclick], [data-review-id="image-svg-preview-content"] foreignObject, [data-review-id="image-svg-preview-content"] script',
            )
            .count()) === 0
        : true,
    hasAsciiDocProjectContextAssets:
      scenario === "viewer-asciidoc-project-context-assets"
        ? bodyText.includes("Project Context Assets") &&
          bodyText.includes("Root Image") &&
          (await page.locator('img[src^="data:image/svg+xml"]').count()) >= 1 &&
          !bodyText.includes("Local image is not available") &&
          !bodyText.includes("Unsupported or unsafe include target")
        : true,
    hasAntoraModuleLocalAssets:
      scenario === "viewer-antora-module-local-assets"
        ? bodyText.includes("Antora Module Local Assets") &&
          bodyText.includes("Module Header") &&
          bodyText.includes("This partial defines an imagesdir") &&
          bodyText.includes("Primary / Secondary Diagram") &&
          (await page.locator('img[src^="data:image/svg+xml"]').count()) >= 1 &&
          antoraImageFitsReader &&
          !bodyText.includes("Local image is not available") &&
          !bodyText.includes("Unsupported or unsafe include target")
        : true,
    hasAsciiDocStandardTheme:
      scenario === "viewer-asciidoc-standard-theme"
        ? bodyText.includes("AsciiDoc Standard Theme Sample") &&
          bodyText.includes("Lists And Terms") &&
          bodyText.includes("Quote And Verse") &&
          bodyText.includes("Captioned Table") &&
          asciiDocThemeGeometry !== null &&
          asciiDocThemeGeometry.className.includes(
            "asciidoc-theme-asciidoctor",
          ) &&
          !asciiDocThemeGeometry.className.includes("asciidoc-theme-antora") &&
          asciiDocThemeGeometry.capped &&
          asciiDocThemeGeometry.contentWidth <= 1001 &&
          asciiDocThemeGeometry.centered &&
          /Noto Serif|DejaVu Serif|Georgia|Times New Roman/i.test(
            asciiDocThemeGeometry.fontFamily,
          ) &&
          /Noto Serif|DejaVu Serif|Georgia|Times New Roman/i.test(
            asciiDocThemeGeometry.headingFontFamily,
          ) &&
          (!asciiDocThemeGeometry.hasHeadingLink ||
            (asciiDocThemeGeometry.headingColor ===
              asciiDocThemeGeometry.headingLinkColor &&
              asciiDocThemeGeometry.headingLinkTextDecoration === "none")) &&
          asciiDocThemeGeometry.groupedTableDisplay === "table" &&
          asciiDocThemeGeometry.groupedTableRowspan === "3" &&
          asciiDocThemeGeometry.groupedTableCellBorderStyle === "solid" &&
          parseFloat(asciiDocThemeGeometry.groupedTableCellBorderWidth) >= 1 &&
          asciiDocThemeGeometry.groupedTableHeaderBackground !==
            "rgba(0, 0, 0, 0)" &&
          parseFloat(asciiDocThemeGeometry.lineHeight) >= 24 &&
          parseFloat(asciiDocThemeGeometry.paragraphMarginBottom) >= 16 &&
          (await page
            .locator(".document-body.format-asciidoc .admonitionblock")
            .count()) === 5 &&
          (await page
            .locator(
              ".document-body.format-asciidoc .admonitionblock .icon-note",
            )
            .count()) === 1 &&
          (await page
            .locator(
              ".document-body.format-asciidoc .admonitionblock .icon-tip",
            )
            .count()) === 1 &&
          (await page
            .locator(
              ".document-body.format-asciidoc .admonitionblock .icon-important",
            )
            .count()) === 1 &&
          (await page
            .locator(
              ".document-body.format-asciidoc .admonitionblock .icon-warning",
            )
            .count()) === 1 &&
          (await page
            .locator(
              ".document-body.format-asciidoc .admonitionblock .icon-caution",
            )
            .count()) === 1 &&
          (await page
            .locator(
              ".document-body.format-asciidoc table.tableblock caption.title",
            )
            .count()) >= 1 &&
          (await page
            .locator(".document-body.format-asciidoc .exampleblock > .title")
            .count()) >= 1 &&
          (await page
            .locator(".document-body.format-asciidoc .dlist dt")
            .count()) >= 2 &&
          (await page
            .locator(".document-body.format-asciidoc .quoteblock")
            .count()) >= 1 &&
          (await page
            .locator(".document-body.format-asciidoc .verseblock")
            .count()) >= 1 &&
          (await page
            .locator(
              '.document-body.format-asciidoc img[alt="Theme sample image"][src^="data:image/svg+xml"]',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '.document-body.format-asciidoc .imageblock:has(img[alt="Theme sample image"]) .image-placeholder',
            )
            .count()) === 0 &&
          !bodyText.includes("Local image is not available")
        : true,
    hasAsciiDocAntoraTheme:
      scenario === "viewer-asciidoc-antora-theme"
        ? bodyText.includes("AsciiDoc Standard Theme Sample") &&
          bodyText.includes("Lists And Terms") &&
          bodyText.includes("Quote And Verse") &&
          asciiDocThemeGeometry !== null &&
          asciiDocThemeGeometry.className.includes("asciidoc-theme-antora") &&
          asciiDocThemeGeometry.capped &&
          asciiDocThemeGeometry.contentWidth <= 1025 &&
          asciiDocThemeGeometry.centered &&
          /Noto Sans|DejaVu Sans|Inter|system-ui|sans-serif/i.test(
            asciiDocThemeGeometry.fontFamily,
          ) &&
          /Noto Sans|DejaVu Sans|Inter|system-ui|sans-serif/i.test(
            asciiDocThemeGeometry.headingFontFamily,
          ) &&
          parseFloat(asciiDocThemeGeometry.lineHeight) >= 24 &&
          asciiDocThemeGeometry.groupedTableDisplay === "table" &&
          asciiDocThemeGeometry.groupedTableRowspan === "3" &&
          asciiDocThemeGeometry.groupedTableCellBorderStyle === "solid" &&
          parseFloat(asciiDocThemeGeometry.groupedTableCellBorderWidth) >= 1 &&
          (await page
            .locator(".document-body.asciidoc-theme-antora h2")
            .count()) >= 1 &&
          (await page
            .locator(".document-body.asciidoc-theme-antora .admonitionblock")
            .count()) === 5 &&
          (await page
            .locator(".document-body.asciidoc-theme-antora .dlist dt")
            .count()) >= 2 &&
          (await page
            .locator(
              '.document-body.asciidoc-theme-antora img[alt="Theme sample image"][src^="data:image/svg+xml"]',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '.document-body.asciidoc-theme-antora .imageblock:has(img[alt="Theme sample image"]) .image-placeholder',
            )
            .count()) === 0 &&
          !bodyText.includes("Local image is not available")
        : true,
    hasAsciiDocThemeCompare:
      scenario === "viewer-asciidoc-theme-compare"
        ? bodyText.includes("AsciiDoc Standard Theme Sample") &&
          asciiDocThemeGeometry !== null &&
          asciiDocThemeGeometry.className.includes("asciidoc-theme-antora") &&
          (await page
            .locator(".document-body.format-asciidoc.asciidoc-theme-antora")
            .count()) === 1
        : true,
    hasAsciiDocComprehensiveVisual:
      scenario === "viewer-asciidoc-comprehensive-visual"
        ? bodyText.includes("AsciiDoc Comprehensive Visual Sample") &&
          bodyText.includes("Nested Heading") &&
          bodyText.includes("Admonitions") &&
          bodyText.includes("Explicit Xref Target") &&
          bodyText.includes("Unsupported Diagram Diagnostic") &&
          bodyText.includes("C4 PlantUML Diagnostic") &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg')
            .count()) >= 8 &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) >= 7 &&
          (await page
            .locator(
              '.document-body.format-asciidoc img[alt="Svard local image"][src^="data:image/svg+xml"]',
            )
            .count()) === 1 &&
          (await page
            .locator(
              '.document-body.format-asciidoc .imageblock:has(img[alt="Svard local image"]) .image-placeholder',
            )
            .count()) === 0 &&
          (await page.locator("[data-copy-source-button]").count()) >= 3 &&
          (await page.locator("[data-copy-source-location-button]").count()) >=
            3 &&
          (await page
            .locator('[data-review-id="diagram-inline-diagnostic"]')
            .count()) >= 2 &&
          !bodyText.includes("Local image is not available") &&
          !bodyText.includes("@startuml") &&
          !bodyText.includes("flowchart LR")
        : true,
  };
}
